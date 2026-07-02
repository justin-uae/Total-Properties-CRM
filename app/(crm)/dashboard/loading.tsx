export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="skeleton h-36 w-full rounded-3xl" />

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <div className="skeleton h-3 w-28" style={{ animationDelay: `${i * 60}ms` }} />
                <div className="skeleton h-8 w-16" style={{ animationDelay: `${i * 60 + 30}ms` }} />
                <div className="skeleton h-2.5 w-36" style={{ animationDelay: `${i * 60 + 60}ms` }} />
              </div>
              <div className="skeleton h-12 w-12 rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div className="skeleton h-5 w-44" />
            <div className="skeleton h-7 w-28 rounded-full" />
          </div>
          <div className="skeleton h-4 w-full rounded-full" />
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 p-4 space-y-2">
                <div className="skeleton h-2.5 w-16" />
                <div className="skeleton h-7 w-10" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="skeleton h-5 w-36 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 p-3 space-y-1.5">
                <div className="skeleton h-3.5 w-3/4" style={{ animationDelay: `${i * 50}ms` }} />
                <div className="skeleton h-2.5 w-1/2" style={{ animationDelay: `${i * 50 + 25}ms` }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity table */}
      <div className="card p-6">
        <div className="skeleton h-5 w-44 mb-4" />
        <div className="space-y-3 mt-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-4 gap-4 py-2">
              <div className="skeleton h-3.5 w-full" style={{ animationDelay: `${i * 40}ms` }} />
              <div className="skeleton h-3.5 w-3/4" style={{ animationDelay: `${i * 40 + 20}ms` }} />
              <div className="skeleton h-3.5 w-1/2" style={{ animationDelay: `${i * 40 + 40}ms` }} />
              <div className="skeleton h-3.5 w-2/3" style={{ animationDelay: `${i * 40 + 60}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
