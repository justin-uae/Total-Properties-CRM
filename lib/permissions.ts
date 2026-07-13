import { PermissionAction } from '@prisma/client';
import { prisma } from '@/lib/db';

const ALL: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE', 'EMAIL', 'FINANCE', 'SETTINGS'];

// Reception covers every business/operational module previously split across
// the retired Manager/Sales/Finance/Operations roles. staff-users stays
// Master-Admin-only (Master Admin bypasses this map entirely via isMasterAdmin()).
const rolePermissions: Record<string, { modules: string[]; actions: PermissionAction[] }[]> = {
  RECEPTION: [
    {
      modules: [
        'web-form-leads', 'leads', 'quotations', 'viewings',
        'visitors', 'mail-parcels', 'access-cards-keys', 'maintenance',
        'services-offices', 'meeting-rooms', 'meeting-room-bookings',
        'clients', 'contracts', 'documents', 'deposits', 'move-outs',
        'invoices', 'payments', 'recurring-billing', 'add-on-services'
      ],
      actions: ALL
    }
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
