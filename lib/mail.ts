import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';
import { generateQuotationPdfBuffer } from '@/lib/quotationPdf';
import { createInvoicePaymentLink } from '@/lib/stripePaymentLink';

export async function sendInvoiceEmail(invoiceId: string) {
  const invoice = await prisma.record.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.module !== 'invoices') throw new Error('Invoice not found');
  const data = invoice.data as any;
  if (!data.email) throw new Error('Invoice customer email is missing');
  if (!process.env.SMTP_HOST) throw new Error('SMTP is not configured');

  const settings = await getSettings();
  const companyName = String(settings.companyName || 'Our Company');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/public/invoice/${invoice.publicToken}`;

  let paymentLinkUrl: string | undefined = data.stripePaymentLinkUrl;
  let paymentLinkId: string | undefined = data.stripePaymentLinkId;
  if (!paymentLinkUrl && invoice.status !== 'Paid') {
    const created = await createInvoicePaymentLink({
      invoiceId: invoice.id,
      invoiceNumber: data.invoiceNumber || invoice.id,
      publicToken: invoice.publicToken,
      amount: Number(data.total ?? data.amount ?? 0)
    });
    if (created) {
      paymentLinkUrl = created.url;
      paymentLinkId = created.id;
    }
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  const attachments = [];
  if (Array.isArray(data.items) && data.items.length > 0) {
    const pdfBuffer = await generateInvoicePdfBuffer(
      {
        invoiceNumber: data.invoiceNumber || '',
        clientName: data.clientName || '',
        email: data.email,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        subject: data.subject,
        items: data.items
      },
      { companyName: settings.companyName as string, addressLocation1: settings.addressLocation1 as string, addressLocation2: settings.addressLocation2 as string }
    );
    attachments.push({ filename: `Invoice-${data.invoiceNumber || invoice.id}.pdf`, content: pdfBuffer });
  }

  const payLine = paymentLinkUrl ? `\nPay online securely here:\n${paymentLinkUrl}\n` : '';
  const payHtml = paymentLinkUrl ? `<p><a href="${paymentLinkUrl}" style="display:inline-block;padding:10px 18px;background:#c2410c;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Pay Now</a></p>` : '';

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `${companyName} <noreply@example.com>`,
    to: data.email,
    subject: `Invoice ${data.invoiceNumber || ''} from ${companyName}`,
    text: `Dear ${data.clientName || 'Customer'},\n\nPlease find your invoice attached${attachments.length ? '' : ', and available'} using this secure link:\n${link}\n${payLine}\nThank you,\n${companyName}`,
    html: `<p>Dear ${data.clientName || 'Customer'},</p><p>Please find your invoice attached${attachments.length ? '' : ', and available'} using this secure link:</p><p><a href="${link}">${link}</a></p>${payHtml}<p>Thank you,<br>${companyName}</p>`,
    attachments
  });

  await prisma.record.update({
    where: { id: invoiceId },
    data: {
      status: invoice.status === 'Draft' ? 'Sent' : invoice.status,
      data: {
        ...data,
        invoiceEmailSentAt: new Date().toISOString(),
        ...(paymentLinkUrl ? { stripePaymentLinkUrl: paymentLinkUrl, stripePaymentLinkId: paymentLinkId } : {})
      }
    }
  });
}

export async function sendQuotationEmail(quoteId: string) {
  const quote = await prisma.record.findUnique({ where: { id: quoteId } });
  if (!quote || quote.module !== 'quotations') throw new Error('Quotation not found');
  const data = quote.data as any;
  if (!data.email) throw new Error('Quotation customer email is missing');
  if (!process.env.SMTP_HOST) throw new Error('SMTP is not configured');

  const settings = await getSettings();
  const companyName = String(settings.companyName || 'Our Company');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const link = `${appUrl}/public/quote/${quote.publicToken}`;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  const attachments = [];
  if (Array.isArray(data.items) && data.items.length > 0) {
    const pdfBuffer = await generateQuotationPdfBuffer(
      {
        quoteNumber: data.quoteNumber || '',
        clientName: data.clientName || '',
        email: data.email,
        issueDate: data.issueDate,
        validUntil: data.validUntil,
        subject: data.subject,
        items: data.items
      },
      { companyName: settings.companyName as string, addressLocation1: settings.addressLocation1 as string, addressLocation2: settings.addressLocation2 as string }
    );
    attachments.push({ filename: `Quotation-${data.quoteNumber || quote.id}.pdf`, content: pdfBuffer });
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `${companyName} <noreply@example.com>`,
    to: data.email,
    subject: `Quotation ${data.quoteNumber || ''} from ${companyName}`,
    text: `Dear ${data.clientName || 'Customer'},\n\nPlease find your quotation attached${attachments.length ? '' : ', and available'} using this secure link:\n${link}\n\nThank you,\n${companyName}`,
    html: `<p>Dear ${data.clientName || 'Customer'},</p><p>Please find your quotation attached${attachments.length ? '' : ', and available'} using this secure link:</p><p><a href="${link}">${link}</a></p><p>Thank you,<br>${companyName}</p>`,
    attachments
  });

  await prisma.record.update({
    where: { id: quoteId },
    data: { status: quote.status === 'Draft' ? 'Sent' : quote.status, data: { ...data, quoteEmailSentAt: new Date().toISOString() } }
  });
}
