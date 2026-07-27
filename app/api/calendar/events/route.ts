import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getCalendarEvents } from '@/lib/calendarEvents';

export async function GET() {
  await requireUser();
  const events = await getCalendarEvents();
  return NextResponse.json({ events });
}
