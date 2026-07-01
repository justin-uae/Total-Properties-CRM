import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { PermissionAction } from '@prisma/client';
import { assertCan } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { uploadFile } from '@/lib/storage';

const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const module = String(form.get('module') || 'documents');
  const recordId = String(form.get('recordId') || '') || null;
  const user = await assertCan(module, PermissionAction.CREATE);
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
  if (!allowed.includes(file.type)) return NextResponse.json({ message: 'File type not allowed' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ message: 'Maximum file size is 10MB' }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name).toLowerCase();
  const storedName = `${crypto.randomBytes(20).toString('hex')}${ext}`;
  await uploadFile(storedName, buffer, file.type);
  const row = await prisma.fileObject.create({
    data: { module, recordId, originalName: file.name, storedName, mimeType: file.type, size: file.size, uploadedById: user.id, isPrivate: true }
  });
  return NextResponse.json({ file: row });
}
