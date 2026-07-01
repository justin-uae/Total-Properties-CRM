import { prisma } from '@/lib/db';
import { currency } from '@/lib/utils';
import { Building2, CalendarDays, CreditCard, Receipt, UserPlus, Wrench } from 'lucide-react';

async function count(module: string, status?: string) {
  return prisma.record.count({ where: { module, ...(status ? { status } : {}) } });
}

async function sumInvoices() {
  const rows = await prisma.record.findMany({ where: { module: 'invoices' } });
  return rows.reduce((sum, row) => sum + Number((row.data as any)?.amount || 0), 0);
}

export default async function DashboardPage() {
  const [newLeads, activeClients, openTickets, bookings, invoices, revenue, occupied, services] = await Promise.all([
    count('leads', 'New'),
    count('clients', 'Active'),
    count('maintenance', 'Open'),
    count('meeting-room-bookings'),
    count('invoices'),
    sumInvoices(),
    prisma.record.count({ where: { module: 'services-offices', status: 'Occupied' } }),
    count('services-offices')
  ]);
  const occupancy = services ? Math.round((occupied / services) * 100) : 0;
  const recent = await prisma.record.findMany({ orderBy: { createdAt: 'desc' }, take: 8 });
  const due = await prisma.record.findMany({ where: { OR: [{ module: 'invoices' }, { module: 'contracts' }, { module: 'maintenance' }] }, orderBy: { updatedAt: 'desc' }, take: 6 });

  const cards = [
    { label: 'New Leads', value: newLeads, icon: UserPlus, note: 'Requires follow-up' },
    { label: 'Active Clients', value: activeClients, icon: Building2, note: 'Tenants and members' },
    { label: 'Open Tickets', value: openTickets, icon: Wrench, note: 'Maintenance requests' },
    { label: 'Meeting Bookings', value: bookings, icon: CalendarDays, note: 'All bookings' },
    { label: 'Invoices', value: invoices, icon: Receipt, note: 'Invoice records' },
    { label: 'Total Invoice Value', value: currency(revenue), icon: CreditCard, note: 'Gross invoice value' }
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-500 to-rose-500 p-8 text-white shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.25),transparent_35%)]" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/75">Total Business Centres CRM</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Good day — here is your business centre overview.</h1>
          <p className="mt-2 max-w-3xl text-white/85">Manage enquiries, offices, meeting rooms, invoices, contracts, renewals, reception and operations from one dashboard.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-black">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.note}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-[rgb(var(--accent))]"><Icon /></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold">Occupancy Overview</h2>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">{occupancy}% occupied</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${occupancy}%` }} />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Occupied</p><p className="text-2xl font-bold">{occupied}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Total Spaces</p><p className="text-2xl font-bold">{services}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Available</p><p className="text-2xl font-bold">{Math.max(services - occupied, 0)}</p></div>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-bold">Alerts & Follow-ups</h2>
          <div className="mt-4 space-y-3">
            {due.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                <p className="text-sm font-bold">{item.title}</p>
                <p className="text-xs text-slate-500">{item.module.replaceAll('-', ' ')} • {item.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold">Recent CRM Activity</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-3">Record</th><th>Module</th><th>Status</th><th>Created</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((row) => <tr key={row.id}><td className="py-3 font-semibold">{row.title}</td><td>{row.module.replaceAll('-', ' ')}</td><td>{row.status}</td><td>{row.createdAt.toLocaleString()}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
