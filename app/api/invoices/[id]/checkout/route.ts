import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.record.findUnique({ where: { id } });
  if (!invoice || invoice.module !== 'invoices') return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
  const settings = await getSettings();
  if (!settings.stripeEnabled || !settings.stripeSecretKey) return NextResponse.json({ message: 'Stripe is not enabled' }, { status: 400 });
  const data = invoice.data as any;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const stripe = new Stripe(String(settings.stripeSecretKey), { apiVersion: '2024-06-20' as any });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: data.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'aed',
        unit_amount: Math.round(Number(data.amount || 0) * 100),
        product_data: { name: `Invoice ${data.invoiceNumber || invoice.id}` }
      }
    }],
    metadata: { invoiceId: invoice.id, invoiceNumber: data.invoiceNumber || '' },
    success_url: `${appUrl}/public/invoice/${invoice.publicToken}?paid=success`,
    cancel_url: `${appUrl}/public/invoice/${invoice.publicToken}?paid=cancelled`
  });
  await prisma.record.update({ where: { id }, data: { data: { ...(data || {}), stripeCheckoutSessionId: session.id } } });
  return NextResponse.redirect(session.url || `${appUrl}/public/invoice/${invoice.publicToken}`);
}
