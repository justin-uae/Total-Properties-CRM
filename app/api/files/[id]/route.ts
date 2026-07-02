import { NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { downloadFile, deleteFile } from '@/lib/storage';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });
  await assertCan(file.module, PermissionAction.VIEW);
  const blob = await downloadFile(file.storedName);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const forceDownload = new URL(req.url).searchParams.get('download') === 'true';
  const disposition = forceDownload ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `${disposition}; filename="${file.originalName.replaceAll('"', '')}"`
    }
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });
  await assertCan(file.module, PermissionAction.EDIT);
  const body = await req.json();
  const updated = await prisma.fileObject.update({ where: { id }, data: { recordId: body.recordId ?? file.recordId } });
  return NextResponse.json({ file: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ message: 'File not found' }, { status: 404 });
  await assertCan(file.module, PermissionAction.DELETE);
  await deleteFile(file.storedName);
  await prisma.fileObject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
