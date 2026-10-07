import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { ZodError } from 'zod';
import { assertCan } from '@/lib/auth';
import { ImportError, readImportContent } from '@/lib/ai-import';
import { importerFor } from '@/lib/importers';

export const maxDuration = 300;

// Step 1 of an AI import: read the uploaded file with OpenAI and report what was found
// (including duplicates and warnings). Nothing is saved here — see ./commit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const importer = importerFor(module);
  if (!importer) return NextResponse.json({ message: 'Import is not available for this module' }, { status: 404 });
  await assertCan(module, PermissionAction.CREATE);
  try {
    const form = await req.formData();
    const file = form.get('file');
    const content = await readImportContent(file instanceof File ? file : null, String(form.get('text') || ''));
    const rows = await importer.analyse(content);
    if (rows.length === 0) return NextResponse.json({ message: 'No records were found in this file.' }, { status: 422 });
    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ message: err.message }, { status: 400 });
    if (err instanceof ZodError) return NextResponse.json({ message: 'OpenAI returned an unexpected answer. Please try again.' }, { status: 502 });
    console.error(`${module} import failed:`, err);
    return NextResponse.json({ message: 'The import failed. Please try again.' }, { status: 500 });
  }
}
