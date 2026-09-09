export default function WaiterOrderLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col animate-pulse">
      {/* Top Navigation Header Skeleton */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-zinc-200 rounded-xl" />
            <div className="space-y-1">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-48 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="h-9 w-28 bg-zinc-200 rounded-xl" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Step Indicator Skeleton */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="h-4 w-36 bg-zinc-200 rounded" />
            <div className="h-4 w-16 bg-zinc-100 rounded" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 rounded-full bg-zinc-200" />
            ))}
          </div>
        </div>

        {/* Section Title & Area Filters */}
        <div className="space-y-3">
          <div className="h-5 w-40 bg-zinc-200 rounded" />
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-zinc-200 rounded-lg shrink-0" />
            ))}
          </div>
        </div>

        {/* Table / Menu Grid Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 shadow-2xs flex flex-col items-center justify-center min-h-[100px]"
            >
              <div className="h-8 w-8 bg-zinc-200 rounded-full" />
              <div className="h-4 w-16 bg-zinc-200 rounded" />
              <div className="h-3 w-12 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
