import { prisma } from '@/lib/db';

export async function rateLimit(key: string, bucket: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const existing = await prisma.rateLimit.findUnique({ where: { key_bucket: { key, bucket } } });
  if (!existing || existing.resetAt <= now) {
    await prisma.rateLimit.upsert({
      where: { key_bucket: { key, bucket } },
      create: { key, bucket, count: 1, resetAt },
      update: { count: 1, resetAt }
    });
    return { allowed: true, remaining: limit - 1 };
  }
  if (existing.count >= limit) return { allowed: false, remaining: 0 };
  await prisma.rateLimit.update({ where: { id: existing.id }, data: { count: existing.count + 1 } });
  return { allowed: true, remaining: limit - existing.count - 1 };
}
