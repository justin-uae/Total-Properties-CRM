import { ModulePage } from '@/components/ModulePage';
import { moduleMap } from '@/lib/modules';
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!moduleMap[slug]) notFound();
  return <ModulePage slug={slug} />;
}
