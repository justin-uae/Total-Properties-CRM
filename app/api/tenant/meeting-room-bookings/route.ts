import { NextRequest, NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { meetingRoomClash } from '@/lib/meeting-rooms';

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
    numberOfPeople: body.numberOfPeople || ''
  };

  if (!data.roomName || !data.bookingDate || !data.startTime || !data.endTime) {
    return NextResponse.json({ message: 'Room, date and time are required' }, { status: 400 });
  }

  const clash = await meetingRoomClash(data);
  if (clash) return NextResponse.json({ message: `Booking clash with ${clash.title}` }, { status: 409 });

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
