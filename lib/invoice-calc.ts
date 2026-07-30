export type InvoiceItem = {
  description: string;
  qty: number;
  rate: number;
  discountPct: number;
  taxPct: number;
};

export function emptyInvoiceItem(): InvoiceItem {
  return { description: '', qty: 1, rate: 0, discountPct: 0, taxPct: 0 };
}

export function lineAmounts(item: InvoiceItem) {
  const base = (Number(item.qty) || 0) * (Number(item.rate) || 0);
  const discount = base * ((Number(item.discountPct) || 0) / 100);
  const taxable = base - discount;
  const tax = taxable * ((Number(item.taxPct) || 0) / 100);
  return { base, discount, taxable, tax, amount: taxable + tax };
}

/** Stripe is only offered on invoices generated from a Public meeting-room booking — Tenant bookings are free, and all other invoice types are settled by bank transfer. */
export function isStripePayable(data: { sourceType?: string; bookingType?: string }) {
  return data?.sourceType === 'meeting-room-booking' && data?.bookingType !== 'Tenant';
}

export function computeInvoiceTotals(items: InvoiceItem[]) {
  let subTotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let total = 0;
  for (const item of items) {
    const l = lineAmounts(item);
    subTotal += l.base;
    discountTotal += l.discount;
    taxTotal += l.tax;
    total += l.amount;
  }
  return { subTotal, discountTotal, taxTotal, total };
}
