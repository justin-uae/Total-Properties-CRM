'use client';

import { useEffect, useState } from 'react';
import { currency, fmtDate } from '@/lib/utils';
import { chequeDeferralWindow, CHEQUE_DEFERRAL_FEE } from '@/lib/cheques';
import { Spinner } from '@/components/ui/Spinner';
import { AlertTriangle, Download, X } from 'lucide-react';

type FileRef = { id: string; name: string; mimeType: string };
type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

function DeferralBadge({ status }: { status?: string }) {
  if (!status) return null;
  const styles: Record<string, string> = {
    Requested: 'bg-amber-50 text-amber-700',
    Approved: 'bg-green-50 text-green-700',
    Rejected: 'bg-red-50 text-red-700'
  };
  return <span className={`status-pill ${styles[status] || 'bg-slate-100 text-slate-600'}`}>Deferral {status}</span>;
}

export default function TenantChequesPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deferRow, setDeferRow] = useState<RecordRow | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/tenant/cheques');
    const json = await res.json();
    setRows(json.records || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitDeferralRequest() {
    if (!deferRow) return;
    setRequesting(true);
    setError('');
    const res = await fetch(`/api/tenant/cheques/${deferRow.id}/defer`, { method: 'POST' });
    const json = await res.json();
    setRequesting(false);
    if (!res.ok) { setError(json.message || 'Failed to submit request'); return; }
    setDeferRow(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Cheques</h1>
        <p className="mt-2 text-sm text-slate-500">Post-dated cheques on file with Total Business Centres.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Bank</th>
                <th className="px-5 py-3 whitespace-nowrap">Amount</th>
                <th className="px-5 py-3 whitespace-nowrap">Cheque Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3 whitespace-nowrap">Deferral Request</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}>No cheques on file yet.</td></tr>
              ) : rows.map((row) => {
                const receipt: FileRef | undefined = row.data.chequeReceipt;
                const scanned: FileRef | undefined = row.data.scannedCheque;
                const { open } = chequeDeferralWindow(row.data.chequeDate);
                const canRequest = row.status === 'Received' && !row.data.deferralStatus && open;
                return (
                  <tr key={row.id}>
                    <td className="px-5 py-4 whitespace-nowrap">{row.data.bankName || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{currency(row.data.amount || 0)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.chequeDate)}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                    <td className="px-5 py-4 whitespace-nowrap"><DeferralBadge status={row.data.deferralStatus} /></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {receipt && (
                          <a href={`/api/tenant/files/${receipt.id}?download=true`} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
                            <Download className="h-3.5 w-3.5" />Receipt
                          </a>
                        )}
                        {scanned && (
                          <a href={`/api/tenant/files/${scanned.id}?download=true`} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
                            <Download className="h-3.5 w-3.5" />Cheque
                          </a>
                        )}
                        {canRequest && (
                          <button onClick={() => { setDeferRow(row); setError(''); }} className="btn-primary px-2 py-1 text-xs">
                            Request Cheque Deferred/Hold
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deferRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!requesting) setDeferRow(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold">Request Cheque Deferred/Hold</h2>
              <button onClick={() => setDeferRow(null)} disabled={requesting} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">
              Your cheque for <span className="font-semibold text-slate-700">{currency(deferRow.data.amount || 0)}</span> dated{' '}
              <span className="font-semibold text-slate-700">{fmtDate(deferRow.data.chequeDate)}</span> will be marked for deferral/hold review.
            </p>
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">
              A Cheque Deferred/Hold fee of {currency(CHEQUE_DEFERRAL_FEE)} will apply once this request is approved. An invoice for this fee will be sent to you separately.
            </p>
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeferRow(null)} disabled={requesting} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={submitDeferralRequest} disabled={requesting} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[160px]">
                {requesting ? <><Spinner size="sm" color="white" /><span>Submitting...</span></> : 'Confirm Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
