import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { moduleMap } from '@/lib/modules';
import { computeInvoiceTotals } from '@/lib/invoice-calc';
import { generateInvoiceNumber } from '@/lib/invoices';
import { generateQuotationNumber } from '@/lib/quotations';
import { currency, publicToken } from '@/lib/utils';
import { extractStructured, Importer, ImportResult, isoDate, normText, ReviewRow, round2 } from '@/lib/ai-import';
import { loadClientLookup } from '@/lib/client-lookup';

// Importer for line-item documents (invoices and quotations) — e.g. a Zoho Books export
// with one row per line item. Each document keeps the CRM's own numbering; the number it
// had in the file is stored alongside and used to spot duplicates.

// The file's own total and the total recomputed from the extracted line items may
// differ by rounding only (e.g. 10,418.625 vs 10,418.63).
const TOTAL_TOLERANCE = 0.05;

const documentSchema = z.object({
  sourceNumber: z.string(),
  clientName: z.string(),
  email: z.string(),
  address: z.string(),
  issueDate: z.string(),
  dueDate: z.string(),
  subject: z.string(),
  status: z.string(),
  vatRegistered: z.string(),
  trnNumber: z.string(),
  total: z.number(),
  balanceDue: z.number().nullable(),
  items: z.array(z.object({
    description: z.string(),
    qty: z.number(),
    rate: z.number(),
    discountPct: z.number(),
    taxPct: z.number()
  }))
});

type ImportedDocument = z.infer<typeof documentSchema>;

type DocumentKind = {
  module: 'invoices' | 'quotations';
  noun: string;
  numberField: 'invoiceNumber' | 'quoteNumber';
  importedNumberField: 'importedInvoiceNumber' | 'importedQuoteNumber';
  dueDateField: 'dueDate' | 'validUntil';
  dueDateHint: string;
  statusHint: string;
  /** Invoices track money already received; quotations do not. */
  tracksPayments: boolean;
  tokenPrefix: string;
  generateNumber: () => Promise<string>;
};

const KINDS: Record<'invoices' | 'quotations', DocumentKind> = {
  invoices: {
    module: 'invoices',
    noun: 'invoice',
    numberField: 'invoiceNumber',
    importedNumberField: 'importedInvoiceNumber',
    dueDateField: 'dueDate',
    dueDateHint: 'the due date',
    statusHint: 'Draft→Draft; Sent/Open/Unpaid→Sent; Viewed→Viewed; Partially Paid→Part Paid; Paid/Closed→Paid; Overdue→Overdue; Void/Cancelled→Cancelled',
    tracksPayments: true,
    tokenPrefix: 'inv',
    generateNumber: generateInvoiceNumber
  },
  quotations: {
    module: 'quotations',
    noun: 'quotation',
    numberField: 'quoteNumber',
    importedNumberField: 'importedQuoteNumber',
    dueDateField: 'validUntil',
    dueDateHint: 'the date the quotation is valid until / expires',
    statusHint: 'Draft→Draft; Sent/Open→Sent; Viewed→Viewed; Accepted/Invoiced/Approved→Accepted; Declined/Rejected→Rejected; Expired→Expired',
    tracksPayments: false,
    tokenPrefix: 'quote',
    generateNumber: generateQuotationNumber
  }
};

const str = { type: 'string' };
const num = { type: 'number' };

function extractionSchema(kind: DocumentKind) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['documents'],
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sourceNumber', 'clientName', 'email', 'address', 'issueDate', 'dueDate', 'subject', 'status', 'vatRegistered', 'trnNumber', 'total', 'balanceDue', 'items'],
          properties: {
            sourceNumber: str,
            clientName: str,
            email: str,
            address: str,
            issueDate: str,
            dueDate: str,
            subject: str,
            status: { type: 'string', enum: moduleMap[kind.module].statuses },
            vatRegistered: { type: 'string', enum: ['VAT Registered', 'Non VAT Registered', ''] },
            trnNumber: str,
            total: num,
            balanceDue: { type: ['number', 'null'] },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['description', 'qty', 'rate', 'discountPct', 'taxPct'],
                properties: { description: str, qty: num, rate: num, discountPct: num, taxPct: num }
              }
            }
          }
        }
      }
    }
  };
}

