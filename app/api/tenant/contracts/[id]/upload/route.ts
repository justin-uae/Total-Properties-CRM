import crypto from 'crypto';
import path from 'path';
import { NextResponse } from 'next/server';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/storage';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const { id } = await params;
  const record = await prisma.record.findUnique({ where: { id } });
  if (!record || record.module !== 'contracts' || (record.data as any)?.clientName !== companyName) {
    return NextResponse.json({ message: 'Contract not found' }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) return NextResponse.json({ message: 'File type not allowed. Accepted: PDF, JPG, PNG, WebP' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: 'Maximum file size is 10 MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${crypto.randomBytes(20).toString('hex')}${ext}`;
  await uploadFile(storedName, buffer, file.type);
  const fileRow = await prisma.fileObject.create({
    data: { module: 'contracts', recordId: id, originalName: file.name, storedName, mimeType: file.type, size: file.size, uploadedById: user.id, isPrivate: true }
  });

  const data = record.data as any;
  const updated = await prisma.record.update({
    where: { id },
    data: {
      status: 'Signed By Client',
      data: { ...data, signedDocument: { id: fileRow.id, name: fileRow.originalName, mimeType: fileRow.mimeType } }
    }
  });
  return NextResponse.json({ record: updated });
}
