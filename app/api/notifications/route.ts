import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

const LOOKAHEAD_DAYS = 30;

type NotificationItem = {
  id: string;
  module: 'contracts' | 'documents';
  label: string;
  clientName: string;
  expiryDate: string;
  overdue: boolean;
  reminderSent: boolean;
};

export async function GET() {
  await requireUser();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS);

  const [contracts, documents] = await Promise.all([
    prisma.record.findMany({ where: { module: 'contracts', status: { notIn: ['Expired', 'Cancelled'] } } }),
    prisma.record.findMany({ where: { module: 'documents', status: { notIn: ['Expired', 'Archived', 'Missing'] } } })
  ]);

  const items: NotificationItem[] = [];

  for (const r of contracts) {
    const d = (r.data as any) || {};
    const dateStr = d.endDate;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime()) || date > horizon) continue;
    items.push({
      id: r.id,
      module: 'contracts',
      label: `Contract ${d.contractNumber || ''}`.trim(),
      clientName: d.clientName || '',
      expiryDate: dateStr,
      overdue: date < today,
      reminderSent: Boolean(d.whatsappReminderSentAt)
    });
  }

  for (const r of documents) {
    const d = (r.data as any) || {};
    const dateStr = d.expiryDate;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime()) || date > horizon) continue;
    items.push({
      id: r.id,
      module: 'documents',
      label: `${d.documentType || 'Document'}${d.documentNumber ? ` (${d.documentNumber})` : ''}`,
      clientName: d.clientName || '',
      expiryDate: dateStr,
      overdue: date < today,
      reminderSent: Boolean(d.whatsappReminderSentAt)
    });
  }

  items.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return NextResponse.json({ items, count: items.length });
}
