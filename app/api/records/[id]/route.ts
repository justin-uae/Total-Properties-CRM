import { NextRequest, NextResponse } from 'next/server';
import { PermissionAction } from '@prisma/client';
import { assertCan, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { moduleMap } from '@/lib/modules';
import { ipFromHeaders } from '@/lib/utils';
import { deleteFile } from '@/lib/storage';

function titleFor(module: string, data: any) {
  return data.fullName || data.companyName || data.clientName || data.visitorName || data.roomName || data.unitName || data.invoiceNumber || data.quoteNumber || data.contractNumber || data.ruleName || data.serviceName || `${module} record`;
}

async function meetingRoomClash(data: any, exceptId?: string) {
  if (!data.roomName || !data.bookingDate || !data.startTime || !data.endTime) return null;
  const where: any = { module: 'meeting-room-bookings' };
  if (exceptId) where.NOT = { id: exceptId };
  const existing = await prisma.record.findMany({ where });
  return existing.find((row) => {
    const d = row.data as any;
    if (d.roomName !== data.roomName || d.bookingDate !== data.bookingDate) return false;
    return data.startTime < d.endTime && data.endTime > d.startTime && !['Cancelled'].includes(row.status);
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.record.findUnique({ where: { id }, include: { files: true } });
  if (!row) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  await assertCan(row.module, PermissionAction.VIEW);
  return NextResponse.json({ record: row });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json();
  if (body.module === 'staff-users') {
    await assertCan('staff-users', PermissionAction.EDIT);
    const data = body.data || {};
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: String(data.email || '').toLowerCase(),
        role: data.role,
        status: data.status === 'Suspended' ? 'SUSPENDED' : 'ACTIVE'
      }
    });
    await auditLog({ userId: user.id, action: 'UPDATE_USER', module: 'staff-users', recordId: id, ipAddress: ipFromHeaders(req.headers), after: data });
    return NextResponse.json({ user: updated });
  }
  const before = await prisma.record.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  await assertCan(before.module, PermissionAction.EDIT);
  const data = body.data || {};
  if (before.module === 'meeting-room-bookings') {
    const clash = await meetingRoomClash(data, id);
    if (clash) return NextResponse.json({ message: `Booking clash with ${clash.title}` }, { status: 409 });
  }
  const record = await prisma.record.update({
    where: { id },
    data: {
      title: titleFor(before.module, data),
      status: String(body.status || data.status || before.status),
      source: data.source,
      location: data.location,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      data
    }
  });
  await auditLog({ userId: user.id, action: 'UPDATE', module: before.module, recordId: id, ipAddress: ipFromHeaders(req.headers), before, after: record });
  return NextResponse.json({ record });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const before = await prisma.record.findUnique({ where: { id } });
  if (!before) {
    const staff = await prisma.user.findUnique({ where: { id } });
    if (staff) {
      await assertCan('staff-users', PermissionAction.DELETE);
      await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
      await auditLog({ userId: user.id, action: 'SUSPEND_USER', module: 'staff-users', recordId: id, ipAddress: ipFromHeaders(req.headers), before: staff });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  await assertCan(before.module, PermissionAction.DELETE);
  const attachedFiles = await prisma.fileObject.findMany({ where: { recordId: id } });
  await prisma.record.delete({ where: { id } });
  await Promise.allSettled(attachedFiles.map((f) => deleteFile(f.storedName)));
  await auditLog({ userId: user.id, action: 'DELETE', module: before.module, recordId: id, ipAddress: ipFromHeaders(req.headers), before });
  return NextResponse.json({ ok: true });
}
