import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await assertCan('invoices', PermissionAction.EMAIL);
  const invoice = await prisma.record.findUnique({ where: { id } });
  if (!invoice || invoice.module !== 'invoices') return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
  const data = invoice.data as any;
  if (!data.email) return NextResponse.json({ message: 'Invoice customer email is missing' }, { status: 400 });
  if (!process.env.SMTP_HOST) return NextResponse.json({ message: 'SMTP is not configured' }, { status: 400 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/public/invoice/${invoice.publicToken}`;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Total Business Centres <noreply@example.com>',
    to: data.email,
    subject: `Invoice ${data.invoiceNumber || ''} from Total Business Centres`,
    text: `Dear ${data.clientName || 'Customer'},\n\nPlease view your invoice using this secure link:\n${link}\n\nThank you,\nTotal Business Centres`,
    html: `<p>Dear ${data.clientName || 'Customer'},</p><p>Please view your invoice using this secure link:</p><p><a href="${link}">${link}</a></p><p>Thank you,<br>Total Business Centres</p>`
  });
  await prisma.record.update({ where: { id }, data: { status: invoice.status === 'Draft' ? 'Sent' : invoice.status, data: { ...(data || {}), invoiceEmailSentAt: new Date().toISOString() } } });
  return NextResponse.json({ ok: true });
}
