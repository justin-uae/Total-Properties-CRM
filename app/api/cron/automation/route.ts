import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

const EXPIRY_TRIGGERS = new Set(['Contract Expiring', 'Document Expiring']);

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (process.env.CRON_SECRET && key !== process.env.CRON_SECRET) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const due = await prisma.automationQueue.findMany({ where: { status: 'Pending', runAt: { lte: new Date() } }, take: 50, orderBy: { runAt: 'asc' } });
  for (const item of due) {
    try {
      if (EXPIRY_TRIGGERS.has(item.trigger)) {
        const payload = item.payload as any;
        await sendWhatsAppTemplate(payload.to, [payload.clientName || 'there', payload.itemLabel || 'item', payload.expiryDate || '']);
        const record = await prisma.record.findUnique({ where: { id: payload.recordId } });
        if (record) {
          const d = (record.data as any) || {};
          await prisma.record.update({ where: { id: payload.recordId }, data: { data: { ...d, whatsappReminderSentAt: new Date().toISOString() } } });
        }
      }
      await prisma.auditLog.create({ data: { action: `AUTOMATION:${item.trigger}`, module: 'automation-rules', after: item.payload as any } });
      await prisma.automationQueue.update({ where: { id: item.id }, data: { status: 'Completed', processedAt: new Date() } });
    } catch (err: any) {
      await prisma.automationQueue.update({ where: { id: item.id }, data: { attempts: { increment: 1 }, lastError: err.message, status: item.attempts >= 2 ? 'Failed' : 'Pending' } });
    }
  }
  return NextResponse.json({ processed: due.length });
}
