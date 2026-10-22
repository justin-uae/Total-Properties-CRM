'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { moduleMap } from '@/lib/modules';
import { formatValue, MonthlyPoint, periodLabel, ReportDoc, ReportKey, ReportKpi, ReportTable } from '@/lib/report-types';

// One page for all four Reports / Accounting reports. The numbers come from
// /api/reports/<report> (lib/reports.ts); exports hit the same URL with format=xlsx|pdf.

const FILTER_KEY = 'tbc-report-filter';

type Preset = 'this-month' | 'last-month' | 'this-quarter' | 'this-year' | 'last-year' | 'last-12' | 'custom';

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'this-quarter', label: 'This quarter' },
  { id: 'this-year', label: 'This year' },
  { id: 'last-year', label: 'Last year' },
  { id: 'last-12', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom range' }
];

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

function presetRange(preset: Preset): { from: string; to: string } | null {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  switch (preset) {
    case 'this-month': return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
    case 'last-month': return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case 'this-quarter': { const q = Math.floor(m / 3) * 3; return { from: iso(y, q, 1), to: iso(y, q + 3, 0) }; }
    case 'this-year': return { from: iso(y, 0, 1), to: iso(y, 11, 31) };
    case 'last-year': return { from: iso(y - 1, 0, 1), to: iso(y - 1, 11, 31) };
    case 'last-12': return { from: iso(y, m - 11, 1), to: iso(y, m + 1, 0) };
    default: return null;
  }
}

type Filter = { preset: Preset; from: string; to: string; building: string };

function initialFilter(): Filter {
  const fallback: Filter = { preset: 'this-year', ...presetRange('this-year')!, building: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || 'null');
    if (!saved || !PRESETS.some((p) => p.id === saved.preset)) return fallback;
    // Presets are re-computed so "This month" stays current; custom ranges are kept as saved.
    const range = presetRange(saved.preset) || { from: saved.from, to: saved.to };
    return { preset: saved.preset, ...range, building: String(saved.building || '') };
  } catch {
    return fallback;
  }
}

const TONE_BORDER: Record<NonNullable<ReportKpi['tone']>, string> = {
  neutral: 'border-l-slate-300',
  good: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500'
};