function instructions(kind: DocumentKind) {
  const n = kind.noun;
  return `You extract ${n}s from a file exported from accounting software (or typed by hand) so they can be imported into a CRM.

Return every ${n} in the file. Spreadsheet exports usually have one row per LINE ITEM, with the ${n}-level columns repeated on each row: group rows that share the same ${n} number into ONE ${n} with several items. Never merge different ${n} numbers and never invent ${n}s or line items.

For each ${n}:
- sourceNumber: the ${n} number exactly as written in the file ("" if none).
- clientName: the customer / company name exactly as written.
- email: the customer's contact email ("" if none).
- address: the billing address as a single line ("" if none). Ignore a bare city/country with no street or PO box.
- issueDate: the ${n} date, YYYY-MM-DD ("" if unknown). dueDate: ${kind.dueDateHint}, YYYY-MM-DD ("" if unknown).
- subject: a short title for the ${n} — the subject, or the reference / purchase-order text if that is what describes it ("" if none).
- status: map the file's status to the closest of the allowed values: ${kind.statusHint}. Use Draft if there is no status.
- vatRegistered: "VAT Registered" or "Non VAT Registered" according to the customer's VAT treatment ("" if not stated). trnNumber: the customer's tax registration number ("" if none).
- total: the grand total as written in the file, including tax.
- balanceDue: the unpaid balance as written in the file, or null if the file does not state one.
- items: one entry per line item, in file order. description: the full item description, keeping line breaks. qty and rate exactly as written (qty may be 0). rate is the unit price BEFORE tax; if the file's prices include tax, convert to the pre-tax price. discountPct: the line discount as a percentage of qty × rate (convert a discount amount to a percentage; 0 if none). taxPct: the tax rate percentage for that line (0 if none).

Copy numbers exactly; do not round or recalculate them.`;
}

type Checked = ReviewRow & { doc: ImportedDocument; amountPaid: number; key: string };

const fallbackKey = (clientName: string, issueDate: string, total: number) => `${normText(clientName)}|${issueDate}|${round2(total)}`;

async function review(kind: DocumentKind, docs: ImportedDocument[]): Promise<Checked[]> {
  const statuses = moduleMap[kind.module].statuses;
  const [findClient, existing] = await Promise.all([
    loadClientLookup(),
    prisma.record.findMany({ where: { module: kind.module }, select: { data: true } })
  ]);

  // Already-imported documents are recognised by the number they had in the source file;
  // files with no numbers fall back to client + date + total.
  const seen = new Map<string, string>();
  for (const rec of existing) {
    const d = (rec.data as any) || {};
    const label = d[kind.numberField] || `an existing ${kind.noun}`;
    if (d[kind.importedNumberField]) seen.set(`#${normText(d[kind.importedNumberField])}`, label);
    else if (d.sourceType === 'import') seen.set(fallbackKey(d.clientName || '', d.issueDate || '', Number(d.total || 0)), label);
  }

  return docs.map((raw) => {
    const warnings: string[] = [];
    const doc: ImportedDocument = {
      ...raw,
      sourceNumber: raw.sourceNumber.trim(),
      clientName: raw.clientName.trim(),
      email: raw.email.trim(),
      address: raw.address.trim(),
      issueDate: isoDate(raw.issueDate),
      dueDate: isoDate(raw.dueDate),
      items: raw.items.filter((it) => it.description.trim())
    };

    const client = findClient(doc.clientName);
    if (client) {
      doc.clientName = client.name;
      doc.email = doc.email || client.data.email || '';
      doc.address = doc.address || client.data.address || '';
      if (!doc.vatRegistered) {
        doc.vatRegistered = client.data.vatRegistered || '';
        doc.trnNumber = doc.trnNumber || client.data.trnNumber || '';
      }
    } else if (doc.clientName) {
      warnings.push('This client is not in the Clients list.');
    }

    if (!statuses.includes(doc.status)) {
      warnings.push(`Unknown status "${doc.status}" — it will be saved as Draft.`);
      doc.status = 'Draft';
    }

    const computedTotal = computeInvoiceTotals(doc.items).total;
    if (Math.abs(computedTotal - doc.total) > TOTAL_TOLERANCE) {
      warnings.push(`The line items add up to ${round2(computedTotal).toFixed(2)} but the file's total is ${round2(doc.total).toFixed(2)}.`);
    }

    let amountPaid = 0;
    if (kind.tracksPayments) {
      if (doc.status === 'Paid') amountPaid = computedTotal;
      else if (doc.balanceDue !== null && doc.balanceDue < doc.total) amountPaid = round2(doc.total - doc.balanceDue);
    }

    const key = doc.sourceNumber ? `#${normText(doc.sourceNumber)}` : fallbackKey(doc.clientName, doc.issueDate, computedTotal);
    const duplicateOf = seen.get(key) ?? null;
    if (!duplicateOf) seen.set(key, 'another row in this file');

    const error = !doc.clientName ? 'No client name was found.' : doc.items.length === 0 ? 'No line items were found.' : null;

    return {
      record: doc,
      title: [doc.sourceNumber, doc.clientName].filter(Boolean).join(' — ') || kind.noun,
      subtitle: [doc.status, currency(computedTotal), amountPaid > 0 && doc.status !== 'Paid' ? `${currency(amountPaid)} paid` : ''].filter(Boolean).join(' · '),
      duplicateOf,
      error,
      warnings,
      doc,
      amountPaid,
      key
    };
  });
}

