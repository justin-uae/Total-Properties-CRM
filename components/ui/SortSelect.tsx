'use client';

import { useEffect, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { SORT_OPTIONS, SortOrder } from '@/lib/sort';

/** Sort order remembered per list (in this browser), so a chosen order sticks between visits. */
export function useSortOrder(storageKey: string, fallback: SortOrder = 'newest') {
  const key = `tbc-sort:${storageKey}`;
  const [order, setOrder] = useState<SortOrder>(fallback);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setOrder(SORT_OPTIONS.some((o) => o.value === saved) ? (saved as SortOrder) : fallback);
    } catch {
      setOrder(fallback);
    }
  }, [key, fallback]);

  function update(next: SortOrder) {
    setOrder(next);
    try { localStorage.setItem(key, next); } catch { /* storage unavailable */ }
  }

  return [order, update] as const;
}

export function SortSelect({ value, onChange }: { value: SortOrder; onChange: (order: SortOrder) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 pr-1 text-sm" title="Sort">
      <ArrowUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        aria-label="Sort"
        className="bg-transparent py-2.5 pr-1 text-sm outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOrder)}
      >
        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
