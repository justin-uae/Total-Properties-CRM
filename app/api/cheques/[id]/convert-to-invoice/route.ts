import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/mail';
import { auditLog } from '@/lib/audit';
import { ipFromHeaders, publicToken } from '@/lib/utils';
import { CHEQUE_DEFERRAL_FEE } from '@/lib/cheques';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await assertCan('cheques', PermissionAction.EDIT);
  await assertCan('invoices', PermissionAction.CREATE);

  const cheque = await prisma.record.findUnique({ where: { id } });
  if (!cheque || cheque.module !== 'cheques') return NextResponse.json({ message: 'Cheque not found' }, { status: 404 });
  const data = cheque.data as any;
  if (data.deferralStatus !== 'Approved') return NextResponse.json({ message: 'The deferral request must be approved before converting to an invoice' }, { status: 400 });
  if (data.deferralInvoiceId) return NextResponse.json({ message: 'An invoice has already been created for this deferral' }, { status: 400 });
  if (!data.email) return NextResponse.json({ message: 'This cheque has no recipient email on file' }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);
  const invoiceData = {
    invoiceNumber: `INV-${Date.now()}`,
    clientName: data.clientName || '',
    email: data.email,
    description: `Cheque Deferred/Hold Fee — cheque dated ${data.chequeDate || ''}${data.bankName ? ` (${data.bankName})` : ''}`,
    amount: CHEQUE_DEFERRAL_FEE,
    vatAmount: 0,
    issueDate: today,
    dueDate: today
  };

  const invoice = await prisma.record.create({
    data: {
      module: 'invoices',
      title: invoiceData.clientName || invoiceData.invoiceNumber,
      status: 'Draft',
      publicToken: publicToken('inv'),
      createdById: user.id,
      data: invoiceData
    }
  });
  await auditLog({ userId: user.id, action: 'CREATE', module: 'invoices', recordId: invoice.id, ipAddress: ipFromHeaders(req.headers), after: invoiceData });

  try {
    await sendInvoiceEmail(invoice.id);
  } catch (err: any) {
    await prisma.record.update({ where: { id }, data: { data: { ...data, deferralInvoiceId: invoice.id } } });
    return NextResponse.json({ message: `Invoice created but the email failed to send: ${err.message}`, invoiceId: invoice.id }, { status: 207 });
  }

  const updated = await prisma.record.update({
    where: { id },
    data: { data: { ...data, deferralInvoiceId: invoice.id, deferralInvoiceSentAt: new Date().toISOString() } }
  });
  return NextResponse.json({ record: updated, invoiceId: invoice.id });
}
