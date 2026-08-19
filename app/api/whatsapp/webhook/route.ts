import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { getSettings } from '@/lib/settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A finished conversation resets after this long, so a returning contact gets treated as a new enquiry.
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

function verifyMetaSignature(raw: string, signature: string | null) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  if (!appSecret) return true; // allow local development if not configured
  if (!signature?.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function reply(to: string, body: string) {
  try {
    await sendWhatsAppText(to, body);
  } catch (err) {
    console.error('whatsapp reply failed:', err);
  }
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
    const from = `+${String(msg.from || '').replace(/[^0-9]/g, '')}`;
    const text = String(msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '').trim();
    if (from === '+' || !text) continue;

    let session = await prisma.whatsAppSession.findUnique({ where: { phone: from } });

    // Meta can redeliver the same webhook event — skip if we've already handled this message id.
    if (session?.lastMessageId === msg.id) continue;

    // A completed conversation from a while ago — treat this message as a fresh enquiry.
    if (session?.step === 'DONE' && Date.now() - session.updatedAt.getTime() > SESSION_EXPIRY_MS) {
      session = await prisma.whatsAppSession.update({
        where: { phone: from },
        data: { step: 'ASK_NAME', fullName: null, email: null, lastMessageId: msg.id }
      });
      await reply(from, "Welcome back! Let's get your new enquiry started — what's your full name?");
      continue;
    }

    if (!session) {
      await prisma.whatsAppSession.create({ data: { phone: from, step: 'ASK_NAME', lastMessageId: msg.id } });
      const settings = await getSettings();
      await reply(from, `Hi, thanks for messaging ${settings.companyName}! \u{1F44B}\nCould you share your full name to get started?`);
      continue;
    }

    if (session.step === 'ASK_NAME') {
      await prisma.whatsAppSession.update({ where: { phone: from }, data: { fullName: text, step: 'ASK_EMAIL', lastMessageId: msg.id } });
      await reply(from, `Thanks, ${text}! What's your email address? (Reply "skip" if you'd rather not share it)`);
      continue;
    }

    if (session.step === 'ASK_EMAIL') {
      const skipped = text.toLowerCase() === 'skip';
      if (!skipped && !EMAIL_RE.test(text)) {
        await prisma.whatsAppSession.update({ where: { phone: from }, data: { lastMessageId: msg.id } });
        await reply(from, 'That doesn’t look like a valid email — please try again, or reply "skip".');
        continue;
      }
      await prisma.whatsAppSession.update({
        where: { phone: from },
        data: { email: skipped ? '' : text.toLowerCase(), step: 'ASK_QUERY', lastMessageId: msg.id }
      });
      await reply(from, 'Great — and what are you looking for? (e.g. private office, coworking desk, meeting room, virtual office)');
      continue;
    }

    if (session.step === 'ASK_QUERY') {
      const record = await prisma.record.create({
        data: {
          module: 'leads',
          title: session.fullName || `WhatsApp ${from}`,
          status: 'New',
          source: 'WhatsApp',
          data: {
            fullName: session.fullName || '',
            email: session.email || '',
            telephone: from,
            source: 'WhatsApp',
            enquiry: text,
            whatsappMessageId: msg.id
          }
        }
      });
      await prisma.automationQueue.create({
        data: { trigger: 'New WhatsApp Lead', payload: { recordId: record.id, from, fullName: session.fullName, text }, runAt: new Date() }
      });
      await prisma.whatsAppSession.update({ where: { phone: from }, data: { step: 'DONE', lastMessageId: msg.id } });
      await reply(from, 'Thank you! We’ve got your details and one of our team will be in touch shortly. \u{1F64C}');
      continue;
    }

    // step === 'DONE' within the window — already have a lead in flight, just acknowledge.
    await prisma.whatsAppSession.update({ where: { phone: from }, data: { lastMessageId: msg.id } });
    await reply(from, 'Thanks for the message! Our team already has your details and will reach out shortly.');
  }

  return NextResponse.json({ ok: true });
}
