import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { ModuleConfig, ModuleField, moduleMap } from '@/lib/modules';
import { generateContractNumber } from '@/lib/contracts';
import { currency, fmtDate, isReminderDue, recordTitle } from '@/lib/utils';
import { extractStructured, ImportError, Importer, ImportResult, isoDate, normText, ReviewRow, round2 } from '@/lib/ai-import';
import { loadClientLookup } from '@/lib/client-lookup';

// Importer for ordinary one-row-per-record modules (Clients, Contracts, Cheques, ...).
// The fields OpenAI fills in come straight from the module's form definition in
// lib/modules.ts; this file only adds what the form cannot say — how to spot duplicates
// and what else has to happen on save.

type Config = {
  /** Extra guidance for the model about this module's columns. */
  hint?: string;
  /** Keys that identify the same real-world record; any shared key means duplicate. */
  dedupeKeys: (data: Record<string, any>) => string[];
  /** Adjusts the data just before saving (numbering, reminder flags, ...). */
  beforeSave?: (data: Record<string, any>) => Promise<void> | void;
};

const key = (...parts: unknown[]) => (parts.every((p) => p !== '' && p !== null && p !== undefined) ? parts.map((p) => (typeof p === 'number' ? round2(p) : normText(p))).join('|') : null);
const keys = (...list: (string | null)[]) => list.filter((k): k is string => !!k);

/**
 * The reminder job (app/api/cron/expiry-scan) emails a client for every reminder date that
 * has passed. A historical import would otherwise trigger a burst of emails about dates that
 * are long gone, so reminders already due at import time are marked as sent.
 */
function markPastReminders(data: Record<string, any>, targets: { dateField: string; flags: string[]; daysBefore?: number }[]) {
  const now = new Date().toISOString();
  for (const t of targets) {
    if (isReminderDue(data[t.dateField], t.daysBefore ?? 0)) for (const flag of t.flags) data[flag] = data[flag] || now;
  }
}

const CONFIGS: Record<string, Config> = {
  clients: {
    hint: 'companyName is the tenant / customer company; contactName is the main contact person at that company. address is the full postal / billing address.',
    dedupeKeys: (d) => keys(key('name', d.companyName), key('licence', d.tradeLicenseNumber))
  },
  contracts: {
    hint: 'clientName is the tenant / customer company. startDate and endDate are the contract period. monthlyRent is the rent per month and depositAmount the security deposit; if only a total contract value is given, leave monthlyRent empty. renewalReminderAt / expiryReminderAt only if the file states them.',
    dedupeKeys: (d) => keys(key(d.clientName, d.startDate, d.endDate)),
    async beforeSave(d) {
      d.contractNumber = await generateContractNumber();
      markPastReminders(d, [
        { dateField: 'renewalReminderAt', flags: ['renewalEmailQueuedAt'] },
        { dateField: 'expiryReminderAt', flags: ['expiryEmailQueuedAt', 'whatsappReminderQueuedAt'] }
      ]);
    }
  },
  cheques: {
    hint: 'clientName is the tenant / company the cheque is from. chequeDate is the date written on the cheque (when it can be deposited); receivedDate is when the cheque was received. handedOverBy is the person who handed the cheque over.',
    dedupeKeys: (d) => keys(key(d.clientName, d.amount, d.chequeDate, d.bankName)),
    beforeSave(d) {
      markPastReminders(d, [
        { dateField: 'chequeDate', flags: ['depositNoticeQueuedAt'], daysBefore: 20 },
        { dateField: 'chequeDate', flags: ['depositReminderQueuedAt'], daysBefore: 5 }
      ]);
    }
  },
  deposits: {
    hint: 'clientName is the tenant / company the security deposit belongs to. amount is the deposit amount.',
    dedupeKeys: (d) => keys(key(d.clientName, d.amount, d.paidDate))
  },
  'services-offices': {
    hint: 'One record per office / unit / desk / virtual office package. unitName is the office or unit name / number.',
    dedupeKeys: (d) => keys(key(d.unitName, d.location))
  }
};

