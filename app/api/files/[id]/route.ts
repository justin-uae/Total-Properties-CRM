import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/storage';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });
  await assertCan(file.module, PermissionAction.VIEW);
  const blob = await downloadFile(file.storedName);
  const buffer = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalName.replaceAll('"', '')}"`
    }
  });
}