export function documentImporter(module: 'invoices' | 'quotations'): Importer {
  const kind = KINDS[module];
  return {
    async analyse(content) {
      const result = await extractStructured<{ documents: unknown }>({
        instructions: instructions(kind),
        schemaName: `${kind.noun}_import`,
        schema: extractionSchema(kind),
        content
      });
      const rows = await review(kind, z.array(documentSchema).parse(result.documents));
      return rows.map(({ record, title, subtitle, duplicateOf, error, warnings }) => ({ record, title, subtitle, duplicateOf, error, warnings }));
    },

    async commit(records, ctx) {
      const docs = z.array(documentSchema).parse(records);
      const rows = await review(kind, docs);
      const importedAt = new Date().toISOString();
      const out: ImportResult = { created: [], skipped: [] };

      for (const row of rows) {
        if (row.error || row.duplicateOf) {
          out.skipped.push({ title: row.title, reason: row.error || `Already imported as ${row.duplicateOf}` });
          continue;
        }
        const { doc, amountPaid } = row;
        const totals = computeInvoiceTotals(doc.items);
        // Sequential on purpose: the number is derived from the current record count.
        const number = await kind.generateNumber();
        const data: Record<string, any> = {
          [kind.numberField]: number,
          [kind.importedNumberField]: doc.sourceNumber,
          clientName: doc.clientName,
          email: doc.email,
          issueDate: doc.issueDate,
          [kind.dueDateField]: doc.dueDate,
          subject: doc.subject,
          items: doc.items,
          subTotal: totals.subTotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          amount: totals.total,
          description: doc.subject,
          vatRegistered: doc.vatRegistered,
          trnNumber: doc.vatRegistered === 'VAT Registered' ? doc.trnNumber : '',
          sourceType: 'import',
          importedFrom: ctx.fileName,
          importedAt
        };
        if (module === 'invoices') data.address = doc.address;
        // Payments made before the import have no payment records in the CRM, so they are
        // kept separately and added back whenever the paid amount is recalculated.
        if (amountPaid > 0) Object.assign(data, { amountPaid, importedAmountPaid: amountPaid });

        const record = await prisma.record.create({
          data: { module, title: doc.clientName, status: doc.status, publicToken: publicToken(kind.tokenPrefix), createdById: ctx.userId, data }
        });
        await auditLog({ userId: ctx.userId, action: 'IMPORT', module, recordId: record.id, ipAddress: ctx.ipAddress, after: data });
        out.created.push({ title: `${number} — ${doc.clientName}`, subtitle: [doc.sourceNumber && `uploaded as ${doc.sourceNumber}`, doc.status, currency(totals.total)].filter(Boolean).join(' · ') });
      }
      return out;
    }
  };
}
