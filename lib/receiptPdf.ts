import PDFDocument from 'pdfkit';
import { currency, fmtDate } from '@/lib/utils';
import { LOGO_PATH, COMPANY_NAME_LINE, COMPANY_ADDRESS_LINES, COMPANY_CONTACT_LINE, drawStamp } from '@/lib/pdfBranding';

type ReceiptPdfData = {
  clientName: string;
  clientAddress?: string;
  paymentDate?: string;
  reference?: string;
  method?: string;
  amount: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LOGO_WIDTH = 80;
const TEXT_X = MARGIN + LOGO_WIDTH + 14;
const TEXT_WIDTH = CONTENT_WIDTH - LOGO_WIDTH - 14;

export function generatePaymentReceiptPdfBuffer(receipt: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Letterhead
    try {
      doc.image(LOGO_PATH, MARGIN, MARGIN, { width: LOGO_WIDTH });
    } catch {
      // Logo file missing on disk — continue without it rather than failing the whole document.
    }
    doc.fillColor('#0f172a').fontSize(12.5).font('Helvetica-Bold').text(COMPANY_NAME_LINE, TEXT_X, MARGIN, { width: TEXT_WIDTH });
    doc.fillColor('#475569').fontSize(8).font('Helvetica');
    COMPANY_ADDRESS_LINES.forEach((line) => doc.text(line, TEXT_X, doc.y + 2, { width: TEXT_WIDTH, lineGap: 0 }));
    doc.text(COMPANY_CONTACT_LINE, TEXT_X, doc.y + 3, { width: TEXT_WIDTH });

    doc.y = Math.max(doc.y, MARGIN + LOGO_WIDTH) + 14;
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(1);

    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 1.5 });
    doc.moveDown(2);

    // Payment details (left) + amount received box (right)
    const detailsY = doc.y;
    const boxW = 200;
    const boxH = 64;
    const boxX = MARGIN + CONTENT_WIDTH - boxW;

    doc.roundedRect(boxX, detailsY, boxW, boxH, 8).fill('#16a34a');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('AMOUNT RECEIVED', boxX, detailsY + 14, { width: boxW, align: 'center', characterSpacing: 0.5 });
    doc.fontSize(19).font('Helvetica-Bold').text(currency(receipt.amount), boxX, detailsY + 32, { width: boxW, align: 'center' });

    function detailRow(label: string, value: string, y: number) {
      doc.fillColor('#64748b').fontSize(8.5).font('Helvetica-Bold').text(label.toUpperCase(), MARGIN, y, { width: 260, characterSpacing: 0.3 });
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(value || '—', MARGIN, doc.y + 2, { width: 260 });
      return doc.y;
    }

    let y = detailsY;
    y = detailRow('Payment Date', receipt.paymentDate ? fmtDate(receipt.paymentDate) : '—', y) + 12;
    y = detailRow('Reference Number', receipt.reference || '—', y) + 12;
    y = detailRow('Payment Mode', receipt.method || '—', y) + 12;

    doc.y = Math.max(y, detailsY + boxH) + 20;

    // Received From
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold').text('RECEIVED FROM', MARGIN, doc.y, { characterSpacing: 0.3 });
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(receipt.clientName || '—', MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
    if (receipt.clientAddress) {
      doc.fillColor('#475569').fontSize(9).font('Helvetica').text(receipt.clientAddress, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
    }

    doc.moveDown(1.5);

    // Payment for table
    doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold').text('Payment for', MARGIN, doc.y);
    doc.moveDown(0.5);

    const COLS = {
      invoiceNumber: { x: MARGIN, w: CONTENT_WIDTH * 0.28 },
      invoiceDate: { x: MARGIN + CONTENT_WIDTH * 0.28, w: CONTENT_WIDTH * 0.24 },
      invoiceAmount: { x: MARGIN + CONTENT_WIDTH * 0.52, w: CONTENT_WIDTH * 0.24 },
      paymentAmount: { x: MARGIN + CONTENT_WIDTH * 0.76, w: CONTENT_WIDTH * 0.24 }
    };

    const headerY = doc.y;
    doc.rect(MARGIN, headerY, CONTENT_WIDTH, 22).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
    doc.text('INVOICE NUMBER', COLS.invoiceNumber.x + 6, headerY + 7, { width: COLS.invoiceNumber.w });
    doc.text('INVOICE DATE', COLS.invoiceDate.x, headerY + 7, { width: COLS.invoiceDate.w });
    doc.text('INVOICE AMOUNT', COLS.invoiceAmount.x, headerY + 7, { width: COLS.invoiceAmount.w, align: 'right' });
    doc.text('PAYMENT AMOUNT', COLS.paymentAmount.x - 6, headerY + 7, { width: COLS.paymentAmount.w, align: 'right' });

    const rowY = headerY + 22;
    doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica');
    doc.text(receipt.invoiceNumber || '—', COLS.invoiceNumber.x + 6, rowY + 8, { width: COLS.invoiceNumber.w });
    doc.text(receipt.invoiceDate ? fmtDate(receipt.invoiceDate) : '—', COLS.invoiceDate.x, rowY + 8, { width: COLS.invoiceDate.w });
    doc.text(currency(receipt.invoiceAmount ?? receipt.amount), COLS.invoiceAmount.x, rowY + 8, { width: COLS.invoiceAmount.w, align: 'right' });
    doc.font('Helvetica-Bold').text(currency(receipt.amount), COLS.paymentAmount.x - 6, rowY + 8, { width: COLS.paymentAmount.w, align: 'right' });
    doc.moveTo(MARGIN, rowY + 32).lineTo(MARGIN + CONTENT_WIDTH, rowY + 32).strokeColor('#e2e8f0').stroke();
    doc.y = rowY + 40;

    doc.moveDown(1);
    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('This is a system-generated receipt and does not require a signature.', MARGIN, doc.y, { width: CONTENT_WIDTH });

    drawStamp(doc, MARGIN, CONTENT_WIDTH);

    doc.end();
  });
}
