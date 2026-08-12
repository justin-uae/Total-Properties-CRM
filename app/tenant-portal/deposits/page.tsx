'use client';

import { useEffect, useState } from 'react';
import { currency, fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

export default function TenantDepositsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenant/deposits').then((r) => r.json()).then((json) => { setRows(json.records || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Deposits</h1>
        <p className="mt-2 text-sm text-slate-500">Deposit records held with Total Business Centres.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 whitespace-nowrap">Paid Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Deduction</th>
                <th className="px-5 py-3 whitespace-nowrap">Refund Amount</th>
                <th className="px-5 py-3 whitespace-nowrap">Refund Due Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}>No deposit records yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap font-semibold">{currency(row.data.amount || 0)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.paidDate)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.deductionAmount ? currency(row.data.deductionAmount) : '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.refundAmount ? currency(row.data.refundAmount) : '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.refundDueDate)}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
