'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Search, Bell, ChevronDown } from 'lucide-react';
import { moduleGroups, modules, themes } from '@/lib/modules';
import { useEffect, useMemo, useState } from 'react';

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  theme: string;
  permissions: { module: string; action: string }[];
};

function canSee(user: ShellUser, slug: string) {
  if (user.role === 'MASTER_ADMIN') return true;
  if (slug === 'dashboard') return true;
  return user.permissions.some((p) => p.module === slug && p.action === 'VIEW');
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState(user.theme || 'warm-sunset');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tbc-theme', theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('tbc-theme');
    if (saved) setTheme(saved);
  }, []);

  const grouped = useMemo(() => {
    return moduleGroups.map((group) => ({
      group,
      items: modules.filter((module) => module.group === group && canSee(user, module.slug))
    })).filter((g) => g.items.length > 0);
  }, [user]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))]">
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/10 bg-[rgb(var(--sidebar))] text-white transition lg:translate-x-0`}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white">TB</div>
          <div>
            <p className="text-lg font-bold leading-tight">Total Business</p>
            <p className="text-sm text-white/70">Centres CRM</p>
          </div>
        </div>
        <nav className="h-[calc(100vh-5rem)] overflow-y-auto px-4 py-5">
          {grouped.map(({ group, items }) => (
            <div key={group} className="mb-6">
              {group !== 'Dashboard' && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-white/40">{group}</p>}
              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const href = item.slug === 'dashboard' ? '/dashboard' : `/modules/${item.slug}`;
                  const active = pathname === href;
                  return (
                    <Link key={item.slug} href={href} className={`sidebar-link ${active ? 'bg-white/15 text-white shadow' : 'text-white/75 hover:bg-white/10 hover:text-white'}`} onClick={() => setOpen(false)}>
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
          <div className="flex h-20 items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu /></button>
            <div className="hidden flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex">
              <Search className="h-4 w-4 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search clients, invoices, leads, visitors..." />
            </div>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input max-w-[190px]">
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="relative rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">3</span>
            </button>
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:flex">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-[rgb(var(--accent))] text-sm font-bold text-white">{user.name.slice(0, 2).toUpperCase()}</div>
              <div className="text-sm">
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <button onClick={logout} className="rounded-xl border border-slate-200 p-3 text-slate-600 hover:bg-slate-50" title="Logout"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
