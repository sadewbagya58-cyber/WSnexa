export default function CustomerLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 p-4 sm:p-6 space-y-6 animate-pulse max-w-4xl mx-auto">
      {/* Customer Header Skeleton */}
      <div className="flex justify-between items-center bg-white border border-zinc-200 shadow-xs rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-200 rounded-full" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-zinc-200 rounded" />
            <div className="h-3 w-24 bg-zinc-100 rounded" />
          </div>
        </div>
        <div className="h-8 w-20 bg-zinc-200 rounded-lg" />
      </div>

      {/* Main Active/Recent Cards Skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-40 bg-zinc-200 rounded" />
        <div className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-xs">
          <div className="h-4 w-48 bg-zinc-200 rounded" />
          <div className="h-12 bg-zinc-100 rounded-xl border border-zinc-200/50" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-5 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-xs">
            <div className="h-4 w-28 bg-zinc-200 rounded" />
            <div className="h-16 bg-zinc-100 rounded-xl border border-zinc-200/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
