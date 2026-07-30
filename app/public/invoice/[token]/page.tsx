import { prisma } from '@/lib/db';
import { currency } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';
import { BankDetailsCard } from '@/components/BankDetailsCard';
import { getStripeConfig } from '@/lib/stripe';
import { isStripePayable } from '@/lib/invoice-calc';
import { getSettings } from '@/lib/settings';

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await prisma.record.findUnique({ where: { publicToken: token } });
  if (!invoice || invoice.module !== 'invoices') notFound();
  await prisma.record.update({ where: { id: invoice.id }, data: { viewedAt: new Date(), viewCount: { increment: 1 }, status: invoice.status === 'Sent' ? 'Viewed' : invoice.status } });
  const data = invoice.data as any;
  const settings = await getSettings();
  const bankDetails = (settings.bankDetails || {}) as Record<string, string>;
  const bankRows: [string, string][] = [
    ['Bank Name', bankDetails.bankName],
    ['Account Name', bankDetails.accountName],
    ['Account Number', bankDetails.accountNumber],
    ['IBAN', bankDetails.iban],
    ['SWIFT / BIC', bankDetails.swiftCode],
    ['Branch', bankDetails.branch]
  ].filter(([, value]) => value) as [string, string][];
  const stripeEnabled = getStripeConfig().enabled && isStripePayable(data);
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-soft">
        <div className="flex items-start justify-between border-b pb-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-orange-600">Total Business Centres</p>
            <h1 className="mt-2 text-3xl font-black">Invoice {data.invoiceNumber}</h1>
            <p className="mt-1 text-slate-500">Secure browser invoice link</p>
          </div>
          <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">{invoice.status}</span>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label">Bill To</p>
            <p className="font-bold">{data.clientName}</p>
            <p className="text-sm text-slate-500">{data.email}</p>
            {data.vatRegistered === 'VAT Registered' && data.trnNumber && (
              <p className="text-sm text-slate-500">TRN: {data.trnNumber}</p>
            )}
          </div>
          <div className="text-left sm:text-right"><p className="label">Amount Due</p><p className="text-4xl font-black">{currency(data.amount)}</p><p className="text-sm text-slate-500">Due {data.dueDate || '—'}</p></div>
        </div>
        <div className="mt-8 rounded-2xl border border-slate-200 p-5">
          <p className="font-bold">Description</p>
          <p className="mt-2 whitespace-pre-line text-slate-600">{data.description || 'Business centre services'}</p>
        </div>
        <BankDetailsCard rows={bankRows} />
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {stripeEnabled && invoice.status !== 'Paid' && (
            <form action={`/api/invoices/${invoice.id}/checkout`} method="post">
              <button className="btn-primary">Pay Invoice by Card</button>
            </form>
          )}
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
