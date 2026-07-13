import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ipFromHeaders } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';
import { meetingRoomClash } from '@/lib/meeting-rooms';
import { durationMinutes } from '@/lib/booking-time';

export async function POST(req: NextRequest) {
  const ip = ipFromHeaders(req.headers);
  const allowed = await rateLimit(ip, 'meeting-booking', 10, 60 * 60);
  if (!allowed.allowed) return NextResponse.json({ message: 'Too many booking requests' }, { status: 429 });
  const data = await req.json();
  if (!data.customerName || !data.roomName || !data.bookingDate || !data.startTime || !data.endTime) {
    return NextResponse.json({ message: 'Missing booking details' }, { status: 400 });
  }

  const minutes = durationMinutes(data.startTime, data.endTime);
  if (!(minutes > 0)) {
    return NextResponse.json({ message: 'End time must be after start time.' }, { status: 400 });
  }

  const clash = await meetingRoomClash(data);
  if (clash) return NextResponse.json({ message: 'This room is already booked for the selected time.' }, { status: 409 });

  const record = await prisma.record.create({
    data: {
      module: 'meeting-room-bookings',
      title: `${data.customerName} - ${data.roomName}`,
      status: 'Requested',
      location: data.location,
      source: 'Public Booking Form',
      data: { ...data, bookingType: 'Public', ip }
    }
  });
  await prisma.automationQueue.create({ data: { trigger: 'New Meeting Room Booking', payload: { recordId: record.id }, runAt: new Date() } });
  return NextResponse.json({ ok: true, recordId: record.id });
}
