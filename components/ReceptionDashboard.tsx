import { prisma } from '@/lib/db';
import { fmtDate } from '@/lib/utils';
import { Mail, KeyRound, UserCheck, Wrench } from 'lucide-react';

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function count(module: string, status?: string | string[]) {
  return prisma.record.count({ where: { module, ...(status ? { status: Array.isArray(status) ? { in: status } : status } : {}) } });
}

export async function ReceptionDashboard() {
  const [visitorsToday, checkedIn, mailAwaiting, accessDue, openTickets, recent] = await Promise.all([
    prisma.record.count({ where: { module: 'visitors', createdAt: { gte: startOfToday() } } }),
    count('visitors', 'Checked In'),
    count('mail-parcels', ['Received', 'Client Notified']),
    count('access-cards-keys', 'Due Return'),
    count('maintenance', ['Open', 'In Progress', 'Waiting Tenant']),
    prisma.record.findMany({
      where: { module: { in: ['visitors', 'mail-parcels', 'access-cards-keys', 'maintenance'] } },
      orderBy: { createdAt: 'desc' },
      take: 8
    })
  ]);

  const cards = [
    { label: 'Visitors Checked In', value: checkedIn, icon: UserCheck, note: 'Currently on site' },
    { label: 'Visitors Today', value: visitorsToday, icon: UserCheck, note: 'Logged since midnight' },
    { label: 'Mail Awaiting Pickup', value: mailAwaiting, icon: Mail, note: 'Received, not yet collected' },
    { label: 'Access Returns Due', value: accessDue, icon: KeyRound, note: 'Cards & keys due back' },
    { label: 'Open Maintenance Tickets', value: openTickets, icon: Wrench, note: 'Needs attention' }
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-orange-600 via-amber-500 to-rose-500 p-5 text-white shadow-soft sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.25),transparent_35%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/75 sm:text-sm">Total Business Centres CRM</p>
          <h1 className="mt-2 text-xl font-black tracking-tight sm:text-3xl">Good day — here's today's front desk overview.</h1>
          <p className="mt-2 hidden max-w-3xl text-sm text-white/85 sm:block">Visitors, mail &amp; parcels, access cards and maintenance tickets in one place.</p>
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

      <div className="card p-4 sm:p-6">
        <h2 className="text-lg font-bold">Recent Front Desk Activity</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Record</th>
                <th className="px-3 py-3 whitespace-nowrap">Module</th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 whitespace-nowrap">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.length === 0 ? (
                <tr><td className="px-3 py-8 text-slate-500" colSpan={4}>No activity yet.</td></tr>
              ) : recent.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 whitespace-nowrap font-semibold">{row.title}</td>
                  <td className="px-3 py-3 whitespace-nowrap capitalize">{row.module.replaceAll('-', ' ')}</td>
                  <td className="px-3 py-3 whitespace-nowrap"><span className="status-pill bg-orange-50 text-orange-700">{row.status}</span></td>
                  <td className="px-3 py-3 whitespace-nowrap text-slate-500">{fmtDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
