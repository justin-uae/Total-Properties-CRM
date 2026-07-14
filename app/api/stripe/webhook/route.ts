import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getStripeConfig } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const { secretKey } = getStripeConfig();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secretKey || !webhookSecret) return NextResponse.json({ message: 'Stripe webhook not configured' }, { status: 400 });
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });
  const raw = await req.text();
  const sig = req.headers.get('stripe-signature');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || '', webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ message: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoiceId;
    if (invoiceId && session.payment_status === 'paid') {
      const invoice = await prisma.record.findUnique({ where: { id: invoiceId } });
      if (invoice) {
        const data = invoice.data as any;
        await prisma.record.update({
          where: { id: invoiceId },
          data: {
            status: 'Paid',
            data: {
              ...(data || {}),
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: String(session.payment_intent || ''),
              stripePaymentStatus: session.payment_status,
              stripePaidAt: new Date().toISOString()
            }
          }
        });
        await prisma.record.create({
          data: {
            module: 'payments',
            title: `Stripe payment for ${(data as any)?.invoiceNumber || invoiceId}`,
            status: 'Received',
            data: {
              clientName: (data as any)?.clientName || '',
              invoiceNumber: (data as any)?.invoiceNumber || '',
              amount: Number(session.amount_total || 0) / 100,
              method: 'Stripe',
              reference: session.id,
              paidAt: new Date().toISOString()
            }
          }
        });
      }
    }
  }
  return NextResponse.json({ received: true });
}
