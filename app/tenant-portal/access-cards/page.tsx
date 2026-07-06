'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

export default function TenantAccessCardsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenant/access-cards').then((r) => r.json()).then((json) => { setRows(json.records || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Access Cards & Keys</h1>
        <p className="mt-2 text-sm text-slate-500">You have {rows.length} access card{rows.length === 1 ? '' : 's'} / key{rows.length === 1 ? '' : 's'} assigned.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Item Type</th>
                <th className="px-5 py-3 whitespace-nowrap">Card / Key Number</th>
                <th className="px-5 py-3 whitespace-nowrap">Number of Items</th>
                <th className="px-5 py-3 whitespace-nowrap">Issued At</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}>No access cards or keys assigned yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.itemType || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.identifier || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.numberOfItems || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.issuedAt)}</td>
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
