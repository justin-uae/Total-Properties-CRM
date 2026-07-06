import { prisma } from '@/lib/db';

export async function meetingRoomClash(data: any, exceptId?: string) {
  if (!data.roomName || !data.bookingDate || !data.startTime || !data.endTime) return null;
  const where: any = { module: 'meeting-room-bookings' };
  if (exceptId) where.NOT = { id: exceptId };
  const existing = await prisma.record.findMany({ where });
  return existing.find((row) => {
    const d = row.data as any;
    if (d.roomName !== data.roomName || d.bookingDate !== data.bookingDate) return false;
    return data.startTime < d.endTime && data.endTime > d.startTime && !['Cancelled'].includes(row.status);
  });
}
