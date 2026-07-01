'use client';

import { ModuleConfig, moduleMap } from '@/lib/modules';
import { currency, fmtDate } from '@/lib/utils';
import { Download, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

function valueFor(row: RecordRow, key: string) {
  if (key === 'status') return row.status;
  if (key === 'viewCount') return row.viewCount || 0;
  const value = row.data?.[key];
  if (key.toLowerCase().includes('amount') || key.toLowerCase().includes('rate') || key.toLowerCase().includes('charge') || key === 'budget') return currency(value || 0);
  if (key.toLowerCase().includes('date') || key.toLowerCase().includes('at')) return fmtDate(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value || '—';
}

export function ModulePage({ slug }: { slug: string }) {
  const module = moduleMap[slug]!;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/records/${editing.id}` : '/api/records';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: module.slug, status: form.status, data: form })
    });
    if (!res.ok) {
      alert((await res.json()).message || 'Save failed');
      return;
    }
    setShowForm(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/records/${id}`, { method: 'DELETE' });
    await load();
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
          <h1 className="mt-1 text-3xl font-black">{module.title}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">{module.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="input w-64" placeholder="Search records..." />
          <button onClick={load} className="btn-secondary"><RefreshCw className="mr-2 inline h-4 w-4" />Refresh</button>
          <button onClick={exportCsv} className="btn-secondary"><Download className="mr-2 inline h-4 w-4" />Export</button>
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
              <select className="input" value={form.status || ''} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {module.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {module.fields.map((field) => (
              <div key={field.name} className={field.colSpan === 2 ? 'md:col-span-2' : ''}>
                <label className="label">{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'textarea' ? (
                  <textarea className="input min-h-28" value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} placeholder={field.placeholder} />
                ) : field.type === 'select' ? (
                  <select className="input" value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required}>
                    <option value="">Select...</option>
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm"><input type="checkbox" checked={Boolean(form[field.name])} onChange={(e) => setForm({ ...form, [field.name]: e.target.checked })} /> Yes</label>
                ) : field.type === 'file' ? (
                  <input className="input" type="file" onChange={(e) => setForm({ ...form, [field.name]: e.target.files?.[0]?.name || '' })} />
                ) : (
                  <input className="input" type={field.type === 'money' ? 'number' : field.type} step={field.type === 'money' ? '0.01' : undefined} value={form[field.name] || ''} onChange={(e) => setForm({ ...form, [field.name]: e.target.value })} required={field.required} placeholder={field.placeholder} />
                )}
              </div>
            ))}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button className="btn-primary">Save {module.singular}</button>
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
                <th className="px-5 py-3">Title</th>
                {module.tableFields.map((field) => <th key={field} className="px-5 py-3">{field.replace(/([A-Z])/g, ' $1')}</th>)}
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td className="px-5 py-8 text-slate-500" colSpan={module.tableFields.length + 2}>Loading...</td></tr> : filtered.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4 font-semibold">{row.title}<p className="text-xs font-normal text-slate-400">{new Date(row.createdAt).toLocaleString()}</p></td>
                  {module.tableFields.map((field) => (
                    <td key={field} className="px-5 py-4">
                      {field === 'status' ? <span className="status-pill bg-orange-50 text-orange-700">{row.status}</span> : valueFor(row, field)}
                    </td>
                  ))}
                  <td className="px-5 py-4 text-right">
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
        <h1 className="mt-1 text-3xl font-black">{module.title}</h1>
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
