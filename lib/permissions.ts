import { PermissionAction } from '@prisma/client';
import { prisma } from '@/lib/db';

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

export async function applyRolePermissions(userId: string, role: string) {
  await prisma.permission.deleteMany({ where: { userId } });
  const groups = rolePermissions[role] || [];
  const rows = groups.flatMap(({ modules, actions }) =>
    modules.flatMap((module) => actions.map((action) => ({ userId, module, action })))
  );
  if (rows.length) await prisma.permission.createMany({ data: rows });
}
