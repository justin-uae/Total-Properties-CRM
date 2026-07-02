import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PermissionAction } from '@prisma/client';
import { assertCan, requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { moduleMap } from '@/lib/modules';
import { ipFromHeaders, publicToken } from '@/lib/utils';

const ALL: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE', 'EMAIL', 'FINANCE', 'SETTINGS'];
const STANDARD: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'EMAIL'];
const VIEW_ONLY: PermissionAction[] = ['VIEW'];

const rolePermissions: Record<string, { modules: string[]; actions: PermissionAction[] }[]> = {
  MANAGER: [{ modules: ['web-form-leads','leads','quotations','viewings','visitors','mail-parcels','access-cards-keys','maintenance','services-offices','meeting-rooms','meeting-room-bookings','clients','contracts','documents','deposits','move-outs','invoices','payments','recurring-billing','add-on-services','staff-users','automation-rules','settings'], actions: ALL }],
  SALES: [
    { modules: ['web-form-leads','leads','quotations','viewings'], actions: STANDARD },
    { modules: ['clients','services-offices','meeting-rooms','meeting-room-bookings'], actions: VIEW_ONLY }
  ],
  RECEPTION: [
    { modules: ['visitors','mail-parcels','access-cards-keys','maintenance','meeting-room-bookings'], actions: ['VIEW','CREATE','EDIT'] },
    { modules: ['leads','clients','services-offices','meeting-rooms'], actions: VIEW_ONLY }
  ],
  FINANCE: [
    { modules: ['invoices','payments','recurring-billing','add-on-services','deposits'], actions: ['VIEW','CREATE','EDIT','DELETE','EXPORT','EMAIL','FINANCE'] },
    { modules: ['clients','contracts','move-outs'], actions: ['VIEW','EXPORT'] }
  ],
  OPERATIONS: [
    { modules: ['visitors','mail-parcels','access-cards-keys','maintenance','services-offices','meeting-rooms','meeting-room-bookings'], actions: ['VIEW','CREATE','EDIT','DELETE','EXPORT'] },
    { modules: ['clients','contracts'], actions: VIEW_ONLY }
  ],
  TENANT: []
};

async function applyRolePermissions(userId: string, role: string) {
  await prisma.permission.deleteMany({ where: { userId } });
  const groups = rolePermissions[role] || [];
  const rows = groups.flatMap(({ modules, actions }) =>
    modules.flatMap((module) => actions.map((action) => ({ userId, module, action })))
  );
  if (rows.length) await prisma.permission.createMany({ data: rows });
}

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

export async function GET(req: NextRequest) {
  await requireUser();
  const module = req.nextUrl.searchParams.get('module') || '';
  if (!moduleMap[module]) return NextResponse.json({ message: 'Unknown module' }, { status: 404 });
  await assertCan(module, PermissionAction.VIEW);
  if (module === 'staff-users') {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return NextResponse.json({
      records: users.map((u) => ({
        id: u.id,
        module: 'staff-users',
        title: u.name,
        status: u.status === 'ACTIVE' ? 'Active' : 'Suspended',
        data: { name: u.name, email: u.email, role: u.role, status: u.status === 'ACTIVE' ? 'Active' : 'Suspended' },
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      }))
    });
  }
  const records = await prisma.record.findMany({ where: { module }, orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const body = await req.json();
  const module = String(body.module || '');
  if (!moduleMap[module]) return NextResponse.json({ message: 'Unknown module' }, { status: 404 });
  await assertCan(module, PermissionAction.CREATE);
  const data = body.data || {};
  const status = String(body.status || data.status || moduleMap[module].defaultStatus || 'New');

  if (module === 'meeting-room-bookings') {
    const clash = await meetingRoomClash(data);
    if (clash) return NextResponse.json({ message: `Booking clash with ${clash.title}` }, { status: 409 });
  }

  if (module === 'staff-users') {
    const password = String(data.password || '');
    if (!password) return NextResponse.json({ message: 'Password is required for new staff users' }, { status: 400 });
    const role = data.role || 'SALES';
    const created = await prisma.user.create({
      data: {
        name: String(data.name),
        email: String(data.email).toLowerCase(),
        role,
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true
      }
    });
    await applyRolePermissions(created.id, role);
    await auditLog({ userId: user.id, action: 'CREATE_USER', module, recordId: created.id, ipAddress: ipFromHeaders(req.headers), after: data });
    return NextResponse.json({ user: created });
  }

  const record = await prisma.record.create({
    data: {
      module,
      title: titleFor(module, data),
      status,
      source: data.source,
      location: data.location,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      publicToken: ['invoices', 'quotations'].includes(module) ? publicToken(module === 'invoices' ? 'inv' : 'quote') : undefined,
      createdById: user.id,
      data
    }
  });
  await auditLog({ userId: user.id, action: 'CREATE', module, recordId: record.id, ipAddress: ipFromHeaders(req.headers), after: data });
  return NextResponse.json({ record });
}
