import { Importer } from '@/lib/ai-import';
import { documentImporter } from '@/lib/document-import';
import { recordImporter } from '@/lib/record-import';
import { IMPORTABLE_MODULES } from '@/lib/import-modules';

export function importerFor(slug: string): Importer | null {
  if (!IMPORTABLE_MODULES.includes(slug)) return null;
  if (slug === 'invoices' || slug === 'quotations') return documentImporter(slug);
  return recordImporter(slug);
}
