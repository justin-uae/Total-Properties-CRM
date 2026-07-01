import crypto from 'crypto';
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: unknown, code = 'AED') {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: code }).format(num);
}

export function fmtDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function publicToken(prefix = 'tbc') {
  return `${prefix}_${crypto.randomBytes(18).toString('hex')}`;
}

export function safeJson<T = Record<string, unknown>>(value: unknown): T {
  if (!value || typeof value !== 'object') return {} as T;
  return value as T;
}

export function ipFromHeaders(headers: Headers) {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}

export function normalisePhone(phone?: string) {
  return (phone || '').replace(/[^0-9+]/g, '');
}
