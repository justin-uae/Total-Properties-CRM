export const TENANT_MAX_BOOKING_MINUTES = 120;

// Pure time-string helpers (no server-only deps) so they're safe to import
// from both API routes and client components.
export function durationMinutes(start: string, end: string): number {
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(end).split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return NaN;
  return eh * 60 + em - (sh * 60 + sm);
}
