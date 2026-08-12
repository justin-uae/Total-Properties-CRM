import { prisma } from '@/lib/db';

// Fixed "21" prefix + a running sequence that never resets (e.g. 210001, 210002, ... 210006).
const CONTRACT_NUMBER_PREFIX = '21';

export async function generateContractNumber() {
  const count = await prisma.record.count({ where: { module: 'contracts' } });
  return `${CONTRACT_NUMBER_PREFIX}${String(count + 1).padStart(4, '0')}`;
}
