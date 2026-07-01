'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setLoading(false);
    if (!res.ok) return setError(json.message || 'Login failed');
    router.push('/dashboard');
  }

  return (
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
              {['Master Admin controls', 'Staff permissions', 'Stripe ready', 'Tenant portal'].map((item) => <div key={item} className="rounded-2xl bg-white/15 p-4 backdrop-blur">{item}</div>)}
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
            {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Enter your password" required />
              <p className="mt-2 text-xs text-slate-500">Default after seed: admin@example.com / Admin123! — change this immediately.</p>
            </div>
            <button disabled={loading} className="btn-primary w-full py-3">{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
