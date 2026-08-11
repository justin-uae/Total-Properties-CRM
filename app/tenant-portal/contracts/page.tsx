'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { SignaturePad, SignaturePadHandle } from '@/components/ui/SignaturePad';
import { Download, FileSignature, Upload, X } from 'lucide-react';

type FileRef = { id: string; name: string; mimeType: string };
type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

export default function TenantContractsPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signRow, setSignRow] = useState<RecordRow | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/tenant/contracts');
    const json = await res.json();
    setRows(json.records || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openSign(row: RecordRow) {
    setSignRow(row);
    setSignerName('');
    setSignError('');
  }

  async function submitSignature(e: React.FormEvent) {
    e.preventDefault();
    if (!signRow) return;
    if (!signerName.trim()) { setSignError('Your full name is required'); return; }
    if (padRef.current?.isEmpty()) { setSignError('Please draw your signature'); return; }
    setSigning(true);
    setSignError('');
    const res = await fetch(`/api/tenant/contracts/${signRow.id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: signerName.trim(), signatureDataUrl: padRef.current?.toDataURL() })
    });
    const json = await res.json();
    setSigning(false);
    if (!res.ok) { setSignError(json.message || 'Failed to submit signature'); return; }
    setSignRow(null);
    await load();
  }

  async function uploadSigned(row: RecordRow, file: File) {
    setUploadingId(row.id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/tenant/contracts/${row.id}/upload`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { alert(json.message || 'Upload failed'); return; }
      await load();
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black sm:text-3xl">Contracts</h1>
        <p className="mt-2 text-sm text-slate-500">Contracts sent to you by Total Business Centres. Sign digitally or upload a signed copy.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Contract Number</th>
                <th className="px-5 py-3 whitespace-nowrap">Service Type</th>
                <th className="px-5 py-3 whitespace-nowrap">Start Date</th>
                <th className="px-5 py-3 whitespace-nowrap">End Date</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
                <th className="px-5 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={6}>No contracts available yet.</td></tr>
              ) : rows.map((row) => {
                const sent: FileRef | undefined = row.data.contractDocument;
                const signed: FileRef | undefined = row.data.signedDocument;
                return (
                  <tr key={row.id}>
                    <td className="px-5 py-4 whitespace-nowrap font-semibold">{row.data.contractNumber || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{row.data.serviceType || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.startDate)}</td>
                    <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.endDate)}</td>
                    <td className="px-5 py-4 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {sent && (
                          <a href={`/api/tenant/files/${sent.id}?download=true`} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
                            <Download className="h-3.5 w-3.5" />Contract
                          </a>
                        )}
                        {signed ? (
                          <a href={`/api/tenant/files/${signed.id}?download=true`} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
                            <Download className="h-3.5 w-3.5" />Signed Copy
                          </a>
                        ) : sent ? (
                          <>
                            <button onClick={() => openSign(row)} className="btn-primary inline-flex items-center gap-1 px-2 py-1 text-xs">
                              <FileSignature className="h-3.5 w-3.5" />Sign Now
                            </button>
                            <label className="btn-secondary inline-flex cursor-pointer items-center gap-1 px-2 py-1 text-xs">
                              {uploadingId === row.id ? <Spinner size="sm" color="muted" /> : <><Upload className="h-3.5 w-3.5" />Upload Signed</>}
                              <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={uploadingId === row.id}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSigned(row, f); e.target.value = ''; }} />
                            </label>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Awaiting contract</span>
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

      {signRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!signing) setSignRow(null); }} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Sign Contract {signRow.data.contractNumber}</h2>
              <button onClick={() => setSignRow(null)} disabled={signing} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={submitSignature} className="space-y-4">
              {signError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{signError}</p>}
              <div>
                <label className="label">Full Legal Name</label>
                <input className="input" disabled={signing} value={signerName} onChange={(e) => setSignerName(e.target.value)} required placeholder="Type your full name" />
              </div>
              <div>
                <label className="label">Signature</label>
                <SignaturePad ref={padRef} />
                <button type="button" onClick={() => padRef.current?.clear()} disabled={signing} className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700">Clear signature</button>
              </div>
              <p className="text-xs text-slate-400">By signing, you confirm you have read and agree to the terms of this contract. Your name, signature, timestamp and IP address will be recorded.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setSignRow(null)} disabled={signing} className="btn-secondary w-full sm:w-auto">Cancel</button>
                <button className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[140px]" disabled={signing}>
                  {signing ? <><Spinner size="sm" color="white" /><span>Submitting...</span></> : 'Submit Signature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
