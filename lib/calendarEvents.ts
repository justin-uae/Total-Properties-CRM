import { prisma } from '@/lib/db';
import { currency } from '@/lib/utils';

export type CalendarEventKind =
  | 'meeting-room-booking'
  | 'viewing'
  | 'contract-renewal'
  | 'contract-expiry'
  | 'invoice-due'
  | 'quotation-expiry'
  | 'lead-followup'
  | 'document-expiry'
  | 'deposit-refund'
  | 'move-out';

export type CalendarEvent = {
  id: string;
  recordId: string;
  module: string;
  date: string;
  time?: string;
  endTime?: string;
  title: string;
  subtitle?: string;
  status: string;
  kind: CalendarEventKind;
  kindLabel: string;
  color: string;
  dot: string;
  href: string;
};

const KIND_META: Record<CalendarEventKind, { label: string; color: string; dot: string }> = {
  'meeting-room-booking': { label: 'Meeting Room Booking', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  viewing: { label: 'Viewing', color: 'bg-purple-50 text-purple-700', dot: 'bg-purple-500' },
  'contract-renewal': { label: 'Contract Renewal', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'contract-expiry': { label: 'Contract Expiry', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  'invoice-due': { label: 'Invoice Due', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'quotation-expiry': { label: 'Quotation Valid Until', color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  'lead-followup': { label: 'Lead Follow-up', color: 'bg-pink-50 text-pink-700', dot: 'bg-pink-500' },
  'document-expiry': { label: 'Document Expiry', color: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  'deposit-refund': { label: 'Deposit Refund Due', color: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
  'move-out': { label: 'Move-Out', color: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' }
};

const CALENDAR_MODULES = ['meeting-room-bookings', 'viewings', 'contracts', 'invoices', 'quotations', 'leads', 'documents', 'deposits', 'move-outs'];

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const rows = await prisma.record.findMany({ where: { module: { in: CALENDAR_MODULES } }, orderBy: { createdAt: 'desc' } });
  const events: CalendarEvent[] = [];

  for (const row of rows) {
    const data = (row.data as any) || {};

    function push(kind: CalendarEventKind, dateValue: unknown, opts: { time?: string; endTime?: string; title: string; subtitle?: string; idSuffix: string }) {
      const date = toDateKey(dateValue);
      if (!date) return;
      const meta = KIND_META[kind];
      events.push({
        id: `${row.id}-${opts.idSuffix}`,
        recordId: row.id,
        module: row.module,
        date,
        time: opts.time || undefined,
        endTime: opts.endTime || undefined,
        title: opts.title,
        subtitle: opts.subtitle,
        status: row.status,
        kind,
        kindLabel: meta.label,
        color: meta.color,
        dot: meta.dot,
        href: `/modules/${row.module}`
      });
    }

    switch (row.module) {
      case 'meeting-room-bookings':
        push('meeting-room-booking', data.bookingDate, {
          time: data.startTime,
          endTime: data.endTime,
          title: `${data.roomName || 'Meeting Room'} — ${data.customerName || row.title}`,
          subtitle: [data.numberOfPeople ? `${data.numberOfPeople} people` : '', data.location].filter(Boolean).join(' • '),
          idSuffix: 'booking'
        });
        break;
      case 'viewings':
        push('viewing', data.viewingDate, {
          time: data.viewingTime,
          title: `Viewing — ${data.clientName || row.title}`,
          subtitle: [data.serviceType, data.location].filter(Boolean).join(' • '),
          idSuffix: 'viewing'
        });
        break;
      case 'contracts':
        push('contract-renewal', data.renewalReminderAt, {
          title: `Renewal Reminder — ${data.clientName || row.title}`,
          subtitle: data.contractNumber,
          idSuffix: 'renewal'
        });
        push('contract-expiry', data.expiryReminderAt, {
          title: `Contract Expiry — ${data.clientName || row.title}`,
          subtitle: data.contractNumber,
          idSuffix: 'expiry'
        });
        break;
      case 'invoices':
        push('invoice-due', data.dueDate, {
          title: `Invoice Due — ${data.clientName || row.title}`,
          subtitle: [data.invoiceNumber, currency(data.total ?? data.amount)].filter(Boolean).join(' • '),
          idSuffix: 'due'
        });
        break;
      case 'quotations':
        push('quotation-expiry', data.validUntil, {
          title: `Quotation Valid Until — ${data.clientName || row.title}`,
          subtitle: data.quoteNumber,
          idSuffix: 'valid'
        });
        break;
      case 'leads':
        push('lead-followup', data.nextFollowUp, {
          title: `Follow-up — ${data.fullName || row.title}`,
          subtitle: [data.serviceType, data.telephone].filter(Boolean).join(' • '),
          idSuffix: 'followup'
        });
        break;
      case 'documents':
        push('document-expiry', data.expiryDate, {
          title: `Document Expiry — ${data.clientName || row.title}`,
          subtitle: [data.documentType, data.documentNumber].filter(Boolean).join(' • '),
          idSuffix: 'docexpiry'
        });
        break;
      case 'deposits':
        push('deposit-refund', data.refundDueDate, {
          title: `Deposit Refund Due — ${data.clientName || row.title}`,
          subtitle: currency(data.amount),
          idSuffix: 'refund'
        });
        break;
      case 'move-outs':
        push('move-out', data.moveOutDate, {
          title: `Move-Out — ${data.clientName || row.title}`,
          subtitle: data.officeUnit,
          idSuffix: 'moveout'
        });
        push('move-out', data.inspectionDate, {
          title: `Move-Out Inspection — ${data.clientName || row.title}`,
          subtitle: data.officeUnit,
          idSuffix: 'inspection'
        });
        break;
    }
  }

  events.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  return events;
}

export function calendarLegend() {
  return (Object.entries(KIND_META) as [CalendarEventKind, { label: string; color: string; dot: string }][]).map(([kind, meta]) => ({ kind, ...meta }));
}
