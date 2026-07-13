import { NextRequest, NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { meetingRoomClash } from '@/lib/meeting-rooms';
import { durationMinutes, TENANT_MAX_BOOKING_MINUTES } from '@/lib/booking-time';

export async function GET() {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const records = await prisma.record.findMany({ where: { module: 'meeting-room-bookings' }, orderBy: { createdAt: 'desc' } });
  const scoped = records.filter((r) => (r.data as any)?.customerName === companyName);
  return NextResponse.json({ records: scoped });
}

export async function POST(req: NextRequest) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const client = user.clientRecordId ? await prisma.record.findUnique({ where: { id: user.clientRecordId } }) : null;
  const clientData = (client?.data as any) || {};
  const body = await req.json();

  const data = {
    customerName: companyName,
    telephone: clientData.telephone || '',
    email: clientData.email || '',
    roomName: String(body.roomName || ''),
    location: String(body.location || ''),
    bookingDate: String(body.bookingDate || ''),
    startTime: String(body.startTime || ''),
    endTime: String(body.endTime || ''),
    numberOfPeople: body.numberOfPeople || '',
    bookingType: 'Tenant',
    hourlyRate: 0,
    totalCharge: 0
  };

  if (!data.roomName || !data.bookingDate || !data.startTime || !data.endTime) {
    return NextResponse.json({ message: 'Room, date and time are required' }, { status: 400 });
  }

  const minutes = durationMinutes(data.startTime, data.endTime);
  if (!(minutes > 0)) {
    return NextResponse.json({ message: 'End time must be after start time.' }, { status: 400 });
  }
  if (minutes > TENANT_MAX_BOOKING_MINUTES) {
    return NextResponse.json({ message: 'Meeting rooms can be booked for a maximum of 2 hours.' }, { status: 400 });
  }

  const clash = await meetingRoomClash(data);
  if (clash) return NextResponse.json({ message: `${data.roomName} is already booked for the selected time. Please choose a different time or room.` }, { status: 409 });

  const record = await prisma.record.create({
    data: {
      module: 'meeting-room-bookings',
      title: data.roomName,
      status: 'Requested',
      location: data.location,
      createdById: user.id,
      data
    }
  });
  return NextResponse.json({ record });
}
