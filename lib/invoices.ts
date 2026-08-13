import { prisma } from '@/lib/db';

// "INV-" + fixed "21" + a running sequence that never resets (e.g. INV-210001, INV-210002, ... INV-210009).
const INVOICE_NUMBER_PREFIX = 'INV-21';

export async function generateInvoiceNumber() {
  const count = await prisma.record.count({ where: { module: 'invoices' } });
  return `${INVOICE_NUMBER_PREFIX}${String(count + 1).padStart(4, '0')}`;
}
