import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ipFromHeaders, normalisePhone } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);
  const allowed = await rateLimit(ip, 'web-form-leads', 8, 60 * 60);
  if (!allowed.allowed) return NextResponse.json({ message: 'Too many submissions' }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  if (body.website) return NextResponse.json({ ok: true }); // honeypot
  const fullName = String(body.fullName || body.full_name || '').trim();
  const email = String(body.email || '').trim();
  const telephone = normalisePhone(body.telephone || body.phone || '');
  const enquiry = String(body.enquiry || '').trim();
  if (!fullName || !telephone) return NextResponse.json({ message: 'Full name and telephone are required' }, { status: 400 });

  const recentRows = await prisma.record.findMany({
    where: { module: 'web-form-leads', createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    take: 200
  });
  const recentDuplicate = recentRows.find((row) => {
    const d = row.data as any;
    return d.telephone === telephone || (email && d.email === email);
  });

  if (recentDuplicate) return NextResponse.json({ ok: true, duplicate: true, message: 'Enquiry already received' });

  const record = await prisma.record.create({
    data: {
      module: 'web-form-leads',
      title: fullName,
      status: 'New',
      source: body.source || 'Website',
      location: body.location,
      data: {
        fullName,
        email,
        telephone,
        enquiry,
        source: body.source || 'Website',
        serviceType: body.serviceType || body.service_type || '',
        location: body.location || '',
        ip,
        landingPage: body.landingPage || body.landing_page || '',
        referrer: body.referrer || req.headers.get('referer') || '',
        utmSource: body.utm_source || '',
        utmCampaign: body.utm_campaign || ''
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

  return NextResponse.json({ ok: true, message: 'Enquiry received' });
}
