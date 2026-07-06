'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, LayoutDashboard, KeyRound, Wrench, DoorOpen, FolderOpen, Mail } from 'lucide-react';
import { useState } from 'react';

const links = [
  { href: '/tenant-portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tenant-portal/access-cards', label: 'Access Cards & Keys', icon: KeyRound },
  { href: '/tenant-portal/mail-parcels', label: 'Mail & Parcels', icon: Mail },
  { href: '/tenant-portal/maintenance', label: 'Maintenance Tickets', icon: Wrench },
  { href: '/tenant-portal/meeting-rooms', label: 'Meeting Rooms', icon: DoorOpen },
  { href: '/tenant-portal/documents', label: 'Documents', icon: FolderOpen }
];

export function TenantShell({ companyName, children }: { companyName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div data-theme="warm-sunset" className="min-h-screen bg-[rgb(var(--bg))]">
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/10 bg-[rgb(var(--sidebar))] text-white transition-transform duration-300 lg:translate-x-0`}>
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5 sm:h-20 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white sm:h-11 sm:w-11">TB</div>
          <div>
            <p className="text-base font-bold leading-tight sm:text-lg">Total Business</p>
            <p className="text-xs text-white/70 sm:text-sm">Tenant Portal</p>
          </div>
        </div>
        <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4 sm:h-[calc(100vh-5rem)] sm:py-5">
          <div className="space-y-1">
            {links.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'bg-white/15 text-white shadow' : 'text-white/75 hover:bg-white/10 hover:text-white'}`} onClick={() => setOpen(false)}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-2 px-3 sm:h-20 sm:gap-4 sm:px-6 lg:px-8">
            <button onClick={() => setOpen(true)} className="shrink-0 rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-700">{companyName}</p>
            </div>
            <button onClick={logout} className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 sm:p-3" title="Logout"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