export function ReportPage({ report }: { report: ReportKey }) {
  const module = moduleMap[report]!;
  const [filter, setFilter] = useState<Filter | null>(null);
  const [doc, setDoc] = useState<ReportDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { setFilter(initialFilter()); }, []);

  useEffect(() => {
    if (!filter) return;
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filter)); } catch { /* storage unavailable */ }
  }, [filter]);

  const query = filter ? new URLSearchParams({ from: filter.from, to: filter.to, building: filter.building }).toString() : '';

  async function load() {
    if (!query) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/${report}?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `Could not load the report (${res.status})`);
      setDoc(json);
    } catch (err: any) {
      setError(err?.message || 'Could not load the report');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [report, query]);

  function choosePreset(preset: Preset) {
    setFilter((f) => f && ({ ...f, preset, ...(presetRange(preset) || {}) }));
  }

  function setDate(key: 'from' | 'to', value: string) {
    if (!value) return;
    setFilter((f) => f && ({ ...f, preset: 'custom', [key]: value }));
  }

  const snapshot = report === 'report-occupancy';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-[rgb(var(--accent))]">Reports / Accounting</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{module.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{module.description}</p>
      </div>

      {filter && (
        <div className="card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
          {!snapshot && (
            <>
              <label className="block min-w-[160px]">
                <span className="label">Period</span>
                <select className="input" value={filter.preset} onChange={(e) => choosePreset(e.target.value as Preset)}>
                  {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">From</span>
                  <input type="date" className="input" value={filter.from} max={filter.to} onChange={(e) => setDate('from', e.target.value)} />
                </label>
                <label className="block">
                  <span className="label">To</span>
                  <input type="date" className="input" value={filter.to} min={filter.from} onChange={(e) => setDate('to', e.target.value)} />
                </label>
              </div>
            </>
          )}
          <label className="block min-w-[200px]">
            <span className="label">Building / Property</span>
            <select className="input" value={filter.building} onChange={(e) => setFilter((f) => f && ({ ...f, building: e.target.value }))}>
              <option value="">All buildings</option>
              {(doc?.buildings || (filter.building ? [filter.building] : [])).map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button type="button" onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <a href={`/api/reports/${report}?${query}&format=xlsx`} className="btn-secondary flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel</a>
            <a href={`/api/reports/${report}?${query}&format=pdf`} className="btn-primary flex items-center gap-2"><Download className="h-4 w-4" /> PDF</a>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}

      {!doc && loading && (
        <div className="card flex items-center justify-center gap-3 p-10 text-sm text-slate-500"><Spinner size="sm" color="muted" /> Building report…</div>
      )}

      {doc && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{periodLabel(doc)}</span>
            {' · '}{doc.building || 'All buildings'}
          </p>

          <div className={`grid gap-3 sm:grid-cols-2 ${doc.kpis.length > 4 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
            {doc.kpis.map((k) => (
              <div key={k.label} className={`card border-l-4 p-4 ${TONE_BORDER[k.tone || 'neutral']}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{k.label}</p>
                <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-900">{formatValue(k.value, k.format)}</p>
                {k.hint && <p className="mt-1 text-xs text-slate-500">{k.hint}</p>}
              </div>
            ))}
          </div>

          {doc.monthly && doc.monthly.length > 0 && <MonthlyChart points={doc.monthly} />}

          {doc.tables.map((t) => <ReportTableCard key={t.title} table={t} />)}

          {doc.notes.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-500">
              {doc.notes.map((n) => <li key={n}>• {n}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ReportTableCard({ table }: { table: ReportTable }) {
  const right = (f?: string) => f === 'money' || f === 'count' || f === 'percent';
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="font-bold">{table.title}</h2>
        {table.description && <p className="mt-0.5 text-xs text-slate-500">{table.description}</p>}
      </div>
      {table.rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500">{table.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>{table.columns.map((c) => <th key={c.key} className={`whitespace-nowrap px-4 py-2.5 ${right(c.format) ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {table.columns.map((c) => (
                    <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 ${right(c.format) ? 'text-right tabular-nums' : ''}`}>{formatValue(r[c.key], c.format) || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {table.totals && (
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <tr>{table.columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 ${right(c.format) ? 'text-right tabular-nums' : ''}`}>{formatValue(table.totals![c.key], c.format)}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

// Grouped bars: invoiced vs collected per month, one shared AED axis.
const SERIES = [
  { key: 'invoiced' as const, label: 'Invoiced', color: 'var(--viz-series-1)' },
  { key: 'collected' as const, label: 'Collected', color: 'var(--viz-series-2)' }
];

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= value)! * pow;
  return step * 4;
}

const compactAed = (v: number) => `AED ${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`;

function MonthlyChart({ points }: { points: MonthlyPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 240;
  const pad = { top: 12, right: 8, bottom: 26, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = useMemo(() => niceMax(Math.max(...points.flatMap((p) => [p.invoiced, p.collected]))), [points]);
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const slot = plotW / points.length;
  const barW = Math.max(3, Math.min(22, (slot - 10) / 2));
  const labelEvery = Math.ceil(points.length / Math.max(1, Math.floor(plotW / 56)));
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;

  // Bar with 4px rounded top corners, square at the baseline.
  const bar = (x: number, v: number) => {
    const top = y(v);
    const h = pad.top + plotH - top;
    if (h <= 0) return '';
    const r = Math.min(4, barW / 2, h);
    const base = pad.top + plotH;
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${base}Z`;
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="viz-root card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Invoiced vs Collected by Month</h2>
        <div className="flex gap-4 text-xs text-slate-600">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>
          ))}
        </div>
      </div>
      <div ref={wrap} className="relative mt-3">
        <svg width={width} height={height} role="img" aria-label="Invoiced and collected amounts by month. The Monthly Income Summary table below lists the same figures.">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--viz-text-muted)">{compactAed(t)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const x0 = pad.left + i * slot + (slot - (barW * 2 + 2)) / 2;
            return (
              <g key={p.month}>
                {hover === i && <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="var(--viz-hover)" />}
                {SERIES.map((s, si) => <path key={s.key} d={bar(x0 + si * (barW + 2), p[s.key])} fill={s.color} />)}
                {i % labelEvery === 0 && (
                  <text x={pad.left + i * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--viz-text-muted)">{p.label}</text>
                )}
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH + pad.bottom} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              </g>
            );
          })}
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--viz-axis)" strokeWidth={1} />
        </svg>
        {hp && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(pad.left + hover * slot + slot / 2 - 85, 0), width - 175), top: 4 }}
          >
            <p className="font-bold text-slate-900">{hp.label}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="mt-1 flex items-center justify-between gap-3 text-slate-600">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />{s.label}</span>
                <span className="font-semibold tabular-nums text-slate-900">{formatValue(hp[s.key], 'money')}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
