import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { downloadFile } from '@/lib/storage';

const ALLOWED_MODULES = ['documents', 'maintenance'];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file || !ALLOWED_MODULES.includes(file.module) || !file.recordId) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 });
  }
  const record = await prisma.record.findUnique({ where: { id: file.recordId } });
  if (!record || (record.data as any)?.clientName !== companyName) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 });
  }
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
