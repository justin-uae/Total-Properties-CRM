import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: process.env.DATABASE_URL } }
  });

// Reuse the single instance across hot-reloads in dev to avoid connection exhaustion
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
