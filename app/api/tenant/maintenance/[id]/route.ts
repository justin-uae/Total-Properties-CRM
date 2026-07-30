import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const record = await prisma.record.findUnique({ where: { id } });
  if (!record || record.module !== 'maintenance' || (record.data as any)?.clientName !== companyName) {
    return NextResponse.json({ message: 'Ticket not found' }, { status: 404 });
  }
  return NextResponse.json({ record });
}
