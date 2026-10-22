import { prisma } from '@/lib/db';
import { MonthlyPoint, REPORT_TITLES, ReportDoc, ReportKey, ReportKpi, ReportTable } from '@/lib/report-types';

// Builds the Reports / Accounting pages straight from existing CRM records — nothing
// is stored separately, so the numbers always match the modules they come from.
//
// Where the data lives:
//   revenue / pending / overdue  -> invoices (total, amountPaid, issueDate, dueDate)
//   money collected              -> payments (Received) + cheques that have cleared
//   occupancy                    -> Services & Offices (status per office)
//   contracts                    -> contracts (startDate, endDate, status)
//   building                     -> office / contract "location"; invoices, payments and
//                                   cheques have no building, so they take the building
//                                   of the client's contract.

export type ReportFilter = { from: string; to: string; building: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS = 90;
// A contract starting within this many days after the same client's previous contract
// ended counts as a renewal rather than a new contract.
const RENEWAL_GAP_DAYS = 60;

const NO_BUILDING = 'No building on record';
const INVOICE_EXCLUDED = ['Draft', 'Cancelled'];
const CHEQUE_CLEARED = ['Deposited', 'Paid By Bank Transfer', 'Paid By Cash'];
const CHEQUE_IN_HAND = ['Received', 'Cheque Deferred/Hold'];
const CONTRACT_EXCLUDED = ['Draft', 'Cancelled'];
const CONTRACT_LIVE = ['Active', 'Signed By Client', 'Signed By Company'];
// Virtual offices and meeting rooms are not physical offices that can be occupied.
const NOT_OFFICES = ['Virtual Office', 'Meeting Room'];

/** Today's date in the UAE as YYYY-MM-DD. */
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
}