const IMPORTABLE_TYPES = new Set(['text', 'email', 'tel', 'select', 'textarea', 'date', 'datetime', 'time', 'money', 'number', 'checkbox']);
const isNumeric = (f: ModuleField) => f.type === 'money' || f.type === 'number';
const isClientField = (f: ModuleField) => f.optionsSource === 'clients' && f.optionsValueField === 'companyName';
const importableFields = (module: ModuleConfig) => module.fields.filter((f) => IMPORTABLE_TYPES.has(f.type) && (!f.optionsSource || isClientField(f)));

function fieldSchema(f: ModuleField) {
  const description = f.type === 'date' ? `${f.label} (YYYY-MM-DD)`
    : f.type === 'datetime' ? `${f.label} (ISO date-time, e.g. 2026-09-28T14:30)`
    : f.type === 'time' ? `${f.label} (24-hour HH:MM)`
    : isNumeric(f) ? `${f.label} (plain number, no currency or thousands separators)`
    : f.label;
  if (isNumeric(f)) return { type: ['number', 'null'], description };
  if (f.type === 'checkbox') return { type: ['boolean', 'null'], description };
  if (f.type === 'select' && f.options) return { type: 'string', enum: [...f.options, ''], description: `${description} — pick the closest allowed value, or "" if none fits` };
  return { type: 'string', description };
}

function extractionSchema(module: ModuleConfig) {
  const fields = importableFields(module);
  const properties: Record<string, unknown> = Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)]));
  properties.status = { type: 'string', enum: module.statuses, description: 'Record status' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['records'],
    properties: {
      records: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: [...fields.map((f) => f.name), 'status'], properties }
      }
    }
  };
}

function instructions(module: ModuleConfig, config: Config) {
  const noun = module.singular.toLowerCase();
  return `You extract ${module.title} records from a file (a spreadsheet export, a list, or text typed by hand) so they can be imported into a CRM for a business centre.

Return every ${noun} in the file — usually one per spreadsheet row; if several rows clearly describe the same ${noun}, combine them into one. Never invent records or values: use "" (or null for numbers) when the file does not give a value. Copy names, numbers and amounts exactly.
${config.hint ? `\n${config.hint}\n` : ''}
status: the closest allowed status for the record. Use "${module.defaultStatus || module.statuses[0]}" if the file gives no status.`;
}

/** Turns one model / browser record into clean data for this module's fields. */
function cleanRecord(module: ModuleConfig, raw: Record<string, any>, findClient: Awaited<ReturnType<typeof loadClientLookup>>) {
  const data: Record<string, any> = {};
  const warnings: string[] = [];
  let error: string | null = null;

  for (const f of importableFields(module)) {
    const v = raw[f.name];
    if (isNumeric(f)) {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/[^0-9.-]/g, '')) : NaN;
      if (Number.isFinite(n)) data[f.name] = n;
    } else if (f.type === 'checkbox') {
      if (typeof v === 'boolean') data[f.name] = v;
    } else {
      let s = String(v ?? '').trim();
      if (f.type === 'date' && s && !isoDate(s)) { warnings.push(`${f.label} "${s}" is not a valid date and was left empty.`); s = ''; }
      if (f.type === 'select' && f.options && s) {
        const match = f.options.find((o) => normText(o) === normText(s));
        if (!match) warnings.push(`${f.label} "${s}" is not one of the options and was left empty.`);
        s = match || '';
      }
      if (s) data[f.name] = s;
    }
  }

  for (const f of importableFields(module).filter(isClientField)) {
    if (!data[f.name]) continue;
    const client = findClient(data[f.name]);
    if (!client) { warnings.push(`${data[f.name]} is not in the Clients list.`); continue; }
    data[f.name] = client.name;
    if (f.autofill && !data[f.autofill.targetField] && client.data[f.autofill.sourceDataField]) {
      data[f.autofill.targetField] = client.data[f.autofill.sourceDataField];
    }
  }

  const status = module.statuses.includes(raw.status) ? raw.status : module.defaultStatus || module.statuses[0];
  if (raw.status && raw.status !== status) warnings.push(`Unknown status "${raw.status}" — it will be saved as ${status}.`);

  // The first required field names the record (company, client, unit, ...): without it the
  // row cannot be imported. Other missing required fields can be filled in afterwards.
  const required = importableFields(module).filter((f) => f.required);
  const [primary, ...rest] = required;
  if (primary && (data[primary.name] === undefined || data[primary.name] === '')) error = `${primary.label} is missing.`;
  const missing = rest.filter((f) => data[f.name] === undefined || data[f.name] === '').map((f) => f.label);
  if (missing.length) warnings.push(`Missing: ${missing.join(', ')}.`);

  return { data, status, warnings, error };
}

