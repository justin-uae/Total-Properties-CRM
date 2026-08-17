import PDFDocument from 'pdfkit';
import { currency, fmtDate } from '@/lib/utils';
import { computeInvoiceTotals, InvoiceItem, lineAmounts } from '@/lib/invoice-calc';
import { drawLetterhead, drawTermsAndConditions, drawStamp, drawBankDetails, BankDetails, BRAND_ACCENT } from '@/lib/pdfBranding';

type InvoicePdfData = {
  invoiceNumber: string;
  clientName: string;
  email?: string;
  address?: string;
  issueDate?: string;
  dueDate?: string;
  subject?: string;
  items: InvoiceItem[];
  vatRegistered?: string;
  trnNumber?: string;
  bankDetails?: BankDetails;
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT = BRAND_ACCENT;

const COLS = {
  idx: { x: MARGIN, w: 20 },
  desc: { x: MARGIN + 20, w: 225 },
  qty: { x: MARGIN + 245, w: 35 },
  rate: { x: MARGIN + 280, w: 60 },
  discount: { x: MARGIN + 340, w: 50 },
  tax: { x: MARGIN + 390, w: 45 },
  amount: { x: MARGIN + 435, w: CONTENT_WIDTH - 435 }
};

function shortCurrency(value: number) {
  return currency(value).replace(/^AED\s?/, '');
}

export function generateInvoicePdfBuffer(invoice: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const totals = computeInvoiceTotals(invoice.items);

    drawLetterhead(doc, MARGIN, CONTENT_WIDTH, 'INVOICE', invoice.invoiceNumber);
    doc.moveDown(1.5);

    // Bill To / Date block
    const billToY = doc.y;
    const billToWidth = CONTENT_WIDTH - 220;
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold').text('BILL TO', MARGIN, billToY);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(invoice.clientName || '—', MARGIN, doc.y + 2, { width: billToWidth });
    (invoice.address || '').split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
      doc.fillColor('#475569').fontSize(9).font('Helvetica').text(line, MARGIN, doc.y + 2, { width: billToWidth });
    });
    if (invoice.vatRegistered === 'VAT Registered' && invoice.trnNumber) {
      doc.fillColor('#475569').fontSize(9).font('Helvetica').text(`TRN: ${invoice.trnNumber}`, MARGIN, doc.y + 2, { width: billToWidth });
    }
    const billToBottom = doc.y;

    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold').text('ISSUE DATE', MARGIN, billToY, { align: 'right', width: CONTENT_WIDTH });
    doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(invoice.issueDate ? fmtDate(invoice.issueDate) : '—', { align: 'right', width: CONTENT_WIDTH });
    if (invoice.dueDate) {
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold').text('DUE DATE', MARGIN, doc.y + 6, { align: 'right', width: CONTENT_WIDTH });
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica').text(fmtDate(invoice.dueDate), { align: 'right', width: CONTENT_WIDTH });
    }
    const dateBottom = doc.y;

    doc.moveDown(1.5);
    const billBlockBottom = Math.max(doc.y, billToBottom + 12, dateBottom + 12);
    if (invoice.subject) {
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(invoice.subject, MARGIN, billBlockBottom);
      doc.moveDown(0.5);
    } else {
      doc.y = billBlockBottom;
    }

    // Table header
    function drawTableHeader() {
      const y = doc.y;
      doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(ACCENT);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', COLS.idx.x + 4, y + 7, { width: COLS.idx.w });
      doc.text('ITEM & DESCRIPTION', COLS.desc.x + 4, y + 7, { width: COLS.desc.w });
      doc.text('QTY', COLS.qty.x, y + 7, { width: COLS.qty.w, align: 'right' });
      doc.text('RATE', COLS.rate.x, y + 7, { width: COLS.rate.w, align: 'right' });
      doc.text('DISC %', COLS.discount.x, y + 7, { width: COLS.discount.w, align: 'right' });
      doc.text('TAX %', COLS.tax.x, y + 7, { width: COLS.tax.w, align: 'right' });
      doc.text('AMOUNT', COLS.amount.x - 4, y + 7, { width: COLS.amount.w, align: 'right' });
      doc.y = y + 22;
    }

    drawTableHeader();

    invoice.items.forEach((item, i) => {
      const l = lineAmounts(item);
      const descHeight = doc.font('Helvetica').fontSize(9).heightOfString(item.description || '—', { width: COLS.desc.w });
      const rowHeight = Math.max(descHeight + 12, 24);

      if (doc.y + rowHeight > doc.page.height - MARGIN - 100) {
        doc.addPage();
        doc.y = MARGIN;
        drawTableHeader();
      }

      const y = doc.y;
      if (i % 2 === 1) doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill('#f8fafc');

      doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
      doc.text(String(i + 1), COLS.idx.x + 4, y + 6, { width: COLS.idx.w });
      doc.text(item.description || '—', COLS.desc.x + 4, y + 6, { width: COLS.desc.w });
      doc.text(String(item.qty ?? 0), COLS.qty.x, y + 6, { width: COLS.qty.w, align: 'right' });
      doc.text(shortCurrency(item.rate), COLS.rate.x, y + 6, { width: COLS.rate.w, align: 'right' });
      doc.text(item.discountPct ? `${item.discountPct}%` : '—', COLS.discount.x, y + 6, { width: COLS.discount.w, align: 'right' });
      doc.text(item.taxPct ? `${item.taxPct}%` : '—', COLS.tax.x, y + 6, { width: COLS.tax.w, align: 'right' });
      doc.font('Helvetica-Bold').text(shortCurrency(l.amount), COLS.amount.x - 4, y + 6, { width: COLS.amount.w, align: 'right' });

      doc.y = y + rowHeight;
    });

    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.75);

    // Totals block
    const totalsX = MARGIN + CONTENT_WIDTH - 220;
    function totalsRow(label: string, value: string, bold = false) {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(bold ? '#0f172a' : '#475569');
      doc.text(label, totalsX, y, { width: 120 });
      doc.text(value, totalsX + 120, y, { width: 100, align: 'right' });
      doc.y = y + (bold ? 20 : 16);
    }
    totalsRow('Sub Total', currency(totals.subTotal));
    if (totals.discountTotal > 0) totalsRow('Discount', `-${currency(totals.discountTotal)}`);
    if (totals.taxTotal > 0) totalsRow('Tax', currency(totals.taxTotal));
    doc.moveTo(totalsX, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#cbd5e1').stroke();
    doc.moveDown(0.3);
    totalsRow('Total (AED)', currency(totals.total), true);

    drawBankDetails(doc, MARGIN, CONTENT_WIDTH, invoice.bankDetails);
    drawTermsAndConditions(doc, MARGIN, CONTENT_WIDTH);

    doc.moveDown(1.5);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('Thank you for your business.', MARGIN, doc.y, { width: CONTENT_WIDTH });

    drawStamp(doc, MARGIN, CONTENT_WIDTH);

    doc.end();
  });
}
