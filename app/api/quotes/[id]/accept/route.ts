import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.record.update({ where: { id }, data: { status: 'Accepted' } });
  return NextResponse.redirect(new URL('/public/thank-you?type=quote', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
