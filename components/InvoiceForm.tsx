'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Combobox } from '@/components/ui/Combobox';
import { Spinner } from '@/components/ui/Spinner';
import { currency } from '@/lib/utils';
import { computeInvoiceTotals, emptyInvoiceItem, InvoiceItem, lineAmounts } from '@/lib/invoice-calc';
import { durationMinutes } from '@/lib/booking-time';

type RecordRow = { id: string; title: string; status: string; data: Record<string, any> };

type InvoiceFormValues = {
  invoiceNumber: string;
  clientName: string;
  email: string;
  issueDate: string;
  dueDate: string;
  subject: string;
  items: InvoiceItem[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fromBookingValues(booking: RecordRow): InvoiceFormValues {
  const d = booking.data;
  const hours = Math.round((durationMinutes(d.startTime, d.endTime) / 60) * 100) / 100;
  return {
    invoiceNumber: `INV-${Date.now()}`,
    clientName: d.customerName || '',
    email: d.email || '',
    issueDate: todayIso(),
    dueDate: daysFromNowIso(7),
    subject: `Meeting Room Booking - ${d.roomName || ''}`.trim(),
    items: [{
      description: `Meeting room booking - ${d.roomName || ''} on ${d.bookingDate || ''} (${d.startTime || ''}-${d.endTime || ''})`,
      qty: hours > 0 ? hours : 1,
      rate: Number(d.hourlyRate) || 0,
      discountPct: 0,
      taxPct: 0
    }]
  };
}

export function InvoiceForm({
  existing,
  fromBooking,
  modal,
  onClose,
  onSaved
}: {
  existing: RecordRow | null;
  fromBooking?: RecordRow | null;
  modal?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clients, setClients] = useState<RecordRow[]>([]);
  const [recordId, setRecordId] = useState<string | null>(existing?.id || null);
  const [values, setValues] = useState<InvoiceFormValues>(() => {
    if (existing) {
      return {
        invoiceNumber: existing.data.invoiceNumber || `INV-${Date.now()}`,
        clientName: existing.data.clientName || '',
        email: existing.data.email || '',
        issueDate: existing.data.issueDate || todayIso(),
        dueDate: existing.data.dueDate || daysFromNowIso(7),
        subject: existing.data.subject || '',
        items: existing.data.items?.length ? existing.data.items : [emptyInvoiceItem()]
      };
    }
    if (fromBooking) return fromBookingValues(fromBooking);
    return {
      invoiceNumber: `INV-${Date.now()}`,
      clientName: '',
      email: '',
      issueDate: todayIso(),
      dueDate: daysFromNowIso(7),
      subject: '',
      items: [emptyInvoiceItem()]
    };
  });
  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/records?module=clients').then((r) => r.json()).then((json) => setClients(json.records || [])).catch(() => {});
  }, []);

  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.data.companyName || c.title, label: c.data.companyName || c.title, detail: c.data.email })),
    [clients]
  );

  const totals = useMemo(() => computeInvoiceTotals(values.items), [values.items]);

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setValues((v) => ({ ...v, items: v.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  }

  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, emptyInvoiceItem()] }));
  }

  function removeItem(index: number) {
    setValues((v) => ({ ...v, items: v.items.length > 1 ? v.items.filter((_, i) => i !== index) : v.items }));
  }

  function pickClient(name: string) {
    const match = clients.find((c) => (c.data.companyName || c.title) === name);
    setValues((v) => ({ ...v, clientName: name, email: match?.data.email || v.email }));
  }

  function buildData() {
    return {
      invoiceNumber: values.invoiceNumber,
      clientName: values.clientName,
      email: values.email,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      subject: values.subject,
      items: values.items,
      subTotal: totals.subTotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amount: totals.total,
      description: values.subject
    };
  }

  function validate() {
    if (!values.clientName.trim()) return 'Client / company name is required';
    if (!values.email.trim()) return 'Client email is required to send the invoice';
    if (values.items.every((it) => !it.description.trim())) return 'Add at least one item';
    return '';
  }

  async function linkBooking(invoiceId: string) {
    if (!fromBooking || fromBooking.data.invoiceId === invoiceId) return;
    await fetch(`/api/records/${fromBooking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: fromBooking.status, data: { ...fromBooking.data, invoiceId } })
    });
  }

  async function persist(status: 'Draft' | 'Sent'): Promise<string | null> {
    const data = buildData();
    if (recordId) {
      const res = await fetch(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, data })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Could not save invoice'); return null; }
      await linkBooking(recordId);
      return recordId;
    }
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'invoices', status, data })
    });
    const json = await res.json();
    if (!res.ok) { setError(json.message || 'Could not save invoice'); return null; }
    setRecordId(json.record.id);
    await linkBooking(json.record.id);
    return json.record.id;
  }

  async function saveDraft() {
    setError('');
    setSaving(true);
    try {
      const id = await persist('Draft');
      if (id) { onSaved(); onClose(); }
    } finally {
      setSaving(false);
    }
  }

  function openPreview() {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setError('');
    setMode('preview');
  }

  async function sendInvoice() {
    setError('');
    setSending(true);
    try {
      const id = await persist('Sent');
      if (!id) return;
      const res = await fetch(`/api/invoices/${id}/email`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setError(json.message || 'Invoice saved, but the email could not be sent'); return; }
      onSaved();
      onClose();
    } finally {
      setSending(false);
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="label">{label}</label>
      {node}
    </div>
  );

  if (mode === 'preview') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !sending && setMode('form')} />
        <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <p className="font-bold">Invoice Preview</p>
            <button onClick={() => !sending && setMode('form')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-orange-600">Total Business Centres</p>
                <input
                  className="mt-2 w-full rounded-lg border-none bg-transparent text-2xl font-black outline-none focus:bg-slate-50"
                  value={values.subject}
                  placeholder="Subject (e.g. Meeting Room Booking)"
                  onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))}
                />
              </div>
              <div className="text-right">
                <p className="text-2xl font-black">INVOICE</p>
                <p className="text-sm text-slate-500"># {values.invoiceNumber}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="label">Bill To</p>
                <Combobox value={values.clientName} onChange={pickClient} options={clientOptions} placeholder="Client / company name" />
                <input
                  className="input mt-2"
                  type="email"
                  value={values.email}
                  placeholder="Client email"
                  onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
                />
              </div>
              <div className="text-left sm:text-right">
                {field('Issue Date', <input className="input" type="date" value={values.issueDate} onChange={(e) => setValues((v) => ({ ...v, issueDate: e.target.value }))} />)}
                <div className="mt-2">
                  {field('Due Date', <input className="input" type="date" value={values.dueDate} onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))} />)}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-orange-600 text-white">
                  <tr>
                    <th className="px-3 py-2">Item & Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Disc %</th>
                    <th className="px-3 py-2 text-right">Tax %</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {values.items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input className="w-full min-w-[160px] rounded-md border-none bg-transparent outline-none focus:bg-slate-50" value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 text-right"><input type="number" className="w-16 rounded-md border-none bg-transparent text-right outline-none focus:bg-slate-50" value={item.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right"><input type="number" className="w-20 rounded-md border-none bg-transparent text-right outline-none focus:bg-slate-50" value={item.rate} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right"><input type="number" className="w-16 rounded-md border-none bg-transparent text-right outline-none focus:bg-slate-50" value={item.discountPct} onChange={(e) => updateItem(i, { discountPct: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right"><input type="number" className="w-16 rounded-md border-none bg-transparent text-right outline-none focus:bg-slate-50" value={item.taxPct} onChange={(e) => updateItem(i, { taxPct: Number(e.target.value) })} /></td>
                      <td className="px-3 py-2 text-right font-semibold">{currency(lineAmounts(item).amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addItem} className="mt-2 text-xs font-semibold text-blue-600 hover:underline">+ Add item</button>

            <div className="mt-6 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500"><span>Sub Total</span><span>{currency(totals.subTotal)}</span></div>
                {totals.discountTotal > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{currency(totals.discountTotal)}</span></div>}
                {totals.taxTotal > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{currency(totals.taxTotal)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-black"><span>Total (AED)</span><span>{currency(totals.total)}</span></div>
              </div>
            </div>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

            <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={saveDraft} disabled={saving || sending} className="btn-secondary w-full sm:w-auto">
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button type="button" onClick={sendInvoice} disabled={saving || sending} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[120px]">
                {sending ? <><Spinner size="sm" color="white" /><span>Sending…</span></> : <span>Send</span>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formBody = (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">{existing ? 'Edit' : 'New'} Invoice</h2>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {field('Client / Company Name', <Combobox value={values.clientName} onChange={pickClient} options={clientOptions} placeholder="Select or type a client name" required />)}
        {field('Client Email', <input className="input" type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />)}
        {field('Invoice Number', <input className="input bg-slate-50" value={values.invoiceNumber} readOnly />)}
        {field('Date', <input className="input" type="date" value={values.issueDate} onChange={(e) => setValues((v) => ({ ...v, issueDate: e.target.value }))} />)}
        {field('Subject', <input className="input" placeholder="e.g. Meeting Room Booking" value={values.subject} onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))} />)}
        {field('Due Date', <input className="input" type="date" value={values.dueDate} onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))} />)}
      </div>

      <div className="mt-6">
        <p className="label mb-2">Items</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Item Detail</th>
                <th className="px-3 py-2 text-right">Qty / Hours</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Discount %</th>
                <th className="px-3 py-2 text-right">Tax %</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {values.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2"><input className="input" placeholder="Meeting room, or any other" value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} /></td>
                  <td className="px-3 py-2"><input type="number" className="input w-20 text-right" value={item.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2"><input type="number" className="input w-24 text-right" value={item.rate} onChange={(e) => updateItem(i, { rate: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2"><input type="number" className="input w-20 text-right" value={item.discountPct} onChange={(e) => updateItem(i, { discountPct: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2"><input type="number" className="input w-20 text-right" value={item.taxPct} onChange={(e) => updateItem(i, { taxPct: Number(e.target.value) })} /></td>
                  <td className="px-3 py-2 text-right font-semibold">{currency(lineAmounts(item).amount)}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeItem(i)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500"><span>Sub Total</span><span>{currency(totals.subTotal)}</span></div>
          {totals.discountTotal > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{currency(totals.discountTotal)}</span></div>}
          {totals.taxTotal > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{currency(totals.taxTotal)}</span></div>}
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-black"><span>Total (AED)</span><span>{currency(totals.total)}</span></div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}

      <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="btn-secondary w-full sm:w-auto">Cancel</button>
        <button type="button" onClick={saveDraft} disabled={saving} className="btn-secondary w-full sm:w-auto">
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button type="button" onClick={openPreview} disabled={saving} className="btn-primary w-full sm:w-auto">
          Preview and Send
        </button>
      </div>
    </>
  );

  if (modal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          {formBody}
        </div>
      </div>
    );
  }

  return <div className="card p-6">{formBody}</div>;
}
