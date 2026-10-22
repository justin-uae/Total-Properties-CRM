// Shared shapes for the Reports / Accounting pages. Dependency-free so both the
// client page (components/ReportPage.tsx) and the server builders (lib/reports.ts)
// can import it.

export const REPORT_TITLES = {
  'report-accounting': 'Accounting Report',
  'report-occupancy': 'Office Occupancy Report',
  'report-contracts': 'Contract Report',
  'report-payments': 'Payment Report'
} as const;

export type ReportKey = keyof typeof REPORT_TITLES;

export const isReportKey = (slug: string): slug is ReportKey => slug in REPORT_TITLES;

export type ValueFormat = 'money' | 'count' | 'percent' | 'date' | 'text';

export type ReportKpi = {
  label: string;
  value: number;
  format: 'money' | 'count' | 'percent';
  /** Short line under the number explaining what it covers. */
  hint?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
};

export type ReportColumn = { key: string; label: string; format?: ValueFormat };

export type ReportTable = {
  title: string;
  description?: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  /** Optional totals row, keyed like rows. */
  totals?: Record<string, string | number | null>;
  empty: string;
};

export type MonthlyPoint = { month: string; label: string; invoiced: number; collected: number };

export type ReportDoc = {
  key: ReportKey;
  title: string;
  from: string;
  to: string;
  /** '' = all buildings. */
  building: string;
  /** True when the date range is ignored (snapshot reports such as occupancy). */
  snapshot: boolean;
  generatedAt: string;
  kpis: ReportKpi[];
  monthly?: MonthlyPoint[];
  tables: ReportTable[];
  notes: string[];
  buildings: string[];
};

const moneyFormatter = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' });

/** e.g. "5 Oct 2026" — dates in reports are plain YYYY-MM-DD strings. */
export function fmtReportDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : 'Asia/Dubai' });
}

export function formatValue(value: unknown, format?: ValueFormat) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && format !== 'date') return value;
  switch (format) {
    case 'money': return moneyFormatter.format(Number(value));
    case 'percent': return `${Number(value).toFixed(1)}%`;
    case 'count': return Number(value).toLocaleString('en-AE');
    case 'date': return fmtReportDate(String(value));
    default: return String(value);
  }
}

export function periodLabel(doc: Pick<ReportDoc, 'snapshot' | 'from' | 'to' | 'generatedAt'>) {
  if (doc.snapshot) return `Current status as of ${fmtReportDate(doc.generatedAt)}`;
  return `${fmtReportDate(doc.from)} – ${fmtReportDate(doc.to)}`;
}
