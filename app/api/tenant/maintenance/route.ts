import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { requireTenantApi, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateTicketNumber } from '@/lib/tickets';
import { uploadFile } from '@/lib/storage';

const CATEGORIES = ['AC', 'Maintenance', 'Electricity', 'Other'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function GET() {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const records = await prisma.record.findMany({ where: { module: 'maintenance' }, orderBy: { createdAt: 'desc' } });
  const scoped = records.filter((r) => (r.data as any)?.clientName === companyName);
  return NextResponse.json({ records: scoped });
}

export async function POST(req: NextRequest) {
  const user = await requireTenantApi();
  const companyName = await tenantCompanyName(user);
  const form = await req.formData();
  const category = String(form.get('category') || '');
  const details = String(form.get('details') || '');
  if (!CATEGORIES.includes(category)) return NextResponse.json({ message: 'Invalid category' }, { status: 400 });
  if (!details.trim()) return NextResponse.json({ message: 'Details are required' }, { status: 400 });

  const data = {
    clientName: companyName,
    category,
    issue: details,
    ticketNumber: await generateTicketNumber(),
    reportedAt: new Date().toISOString(),
    resolution: [] as { id: string; name: string; mimeType: string }[]
  };

  const record = await prisma.record.create({
    data: {
      module: 'maintenance',
      title: data.ticketNumber,
      status: 'Open',
      createdById: user.id,
      data
    }
  });

  const photos = form.getAll('photos').filter((f): f is File => f instanceof File);
  const refs: { id: string; name: string; mimeType: string }[] = [];
  for (const file of photos) {
    if (!ALLOWED_MIME.includes(file.type) || file.size > 10 * 1024 * 1024) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${crypto.randomBytes(20).toString('hex')}${ext}`;
    await uploadFile(storedName, buffer, file.type);
    const fileRow = await prisma.fileObject.create({
      data: { module: 'maintenance', recordId: record.id, originalName: file.name, storedName, mimeType: file.type, size: file.size, uploadedById: user.id, isPrivate: true }
    });
    refs.push({ id: fileRow.id, name: fileRow.originalName, mimeType: fileRow.mimeType });
  }

  const updated = await prisma.record.update({ where: { id: record.id }, data: { data: { ...data, resolution: refs } } });
  return NextResponse.json({ record: updated });
}
