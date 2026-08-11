import { prisma } from '@/lib/db';

export async function generateContractNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.record.count({ where: { module: 'contracts' } });
  return `CT-${year}-${String(count + 1).padStart(4, '0')}`;
}
