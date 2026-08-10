export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-72 bg-zinc-800/60 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-zinc-800 rounded-xl" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-zinc-800 rounded" />
              <div className="h-6 w-6 bg-zinc-800 rounded-full" />
            </div>
            <div className="h-8 w-20 bg-zinc-800 rounded-lg" />
            <div className="h-3 w-32 bg-zinc-800/60 rounded" />
          </div>
        ))}
      </div>

      {/* Main Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
          <div className="h-5 w-40 bg-zinc-800 rounded" />
          <div className="h-64 bg-zinc-950/60 rounded-xl border border-zinc-800/50" />
        </div>
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
          <div className="h-5 w-32 bg-zinc-800 rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-12 bg-zinc-950/60 rounded-xl border border-zinc-800/50" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
