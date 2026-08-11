/**
 * Modules a role has API-level VIEW access to (e.g. so a dropdown on another module's
 * form — like the Tenant/Company picker on Mail & Parcels — can look records up) but
 * that should NOT surface as that role's own browsable nav item / page. Dependency-free
 * so it can be imported from both client components (AppShell) and server components
 * (the modules/[slug] page route) without pulling in server-only code like Prisma.
 */
export const navHiddenModules: Record<string, string[]> = {
  RECEPTION: ['clients']
};
