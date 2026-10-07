export type SortOrder = 'newest' | 'oldest' | 'az' | 'za';

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'Name A–Z' },
  { value: 'za', label: 'Name Z–A' }
];

// Case-insensitive and number-aware, so "Office 2" comes before "Office 10".
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function compareNames(a: string, b: string) {
  return collator.compare(a.trim(), b.trim());
}

/** Returns a sorted copy; `name` and `createdAt` pick the fields to sort by. */
export function sortRecords<T>(rows: T[], order: SortOrder, name: (row: T) => string, createdAt: (row: T) => string | undefined) {
  const time = (row: T) => new Date(createdAt(row) || 0).getTime();
  const sorted = [...rows];
  if (order === 'az') sorted.sort((a, b) => compareNames(name(a), name(b)));
  else if (order === 'za') sorted.sort((a, b) => compareNames(name(b), name(a)));
  else if (order === 'oldest') sorted.sort((a, b) => time(a) - time(b));
  else sorted.sort((a, b) => time(b) - time(a));
  return sorted;
}

/** Alphabetical copy of dropdown options. */
export function sortOptions<T extends { label: string }>(options: T[]) {
  return [...options].sort((a, b) => compareNames(a.label, b.label));
}
