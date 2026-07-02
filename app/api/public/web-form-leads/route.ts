import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ipFromHeaders, normalisePhone } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

// Restricts this public form endpoint to the marketing site(s) that are allowed to submit enquiries.
const ALLOWED_ORIGINS = (process.env.PUBLIC_WEBSITE_ORIGIN || 'https://totalproperty.ae,https://www.totalproperty.ae')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS_RE = new RegExp('[\\x00-\\x1F\\x7F]', 'g');

function resolveOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function sanitize(value: unknown, maxLen = 500) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(CONTROL_CHARS_RE, '')
    .trim()
    .slice(0, maxLen);
}

export async function OPTIONS(req: NextRequest) {
  const origin = resolveOrigin(req);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const origin = resolveOrigin(req);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  const headers = corsHeaders(origin);

  try {
    const ip = ipFromHeaders(req.headers);
    const allowed = await rateLimit(ip, 'web-form-leads', 8, 60 * 60);
    if (!allowed.allowed) {
      return NextResponse.json({ message: 'Too many submissions, please try again later' }, { status: 429, headers });
    }

    const body = await req.json().catch(() => ({}));

    // Hidden field only bots fill in — a non-empty value means reject as a validation failure.
    if (sanitize(body.website)) {
      return NextResponse.json({ message: 'Unable to process request' }, { status: 400, headers });
    }

    const fullName = sanitize(body.fullName || body.full_name, 150);
    const telephone = normalisePhone(sanitize(body.telephone || body.phone, 30));
    const email = sanitize(body.email, 200).toLowerCase();
    const serviceType = sanitize(body.serviceType || body.service_type, 100);
    const location = sanitize(body.location, 150);
    const enquiry = sanitize(body.enquiry, 2000);

    if (!fullName || !telephone || !enquiry) {
      return NextResponse.json({ message: 'Full name, telephone and enquiry are required' }, { status: 400, headers });
    }
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ message: 'Please provide a valid email address' }, { status: 400, headers });
    }

    const recentRows = await prisma.record.findMany({
      where: { module: 'web-form-leads', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      take: 200
    });
    const isDuplicate = recentRows.some((row) => {
      const d = row.data as any;
      return d.telephone === telephone || (email && d.email === email);
    });
    if (isDuplicate) {
      return NextResponse.json({ ok: true, message: 'Enquiry received' }, { headers });
    }

    const record = await prisma.record.create({
      data: {
        module: 'web-form-leads',
        title: fullName,
        status: 'New',
        source: 'Website',
        location,
        data: {
          fullName,
          email,
          telephone,
          serviceType,
          location,
          enquiry,
          source: 'Website',
          ip,
          landingPage: sanitize(body.landingPage || body.landing_page, 300),
          referrer: sanitize(body.referrer, 300) || req.headers.get('referer') || '',
          utmSource: sanitize(body.utm_source, 100),
          utmCampaign: sanitize(body.utm_campaign, 100)
        }
      }
    });

    await prisma.automationQueue.create({
      data: {
        trigger: 'New Web Form Lead',
        payload: { recordId: record.id, fullName, telephone, email },
        runAt: new Date()
      }
    });

    return NextResponse.json({ ok: true, message: 'Enquiry received' }, { headers });
  } catch (err) {
    console.error('web-form-leads submission failed:', err);
    return NextResponse.json({ message: 'Something went wrong. Please try again later.' }, { status: 500, headers });
  }
}
