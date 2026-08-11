import crypto from 'crypto';
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function currency(value: unknown, code = 'AED') {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: code }).format(num);
}

// e.g. "18 Dec Friday 2026" — a single shared formatter instance (formatToParts lets us pick a
// custom part order) reused across every call rather than constructed per-render.
const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', weekday: 'long', year: 'numeric' });

export function fmtDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return `${part('day')} ${part('month')} ${part('weekday')} ${part('year')}`;
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

/** Converts an ISO datetime string to the local `yyyy-MM-ddTHH:mm` value an <input type="datetime-local"> expects. */
export function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converts an <input type="datetime-local"> value back to an ISO string. */
export function fromDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString();
}
