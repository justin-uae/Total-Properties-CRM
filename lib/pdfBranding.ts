import path from 'path';

export const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'image.png');
const LOGO_ASPECT = 206 / 327;
const LOGO_WIDTH = 110;
const LOGO_HEIGHT = LOGO_WIDTH * LOGO_ASPECT;

export const COMPANY_NAME_LINE = 'Total Property Solutions Real Estate LLC - OPC';
export const COMPANY_ADDRESS_LINE =
  'Khalidiyah Towers, Mezzanine Floor, Al Faskar Street, Al Bateen, Al Khalidiyah, Abu Dhabi, Al Danah - Zone 1, P.O. Box 767649, Abu Dhabi, United Arab Emirates';
export const COMPANY_CONTACT_LINE = 'TRN: 100593093600003  •  Tel: +971 26 3444 05  •  karen@totalproperty.ae';

export const TERMS_AND_CONDITIONS = [
  'Please note that the rental value reflected in the Tawtheeq may differ from the total contract value stated in this invoice. In accordance with the business center package structure, charges related to facilities, services, and operational support may be allocated separately from the office rental amount for registration and documentation purposes.',
  'The cost of Tawtheeq registration and issuance shall be borne by the Lessor.',
  'The Refundable Security Deposit shall be returned upon expiry or termination of the agreement, subject to clearance of all outstanding dues and fulfillment of contractual obligations.',
  'The office space shall be reserved only upon receipt of the required documents and payment as per the agreed terms.',
  'This quotation/invoice is based on the agreed lease term and payment schedule and may be subject to revision should the lease structure or payment terms be amended.'
];

/** Draws the logo + letterhead block, and the document title/number to the right. Returns the y position to continue drawing from. */
export function drawLetterhead(doc: PDFKit.PDFDocument, MARGIN: number, CONTENT_WIDTH: number, docTitle: string, docNumber: string) {
  const topY = MARGIN;

  try {
    doc.image(LOGO_PATH, MARGIN, topY, { width: LOGO_WIDTH });
  } catch {
    // Logo file missing on disk — continue without it rather than failing the whole document.
  }

  doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(docTitle, MARGIN, topY, { align: 'right', width: CONTENT_WIDTH });
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text(`# ${docNumber}`, { align: 'right', width: CONTENT_WIDTH });

  let y = topY + LOGO_HEIGHT + 10;
  doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(COMPANY_NAME_LINE, MARGIN, y, { width: CONTENT_WIDTH });
  doc.fillColor('#475569').fontSize(8).font('Helvetica').text(COMPANY_ADDRESS_LINE, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });
  doc.fillColor('#475569').fontSize(8).font('Helvetica').text(COMPANY_CONTACT_LINE, MARGIN, doc.y + 2, { width: CONTENT_WIDTH });

  return doc.y;
}

/** Draws the numbered Terms & Conditions block, starting a new page first if there isn't enough room left. */
export function drawTermsAndConditions(doc: PDFKit.PDFDocument, MARGIN: number, CONTENT_WIDTH: number) {
  const bodyWidth = CONTENT_WIDTH - 14;
  const estimatedHeight =
    24 +
    TERMS_AND_CONDITIONS.reduce((sum, term, i) => {
      doc.font('Helvetica').fontSize(7.5);
      return sum + doc.heightOfString(`${i + 1}. ${term}`, { width: bodyWidth }) + 5;
    }, 0);

  if (doc.y + estimatedHeight > doc.page.height - MARGIN) {
    doc.addPage();
    doc.y = MARGIN;
  }

  doc.moveDown(1.2);
  doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_WIDTH, doc.y).strokeColor('#e2e8f0').stroke();
  doc.moveDown(0.6);
  doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Terms & Conditions', MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.4);
  TERMS_AND_CONDITIONS.forEach((term, i) => {
    doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(`${i + 1}. ${term}`, MARGIN + 4, doc.y, { width: bodyWidth, align: 'justify' });
    doc.moveDown(0.35);
  });
}
