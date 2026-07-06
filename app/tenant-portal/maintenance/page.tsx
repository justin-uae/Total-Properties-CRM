'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Plus, Upload, FileText, X } from 'lucide-react';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any>; createdAt: string };

const CATEGORIES = ['AC', 'Maintenance', 'Electricity', 'Other'];

export default function TenantMaintenancePage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/tenant/maintenance');
    const json = await res.json();
    setRows(json.records || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setCategory('');
    setDetails('');
    setPhotos([]);
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.append('category', category);
    fd.append('details', details);
    photos.forEach((p) => fd.append('photos', p));
    const res = await fetch('/api/tenant/maintenance', { method: 'POST', body: fd });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.message || 'Failed to submit ticket'); return; }
    setShowForm(false);
    resetForm();
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Maintenance Tickets</h1>
          <p className="mt-2 text-sm text-slate-500">Raise a ticket and track its status. Status is updated by our team.</p>
        </div>
        <button onClick={() => { setShowForm(true); resetForm(); }} className="btn-primary"><Plus className="mr-2 inline h-4 w-4" />New Ticket</button>
      </div>

      {showForm && (
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">New Maintenance Ticket</h2>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600 md:col-span-2">{error}</p>}
            <div>
              <label className="label">Category</label>
              <select className="input" disabled={saving} value={category} onChange={(e) => setCategory(e.target.value)} required>
                <option value="">Select...</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Details</label>
              <textarea className="input min-h-28" disabled={saving} value={details} onChange={(e) => setDetails(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="label">Attach Photos</label>
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {photos.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
                        <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-[rgb(var(--accent))]">
                  <Upload className="h-7 w-7 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-600">Click to add photos</p>
                    <p className="mt-0.5 text-xs text-slate-400">JPG, PNG, WebP, GIF — max 10 MB each</p>
                  </div>
                  <input type="file" multiple className="sr-only" accept=".jpg,.jpeg,.png,.webp,.gif" disabled={saving}
                    onChange={(e) => { const f = e.target.files; if (f) setPhotos((ps) => [...ps, ...Array.from(f)]); }} />
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end md:col-span-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[120px]" disabled={saving}>
                {saving ? <><Spinner size="sm" color="white" /><span>Submitting...</span></> : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Ticket Number</th>
                <th className="px-5 py-3 whitespace-nowrap">Category</th>
                <th className="px-5 py-3 whitespace-nowrap">Details</th>
                <th className="px-5 py-3 whitespace-nowrap">Reported At</th>
                <th className="px-5 py-3 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}><Spinner size="sm" color="muted" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-5 py-8 text-slate-500" colSpan={5}>No maintenance tickets yet.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-4 whitespace-nowrap font-semibold">{row.data.ticketNumber}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{row.data.category}</td>
                  <td className="px-5 py-4 max-w-xs truncate">{row.data.issue}</td>
                  <td className="px-5 py-4 whitespace-nowrap">{fmtDate(row.data.reportedAt)}</td>
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
