'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import type { ModuleConfig } from '@/lib/modules';

type ReviewRow = {
  record: Record<string, any>;
  title: string;
  subtitle: string;
  duplicateOf: string | null;
  error: string | null;
  warnings: string[];
};

type Result = {
  created: { title: string; subtitle: string }[];
  skipped: { title: string; reason: string }[];
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** AI file import for any module listed in lib/import-modules.ts. */
export function ImportModal({ module, onClose, onSaved }: { module: ModuleConfig; onClose: () => void; onSaved: () => void }) {
  const noun = module.singular.toLowerCase();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('');
  const [error, setError] = useState('');
  // Set only when the file needs a decision (duplicates / warnings); a clean file is saved straight away.
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const importable = (review || []).filter((r) => !r.duplicateOf && !r.error);

  async function commit(rows: ReviewRow[]) {
    setBusy('saving');
    try {
      const res = await fetch(`/api/import/${module.slug}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file?.name || 'Pasted text', records: rows.map((r) => r.record) })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.message || 'Could not save the records'); onSaved(); return; }
      setResult(json);
      setReview(null);
      onSaved();
    } catch {
      setError('Could not save the records. Please try again.');
    } finally {
      setBusy('');
    }
  }

  async function readFile() {
    setError('');
    setBusy('reading');
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      else fd.append('text', text);
      const res = await fetch(`/api/import/${module.slug}`, { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.message || `Import failed (${res.status})`); return; }
      const rows: ReviewRow[] = json.rows || [];
      if (rows.some((r) => r.duplicateOf || r.error || r.warnings.length)) { setReview(rows); return; }
      await commit(rows);
    } catch {
      setError('Import failed. Please try again.');
    } finally {
      setBusy('');
    }
  }

  const close = () => { if (!busy) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">Import {module.title}</h2>
          <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        {result ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <Check className="h-4 w-4" />
              {plural(result.created.length, noun)} imported
            </p>
            {result.created.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
                {result.created.map((c, i) => (
                  <li key={i} className="px-3 py-2">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-slate-500">{c.subtitle}</p>
                  </li>
                ))}
              </ul>
            )}
            {result.skipped.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-semibold">{result.skipped.length} skipped</p>
                <ul className="mt-1 list-disc pl-5">
                  {result.skipped.map((s, i) => <li key={i}>{s.title}: {s.reason}</li>)}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button type="button" onClick={onClose} className="btn-primary w-full sm:w-auto">Done</button>
            </div>
          </>
        ) : review ? (
          <>
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {plural(review.length, noun)} found in this file. Some need your attention before anything is saved.
                {review.some((r) => r.duplicateOf) && ' Records that already exist will be skipped.'}
              </p>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 text-sm">
              {review.map((r, i) => (
                <li key={i} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{r.title}</span>
                    <span className={`shrink-0 text-xs font-semibold ${r.duplicateOf || r.error ? 'text-red-600' : r.warnings.length ? 'text-amber-700' : 'text-green-700'}`}>
                      {r.duplicateOf ? 'Duplicate — skipped' : r.error ? 'Cannot import' : r.warnings.length ? 'Check' : 'Ready'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{r.subtitle}</p>
                  {r.duplicateOf && <p className="mt-0.5 text-xs text-red-600">Already exists as {r.duplicateOf}.</p>}
                  {r.error && <p className="mt-0.5 text-xs text-red-600">{r.error}</p>}
                  {!r.duplicateOf && !r.error && r.warnings.map((w, j) => <p key={j} className="mt-0.5 text-xs text-amber-700">{w}</p>)}
                </li>
              ))}
            </ul>
            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} disabled={!!busy} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={() => commit(importable)} disabled={!!busy || importable.length === 0} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                {busy === 'saving'
                  ? <><Spinner size="sm" color="white" /><span>Importing…</span></>
                  : <span>{importable.length === 0 ? 'Nothing to import' : `Import ${plural(importable.length, noun)}`}</span>}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Upload a CSV or text file with one or more {noun}s, or paste the details below. AI reads the file and creates the records; anything that already exists is flagged before saving.
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm hover:bg-slate-50">
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="font-medium">{file ? file.name : 'Choose a file (.csv, .tsv, .txt, .json)'}</span>
              <input type="file" className="hidden" accept=".csv,.tsv,.txt,.json,text/csv,text/plain" disabled={!!busy} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(''); }} />
            </label>
            {!file && (
              <textarea className="input mt-3 min-h-28" placeholder={`…or paste the ${noun} details here`} disabled={!!busy} value={text} onChange={(e) => setText(e.target.value)} />
            )}
            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={close} disabled={!!busy} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={readFile} disabled={!!busy || (!file && !text.trim())} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto sm:min-w-[140px]">
                {busy
                  ? <><Spinner size="sm" color="white" /><span>{busy === 'reading' ? 'Reading file…' : 'Importing…'}</span></>
                  : <><Upload className="h-4 w-4" /><span>Import</span></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
