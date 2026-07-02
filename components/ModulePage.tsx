'use client';

import { ModuleConfig, moduleMap } from '@/lib/modules';
import { currency, fmtDate } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Download, Eye, FileText, Plus, RefreshCw, Send, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type RecordRow = {
  id: string;
  title: string;
  status: string;
  module: string;
  data: Record<string, any>;
  viewCount?: number;
  viewedAt?: string;
  createdAt: string;
};

type FileRef = { id: string; name: string; mimeType: string };

function isFileRef(v: unknown): v is FileRef {
  return typeof v === 'object' && v !== null && 'id' in v && 'name' in v;
}

function valueFor(row: RecordRow, key: string) {
  if (key === 'status') return row.status;
  if (key === 'viewCount') return row.viewCount || 0;
  const value = row.data?.[key];
  if (isFileRef(value)) return value.name;
  if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('rate') || key.toLowerCase().includes('charge') || key === 'budget') return currency(value || 0);
  if (key.toLowerCase().includes('date') || key.toLowerCase().includes('at')) return fmtDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value || '—';
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          <td className="px-5 py-4">
            <div className="space-y-2">
              <div className="skeleton h-3.5 w-36" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="skeleton h-2.5 w-24" style={{ animationDelay: `${i * 80 + 40}ms` }} />
            </div>
          </td>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className="skeleton h-3.5 w-20" style={{ animationDelay: `${i * 80 + j * 20}ms` }} />
            </td>
          ))}
          <td className="px-5 py-4 text-right">
            <div className="ml-auto flex justify-end gap-2">
              <div className="skeleton h-8 w-8" style={{ animationDelay: `${i * 80}ms` }} />
              <div className="skeleton h-8 w-8" style={{ animationDelay: `${i * 80 + 20}ms` }} />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function ModulePage({ slug }: { slug: string }) {
  const module = moduleMap[slug]!;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [transferring, setTransferring] = useState<Record<string, boolean>>({});
  const [confirmTransferRow, setConfirmTransferRow] = useState<RecordRow | null>(null);
  const [transferError, setTransferError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Record<string, any>>({ status: module.defaultStatus || module.statuses[0] || 'New' });

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/records?module=${module.slug}`);
    const json = await res.json();
    setRows(json.records || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [module.slug]);

  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [rows, query]);

  function startCreate() {
    setEditing(null);
    setForm({ status: module.defaultStatus || module.statuses[0] || 'New' });
    setShowForm(true);
  }

  function startEdit(row: RecordRow) {
    setEditing(row);
    setForm({ ...row.data, status: row.status });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/records/${editing.id}` : '/api/records';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: module.slug, status: form.status, data: form })
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json()).message || 'Save failed');
      return;
    }
    if (!editing) {
      const { record } = await res.json();
      const fileRefs = Object.values(form).filter(isFileRef);
      await Promise.allSettled(
        fileRefs.map((ref) =>
          fetch(`/api/files/${ref.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recordId: record.id })
          })
        )
      );
    }
    setShowForm(false);
    await load();
  }

  async function handleFileRemove(fieldName: string, fileId: string) {
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    setForm((f) => ({ ...f, [fieldName]: null }));
  }

  async function handleFileUpload(fieldName: string, file: File) {
    setUploading((u) => ({ ...u, [fieldName]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('module', module.slug);
      if (editing) fd.append('recordId', editing.id);
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      let json: any = {};
      try { json = await res.json(); } catch { /* non-JSON body */ }
      if (!res.ok) { alert(json.message || `Upload failed (${res.status})`); return; }
      setForm((f) => ({ ...f, [fieldName]: { id: json.file.id, name: json.file.originalName, mimeType: json.file.mimeType } }));
    } catch (err: any) {
      alert(err?.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [fieldName]: false }));
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    await load();
  }

  function transferToQuote(row: RecordRow) {
    setTransferError('');
    setConfirmTransferRow(row);
  }

  async function doTransfer() {
    if (!confirmTransferRow) return;
    const row = confirmTransferRow;
    setTransferring((t) => ({ ...t, [row.id]: true }));
    setTransferError('');
    try {
      const res = await fetch('/api/records/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: row.id })
      });
      const json = await res.json();
      if (!res.ok) { setTransferError(json.message || 'Transfer failed'); return; }
      setConfirmTransferRow(null);
      await load();
    } finally {
      setTransferring((t) => ({ ...t, [row.id]: false }));
    }
  }

  function exportCsv() {
    const headings = ['title', 'status', ...module.tableFields, 'createdAt'];
    const csv = [headings.join(',')].concat(filtered.map((row) => headings.map((h) => `"${String(valueFor(row, h)).replaceAll('"', '""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${module.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (module.systemOnly) return <SystemModule module={module} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--accent))]">{module.group}</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{module.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{module.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input w-full sm:w-64" placeholder="Search records..." />
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={exportCsv} className="btn-secondary"><Download className="mr-2 inline h-4 w-4" /><span className="hidden sm:inline">Export</span></button>
          <button onClick={startCreate} className="btn-primary"><Plus className="mr-2 inline h-4 w-4" />Add {module.singular}</button>
        </div>
      </div>

      {showForm && (
        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">{editing ? 'Edit' : 'Add'} {module.singular}</h2>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Status</label>
              <select className="input" disabled={saving} value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {module.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {module.fields.map((field) => (
              <div key={field.name} className={`min-w-0${field.colSpan === 2 ? ' md:col-span-2' : ''}`}>
                <label className="label">{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'textarea' ? (
                  <textarea className="input min-h-28" disabled={saving} value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select className="input" disabled={saving} value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required}>
                    <option value="">Select...</option>
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" disabled={saving} checked={Boolean(form[field.name])} onChange={(e) => setForm({ ...form, [field.name]: e.target.checked })} /> Yes</label>
                ) : field.type === 'file' ? (
                  (() => {
                    const val = form[field.name];
                    const ref = isFileRef(val) ? val : null;
                    const isImg = ref?.mimeType?.startsWith('image/');
                    const isPdf = ref?.mimeType === 'application/pdf';
                    if (ref) return (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {isImg && <img src={`/api/files/${ref.id}`} alt={ref.name} className="max-h-52 w-full object-contain p-2" />}
                        {isPdf && <iframe src={`/api/files/${ref.id}`} title={ref.name} className="h-52 w-full border-0" />}
                        <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{ref.name}</span>
                          <a href={`/api/files/${ref.id}?download=true`} className="btn-secondary px-2 py-1 text-xs">Download</a>
                          <button type="button" disabled={saving} onClick={() => handleFileRemove(field.name, ref.id)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      </div>
                    );
                    if (uploading[field.name]) return (
                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <Spinner size="sm" color="muted" />
                        <span className="text-sm text-slate-500">Uploading…</span>
                      </div>
                    );
                    return (
                      <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-[rgb(var(--accent))]">
                        <Upload className="h-7 w-7 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-600">Click to upload</p>
                          <p className="mt-0.5 text-xs text-slate-400">PDF, JPG, PNG, WebP — max 10 MB</p>
                        </div>
                        <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" disabled={saving}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(field.name, f); }} />
                      </label>
                    );
                  })()
                ) : (
                  <input className="input" disabled={saving} type={field.type === 'money' ? 'number' : field.type} step={field.type === 'money' ? '0.01' : undefined} value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} placeholder={field.placeholder} />
                )}
              </div>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end md:col-span-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[120px]" disabled={saving}>
                {saving ? <><Spinner size="sm" color="white" /><span>Saving...</span></> : `Save ${module.singular}`}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold">{module.title} Records</h2>
          <p className="text-sm text-slate-500">Showing {filtered.length} of {rows.length} records.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3 whitespace-nowrap">Title</th>
                {module.tableFields.map((field) => <th key={field} className="px-5 py-3 whitespace-nowrap">{field.replace(/([A-Z])/g, ' $1')}</th>)}
                <th className="px-5 py-3 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <TableSkeleton cols={module.tableFields.length} /> : filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 whitespace-nowrap font-semibold">{row.title}<p className="text-xs font-normal text-slate-400">{new Date(row.createdAt).toLocaleString()}</p></td>
                  {module.tableFields.map((field) => (
                    <td key={field} className="px-5 py-4 whitespace-nowrap">
                      {field === 'status' ? <span className="status-pill bg-orange-50 text-orange-700">{row.status}</span> : valueFor(row, field)}
                    </td>
                  ))}
                  <td className="px-5 py-4 whitespace-nowrap text-right">
                    {module.slug === 'leads' && (
                      <button
                        onClick={() => transferToQuote(row)}
                        disabled={row.status === 'Transferred to Quotation' || transferring[row.id]}
                        title="Transfer to Quotation"
                        className="mr-2 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send className="inline h-3.5 w-3.5 mr-1" />
                        {transferring[row.id] ? 'Transferring…' : 'Transfer to Quote'}
                      </button>
                    )}
                    <button onClick={() => startEdit(row)} className="mr-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => remove(row.id)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td className="px-5 py-8 text-slate-500" colSpan={module.tableFields.length + 2}>No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer to Quotation confirmation modal */}
      {confirmTransferRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!transferring[confirmTransferRow.id]) setConfirmTransferRow(null); }} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="mt-3 text-lg font-bold">Transfer to Quotation</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              A draft quotation will be created for <span className="font-semibold text-slate-700">{confirmTransferRow.title}</span> with this lead's details pre-filled. The lead status will be updated to <span className="font-semibold text-slate-700">Transferred to Quotation</span>.
            </p>
            {transferError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{transferError}</p>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmTransferRow(null)}
                disabled={transferring[confirmTransferRow.id]}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doTransfer}
                disabled={transferring[confirmTransferRow.id]}
                className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[140px]"
              >
                {transferring[confirmTransferRow.id]
                  ? <><Spinner size="sm" color="white" /><span>Transferring…</span></>
                  : <><Send className="h-4 w-4" /><span>Transfer to Quote</span></>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemModule({ module }: { module: ModuleConfig; }) {
  const cards = {
    'reception-dashboard': ['Visitors today', 'Mail waiting', 'Rooms booked', 'Open maintenance', 'Access returns due', 'Walk-in leads'],
    calendar: ['Viewings', 'Meeting rooms', 'Contract renewals', 'Invoice due dates', 'Staff follow-ups', 'Maintenance SLAs'],
    'floor-plan': ['Available units', 'Occupied units', 'Reserved units', 'Expiring soon', 'Under maintenance', 'Vacant by location'],
    'payment-alerts': ['Due today', 'Overdue 1–30 days', 'Overdue 31–60 days', 'Overdue 60+ days', 'Stripe failed', 'Deposit refunds due'],
    reports: ['Revenue by location', 'Lead sources', 'Occupancy', 'Staff activity', 'Meeting room revenue', 'Lost lead reasons'],
    'accounting-exports': ['Invoices CSV', 'Payments CSV', 'Clients CSV', 'Deposits CSV', 'Bookings CSV', 'Recurring billing CSV'],
    'automation-log': ['Queued actions', 'Completed actions', 'Failed actions', 'Retry needed', 'Email sent', 'WhatsApp created'],
    'whatsapp-api': ['API disabled by default', 'Webhook URL', 'Phone Number ID', 'Access Token', 'Verify Token', 'Message logs'],
    settings: ['Company settings', 'Stripe keys', 'SMTP settings', 'Security settings', 'Default theme', 'Locations'],
    themes: ['Modern Blue', 'Purple Elegance', 'Green Fresh', 'Warm Sunset', 'Dark Mode', 'Minimal Clean'],
    dashboard: []
  } as Record<string, string[]>;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--accent))]">{module.group}</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{module.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">{module.description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(cards[module.slug] || ['Configuration', 'Reports', 'Actions']).map((item, index) => (
          <div key={item} className="card p-5">
            <p className="text-sm text-slate-500">{item}</p>
            <p className="mt-3 text-3xl font-black">{index + 1}</p>
            <p className="mt-2 text-xs text-slate-500">This panel is ready to connect to live CRM data.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
