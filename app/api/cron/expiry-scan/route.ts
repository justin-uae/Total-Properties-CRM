import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { normalisePhone } from '@/lib/utils';

function isDue(dateStr: string | undefined, daysBefore = 0) {
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  target.setDate(target.getDate() - daysBefore);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today >= target;
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const settings = await getSettings();
  const clients = await prisma.record.findMany({ where: { module: 'clients' } });
  const phoneByCompany = new Map(clients.map((c) => [(c.data as any)?.companyName, normalisePhone((c.data as any)?.telephone)]));

  const targets = [
    {
      module: 'contracts',
      excludeStatuses: ['Expired', 'Cancelled'],
      dateField: 'expiryReminderAt',
      daysBefore: 0,
      itemLabel: (d: any) => `contract ${d.contractNumber || ''}`.trim(),
      trigger: 'Contract Expiring'
    },
    {
      module: 'documents',
      excludeStatuses: ['Expired', 'Archived', 'Missing'],
      dateField: 'expiryDate',
      daysBefore: Number(settings.documentExpiryReminderDays) || 7,
      itemLabel: (d: any) => `${d.documentType || 'document'}${d.documentNumber ? ` (${d.documentNumber})` : ''}`,
      trigger: 'Document Expiring'
    }
  ];

  let queued = 0;
  let skippedNoPhone = 0;

  for (const target of targets) {
    const records = await prisma.record.findMany({ where: { module: target.module } });
    for (const record of records) {
      const d = (record.data as any) || {};
      if (target.excludeStatuses.includes(record.status)) continue;
      if (d.whatsappReminderQueuedAt) continue;
      if (!isDue(d[target.dateField], target.daysBefore)) continue;

      const phone = phoneByCompany.get(d.clientName);
      if (!phone) {
        skippedNoPhone++;
        continue;
      }

      await prisma.automationQueue.create({
        data: {
          trigger: target.trigger,
          payload: {
            recordId: record.id,
            to: phone,
            clientName: d.clientName || '',
            itemLabel: target.itemLabel(d),
            expiryDate: d[target.dateField]
          },
          runAt: new Date()
        }
      });
      await prisma.record.update({ where: { id: record.id }, data: { data: { ...d, whatsappReminderQueuedAt: new Date().toISOString() } } });
      queued++;
    }
  }

  // Direct-to-email reminders (contract renewal/expiry, cheque deposit) — sent to the record's
  // own `email` field rather than a WhatsApp phone lookup, each keyed by its own "queued" flag
  // so a rerun of this scan doesn't queue the same reminder twice.
  async function queueEmailReminders(module: string, excludeStatuses: string[], emailTargets: { dateField: string; flag: string; trigger: string; daysBefore?: number }[]) {
    const records = await prisma.record.findMany({ where: { module } });
    for (const record of records) {
      if (excludeStatuses.includes(record.status)) continue;
      const d = { ...((record.data as any) || {}) };
      if (!d.email) continue;
      let changed = false;
      for (const target of emailTargets) {
        if (d[target.flag]) continue;
        if (!isDue(d[target.dateField], target.daysBefore ?? 0)) continue;
        await prisma.automationQueue.create({
          data: { trigger: target.trigger, payload: { recordId: record.id }, runAt: new Date() }
        });
        d[target.flag] = new Date().toISOString();
        changed = true;
        queued++;
      }
      if (changed) await prisma.record.update({ where: { id: record.id }, data: { data: d } });
    }
  }

  await queueEmailReminders('contracts', ['Expired', 'Cancelled'], [
    { dateField: 'renewalReminderAt', flag: 'renewalEmailQueuedAt', trigger: 'Contract Renewal Reminder' },
    { dateField: 'expiryReminderAt', flag: 'expiryEmailQueuedAt', trigger: 'Contract Expired' }
  ]);

  // Cheque deposit reminders, both direct off chequeDate (no separate "reminder date" field
  // needed since both offsets are fixed business rules): the 20-day notice also announces the
  // tenant's 20-to-15-day deferral/hold request window, the 5-day one is the final reminder.
  await queueEmailReminders('cheques', ['Deposited', 'Paid By Bank Transfer', 'Paid By Cash', 'Returned'], [
    { dateField: 'chequeDate', flag: 'depositNoticeQueuedAt', trigger: 'Cheque Deposit Notice', daysBefore: 20 },
    { dateField: 'chequeDate', flag: 'depositReminderQueuedAt', trigger: 'Cheque Deposit Reminder', daysBefore: 5 }
  ]);

  return NextResponse.json({ queued, skippedNoPhone });
}
