'use client';

import { useEffect, useState } from 'react';
import { ScanLine, X as XIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

// Talks to the TBC Scan Helper running on this PC (scan-helper/scan-helper.ps1),
// which scans with NAPS2 and returns a PDF. Each scan is collected in a preview so
// staff can add more pages (the back of a cheque, the next page of a contract on a
// flatbed scanner); the pages are joined into one PDF and handed to onScanned, which
// uploads it like any other attachment.
const HELPER_URL = 'http://localhost:47115';
const PROFILE_KEY = 'tbc-scan-profile';
const MAX_BYTES = 10 * 1024 * 1024;

type HelperStatus = { ok: boolean; version: string; naps2: boolean; profiles: { name: string; isDefault: boolean }[] };

function rememberedProfile() {
  try { return localStorage.getItem(PROFILE_KEY) || ''; } catch { return ''; }
}

function rememberProfile(name: string) {
  try { localStorage.setItem(PROFILE_KEY, name); } catch { /* storage unavailable */ }
}

function scanFileName(label: string) {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = label.replace(/\(.*?\)/g, '').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Scan';
  return `${base}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
}

/** Joins the PDFs from each scan, in order, into one PDF. */
async function mergePdfs(parts: Uint8Array[]) {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((page) => out.addPage(page));
  }
  return { bytes: await out.save(), pageCount: out.getPageCount() };
}

type Merged = { bytes: Uint8Array; pageCount: number; url: string };

export function ScanButton({ label, disabled, onScanned }: { label: string; disabled?: boolean; onScanned: (file: File) => void | Promise<void> }) {
  const [state, setState] = useState<'idle' | 'checking' | 'scanning' | 'attaching'>('idle');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<'helper' | 'naps2' | null>(null);
  const [profiles, setProfiles] = useState<HelperStatus['profiles'] | null>(null);
  const [profile, setProfile] = useState('');
  // Scans collected so far in this session (null = no session open).
  const [parts, setParts] = useState<Uint8Array[] | null>(null);
  const [merged, setMerged] = useState<Merged | null>(null);

  useEffect(() => () => { if (merged) URL.revokeObjectURL(merged.url); }, [merged]);

  async function start() {
    setError('');
    setState('checking');
    let status: HelperStatus;
    try {
      const res = await fetch(`${HELPER_URL}/status`, { signal: AbortSignal.timeout(3000) });
      status = await res.json();
      if (!res.ok) throw new Error((status as any)?.message || 'Scan helper error');
    } catch {
      setState('idle');
      setSetup('helper');
      return;
    }
    if (!status.naps2) {
      setState('idle');
      setSetup('naps2');
      return;
    }
    if (status.profiles.length > 1) {
      const last = rememberedProfile();
      const preset = status.profiles.find((p) => p.name === last) || status.profiles.find((p) => p.isDefault) || status.profiles[0];
      setProfile(preset.name);
      setProfiles(status.profiles);
      setState('idle');
      return;
    }
    setProfile('');
    await scanPage('', []);
  }

  async function updateParts(next: Uint8Array[]) {
    const { bytes, pageCount } = await mergePdfs(next);
    setParts(next);
    setMerged({ bytes, pageCount, url: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })) });
  }

  async function scanPage(profileName: string, existing: Uint8Array[]) {
    setProfiles(null);
    setError('');
    setState('scanning');
    if (profileName) rememberProfile(profileName);
    try {
      const qs = profileName ? `?profile=${encodeURIComponent(profileName)}` : '';
      const res = await fetch(`${HELPER_URL}/scan${qs}`, { method: 'POST', headers: { 'X-TBC-Scan': '1' }, body: '' });
      if (!res.ok) {
        let message = `Scan failed (${res.status})`;
        try { message = (await res.json()).message || message; } catch { /* non-JSON body */ }
        throw new Error(message);
      }
      await updateParts([...existing, new Uint8Array(await res.arrayBuffer())]);
    } catch (err: any) {
      setError(err?.name === 'TypeError' ? 'Lost contact with the scan helper. Check it is running and try again.' : err?.message || 'Scan failed');
    } finally {
      setState('idle');
    }
  }

  async function removeLast() {
    if (!parts || parts.length < 2) return;
    setError('');
    await updateParts(parts.slice(0, -1));
  }

  function close() {
    setParts(null);
    setMerged(null);
    setError('');
  }

  async function attach() {
    if (!merged) return;
    if (merged.bytes.length > MAX_BYTES) {
      setError('The scan is larger than 10 MB. Remove a page, or lower the resolution (DPI) in the NAPS2 profile and scan again.');
      return;
    }
    setState('attaching');
    try {
      await onScanned(new File([merged.bytes as BlobPart], scanFileName(label), { type: 'application/pdf' }));
      close();
    } finally {
      setState('idle');
    }
  }

  const busy = state !== 'idle';

  return (
    <div>
      <button type="button" onClick={start} disabled={disabled || busy} className="btn-secondary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
        {state === 'idle' || parts ? <ScanLine className="h-4 w-4" /> : <Spinner size="sm" color="muted" />}
        {!parts && state === 'scanning' ? 'Scanning… keep the document in the scanner' : !parts && state === 'checking' ? 'Connecting to scanner…' : 'Scan from scanner'}
      </button>
      {error && !parts && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}

      {parts && merged && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative flex max-h-[95vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <button type="button" onClick={close} disabled={busy} className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><XIcon className="h-4 w-4" /></button>
            <h2 className="text-lg font-bold">Scanned {merged.pageCount} {merged.pageCount === 1 ? 'page' : 'pages'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              More to add? Put the next page on the scanner (or turn the cheque over) and click <b>Scan next page</b>. All pages are saved together as one PDF.
            </p>
            <iframe key={merged.url} src={merged.url} title="Scan preview" className="mt-4 h-[55vh] w-full rounded-xl border border-slate-200" />
            {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={close} disabled={busy} className="btn-secondary w-full sm:w-auto">Discard</button>
              {parts.length > 1 && (
                <button type="button" onClick={removeLast} disabled={busy} className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 sm:w-auto">Remove last scan</button>
              )}
              <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
                <button type="button" onClick={() => scanPage(profile, parts)} disabled={busy} className="btn-secondary flex w-full items-center justify-center gap-2 sm:w-auto">
                  {state === 'scanning' ? <><Spinner size="sm" color="muted" /> Scanning…</> : <><ScanLine className="h-4 w-4" /> Scan next page</>}
                </button>
                <button type="button" onClick={attach} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                  {state === 'attaching' ? <><Spinner size="sm" color="white" /> Attaching…</> : <>Attach {merged.pageCount === 1 ? 'scan' : `${merged.pageCount} pages`}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProfiles(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Scan settings</h2>
            <p className="mt-1 text-sm text-slate-500">Choose which NAPS2 profile to scan with.</p>
            <select className="input mt-4" value={profile} onChange={(e) => setProfile(e.target.value)}>
              {profiles.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setProfiles(null)} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={() => scanPage(profile, [])} className="btn-primary w-full sm:w-auto">Start scan</button>
            </div>
          </div>
        </div>
      )}

      {setup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSetup(null)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <button type="button" onClick={() => setSetup(null)} className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100"><XIcon className="h-4 w-4" /></button>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50"><ScanLine className="h-5 w-5 text-blue-600" /></div>
            <h2 className="mt-3 text-lg font-bold">{setup === 'naps2' ? 'Install NAPS2 to scan' : 'Set up scanning on this PC'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {setup === 'naps2'
                ? 'The scan helper is running, but NAPS2 (the free scanning program it uses) is not installed on this PC.'
                : 'Scanning needs two free programs on the PC the scanner is connected to. This is a one-time setup per PC (Windows only).'}
            </p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
              <li>
                Install <a href="https://www.naps2.com/download" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">NAPS2</a>.
                Open it, click <b>Profiles</b>, add your scanner (WIA driver) and save. Set Paper source to <b>Glass</b> for a flatbed scanner — Feeder/Duplex only if it has a document feeder. 200–300 DPI keeps files small.
              </li>
              {setup === 'helper' && (
                <li>
                  Download and run the <a href="/api/scan-helper/install-scan-helper.cmd" className="font-semibold text-blue-600 hover:underline">TBC Scan Helper installer</a>.
                  If Windows says &ldquo;Windows protected your PC&rdquo;, click <b>More info</b> → <b>Run anyway</b>. No admin rights are needed, and it starts automatically at login.
                </li>
              )}
              <li>Come back here and click <b>Scan from scanner</b> again. If the browser asks to allow access to apps or devices on this computer, click <b>Allow</b>.</li>
            </ol>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setSetup(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
