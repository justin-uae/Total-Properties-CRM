import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { chequeDeferralWindow } from '@/lib/cheques';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const { id } = await params;
  const record = await prisma.record.findUnique({ where: { id } });
  if (!record || record.module !== 'cheques' || (record.data as any)?.clientName !== companyName) {
    return NextResponse.json({ message: 'Cheque not found' }, { status: 404 });
  }
  if (record.status !== 'Received') {
    return NextResponse.json({ message: 'This cheque is no longer eligible for a deferral request' }, { status: 400 });
  }
  const data = record.data as any;
  if (data.deferralStatus) {
    return NextResponse.json({ message: 'A deferral request has already been submitted for this cheque' }, { status: 400 });
  }
  // Authoritative check — the tenant portal only shows the button inside the window, but never trust the client.
  const { open } = chequeDeferralWindow(data.chequeDate);
  if (!open) {
    return NextResponse.json({ message: 'Deferral requests can only be submitted between 20 and 15 days before the cheque date' }, { status: 400 });
  }

  const updated = await prisma.record.update({
    where: { id },
    data: { data: { ...data, deferralStatus: 'Requested', deferralRequestedAt: new Date().toISOString() } }
  });
  return NextResponse.json({ record: updated });
}