function isoDate(value: unknown) {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

const inRange = (date: string, from: string, to: string) => Boolean(date) && date >= from && date <= to;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = <T>(rows: T[], pick: (r: T) => number) => round2(rows.reduce((a, r) => a + pick(r), 0));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const nameKey = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Building names are typed by hand ("Khalidiyah Towers", "khalidiyah Towers", "Khalidiya"),
 * so spellings that differ only by case/spacing — or where one is a clear prefix of another —
 * are grouped under the most common spelling.
 */
function buildingIndex(names: string[]) {
  const counts: Record<string, Record<string, number>> = {};
  for (const raw of names) {
    const label = String(raw || '').trim().replace(/\s+/g, ' ');
    const key = nameKey(label);
    if (!key) continue;
    counts[key] = counts[key] || {};
    counts[key][label] = (counts[key][label] || 0) + 1;
  }
  const total = (key: string) => Object.values(counts[key]).reduce((a, n) => a + n, 0);
  const keys = Object.keys(counts);
  const target: Record<string, string> = {};
  for (const key of keys) {
    const longer = key.length >= 5 ? keys.filter((k) => k !== key && k.startsWith(key)) : [];
    target[key] = longer.length ? longer.sort((a, b) => total(b) - total(a))[0] : key;
  }
  const labelFor: Record<string, string> = {};
  for (const key of keys) {
    if (target[key] !== key) continue;
    const merged: Record<string, number> = {};
    for (const k of keys.filter((k) => target[k] === key)) {
      for (const [label, n] of Object.entries(counts[k])) merged[label] = (merged[label] || 0) + n;
    }
    labelFor[key] = Object.entries(merged).sort((a, b) => b[1] - a[1])[0][0];
  }
  return {
    canonical(raw: unknown) {
      const key = nameKey(raw);
      return key && target[key] ? labelFor[target[key]] : '';
    },
    list: Object.values(labelFor).sort((a, b) => a.localeCompare(b))
  };
}

type Row = { id: string; status: string; createdAt: Date; data: any };

async function load(module: string): Promise<Row[]> {
  const rows = await prisma.record.findMany({ where: { module }, select: { id: true, status: true, createdAt: true, data: true } });
  return rows.map((r) => ({ ...r, data: (r.data as any) || {} }));
}

async function loadData() {
  const [offices, contracts, invoices, payments, cheques] = await Promise.all([
    load('services-offices'), load('contracts'), load('invoices'), load('payments'), load('cheques')
  ]);
  const today = todayIso();
  const buildings = buildingIndex([...offices.map((r) => r.data.location), ...contracts.map((r) => r.data.location)]);

  const contractRows = contracts.map((r) => ({
    id: r.id,
    status: r.status,
    number: String(r.data.contractNumber || ''),
    client: String(r.data.clientName || ''),
    clientKey: nameKey(r.data.clientName),
    building: buildings.canonical(r.data.location) || NO_BUILDING,
    start: isoDate(r.data.startDate),
    end: isoDate(r.data.endDate),
    rent: num(r.data.monthlyRent),
    renewal: false,
    renewedLater: false
  })).filter((c) => !CONTRACT_EXCLUDED.includes(c.status));

  // Renewals: per client, a contract that starts soon after (or overlaps) the previous one.
  const byClient: Record<string, typeof contractRows> = {};
  for (const c of contractRows) if (c.clientKey) (byClient[c.clientKey] = byClient[c.clientKey] || []).push(c);
  for (const list of Object.values(byClient)) {
    list.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (prev.end && cur.start && cur.start > prev.start && daysBetween(prev.end, cur.start) <= RENEWAL_GAP_DAYS) {
        cur.renewal = true;
        prev.renewedLater = true;
      }
    }
  }

  // Building of each client, from their most recent contract.
  const clientBuilding: Record<string, string> = {};
  for (const c of [...contractRows].sort((a, b) => a.start.localeCompare(b.start))) {
    if (c.clientKey && c.building !== NO_BUILDING) clientBuilding[c.clientKey] = c.building;
  }
  const buildingOfClient = (client: unknown) => clientBuilding[nameKey(client)] || NO_BUILDING;

  const invoiceRows = invoices.filter((r) => !INVOICE_EXCLUDED.includes(r.status)).map((r) => {
    const total = num(r.data.total ?? r.data.amount);
    const paid = r.status === 'Paid' ? total : Math.min(num(r.data.amountPaid), total);
    const balance = round2(Math.max(total - paid, 0));
    const due = isoDate(r.data.dueDate);
    return {
      id: r.id,
      number: String(r.data.invoiceNumber || ''),
      client: String(r.data.clientName || ''),
      building: buildingOfClient(r.data.clientName),
      issue: isoDate(r.data.issueDate) || isoDate(r.createdAt),
      due,
      total,
      paid,
      balance,
      overdue: balance > 0 && ((due && due < today) || r.status === 'Overdue'),
      status: r.status
    };
  });

  const collections = [
    ...payments.filter((r) => r.status === 'Received').map((r) => ({
      date: isoDate(r.data.paymentDate) || isoDate(r.data.paidAt) || isoDate(r.createdAt),
      client: String(r.data.clientName || ''),
      building: buildingOfClient(r.data.clientName),
      type: 'Payment',
      method: String(r.data.method || ''),
      reference: String(r.data.invoiceNumber || r.data.reference || ''),
      amount: num(r.data.amount)
    })),
    ...cheques.filter((r) => CHEQUE_CLEARED.includes(r.status)).map((r) => ({
      date: isoDate(r.data.chequeDate),
      client: String(r.data.clientName || ''),
      building: buildingOfClient(r.data.clientName),
      type: 'Cheque',
      method: r.status === 'Deposited' ? `Cheque – ${r.data.bankName || 'bank'}` : r.status.replace('Paid By ', ''),
      reference: String(r.data.chequeNumber || ''),
      amount: num(r.data.amount)
    }))
  ];

  const chequesInHand = cheques.filter((r) => CHEQUE_IN_HAND.includes(r.status)).map((r) => ({
    date: isoDate(r.data.chequeDate),
    client: String(r.data.clientName || ''),
    building: buildingOfClient(r.data.clientName),
    number: String(r.data.chequeNumber || ''),
    bank: String(r.data.bankName || ''),
    amount: num(r.data.amount),
    status: r.status
  }));

  const officeRows = offices
    .filter((r) => !NOT_OFFICES.includes(r.data.serviceType) && r.status !== 'Inactive')
    .map((r) => ({ status: r.status, building: buildings.canonical(r.data.location) || NO_BUILDING }));

  return { today, buildings: buildings.list, contractRows, invoiceRows, collections, chequesInHand, officeRows };
}

