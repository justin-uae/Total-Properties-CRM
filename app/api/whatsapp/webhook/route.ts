import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function verifyMetaSignature(raw: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  if (!appSecret) return true; // allow local development if not configured
  if (!signature?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN || '';
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const verify = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && verify === token) return new NextResponse(challenge || '', { status: 200 });
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
  }
  const body = JSON.parse(raw);
  const messages = body.entry?.flatMap((entry: any) => entry.changes || [])?.flatMap((change: any) => change.value?.messages || []) || [];
  for (const msg of messages) {
    const from = msg.from;
    const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '';
    const record = await prisma.record.create({
      data: {
        module: 'leads',
        title: `WhatsApp lead ${from}`,
        status: 'New',
        source: 'WhatsApp',
        data: { fullName: `WhatsApp ${from}`, telephone: from, source: 'WhatsApp', enquiry: text, whatsappMessageId: msg.id }
      }
    });
    await prisma.automationQueue.create({ data: { trigger: 'New WhatsApp Lead', payload: { recordId: record.id, from, text }, runAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
