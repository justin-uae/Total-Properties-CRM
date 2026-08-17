import { prisma } from '@/lib/db';

// "QT-" + a running sequence starting at 310000 that never resets (e.g. QT-310000, QT-310001, ...).
const QUOTATION_NUMBER_START = 310000;

export async function generateQuotationNumber() {
  const count = await prisma.record.count({ where: { module: 'quotations' } });
  return `QT-${QUOTATION_NUMBER_START + count}`;
}
