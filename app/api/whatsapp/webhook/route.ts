import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppList } from '@/lib/whatsapp';
import { getSettings } from '@/lib/settings';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A finished conversation resets after this long, so a returning contact gets treated as a new enquiry.
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

const SKIP_ID = 'skip_email';
const OTHER_ID = 'other_interest';
// Row ids double as lookup keys back to the CRM's own Service Type options, so a tapped list
// selection round-trips cleanly into the lead's `serviceType` field.
const INTEREST_ROWS: { id: string; title: string; description: string }[] = [
  { id: 'virtual_office', title: 'Virtual Office', description: 'A business address, no physical desk' },
  { id: 'co_working', title: 'Co Working Office', description: 'Shared workspace, flexible seating' },
  { id: 'private_office', title: 'Private Office', description: 'Your own dedicated office space' },
  { id: 'meeting_room', title: 'Meeting Room', description: 'Book a room by the hour' },
  { id: OTHER_ID, title: 'Something else', description: 'Tell us what you need' }
];
const INTEREST_BY_ID = new Map(INTEREST_ROWS.map((r) => [r.id, r.title]));

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

async function askEmail(to: string, name: string) {
  try {
    await sendWhatsAppButtons(
      to,
      `Thanks, *${name}*! \u{1F64C}\nCould you share your *email address*? We'll send updates there.`,
      [{ id: SKIP_ID, title: 'Skip for now' }]
    );
  } catch (err) {
    console.error('whatsapp reply failed:', err);
  }
}

async function askInterest(to: string) {
  try {
    await sendWhatsAppList(
      to,
      "Perfect! \u{1F3E2} One last thing — what are you interested in?\nTap *View Options* below to choose, or just type it out.",
      'View Options',
      'Our Services',
      INTEREST_ROWS
    );
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

async function createLead(from: string, session: { fullName: string | null; email: string | null }, serviceType: string, enquiry: string, msgId: string) {
  const record = await prisma.record.create({
    data: {
      module: 'web-form-leads',
      title: session.fullName || `WhatsApp ${from}`,
      status: 'New',
      source: 'WhatsApp',
      data: {
        fullName: session.fullName || '',
        email: session.email || '',
        telephone: from,
        source: 'WhatsApp',
        serviceType,
        enquiry,
        whatsappMessageId: msgId
      }
    }
  });
  await prisma.automationQueue.create({
    data: { trigger: 'New WhatsApp Lead', payload: { recordId: record.id, from, fullName: session.fullName, serviceType, enquiry }, runAt: new Date() }
  });
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
    const interactiveReply = msg.interactive?.button_reply || msg.interactive?.list_reply;
    const replyId: string | undefined = interactiveReply?.id;
    const text = String(msg.text?.body || msg.button?.text || interactiveReply?.title || '').trim();
    if (from === '+' || !text) continue;

    let session = await prisma.whatsAppSession.findUnique({ where: { phone: from } });

    // Meta can redeliver the same webhook event — skip if we've already handled this message id.
    if (session?.lastMessageId === msg.id) continue;

    // A completed conversation from a while ago — treat this message as a fresh enquiry.
    if (session?.step === 'DONE' && Date.now() - session.updatedAt.getTime() > SESSION_EXPIRY_MS) {
      session = await prisma.whatsAppSession.update({
        where: { phone: from },
        data: { step: 'ASK_NAME', fullName: null, email: null, serviceType: null, lastMessageId: msg.id }
      });
      await reply(from, "Welcome back! \u{1F44B} Let's get your new enquiry started — what's your *full name*?");
      continue;
    }

    if (!session) {
      await prisma.whatsAppSession.create({ data: { phone: from, step: 'ASK_NAME', lastMessageId: msg.id } });
      const settings = await getSettings();
      await reply(
        from,
        `\u{1F44B} Hi! Thanks for messaging *${settings.companyName}*.\nI'm here to grab a few quick details so our team can help you faster.\n\nWhat's your *full name*?`
      );
      continue;
    }

    if (session.step === 'ASK_NAME') {
      await prisma.whatsAppSession.update({ where: { phone: from }, data: { fullName: text, step: 'ASK_EMAIL', lastMessageId: msg.id } });
      await askEmail(from, text);
      continue;
    }

    if (session.step === 'ASK_EMAIL') {
      const skipped = replyId === SKIP_ID || text.toLowerCase() === 'skip';
      if (!skipped && !EMAIL_RE.test(text)) {
        await prisma.whatsAppSession.update({ where: { phone: from }, data: { lastMessageId: msg.id } });
        await reply(from, "Hmm, that doesn't look like a valid email \u{1F914} Please try again, or tap Skip.");
        continue;
      }
      await prisma.whatsAppSession.update({
        where: { phone: from },
        data: { email: skipped ? '' : text.toLowerCase(), step: 'ASK_INTEREST', lastMessageId: msg.id }
      });
      await askInterest(from);
      continue;
    }

    if (session.step === 'ASK_INTEREST') {
      const matched = replyId && INTEREST_BY_ID.get(replyId);
      if (matched && replyId !== OTHER_ID) {
        await createLead(from, session, matched, `Interested in ${matched}`, msg.id);
        await prisma.whatsAppSession.update({ where: { phone: from }, data: { step: 'DONE', serviceType: matched, lastMessageId: msg.id } });
        await reply(from, `All set, *${session.fullName}*! ✅\nThanks for the details — our team will reach out to you shortly about *${matched}*.\n\nHave a great day! \u{1F60A}`);
        continue;
      }
      if (replyId === OTHER_ID) {
        await prisma.whatsAppSession.update({ where: { phone: from }, data: { step: 'ASK_DETAILS', lastMessageId: msg.id } });
        await reply(from, 'Sure — please tell me a little more about what you’re looking for. ✍️');
        continue;
      }
      // They typed free text instead of tapping a list option — treat it as their answer directly.
      await createLead(from, session, '', text, msg.id);
      await prisma.whatsAppSession.update({ where: { phone: from }, data: { step: 'DONE', lastMessageId: msg.id } });
      await reply(from, `All set, *${session.fullName}*! ✅\nThanks for the details — one of our team members will reach out to you shortly.\n\nHave a great day! \u{1F60A}`);
      continue;
    }

    if (session.step === 'ASK_DETAILS') {
      await createLead(from, session, session.serviceType || '', text, msg.id);
      await prisma.whatsAppSession.update({ where: { phone: from }, data: { step: 'DONE', lastMessageId: msg.id } });
      await reply(from, `All set, *${session.fullName}*! ✅\nThanks for the details — one of our team members will reach out to you shortly.\n\nHave a great day! \u{1F60A}`);
      continue;
    }

    // step === 'DONE' within the window — already have a lead in flight, just acknowledge.
    await prisma.whatsAppSession.update({ where: { phone: from }, data: { lastMessageId: msg.id } });
    await reply(from, 'Thanks for the message! \u{1F64F} Our team already has your details and will reach out shortly.');
  }

  return NextResponse.json({ ok: true });
}
