'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function BankDetailsCard({ rows }: { rows: [string, string][] }) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel((current) => (current === label ? null : current)), 1500);
    } catch {
      // Clipboard API unavailable — nothing to fall back to, the value is still visible to copy manually.
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 p-5">
      <p className="font-bold">Bank Details for Payment</p>
      <div className="mt-3 grid grid-cols-[minmax(110px,auto)_1fr_auto] items-center gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="font-semibold text-slate-500">{label}</span>
            <span className="min-w-0 truncate text-slate-700">{value}</span>
            <button
              type="button"
              onClick={() => copy(label, value)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
            >
              {copiedLabel === label ? (
                <><Check className="h-3.5 w-3.5" />Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Copy</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
