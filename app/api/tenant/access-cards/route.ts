import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const records = await prisma.record.findMany({ where: { module: 'access-cards-keys' }, orderBy: { createdAt: 'desc' } });
  const scoped = records.filter((r) => (r.data as any)?.clientName === companyName);
  return NextResponse.json({ records: scoped });
}
