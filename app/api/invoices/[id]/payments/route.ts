import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { ipFromHeaders } from '@/lib/utils';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await assertCan('payments', PermissionAction.CREATE);

  const invoice = await prisma.record.findUnique({ where: { id } });
  if (!invoice || invoice.module !== 'invoices') return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
  const invData = invoice.data as any;

  const body = await req.json();
  const amount = Number(body.amount || 0);
  if (!amount || amount <= 0) return NextResponse.json({ message: 'Amount received is required' }, { status: 400 });
  if (!body.paymentDate) return NextResponse.json({ message: 'Payment date is required' }, { status: 400 });
  if (!body.depositTo) return NextResponse.json({ message: 'Deposit To is required' }, { status: 400 });

  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  const data = {
    clientName: invData.clientName || '',
    email: invData.email || '',
    invoiceId: invoice.id,
    invoiceNumber: invData.invoiceNumber || '',
    amount,
    bankCharges: Number(body.bankCharges || 0),
    method: String(body.method || ''),
    paymentDate: String(body.paymentDate),
    paymentReceivedOn: String(body.paymentReceivedOn || ''),
    depositTo: String(body.depositTo),
    reference: String(body.reference || ''),
    notes: String(body.notes || ''),
    attachments,
    paidAt: new Date(body.paymentDate).toISOString()
  };

  const payment = await prisma.record.create({
    data: {
      module: 'payments',
      title: data.clientName || data.invoiceNumber || 'Payment',
      status: 'Received',
      createdById: user.id,
      data
    }
  });

  const fileIds = attachments.map((f: any) => f?.id).filter(Boolean);
  if (fileIds.length) {
    await prisma.fileObject.updateMany({ where: { id: { in: fileIds } }, data: { recordId: payment.id } });
  }

  const existingPayments = await prisma.record.findMany({
    where: { module: 'payments', data: { path: ['invoiceId'], equals: invoice.id } }
  });
  // importedAmountPaid: paid before the invoice was imported, so it has no payment records here.
  const totalPaid = existingPayments.reduce((sum, p) => sum + Number((p.data as any)?.amount || 0), Number(invData.importedAmountPaid || 0));
  const invoiceTotal = Number(invData.total ?? invData.amount ?? 0);
  const newStatus = invoiceTotal > 0 && totalPaid >= invoiceTotal ? 'Paid' : totalPaid > 0 ? 'Part Paid' : invoice.status;

  await prisma.record.update({
    where: { id: invoice.id },
    data: { status: newStatus, data: { ...invData, amountPaid: totalPaid } }
  });

  await auditLog({ userId: user.id, action: 'CREATE', module: 'payments', recordId: payment.id, ipAddress: ipFromHeaders(req.headers), after: data });
  return NextResponse.json({ payment });
}
