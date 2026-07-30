import nodemailer from 'nodemailer';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { generateInvoicePdfBuffer } from '@/lib/invoicePdf';
import { generateQuotationPdfBuffer } from '@/lib/quotationPdf';
import { createInvoicePaymentLink } from '@/lib/stripePaymentLink';
import { isStripePayable } from '@/lib/invoice-calc';
import { renderTemplate } from '@/lib/emailTemplates';
import { BRAND_ACCENT } from '@/lib/pdfBranding';
import { currency, fmtDate } from '@/lib/utils';
import { downloadFile } from '@/lib/storage';

function bankDetailsHtml(bankDetails: Record<string, string> | undefined) {
  if (!bankDetails) return '';
  const rows = ([
    ['Bank Name', bankDetails.bankName],
    ['Account Name', bankDetails.accountName],
    ['Account Number', bankDetails.accountNumber],
    ['IBAN', bankDetails.iban],
    ['SWIFT / BIC', bankDetails.swiftCode],
    ['Branch', bankDetails.branch]
  ] as [string, string][]).filter(([, value]) => value);
  if (rows.length === 0) return '';
  const rowsHtml = rows.map(([label, value]) => `<tr><td style="padding:2px 12px 2px 0;color:#64748b;font-weight:600">${label}</td><td style="padding:2px 0;color:#334155">${value}</td></tr>`).join('');
  return `<div style="margin-top:20px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px"><p style="margin:0 0 8px;font-weight:700;color:#0f172a">Bank Details for Payment</p><table style="font-size:13px">${rowsHtml}</table></div>`;
}

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
  const bankDetails = settings.bankDetails as Record<string, string> | undefined;

  let paymentLinkUrl: string | undefined = data.stripePaymentLinkUrl;
  let paymentLinkId: string | undefined = data.stripePaymentLinkId;
  if (!paymentLinkUrl && invoice.status !== 'Paid' && isStripePayable(data)) {
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
    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber: data.invoiceNumber || '',
      clientName: data.clientName || '',
      email: data.email,
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      subject: data.subject,
      items: data.items,
      vatRegistered: data.vatRegistered,
      trnNumber: data.trnNumber,
      bankDetails
    });
    attachments.push({ filename: `Invoice-${data.invoiceNumber || invoice.id}.pdf`, content: pdfBuffer });
  }

  const tokens = {
    clientName: data.clientName || 'Customer',
    companyName,
    invoiceNumber: data.invoiceNumber || '',
    link,
    amount: currency(data.total ?? data.amount ?? 0),
    dueDate: data.dueDate ? fmtDate(data.dueDate) : ''
  };
  const template = (settings.emailTemplates as any)?.invoice || {};
  const subject = renderTemplate(String(template.subject || `Invoice {{invoiceNumber}} from {{companyName}}`), tokens);
  const bodyHtml = renderTemplate(String(template.bodyHtml || ''), tokens);

  const payHtml = paymentLinkUrl ? `<p><a href="${paymentLinkUrl}" style="display:inline-block;padding:10px 18px;background:${BRAND_ACCENT};color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Pay Now</a></p>` : '';
  const html = `${bodyHtml}${payHtml}${bankDetailsHtml(bankDetails)}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `${companyName} <noreply@example.com>`,
    to: data.email,
    subject,
    html,
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
    const pdfBuffer = await generateQuotationPdfBuffer({
      quoteNumber: data.quoteNumber || '',
      clientName: data.clientName || '',
      email: data.email,
      issueDate: data.issueDate,
      validUntil: data.validUntil,
      subject: data.subject,
      items: data.items,
      vatRegistered: data.vatRegistered,
      trnNumber: data.trnNumber
    });
    attachments.push({ filename: `Quotation-${data.quoteNumber || quote.id}.pdf`, content: pdfBuffer });
  }

  if (data.attachment?.id) {
    const file = await prisma.fileObject.findUnique({ where: { id: data.attachment.id } });
    if (file) {
      const blob = await downloadFile(file.storedName);
      attachments.push({ filename: file.originalName, content: Buffer.from(await blob.arrayBuffer()) });
    }
  }

  const tokens = {
    clientName: data.clientName || 'Customer',
    companyName,
    quoteNumber: data.quoteNumber || '',
    link,
    amount: currency(data.total ?? data.amount ?? 0),
    validUntil: data.validUntil ? fmtDate(data.validUntil) : ''
  };
  const template = (settings.emailTemplates as any)?.quotation || {};
  const subject = renderTemplate(String(template.subject || `Quotation {{quoteNumber}} from {{companyName}}`), tokens);
  const bodyHtml = renderTemplate(String(template.bodyHtml || ''), tokens);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `${companyName} <noreply@example.com>`,
    to: data.email,
    subject,
    html: bodyHtml,
    attachments
  });

  await prisma.record.update({
    where: { id: quoteId },
    data: { status: quote.status === 'Draft' ? 'Sent' : quote.status, data: { ...data, quoteEmailSentAt: new Date().toISOString() } }
  });
}
