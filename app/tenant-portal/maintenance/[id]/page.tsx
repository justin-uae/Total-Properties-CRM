'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/Spinner';
import { MaintenanceDetail } from '@/components/MaintenanceDetail';

export default function TenantMaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<{ id: string; status: string; data: Record<string, any> } | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function load() {
    const res = await fetch(`/api/tenant/maintenance/${id}`);
    if (!res.ok) { setNotFound(true); return; }
    const json = await res.json();
    setTicket(json.record);
  }

  useEffect(() => { load(); }, [id]);

  function goBack() {
    router.push('/tenant-portal/maintenance');
  }

  if (notFound) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Ticket not found. <button onClick={goBack} className="font-semibold text-blue-600 hover:underline">Back to Maintenance Tickets</button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center gap-3 p-10">
        <Spinner size="sm" color="muted" />
        <span className="text-sm text-slate-500">Loading ticket…</span>
      </div>
    );
  }

  return <MaintenanceDetail ticket={ticket} mode="tenant" onClose={goBack} onSaved={load} />;
}
