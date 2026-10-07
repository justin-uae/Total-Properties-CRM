import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { z, ZodError } from 'zod';
import { assertCan } from '@/lib/auth';
import { importerFor } from '@/lib/importers';
import { ipFromHeaders } from '@/lib/utils';

const bodySchema = z.object({
  fileName: z.string().max(300).optional(),
  records: z.array(z.record(z.any())).min(1).max(500)
});

// Step 2 of an AI import: save the records the user confirmed. Everything is re-checked
// here, so duplicates are skipped even if the browser sends them again.
export async function POST(req: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const importer = importerFor(module);
  if (!importer) return NextResponse.json({ message: 'Import is not available for this module' }, { status: 404 });
  const user = await assertCan(module, PermissionAction.CREATE);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: 'Invalid import data' }, { status: 400 });
  try {
    const result = await importer.commit(parsed.data.records, {
      userId: user.id,
      ipAddress: ipFromHeaders(req.headers),
      fileName: parsed.data.fileName || ''
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ message: 'Invalid import data' }, { status: 400 });
    console.error(`${module} import commit failed:`, err);
    return NextResponse.json({ message: 'Saving failed part-way. Refresh the list to see what was imported, then import the file again — saved records will be skipped as duplicates.' }, { status: 500 });
  }
}
