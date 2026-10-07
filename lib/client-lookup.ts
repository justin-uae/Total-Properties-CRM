import { prisma } from '@/lib/db';
import { normText } from '@/lib/ai-import';

export type ClientMatch = { name: string; data: Record<string, any> };

/** Clients keyed by normalised company name, for matching names typed in imported files. */
export async function loadClientLookup() {
  const clients = await prisma.record.findMany({ where: { module: 'clients' }, select: { title: true, data: true } });
  const byName = new Map<string, ClientMatch>();
  for (const c of clients) {
    const data = (c.data as Record<string, any>) || {};
    const name = data.companyName || c.title;
    if (name) byName.set(normText(name), { name, data });
  }
  return (name: string) => byName.get(normText(name));
}
