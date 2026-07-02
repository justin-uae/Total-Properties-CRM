'use client';

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

      <div data-theme="warm-sunset" className="min-h-screen bg-slate-950 p-6 text-slate-900">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid-cols-2">
          <div className="relative hidden bg-gradient-to-br from-orange-700 via-amber-500 to-rose-500 p-12 text-white lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.32),transparent_35%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-2xl font-black">TB</div>
                <h1 className="mt-8 text-5xl font-black leading-tight">Total Business Centres CRM</h1>
                <p className="mt-5 max-w-md text-lg text-white/85">A modern CRM for leads, offices, meeting rooms, contracts, invoices, tenants and reception operations.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {['Master Admin controls', 'Staff permissions', 'Stripe ready', 'Tenant portal'].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/15 p-4 backdrop-blur">{item}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-8">
            <form onSubmit={submit} className="w-full max-w-md space-y-6">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-orange-600">Secure login</p>
                <h2 className="mt-2 text-3xl font-black">Welcome back</h2>
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
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
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
