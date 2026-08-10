export default function MenuLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-zinc-200 rounded-lg" />
          <div className="h-4 w-64 bg-zinc-100 rounded-md" />
        </div>
        <div className="h-10 w-36 bg-zinc-200 rounded-xl" />
      </div>

      {/* Category Pills Skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-28 bg-zinc-200 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Menu Item Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-4 bg-white border border-zinc-200 shadow-xs rounded-2xl space-y-3">
            <div className="h-40 bg-zinc-100 rounded-xl border border-zinc-200/50" />
            <div className="flex justify-between items-center">
              <div className="h-5 w-32 bg-zinc-200 rounded" />
              <div className="h-5 w-16 bg-zinc-200 rounded" />
            </div>
            <div className="h-3 w-48 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
