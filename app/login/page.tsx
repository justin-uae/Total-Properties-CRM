'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok) {
      setLoading(false);
      return setError(json.message || 'Login failed');
    }
    setNavigating(true);
    router.push('/dashboard');
  }

  return (
    <>
      {navigating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-6 text-center">
            <div
              className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 text-2xl font-black text-white"
              style={{ boxShadow: '0 8px 32px rgba(234,88,12,0.3)' }}
            >
              TB
            </div>
            <Spinner size="lg" />
            <div>
              <p className="text-lg font-bold text-slate-900">Setting up your workspace</p>
              <p className="mt-1 text-sm text-slate-500">Signing you in securely…</p>
            </div>
          </div>
        </div>
      )}

      <div data-theme="warm-sunset" className="min-h-screen bg-slate-950 p-3 text-slate-900 sm:p-6">
        {/*
          Mobile:  flex-col  → image banner on top, form below
          Desktop: lg:grid   → image left column, form right column
          lg:h-[…] gives the grid an explicit height so the image cell
          can use h-full and the Next.js <Image fill> has a size reference.
        */}
        <div className="mx-auto flex max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-[2rem] lg:grid lg:h-[calc(100vh-3rem)] lg:grid-cols-2">

          {/* ── Image panel ──────────────────────────────────────────────
              Always visible.
              Mobile : fixed banner height (h-52 / sm:h-64), shows brand mark.
              Desktop: fills the full grid-cell height, shows full content.
          ────────────────────────────────────────────────────────────── */}
          <div className="relative h-52 shrink-0 overflow-hidden sm:h-64 lg:h-full">
            <Image
              src="/images/hero-private-office.jpg"
              alt="Private office at Total Business Centres"
              fill
              className="object-cover object-center"
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
            />

            {/* Dark overlay — lighter gradient on mobile, richer on desktop */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 to-black/15 lg:bg-gradient-to-br lg:from-black/55 lg:via-black/35 lg:to-black/30" />
            {/* Accent tint rising from the bottom */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[rgb(var(--accent)/0.4)] to-transparent" />

            {/* Mobile-only: compact centered brand mark */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white lg:hidden">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-xl font-black backdrop-blur-sm">
                TB
              </div>
              <p className="mt-2 text-lg font-black tracking-tight">Total Business Centres</p>
              <p className="text-xs uppercase tracking-widest text-white/65">CRM Platform</p>
            </div>

            {/* Desktop-only: full content overlay */}
            <div className="relative z-10 hidden h-full flex-col justify-between p-10 text-white lg:flex xl:p-12">
              <div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-2xl font-black backdrop-blur-sm">TB</div>
                <h1 className="mt-8 text-4xl font-black leading-tight xl:text-5xl">
                  Total Business Centres CRM
                </h1>
                <p className="mt-5 max-w-md text-base text-white/80 xl:text-lg">
                  A modern CRM for leads, offices, meeting rooms, contracts, invoices, tenants and reception operations.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm xl:gap-4">
                {['Master Admin controls', 'Staff permissions', 'Stripe ready', 'Tenant portal'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm xl:p-4">{item}</div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Form panel ───────────────────────────────────────────────
              flex-1 so it fills the remaining height on mobile (below the banner).
              lg:flex-none lets the grid control sizing on desktop.
          ────────────────────────────────────────────────────────────── */}
          <div className="flex justify-center p-6 py-10 sm:p-8 sm:py-12 lg:flex-1 lg:items-center">
            <form onSubmit={submit} className="w-full max-w-md space-y-5 sm:space-y-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-orange-600">Secure login</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Welcome back</h2>
                <p className="mt-2 text-sm text-slate-500">Sign in to manage Total Business Centres.</p>
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                disabled={loading}
                className="btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                {loading
                  ? <><Spinner size="sm" color="white" /><span>Signing in...</span></>
                  : 'Sign in'
                }
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}
