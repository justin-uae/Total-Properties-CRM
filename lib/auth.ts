import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { PermissionAction, UserRole } from '@prisma/client';

const COOKIE_NAME = 'tbc_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.SESSION_SECRET || 'development-only-change-me';
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('hex');
}

export function createSessionToken(userId: string) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const value = `${userId}.${expires}`;
  return `${value}.${sign(value)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const value = `${userId}.${expires}`;
  const expected = sign(value);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  if (Number(expires) < Date.now()) return null;
  return userId;
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ include: { permissions: true }, where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') return null;
  return user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return user;
}

export function isMasterAdmin(user: { role: UserRole }) {
  return user.role === 'MASTER_ADMIN';
}

export function can(user: Awaited<ReturnType<typeof currentUser>>, module: string, action: PermissionAction | keyof typeof PermissionAction) {
  if (!user) return false;
  if (isMasterAdmin(user)) return true;
  const actionValue = typeof action === 'string' ? action : String(action);
  return user.permissions.some((p) => p.module === module && p.action === actionValue);
}

export async function assertCan(module: string, action: PermissionAction | keyof typeof PermissionAction) {
  const user = await requireUser();
  if (!can(user, module, action)) {
    throw new Response('Forbidden', { status: 403 });
  }
  return user;
}

export async function requireTenantApi() {
  const user = await requireUser();
  if (user.role !== 'TENANT') throw new Response('Forbidden', { status: 403 });
  if (!user.clientRecordId) throw new Response('No company linked to this account', { status: 403 });
  return user;
}

export async function tenantCompanyName(user: { clientRecordId: string | null }) {
  if (!user.clientRecordId) return null;
  const client = await prisma.record.findUnique({ where: { id: user.clientRecordId } });
  return (client?.data as any)?.companyName || client?.title || null;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { ok: false, message: 'Invalid email or password' };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, message: 'Account is temporarily locked. Try again later.' };
  }

  if (user.status !== 'ACTIVE') return { ok: false, message: 'Account is suspended.' };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil: failedLoginCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      }
    });
    return { ok: false, message: 'Invalid email or password' };
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await setSession(user.id);
  return { ok: true, message: 'Logged in', role: user.role };
}
