import { prisma } from '@/lib/db';

export async function auditLog(args: {
  userId?: string;
  action: string;
  module?: string;
  recordId?: string;
  ipAddress?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({ data: args as any });
}
