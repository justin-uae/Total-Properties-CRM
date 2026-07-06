import { prisma } from '@/lib/db';

export async function generateTicketNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.record.count({ where: { module: 'maintenance' } });
  return `MT-${year}-${String(count + 1).padStart(4, '0')}`;
}