type Data = Awaited<ReturnType<typeof loadData>>;

function monthsBetween(from: string, to: string) {
  const out: { month: string; label: string }[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  while (out.length < 120) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > endKey) break;
    out.push({ month, label: new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function accounting(d: Data, f: ReportFilter) {
  const invoices = d.invoiceRows.filter((i) => inRange(i.issue, f.from, f.to));
  const collected = d.collections.filter((c) => inRange(c.date, f.from, f.to));
  const pending = invoices.filter((i) => i.balance > 0 && !i.overdue);
  const overdue = invoices.filter((i) => i.overdue);

  const kpis: ReportKpi[] = [
    { label: 'Total Revenue', value: sum(invoices, (i) => i.total), format: 'money', hint: `${plural(invoices.length, 'invoice')} issued in this period` },
    { label: 'Payments Collected', value: sum(collected, (c) => c.amount), format: 'money', hint: 'Recorded payments + cleared cheques', tone: 'good' },
    { label: 'Pending Payments', value: sum(pending, (i) => i.balance), format: 'money', hint: `${plural(pending.length, 'invoice')} not yet due`, tone: 'warning' },
    { label: 'Overdue Payments', value: sum(overdue, (i) => i.balance), format: 'money', hint: `${plural(overdue.length, 'invoice')} past due date`, tone: 'critical' },
    { label: 'Cheques in Hand', value: sum(d.chequesInHand, (c) => c.amount), format: 'money', hint: `${plural(d.chequesInHand.length, 'cheque')} received, not yet deposited` }
  ];

  const monthly: MonthlyPoint[] = [];
  const rows = monthsBetween(f.from, f.to).map(({ month, label }) => {
    const inv = invoices.filter((i) => i.issue.startsWith(month));
    const col = collected.filter((c) => c.date.startsWith(month));
    const payments = sum(col.filter((c) => c.type === 'Payment'), (c) => c.amount);
    const cheques = sum(col.filter((c) => c.type === 'Cheque'), (c) => c.amount);
    const invoiced = sum(inv, (i) => i.total);
    monthly.push({ month, label, invoiced, collected: round2(payments + cheques) });
    return { month: label, invoiced, payments, cheques, collected: round2(payments + cheques), outstanding: sum(inv, (i) => i.balance) };
  });

  const table: ReportTable = {
    title: 'Monthly Income Summary',
    description: 'Invoiced amounts by issue month; collections by payment or cheque date. Outstanding is what is still unpaid on that month’s invoices.',
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'invoiced', label: 'Invoiced', format: 'money' },
      { key: 'payments', label: 'Payments Received', format: 'money' },
      { key: 'cheques', label: 'Cheques Cleared', format: 'money' },
      { key: 'collected', label: 'Total Collected', format: 'money' },
      { key: 'outstanding', label: 'Outstanding', format: 'money' }
    ],
    rows,
    totals: {
      month: 'Total',
      invoiced: sum(rows, (r) => r.invoiced),
      payments: sum(rows, (r) => r.payments),
      cheques: sum(rows, (r) => r.cheques),
      collected: sum(rows, (r) => r.collected),
      outstanding: sum(rows, (r) => r.outstanding)
    },
    empty: 'No invoices or collections in this period.'
  };

  return { kpis, monthly, tables: [table], notes: [] as string[] };
}

function occupancy(d: Data) {
  const offices = d.officeRows;
  const count = (status: string, list = offices) => list.filter((o) => o.status === status).length;
  const total = offices.length;
  const occupied = count('Occupied');
  const pct = (n: number, of: number) => (of ? round2((n / of) * 100) : 0);

  const kpis: ReportKpi[] = [
    { label: 'Total Offices', value: total, format: 'count', hint: 'Private & co-working offices (excl. inactive)' },
    { label: 'Occupied Offices', value: occupied, format: 'count', tone: 'good' },
    { label: 'Available / Vacant', value: count('Available'), format: 'count', hint: count('Reserved') ? `+ ${count('Reserved')} reserved` : undefined, tone: 'warning' },
    { label: 'Occupancy', value: pct(occupied, total), format: 'percent', hint: 'Occupied ÷ total offices' }
  ];

  const byBuilding = Array.from(new Set(offices.map((o) => o.building))).sort().map((building) => {
    const list = offices.filter((o) => o.building === building);
    return {
      building,
      total: list.length,
      occupied: count('Occupied', list),
      reserved: count('Reserved', list),
      available: count('Available', list),
      maintenance: count('Maintenance', list),
      occupancy: pct(count('Occupied', list), list.length)
    };
  });

  const live = d.contractRows.filter((c) => CONTRACT_LIVE.includes(c.status) && c.start <= d.today && (!c.end || c.end >= d.today));
  const tenants = Array.from(new Set(live.map((c) => c.building))).sort().map((building) => {
    const list = live.filter((c) => c.building === building);
    return { building, contracts: list.length, rent: sum(list, (c) => c.rent) };
  });

  const tables: ReportTable[] = [
    {
      title: 'Breakdown by Building',
      columns: [
        { key: 'building', label: 'Building' },
        { key: 'total', label: 'Total', format: 'count' },
        { key: 'occupied', label: 'Occupied', format: 'count' },
        { key: 'reserved', label: 'Reserved', format: 'count' },
        { key: 'available', label: 'Available', format: 'count' },
        { key: 'maintenance', label: 'Maintenance', format: 'count' },
        { key: 'occupancy', label: 'Occupancy %', format: 'percent' }
      ],
      rows: byBuilding,
      totals: byBuilding.length > 1 ? { building: 'Total', total, occupied, reserved: count('Reserved'), available: count('Available'), maintenance: count('Maintenance'), occupancy: pct(occupied, total) } : undefined,
      empty: 'No offices are set up yet. Add each office under Spaces > Services & Offices, with its building as the Address Location and its current status, to see occupancy here.'
    },
    {
      title: 'Tenants with Active Contracts',
      description: 'Contracts running today, by building (from the Contracts module).',
      columns: [
        { key: 'building', label: 'Building' },
        { key: 'contracts', label: 'Active Contracts', format: 'count' },
        { key: 'rent', label: 'Monthly Rent', format: 'money' }
      ],
      rows: tenants,
      totals: tenants.length > 1 ? { building: 'Total', contracts: live.length, rent: sum(live, (c) => c.rent) } : undefined,
      empty: 'No active contracts today.'
    }
  ];

  return { kpis, tables, notes: ['Occupancy shows the current status of each office; the date range does not apply to this report.'] };
}

function contracts(d: Data, f: ReportFilter) {
  const all = d.contractRows;
  const active = all.filter((c) => CONTRACT_LIVE.includes(c.status) && c.start && c.start <= f.to && (!c.end || c.end >= f.from));
  const started = all.filter((c) => inRange(c.start, f.from, f.to));
  const fresh = started.filter((c) => !c.renewal);
  const renewed = started.filter((c) => c.renewal);
  const expired = all.filter((c) => inRange(c.end, f.from, f.to) && c.end < d.today);
  const horizon = addDays(d.today, UPCOMING_DAYS);
  const upcoming = all
    .filter((c) => CONTRACT_LIVE.includes(c.status) && !c.renewedLater && inRange(c.end, d.today, horizon))
    .sort((a, b) => a.end.localeCompare(b.end));

  const kpis: ReportKpi[] = [
    { label: 'Active Contracts', value: active.length, format: 'count', hint: 'Running at any point in this period', tone: 'good' },
    { label: 'New Contracts', value: fresh.length, format: 'count', hint: 'Started in this period' },
    { label: 'Renewed Contracts', value: renewed.length, format: 'count', hint: 'Follow-on contracts started in this period' },
    { label: 'Expired Contracts', value: expired.length, format: 'count', hint: 'Ended in this period', tone: 'critical' },
    { label: 'Upcoming Renewals', value: upcoming.length, format: 'count', hint: `Ending in the next ${UPCOMING_DAYS} days`, tone: 'warning' }
  ];

  const base = [
    { key: 'client', label: 'Client' },
    { key: 'building', label: 'Building' },
    { key: 'number', label: 'Contract #' }
  ];

  const tables: ReportTable[] = [
    {
      title: `Upcoming Renewals (next ${UPCOMING_DAYS} days)`,
      columns: [...base, { key: 'end', label: 'End Date', format: 'date' }, { key: 'daysLeft', label: 'Days Left', format: 'count' }, { key: 'rent', label: 'Monthly Rent', format: 'money' }],
      rows: upcoming.map((c) => ({ client: c.client, building: c.building, number: c.number, end: c.end, daysLeft: daysBetween(d.today, c.end), rent: c.rent })),
      empty: `No contracts end in the next ${UPCOMING_DAYS} days.`
    },
    {
      title: 'New & Renewed Contracts',
      columns: [...base, { key: 'type', label: 'Type' }, { key: 'start', label: 'Start Date', format: 'date' }, { key: 'end', label: 'End Date', format: 'date' }, { key: 'rent', label: 'Monthly Rent', format: 'money' }],
      rows: started.sort((a, b) => a.start.localeCompare(b.start)).map((c) => ({ client: c.client, building: c.building, number: c.number, type: c.renewal ? 'Renewal' : 'New', start: c.start, end: c.end, rent: c.rent })),
      empty: 'No contracts started in this period.'
    },
    {
      title: 'Expired Contracts',
      columns: [...base, { key: 'start', label: 'Start Date', format: 'date' }, { key: 'end', label: 'End Date', format: 'date' }, { key: 'renewed', label: 'Renewed?' }],
      rows: expired.sort((a, b) => a.end.localeCompare(b.end)).map((c) => ({ client: c.client, building: c.building, number: c.number, start: c.start, end: c.end, renewed: c.renewedLater ? 'Yes' : 'No' })),
      empty: 'No contracts ended in this period.'
    }
  ];

  return {
    kpis,
    tables,
    notes: [`A contract counts as a renewal when the same client's previous contract ended no more than ${RENEWAL_GAP_DAYS} days before it starts.`]
  };
}

function paymentsReport(d: Data, f: ReportFilter) {
  const invoices = d.invoiceRows.filter((i) => inRange(i.issue, f.from, f.to));
  const collected = d.collections.filter((c) => inRange(c.date, f.from, f.to)).sort((a, b) => b.date.localeCompare(a.date));
  const pending = invoices.filter((i) => i.balance > 0 && !i.overdue).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const overdue = invoices.filter((i) => i.overdue).sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  const upcoming = d.chequesInHand.filter((c) => c.date >= d.today).sort((a, b) => a.date.localeCompare(b.date));
  const next30 = upcoming.filter((c) => c.date <= addDays(d.today, 30));

  const kpis: ReportKpi[] = [
    { label: 'Collected Payments', value: sum(collected, (c) => c.amount), format: 'money', hint: `${plural(collected.length, 'payment')} & cleared cheques`, tone: 'good' },
    { label: 'Pending Payments', value: sum(pending, (i) => i.balance), format: 'money', hint: `${plural(pending.length, 'invoice')} not yet due`, tone: 'warning' },
    { label: 'Overdue Payments', value: sum(overdue, (i) => i.balance), format: 'money', hint: `${plural(overdue.length, 'invoice')} past due date`, tone: 'critical' },
    { label: 'Upcoming Cheques', value: sum(upcoming, (c) => c.amount), format: 'money', hint: `${plural(upcoming.length, 'cheque')} · ${next30.length} due in 30 days` }
  ];

  const invoiceCols = [
    { key: 'number', label: 'Invoice #' },
    { key: 'client', label: 'Client' },
    { key: 'issue', label: 'Issued', format: 'date' as const },
    { key: 'due', label: 'Due', format: 'date' as const },
    { key: 'total', label: 'Total', format: 'money' as const },
    { key: 'paid', label: 'Paid', format: 'money' as const },
    { key: 'balance', label: 'Balance', format: 'money' as const }
  ];
  const invoiceRow = (i: (typeof invoices)[number]) => ({ number: i.number, client: i.client, issue: i.issue, due: i.due, total: i.total, paid: i.paid, balance: i.balance });

  const tables: ReportTable[] = [
    {
      title: 'Collected Payments',
      columns: [
        { key: 'date', label: 'Date', format: 'date' },
        { key: 'client', label: 'Client' },
        { key: 'type', label: 'Type' },
        { key: 'method', label: 'Method' },
        { key: 'reference', label: 'Invoice / Cheque #' },
        { key: 'amount', label: 'Amount', format: 'money' }
      ],
      rows: collected.map((c) => ({ date: c.date, client: c.client, type: c.type, method: c.method, reference: c.reference, amount: c.amount })),
      totals: collected.length ? { date: 'Total', amount: sum(collected, (c) => c.amount) } : undefined,
      empty: 'Nothing collected in this period.'
    },
    {
      title: 'Pending Payments',
      description: 'Unpaid balances on invoices issued in this period that are not yet due.',
      columns: invoiceCols,
      rows: pending.map(invoiceRow),
      totals: pending.length ? { number: 'Total', balance: sum(pending, (i) => i.balance) } : undefined,
      empty: 'No pending payments.'
    },
    {
      title: 'Overdue Payments',
      columns: [...invoiceCols, { key: 'daysOverdue', label: 'Days Overdue', format: 'count' }],
      rows: overdue.map((i) => ({ ...invoiceRow(i), daysOverdue: i.due ? Math.max(daysBetween(i.due, d.today), 0) : null })),
      totals: overdue.length ? { number: 'Total', balance: sum(overdue, (i) => i.balance) } : undefined,
      empty: 'No overdue payments.'
    },
    {
      title: 'Upcoming Cheque Payments',
      description: 'Post-dated cheques received and not yet deposited, dated today or later (all future dates).',
      columns: [
        { key: 'date', label: 'Cheque Date', format: 'date' },
        { key: 'client', label: 'Client' },
        { key: 'number', label: 'Cheque #' },
        { key: 'bank', label: 'Bank' },
        { key: 'status', label: 'Status' },
        { key: 'daysUntil', label: 'Days Until', format: 'count' },
        { key: 'amount', label: 'Amount', format: 'money' }
      ],
      rows: upcoming.map((c) => ({ date: c.date, client: c.client, number: c.number, bank: c.bank, status: c.status, daysUntil: daysBetween(d.today, c.date), amount: c.amount })),
      totals: upcoming.length ? { date: 'Total', amount: sum(upcoming, (c) => c.amount) } : undefined,
      empty: 'No upcoming cheques.'
    }
  ];

  return { kpis, tables, notes: ['Pending and overdue cover invoices issued in the selected period. Upcoming cheques are not limited by the period.'] };
}

/** Keeps only rows for the chosen building (rows carry a `building` field). */
function forBuilding(d: Data, building: string): Data {
  if (!building) return d;
  const keep = <T extends { building: string }>(rows: T[]) => rows.filter((r) => r.building === building);
  return {
    ...d,
    contractRows: keep(d.contractRows),
    invoiceRows: keep(d.invoiceRows),
    collections: keep(d.collections),
    chequesInHand: keep(d.chequesInHand),
    officeRows: keep(d.officeRows)
  };
}

export async function buildReport(key: ReportKey, filter: ReportFilter): Promise<ReportDoc> {
  const all = await loadData();
  const buildings = [...all.buildings, NO_BUILDING];
  const building = buildings.includes(filter.building) ? filter.building : '';
  const d = forBuilding(all, building);
  const f = { ...filter, building };

  const body =
    key === 'report-accounting' ? accounting(d, f)
      : key === 'report-occupancy' ? occupancy(d)
        : key === 'report-contracts' ? contracts(d, f)
          : paymentsReport(d, f);

  const notes = [...body.notes];
  if (key !== 'report-occupancy' && key !== 'report-contracts') {
    notes.push('Invoices, payments and cheques have no building of their own; they are grouped by the building on the client’s contract.');
  }

  return {
    key,
    title: REPORT_TITLES[key],
    from: f.from,
    to: f.to,
    building,
    snapshot: key === 'report-occupancy',
    generatedAt: new Date().toISOString(),
    monthly: 'monthly' in body ? (body.monthly as MonthlyPoint[]) : undefined,
    kpis: body.kpis,
    tables: body.tables,
    notes,
    buildings
  };
}
