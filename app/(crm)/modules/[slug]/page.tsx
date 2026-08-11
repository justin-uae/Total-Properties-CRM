import { ModulePage } from '@/components/ModulePage';
import { CalendarView } from '@/components/CalendarView';
import { SettingsPage } from '@/components/SettingsPage';
import { ReceptionDashboard } from '@/components/ReceptionDashboard';
import { moduleMap } from '@/lib/modules';
import { can, requireUser } from '@/lib/auth';
import { navHiddenModules } from '@/lib/roleNav';
import { PermissionAction } from '@prisma/client';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!moduleMap[slug]) notFound();
  const user = await requireUser();
  // Mirrors AppShell's canSee(): nav-hidden modules (permission granted only so a dropdown
  // elsewhere can look records up) are never a browsable page, and everything else needs an
  // explicit VIEW permission (or Master Admin — "dashboard" has no Permission rows for anyone
  // else, so it 404s here too; its real home is the dedicated /dashboard route). Without this,
  // a user could bypass the hidden sidebar link by typing the URL directly.
  if ((navHiddenModules[user.role] || []).includes(slug) || !can(user, slug, PermissionAction.VIEW)) notFound();
  if (slug === 'calendar') return <CalendarView />;
  if (slug === 'reception-dashboard') return <ReceptionDashboard />;
  if (slug === 'settings') {
    if (user.role !== 'MASTER_ADMIN') notFound();
    return <SettingsPage />;
  }
  return <ModulePage slug={slug} />;
}
