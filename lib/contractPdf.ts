import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/** Stamps a drawn signature image plus a "Signed by ... on ..." label onto the bottom-right corner of every page of an existing PDF. */
export async function stampSignatureOnPdf(pdfBytes: Buffer, opts: { name: string; signaturePngDataUrl: string; signedAt: Date }): Promise<Buffer> {
  const match = opts.signaturePngDataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) throw new Error('Invalid signature image');

  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pngImage = await doc.embedPng(Buffer.from(match[1], 'base64'));

  const margin = 24;
  const maxImgWidth = 150;
  const scale = Math.min(1, maxImgWidth / pngImage.width);
  const imgWidth = pngImage.width * scale;
  const imgHeight = pngImage.height * scale;
  const fontSize = 12;
  const textBottom = 10;
  const blue = rgb(0.09, 0.35, 0.85);
  const label = `Signed by ${opts.name} on ${opts.signedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  for (const page of doc.getPages()) {
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const imgX = Math.max(margin, width - margin - imgWidth);
    const textX = Math.max(margin, width - margin - textWidth);

    page.drawImage(pngImage, { x: imgX, y: textBottom + fontSize + 8, width: imgWidth, height: imgHeight });
    page.drawText(label, { x: textX, y: textBottom, size: fontSize, font, color: blue });
  }

  return Buffer.from(await doc.save());
}
