export const CHEQUE_DEFERRAL_FEE = 525;

/**
 * Cheque deferral/hold requests are only accepted between 20 and 15 days
 * (inclusive) before the cheque date. Dependency-free so it can be imported
 * from both the tenant portal (client component) and API routes (server).
 */
export function chequeDeferralWindow(chequeDate?: string | null) {
  if (!chequeDate) return { open: false, daysUntil: null as number | null };
  const cheque = new Date(chequeDate);
  if (Number.isNaN(cheque.getTime())) return { open: false, daysUntil: null as number | null };
  cheque.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((cheque.getTime() - today.getTime()) / 86400000);
  return { open: daysUntil >= 15 && daysUntil <= 20, daysUntil };
}
