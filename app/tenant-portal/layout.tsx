import { redirect } from 'next/navigation';
import { requireUser, tenantCompanyName } from '@/lib/auth';
import { TenantShell } from '@/components/TenantShell';

export default async function TenantPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'TENANT') redirect('/dashboard');
  const companyName = (await tenantCompanyName(user)) || 'Tenant Portal';
  return <TenantShell companyName={companyName}>{children}</TenantShell>;
}
