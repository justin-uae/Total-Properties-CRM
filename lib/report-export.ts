import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BRAND_ACCENT, COMPANY_NAME_LINE, LOGO_PATH } from '@/lib/pdfBranding';
import { formatValue, periodLabel, ReportColumn, ReportDoc, ValueFormat } from '@/lib/report-types';

// Renders a ReportDoc (lib/reports.ts) as an Excel workbook or a PDF, matching what
// the Reports page shows: header, KPI summary, then each table.

export function reportFileName(doc: ReportDoc, ext: string) {
  const base = doc.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const range = doc.snapshot ? doc.generatedAt.slice(0, 10) : `${doc.from}_to_${doc.to}`;
  return `${base}_${range}.${ext}`;
}

const KPI_FORMAT: Record<string, ValueFormat> = { money: 'money', count: 'count', percent: 'percent' };
const MONEY_FMT = '"AED" #,##0.00';

export async function reportToXlsx(doc: ReportDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY_NAME_LINE;
  wb.created = new Date(doc.generatedAt);

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 32 }, { width: 22 }, { width: 50 }];
  summary.addRow([doc.title]).font = { bold: true, size: 14 };
  summary.addRow([periodLabel(doc)]);
  summary.addRow([`Building: ${doc.building || 'All buildings'}`]);
  summary.addRow([`Generated: ${new Date(doc.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`]);
  summary.addRow([]);
  const head = summary.addRow(['Measure', 'Value', 'Notes']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4F32' } }; });
  for (const k of doc.kpis) {
    const row = summary.addRow([k.label, k.format === 'percent' ? k.value / 100 : k.value, k.hint || '']);
    row.getCell(2).numFmt = k.format === 'money' ? MONEY_FMT : k.format === 'percent' ? '0.0%' : '#,##0';
  }
  if (doc.notes.length) {
    summary.addRow([]);
    for (const note of doc.notes) summary.addRow([note]).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  const usedNames = new Set(['Summary']);
  for (const table of doc.tables) {
    let name = table.title.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
    for (let i = 2; usedNames.has(name); i++) name = `${table.title.slice(0, 28)} ${i}`;
    usedNames.add(name);
    const ws = wb.addWorksheet(name);
    ws.columns = table.columns.map((c) => ({ header: c.label, key: c.key, width: c.format === 'money' ? 18 : c.format === 'date' ? 14 : Math.max(12, Math.min(40, c.label.length + 6)) }));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4F32' } }; });

    const addRow = (values: Record<string, unknown>, bold = false) => {
      const row = ws.addRow(table.columns.map((c) => cellValue(values[c.key], c)));
      table.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.format === 'money') cell.numFmt = MONEY_FMT;
        if (c.format === 'percent') cell.numFmt = '0.0%';
        if (c.format === 'date') cell.numFmt = 'dd-mmm-yyyy';
      });
      if (bold) row.font = { bold: true };
    };
    if (!table.rows.length) ws.addRow([table.empty]).font = { italic: true, color: { argb: 'FF64748B' } };
    for (const r of table.rows) addRow(r);
    if (table.totals) addRow(table.totals, true);
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellValue(value: unknown, col: ReportColumn) {
  if (value === null || value === undefined || value === '') return null;
  if (col.format === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00Z`);
  if (col.format === 'percent' && typeof value === 'number') return value / 100;
  return value as any;
}

const MARGIN = 36;

export function reportToPdf(doc: ReportDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    pdf.on('data', (c) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const width = pdf.page.width - MARGIN * 2;
    const bottom = () => pdf.page.height - MARGIN - 20;

    // Header
    try { pdf.image(LOGO_PATH, MARGIN, MARGIN, { width: 90 }); } catch { /* logo missing — continue */ }
    pdf.fillColor('#0f172a').font('Helvetica-Bold').fontSize(18).text(doc.title, MARGIN, MARGIN, { width, align: 'right' });
    pdf.fillColor('#475569').font('Helvetica').fontSize(9.5)
      .text(periodLabel(doc), { width, align: 'right' })
      .text(`Building: ${doc.building || 'All buildings'}`, { width, align: 'right' })
      .text(COMPANY_NAME_LINE, { width, align: 'right' });
    let y = Math.max(pdf.y, MARGIN + 60) + 14;

    // KPI tiles
    const gap = 8;
    const tileW = (width - gap * (doc.kpis.length - 1)) / doc.kpis.length;
    doc.kpis.forEach((k, i) => {
      const x = MARGIN + i * (tileW + gap);
      pdf.roundedRect(x, y, tileW, 58, 6).fillAndStroke('#f8fafc', '#e2e8f0');
      pdf.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5).text(k.label.toUpperCase(), x + 8, y + 8, { width: tileW - 16 });
      pdf.fillColor('#0f172a').font('Helvetica-Bold').fontSize(14).text(formatValue(k.value, KPI_FORMAT[k.format]), x + 8, y + 21, { width: tileW - 16 });
      if (k.hint) pdf.fillColor('#64748b').font('Helvetica').fontSize(7).text(k.hint, x + 8, y + 41, { width: tileW - 16, height: 12, ellipsis: true });
    });
    y += 74;

    const ensure = (needed: number) => {
      if (y + needed > bottom()) { pdf.addPage(); y = MARGIN; }
    };

    for (const table of doc.tables) {
      ensure(60);
      pdf.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12).text(table.title, MARGIN, y, { width });
      y = pdf.y + 2;
      if (table.description) {
        pdf.fillColor('#64748b').font('Helvetica').fontSize(8).text(table.description, MARGIN, y, { width });
        y = pdf.y + 2;
      }
      y += 4;

      const weights = table.columns.map((c) => (c.format === 'money' ? 1.3 : c.format === 'date' ? 1.5 : ['client', 'building'].includes(c.key) ? 2.2 : 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const widths = weights.map((w) => (w / totalWeight) * width);
      const right = (c: ReportColumn) => c.format === 'money' || c.format === 'count' || c.format === 'percent';
      const rowH = 18;

      const drawHeader = () => {
        pdf.rect(MARGIN, y, width, rowH).fill(BRAND_ACCENT);
        let x = MARGIN;
        table.columns.forEach((c, i) => {
          pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(c.label, x + 4, y + 5, { width: widths[i] - 8, align: right(c) ? 'right' : 'left', height: rowH - 6, ellipsis: true });
          x += widths[i];
        });
        y += rowH;
      };

      const drawRow = (values: Record<string, unknown>, bold: boolean, shade: boolean) => {
        if (y + rowH > bottom()) { pdf.addPage(); y = MARGIN; drawHeader(); }
        if (shade) pdf.rect(MARGIN, y, width, rowH).fill('#f8fafc');
        let x = MARGIN;
        table.columns.forEach((c, i) => {
          pdf.fillColor('#0f172a').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
            .text(formatValue(values[c.key], c.format), x + 4, y + 5, { width: widths[i] - 8, align: right(c) ? 'right' : 'left', height: rowH - 6, ellipsis: true, lineBreak: false });
          x += widths[i];
        });
        y += rowH;
        pdf.moveTo(MARGIN, y).lineTo(MARGIN + width, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
      };

      drawHeader();
      if (!table.rows.length) {
        pdf.fillColor('#64748b').font('Helvetica-Oblique').fontSize(8.5).text(table.empty, MARGIN + 4, y + 6, { width: width - 8 });
        y = pdf.y + 6;
      }
      table.rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
      if (table.totals) drawRow(table.totals, true, false);
      y += 16;
    }

    if (doc.notes.length) {
      ensure(20 + doc.notes.length * 12);
      pdf.fillColor('#64748b').font('Helvetica-Oblique').fontSize(7.5);
      for (const note of doc.notes) { pdf.text(note, MARGIN, y, { width }); y = pdf.y + 3; }
    }

    // Footer with page numbers (drawn inside the bottom margin, so lift it while writing)
    const range = pdf.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      pdf.switchToPage(i);
      pdf.page.margins.bottom = 0;
      pdf.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
        .text(`${doc.title}  ·  Generated ${new Date(doc.generatedAt).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}  ·  Page ${i + 1} of ${range.count}`,
          MARGIN, pdf.page.height - MARGIN + 8, { width, align: 'center', lineBreak: false });
    }
    pdf.end();
  });
}
