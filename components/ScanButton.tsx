'use client';

import { useState } from 'react';
import { ScanLine, X as XIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';

// Talks to the TBC Scan Helper running on this PC (scan-helper/scan-helper.ps1),
// which scans with NAPS2 and returns a PDF. The PDF is handed to onScanned, which
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

export function ScanButton({ label, disabled, onScanned }: { label: string; disabled?: boolean; onScanned: (file: File) => void | Promise<void> }) {
  const [state, setState] = useState<'idle' | 'checking' | 'scanning'>('idle');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<'helper' | 'naps2' | null>(null);
  const [profiles, setProfiles] = useState<HelperStatus['profiles'] | null>(null);
  const [profile, setProfile] = useState('');

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
    await scan('');
  }

  async function scan(profileName: string) {
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
      const blob = await res.blob();
      if (blob.size > MAX_BYTES) throw new Error('The scan is larger than 10 MB. Lower the resolution (DPI) in the NAPS2 profile and scan again.');
      await onScanned(new File([blob], scanFileName(label), { type: 'application/pdf' }));
    } catch (err: any) {
      setError(err?.name === 'TypeError' ? 'Lost contact with the scan helper. Check it is running and try again.' : err?.message || 'Scan failed');
    } finally {
      setState('idle');
    }
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={disabled || state !== 'idle'} className="btn-secondary flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60">
        {state === 'idle' ? <ScanLine className="h-4 w-4" /> : <Spinner size="sm" color="muted" />}
        {state === 'scanning' ? 'Scanning… keep the document in the scanner' : state === 'checking' ? 'Connecting to scanner…' : 'Scan from scanner'}
      </button>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}

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
              <button type="button" onClick={() => scan(profile)} className="btn-primary w-full sm:w-auto">Start scan</button>
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
                Open it, click <b>Profiles</b>, add your scanner and save. For cheques, a profile with <b>Duplex</b> scans both sides into one PDF; 200–300 DPI keeps files small.
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
