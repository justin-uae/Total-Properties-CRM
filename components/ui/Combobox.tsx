'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type ComboboxOption = { value: string; label: string; detail?: string };

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const query = value.trim().toLowerCase();
  const filtered = query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options;
  const exactMatch = options.some((o) => o.label.toLowerCase() === query);

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          className="input pr-9"
          disabled={disabled}
          required={required}
          value={value}
          placeholder={placeholder || 'Select from the list or type a name...'}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        />
        <ChevronDown
          onClick={() => !disabled && setOpen((o) => !o)}
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 cursor-pointer text-slate-400"
        />
      </div>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No matches — the typed name will be used as-is.</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => { onChange(option.value); setOpen(false); }}
                className="flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">{option.label}</span>
                {option.detail && <span className="text-xs text-slate-400">{option.detail}</span>}
              </button>
            ))
          )}
          {query && !exactMatch && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-1 rounded-lg border-t border-slate-100 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
            >
              Use “{value}” (not in the list)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
