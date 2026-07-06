'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Download } from 'lucide-react';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

function filesFor(row: RecordRow): { id: string; name: string }[] {
  const value = row.data.file;
  if (Array.isArray(value)) return value;
  if (value?.id) return [value];
  return [];
}

export default function TenantDocumentsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/tenant/documents').then((r) => r.json()).then((json) => { setRows(json.records || []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Documents</h1>
        <p className="mt-2 text-sm text-slate-500">Documents shared with you by Total Business Centres.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Document Type</th>
                <th className="px-5 py-3 whitespace-nowrap">Document Number</th>
                <th className="px-5 py-3 whitespace-nowrap">Expiry Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}>No documents available yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.documentType || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.documentNumber || '—'}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.expiryDate)}</td>
                  <td className="px-5 py-4 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                  <td className="px-5 py-4 text-right">
                    {filesFor(row).length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {filesFor(row).map((f) => (
                          <a key={f.id} href={`/api/tenant/files/${f.id}?download=true`} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"><Download className="h-3.5 w-3.5" />{f.name}</a>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
