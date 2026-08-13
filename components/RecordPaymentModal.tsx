'use client';

import { useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any> };
type FileRef = { id: string; name: string; mimeType: string };

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'Card Terminal', 'Cheque', 'Stripe'];
const DEPOSIT_TO_OPTIONS = ['Petty Cash', 'Bank Account', 'Cash Drawer', 'Stripe'];
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentModal({ invoice, onClose, onSaved }: { invoice: RecordRow; onClose: () => void; onSaved: () => void }) {
  const invoiceTotal = Number(invoice.data.total ?? invoice.data.amount ?? 0);
  const alreadyPaid = Number(invoice.data.amountPaid ?? 0);
  const balanceDue = Math.max(invoiceTotal - alreadyPaid, 0);

  const [amount, setAmount] = useState(String(balanceDue || invoiceTotal || ''));
  const [bankCharges, setBankCharges] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [method, setMethod] = useState('Cash');
  const [paymentReceivedOn, setPaymentReceivedOn] = useState('');
  const [depositTo, setDepositTo] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (attachments.length + list.length > MAX_FILES) {
      setError(`You can upload a maximum of ${MAX_FILES} files`);
      return;
    }
    const oversized = list.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`"${oversized.name}" exceeds the 5MB limit`);
      return;
    }
    setError('');
    setUploading(true);
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', 'payments');
        fd.append('field', 'attachments');
        const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
        let json: any = {};
        try { json = await res.json(); } catch { /* non-JSON body */ }
        if (!res.ok) { setError(json.message || `Upload failed (${res.status})`); continue; }
        setAttachments((a) => [...a, { id: json.file.id, name: json.file.originalName, mimeType: json.file.mimeType }]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(fileId: string) {
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    setAttachments((a) => a.filter((f) => f.id !== fileId));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Amount received is required'); return; }
    if (!paymentDate) { setError('Payment date is required'); return; }
    if (!depositTo) { setError('Deposit To is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          bankCharges: Number(bankCharges || 0),
          paymentDate,
          method,
          paymentReceivedOn,
          depositTo,
          reference,
          notes,
          attachments
        })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Could not record payment'); return; }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Record Payment</h2>
            <p className="mt-1 text-sm text-slate-500">
              For invoice <span className="font-semibold text-slate-700">{invoice.data.invoiceNumber}</span> — {invoice.data.clientName}
            </p>
          </div>
          <button onClick={() => !saving && onClose()} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Amount Received (AED)*</label>
            <input className="input" type="number" step="0.01" min="0" disabled={saving} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label">Bank Charges (if any)</label>
            <input className="input" type="number" step="0.01" min="0" disabled={saving} value={bankCharges} onChange={(e) => setBankCharges(e.target.value)} />
          </div>

          <div>
            <label className="label">Payment Date*</label>
            <input className="input" type="date" disabled={saving} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" disabled={saving} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Payment Received On</label>
            <input className="input" type="date" disabled={saving} value={paymentReceivedOn} onChange={(e) => setPaymentReceivedOn(e.target.value)} />
          </div>
          <div>
            <label className="label">Deposit To*</label>
            <select className="input" disabled={saving} value={depositTo} onChange={(e) => setDepositTo(e.target.value)} required>
              <option value="">Select...</option>
              {DEPOSIT_TO_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Reference#</label>
            <input className="input" disabled={saving} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[42px]" disabled={saving} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Attachments</label>
            <div className="space-y-3">
              {attachments.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {attachments.map((ref) => (
                    <div key={ref.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <a href={`/api/files/${ref.id}?download=true`} className="flex h-16 items-center justify-center"><FileText className="h-6 w-6 text-slate-400" /></a>
                      <div className="flex items-center gap-1 border-t border-slate-200 bg-white px-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{ref.name}</span>
                        <button type="button" disabled={saving} onClick={() => removeAttachment(ref.id)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {uploading ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Spinner size="sm" color="muted" />
                  <span className="text-sm text-slate-500">Uploading…</span>
                </div>
              ) : attachments.length < MAX_FILES ? (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center transition hover:border-[rgb(var(--accent))]">
                  <Upload className="h-5 w-5 text-slate-400" />
                  <p className="text-xs font-medium text-slate-600">Upload File</p>
                  <p className="text-[11px] text-slate-400">You can upload a maximum of {MAX_FILES} files, 5MB each</p>
                  <input type="file" multiple className="sr-only" disabled={saving}
                    onChange={(e) => { const f = e.target.files; if (f && f.length) handleFiles(f); e.target.value = ''; }} />
                </label>
              ) : null}
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 sm:col-span-2">{error}</p>}

          <div className="flex flex-col gap-2 pt-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="btn-secondary w-full sm:w-auto">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[140px]">
              {saving ? <><Spinner size="sm" color="white" /><span>Saving…</span></> : <span>Record Payment</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
