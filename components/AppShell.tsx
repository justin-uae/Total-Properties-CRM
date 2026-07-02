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
      {/* Mobile sidebar backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 transform border-r border-white/10 bg-[rgb(var(--sidebar))] text-white transition-transform duration-300 lg:translate-x-0`}>
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5 sm:h-20 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white sm:h-11 sm:w-11">TB</div>
          <div>
            <p className="text-base font-bold leading-tight sm:text-lg">Total Business</p>
            <p className="text-xs text-white/70 sm:text-sm">Centres CRM</p>
          </div>
        </div>
        <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4 sm:h-[calc(100vh-5rem)] sm:py-5">
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
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
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
          <div className="flex h-16 items-center gap-2 px-3 sm:h-20 sm:gap-4 sm:px-6 lg:px-8">
            <button onClick={() => setOpen(true)} className="shrink-0 rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
            <div className="hidden flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search clients, invoices, leads, visitors..." />
            </div>
            {/* Push right-side items to the end on mobile */}
            <div className="flex-1 md:hidden" />
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="input hidden max-w-[160px] sm:block lg:max-w-[190px]">
              {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="relative shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 sm:p-3">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">3</span>
            </button>
            <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 sm:flex">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent))] text-sm font-bold text-white sm:h-9 sm:w-9">{user.name.slice(0, 2).toUpperCase()}</div>
              <div className="hidden text-sm lg:block">
                <p className="font-semibold">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role.replace('_', ' ')}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
            </div>
            <button onClick={logout} className="shrink-0 rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50 sm:p-3" title="Logout"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <main className="px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
