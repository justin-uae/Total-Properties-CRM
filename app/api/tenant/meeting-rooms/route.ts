import { NextResponse } from 'next/server';
import { requireTenantApi } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  await requireTenantApi();
  const records = await prisma.record.findMany({ where: { module: 'meeting-rooms', status: 'Available' }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ records });
}
