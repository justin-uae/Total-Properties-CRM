import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ipFromHeaders } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);
  const allowed = await rateLimit(ip, 'meeting-booking', 10, 60 * 60);
  if (!allowed.allowed) return NextResponse.json({ message: 'Too many booking requests' }, { status: 429 });
  const data = await req.json();
  if (!data.customerName || !data.roomName || !data.bookingDate || !data.startTime || !data.endTime) {
    return NextResponse.json({ message: 'Missing booking details' }, { status: 400 });
  }

  const existing = await prisma.record.findMany({ where: { module: 'meeting-room-bookings' } });
  const clash = existing.find((row) => {
    const d = row.data as any;
    return d.roomName === data.roomName && d.bookingDate === data.bookingDate && !['Cancelled'].includes(row.status) && overlaps(data.startTime, data.endTime, d.startTime, d.endTime);
  });
  if (clash) return NextResponse.json({ message: 'This room is already booked for the selected time.' }, { status: 409 });

  const record = await prisma.record.create({
    data: {
      module: 'meeting-room-bookings',
      title: `${data.customerName} - ${data.roomName}`,
      status: 'Requested',
      location: data.location,
      source: 'Public Booking Form',
      data: { ...data, ip }
    }
  });
  await prisma.automationQueue.create({ data: { trigger: 'New Meeting Room Booking', payload: { recordId: record.id }, runAt: new Date() } });
  return NextResponse.json({ ok: true, recordId: record.id });
}
