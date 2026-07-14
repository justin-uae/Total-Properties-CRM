import Stripe from 'stripe';
import { getStripeConfig } from '@/lib/stripe';

export async function createInvoicePaymentLink(params: {
  invoiceId: string;
  invoiceNumber: string;
  publicToken: string | null;
  amount: number;
}): Promise<{ id: string; url: string } | null> {
  const { enabled, secretKey } = getStripeConfig();
  if (!enabled) return null;
  if (!(params.amount > 0)) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });

  // Payment Links reference an existing Price object (unlike Checkout Sessions,
  // which accept ad-hoc price_data directly) — create one per invoice first.
  const price = await stripe.prices.create({
    currency: 'aed',
    unit_amount: Math.round(params.amount * 100),
    product_data: { name: `Invoice ${params.invoiceNumber}` }
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { invoiceId: params.invoiceId, invoiceNumber: params.invoiceNumber },
    after_completion: params.publicToken
      ? { type: 'redirect', redirect: { url: `${appUrl}/public/invoice/${params.publicToken}?paid=success` } }
      : undefined,
    restrictions: { completed_sessions: { limit: 1 } }
  });

  return { id: paymentLink.id, url: paymentLink.url };
}
