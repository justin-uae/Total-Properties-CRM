export default function TenantPortalPage() {
  return (
    <div data-theme="warm-sunset" className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-orange-600 to-amber-500 p-8 text-white shadow-soft">
          <p className="text-sm font-bold uppercase tracking-widest text-white/75">Total Business Centres</p>
          <h1 className="mt-2 text-3xl font-black">Tenant Portal</h1>
          <p className="mt-2 text-white/80">View invoices, documents, contracts, meeting room bookings and maintenance requests.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {['Invoices', 'Documents', 'Maintenance', 'Meeting Rooms'].map((item, idx) => (
            <div key={item} className="card p-6"><p className="text-sm text-slate-500">{item}</p><p className="mt-3 text-3xl font-black">{idx + 1}</p><p className="mt-2 text-xs text-slate-500">Tenant-facing panel placeholder.</p></div>
          ))}
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-bold">Portal Security</h2>
          <p className="mt-2 text-sm text-slate-500">In production, tenants should receive individual accounts with verified email, password reset and protected document downloads.</p>
        </div>
      </div>
    </div>
  );
}
