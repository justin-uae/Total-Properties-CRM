import { prisma } from '@/lib/db';
import { currency } from '@/lib/utils';
import { notFound } from 'next/navigation';

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await prisma.record.findUnique({ where: { publicToken: token } });
  if (!quote || quote.module !== 'quotations') notFound();
  await prisma.record.update({ where: { id: quote.id }, data: { viewedAt: new Date(), viewCount: { increment: 1 }, status: quote.status === 'Sent' ? 'Viewed' : quote.status } });
  const data = quote.data as any;
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-soft">
        <p className="text-sm font-bold uppercase tracking-widest text-orange-600">Total Business Centres</p>
        <h1 className="mt-2 text-3xl font-black">Quotation {data.quoteNumber}</h1>
        <p className="mt-2 text-slate-500">Prepared for {data.clientName}</p>
        <div className="mt-8 rounded-2xl bg-orange-50 p-6">
          <p className="text-sm font-bold text-orange-700">Proposal Value</p>
          <p className="mt-1 text-4xl font-black">{currency(data.amount)}</p>
          <p className="mt-2 text-sm text-slate-500">Valid until {data.validUntil || '—'}</p>
        </div>
        <div className="mt-8 rounded-2xl border border-slate-200 p-5">
          <p className="font-bold">Proposal Details</p>
          <p className="mt-2 whitespace-pre-line text-slate-600">{data.description}</p>
        </div>
        <form action={`/api/quotes/${quote.id}/accept`} method="post" className="mt-8 text-right">
          <button className="btn-primary">Accept Quotation</button>
        </form>
      </div>
    </div>
  );
}
