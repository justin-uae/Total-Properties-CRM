import { prisma } from '@/lib/db';

/** Loads a Payment record plus its source Invoice and Client (for address), and shapes the data the receipt PDF/email need. */
export async function loadPaymentReceiptData(paymentId: string) {
  const payment = await prisma.record.findUnique({ where: { id: paymentId } });
  if (!payment || payment.module !== 'payments') throw new Error('Payment not found');
  const data = payment.data as any;

  let invoice: any = null;
  if (data.invoiceId) {
    const invoiceRecord = await prisma.record.findUnique({ where: { id: data.invoiceId } });
    if (invoiceRecord) invoice = invoiceRecord.data as any;
  }

  let clientAddress = '';
  if (data.clientName) {
    const clients = await prisma.record.findMany({ where: { module: 'clients' } });
    const client = clients.find((c) => (c.data as any)?.companyName === data.clientName);
    clientAddress = (client?.data as any)?.location || '';
  }

  return {
    payment,
    receipt: {
      clientName: data.clientName || '',
      clientAddress,
      paymentDate: data.paymentDate || data.paidAt || '',
      reference: data.reference || '',
      method: data.method || '',
      amount: Number(data.amount ?? 0),
      invoiceNumber: data.invoiceNumber || invoice?.invoiceNumber || '',
      invoiceDate: invoice?.issueDate || '',
      invoiceAmount: invoice ? Number(invoice.total ?? invoice.amount ?? 0) : undefined
    }
  };
}
