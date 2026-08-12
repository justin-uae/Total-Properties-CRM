'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

export default function TenantMoveOutsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenant/move-outs').then((r) => r.json()).then((json) => { setRows(json.records || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Move-Outs</h1>
        <p className="mt-2 text-sm text-slate-500">Move-out process status with Total Business Centres.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Office Unit</th>
                <th className="px-5 py-3 whitespace-nowrap">Move-Out Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Final Invoice</th>
                <th className="px-5 py-3 whitespace-nowrap">Deposit Refund</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}>No move-out records yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.officeUnit || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.moveOutDate)}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.finalInvoiceStatus || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.depositRefundStatus || '—'}</td>
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
