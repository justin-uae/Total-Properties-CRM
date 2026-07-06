import { requireUser, tenantCompanyName } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { KeyRound, Wrench, DoorOpen, FolderOpen, Mail } from 'lucide-react';

async function scopedCount(module: string, companyName: string, matchField = 'clientName') {
  const records = await prisma.record.findMany({ where: { module } });
  return records.filter((r) => (r.data as any)?.[matchField] === companyName).length;
}

export default async function TenantPortalPage() {
  const user = await requireUser();
  const companyName = (await tenantCompanyName(user)) || '';

  const accessCards = await scopedCount('access-cards-keys', companyName);
  const mailParcels = await scopedCount('mail-parcels', companyName);
  const openTickets = await scopedCount('maintenance', companyName);
  const bookings = await scopedCount('meeting-room-bookings', companyName, 'customerName');
  const documents = await scopedCount('documents', companyName);

  const cards = [
    { label: 'Access Cards & Keys', value: accessCards, icon: KeyRound },
    { label: 'Mail & Parcels', value: mailParcels, icon: Mail },
    { label: 'Maintenance Tickets', value: openTickets, icon: Wrench },
    { label: 'Meeting Room Bookings', value: bookings, icon: DoorOpen },
    { label: 'Documents', value: documents, icon: FolderOpen }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-8 text-white shadow-soft">
        <p className="text-sm font-bold uppercase tracking-widest text-white/75">Total Business Centres</p>
        <h1 className="mt-2 text-3xl font-black">Tenant Portal</h1>
        <p className="mt-2 text-white/80">{companyName} — view your access cards, mail & parcels, raise maintenance tickets, book meeting rooms and view your documents.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-[rgb(var(--accent))]"><Icon className="h-5 w-5" /></div>
              <p className="mt-3 text-sm text-slate-500">{card.label}</p>
              <p className="mt-1 text-3xl font-black">{card.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
