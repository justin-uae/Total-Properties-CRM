import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/auth';

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === 'TENANT') redirect('/tenant-portal');
  return (
    <AppShell user={{
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      theme: user.theme,
      permissions: user.permissions.map((p) => ({ module: p.module, action: p.action }))
    }}>
      {children}
    </AppShell>
  );
}