function subtitleFor(module: ModuleConfig, data: Record<string, any>, status: string) {
  const fields = new Map(module.fields.map((f) => [f.name, f]));
  const parts = module.tableFields.filter((n) => n !== 'status' && data[n] !== undefined && data[n] !== '').slice(0, 3).map((n) => {
    const f = fields.get(n);
    if (f?.type === 'money') return currency(data[n]);
    if (f?.type === 'date') return fmtDate(data[n]);
    return String(data[n]);
  });
  return [status, ...parts].join(' · ');
}

type Checked = ReviewRow & { status: string };

async function review(module: ModuleConfig, config: Config, raws: Record<string, any>[]): Promise<Checked[]> {
  const [findClient, existing] = await Promise.all([
    loadClientLookup(),
    prisma.record.findMany({ where: { module: module.slug }, select: { title: true, data: true } })
  ]);
  const seen = new Map<string, string>();
  for (const rec of existing) {
    const d = (rec.data as any) || {};
    for (const k of config.dedupeKeys(d)) seen.set(k, d.contractNumber || rec.title);
  }

  return raws.map((raw) => {
    const { data, status, warnings, error } = cleanRecord(module, raw || {}, findClient);
    const recordKeys = config.dedupeKeys(data);
    const duplicateOf = recordKeys.map((k) => seen.get(k)).find(Boolean) ?? null;
    if (!duplicateOf) for (const k of recordKeys) seen.set(k, 'another row in this file');
    return {
      record: { ...data, status },
      title: recordTitle(module.slug, data),
      subtitle: subtitleFor(module, data, status),
      duplicateOf,
      error,
      warnings,
      status
    };
  });
}

export function hasRecordImporter(slug: string) {
  return slug in CONFIGS;
}

export function recordImporter(slug: string): Importer {
  const module = moduleMap[slug];
  const config = CONFIGS[slug];
  if (!module || !config) throw new ImportError('Import is not available for this module.');

  return {
    async analyse(content) {
      const result = await extractStructured<{ records: Record<string, any>[] }>({
        instructions: instructions(module, config),
        schemaName: `${slug.replace(/-/g, '_')}_import`,
        schema: extractionSchema(module),
        content
      });
      if (!Array.isArray(result.records)) throw new ImportError('OpenAI returned an unexpected answer. Please try again.');
      const rows = await review(module, config, result.records);
      return rows.map(({ status: _status, ...row }) => row);
    },

    async commit(records, ctx) {
      const rows = await review(module, config, records);
      const importedAt = new Date().toISOString();
      const out: ImportResult = { created: [], skipped: [] };

      for (const row of rows) {
        if (row.error || row.duplicateOf) {
          out.skipped.push({ title: row.title, reason: row.error || `Already exists as ${row.duplicateOf}` });
          continue;
        }
        const { status: _status, ...fields } = row.record;
        const data: Record<string, any> = { ...fields, importedFrom: ctx.fileName, importedAt };
        // Sequential on purpose: generated numbers are derived from the current record count.
        await config.beforeSave?.(data);
        const title = recordTitle(slug, data);
        const record = await prisma.record.create({
          data: { module: slug, title, status: row.status, source: data.source, location: data.location, createdById: ctx.userId, data }
        });
        await auditLog({ userId: ctx.userId, action: 'IMPORT', module: slug, recordId: record.id, ipAddress: ctx.ipAddress, after: data });
        out.created.push({ title: data.contractNumber ? `${data.contractNumber} — ${title}` : title, subtitle: row.subtitle });
      }
      return out;
    }
  };
}
