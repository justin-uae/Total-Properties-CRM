import { ModulePage } from '@/components/ModulePage';
import { CalendarView } from '@/components/CalendarView';
import { SettingsPage } from '@/components/SettingsPage';
import { moduleMap } from '@/lib/modules';
import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!moduleMap[slug]) notFound();
  if (slug === 'calendar') return <CalendarView />;
  if (slug === 'settings') {
    const user = await requireUser();
    if (user.role !== 'MASTER_ADMIN') notFound();
    return <SettingsPage />;
  }
  return <ModulePage slug={slug} />;
}
