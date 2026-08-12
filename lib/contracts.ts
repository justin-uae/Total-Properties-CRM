import { prisma } from '@/lib/db';

// "CT-" + fixed "21" + a running sequence that never resets (e.g. CT-210001, CT-210002, ... CT-210009).
const CONTRACT_NUMBER_PREFIX = 'CT-21';

export async function generateContractNumber() {
  const count = await prisma.record.count({ where: { module: 'contracts' } });
  return `${CONTRACT_NUMBER_PREFIX}${String(count + 1).padStart(4, '0')}`;
}
