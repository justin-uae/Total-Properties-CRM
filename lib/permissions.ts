import { PermissionAction } from '@prisma/client';
import { prisma } from '@/lib/db';

const ALL: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE', 'EMAIL', 'FINANCE', 'SETTINGS'];

// Reception is limited to the Operations module group only (Reception Dashboard,
// Visitors, Mail & Parcels, Access Cards & Keys, Maintenance) — Sales, Spaces,
// Finance and Admin modules (Leads, Quotations, Meeting Rooms, Meeting Room
// Bookings, Calendar, Floor Plan, Contracts, Documents, Deposits, Move-Outs,
// Invoices, Payments, Recurring Billing, Add-On Services, Settings) are
// Master-Admin-only. staff-users stays Master-Admin-only too (Master Admin
// bypasses this map entirely via isMasterAdmin()). Clients is granted
// VIEW-only so the "Tenant / Company" dropdown on Mail & Parcels, Access
// Cards & Keys and Maintenance keeps working — Reception can look records up
// but not create/edit/delete them. It's also listed in lib/roleNav.ts's
// navHiddenModules so that VIEW grant doesn't resurrect a browsable
// Clients/Tenants nav item or page for Reception.
const rolePermissions: Record<string, { modules: string[]; actions: PermissionAction[] }[]> = {
  RECEPTION: [
    {
      modules: ['reception-dashboard', 'visitors', 'mail-parcels', 'access-cards-keys', 'maintenance'],
      actions: ALL
    },
    {
      modules: ['clients'],
      actions: ['VIEW']
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
