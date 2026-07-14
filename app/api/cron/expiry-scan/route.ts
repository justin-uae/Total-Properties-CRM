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

  return NextResponse.json({ queued, skippedNoPhone });
}
