import React from 'react';

export default function ItemDetailLoading() {
  return (
    <div className="space-y-6 max-w-4xl animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-zinc-200 rounded-md" />
          <div className="h-3.5 w-64 bg-zinc-100 rounded-md" />
        </div>
      </div>

      {/* Hero Stock Summary Card Skeleton */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-zinc-200 rounded" />
            <div className="h-10 w-44 bg-zinc-300 rounded" />
            <div className="h-3 w-36 bg-zinc-100 rounded" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100 min-w-[110px] space-y-1">
                <div className="h-2.5 w-16 bg-zinc-200 rounded" />
                <div className="h-4 w-20 bg-zinc-300 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Location Breakdown Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-40 bg-zinc-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-zinc-50 rounded-xl border border-zinc-100" />
            ))}
          </div>
        </div>
      </div>

      {/* Movement Timeline Skeleton */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="h-4 w-36 bg-zinc-200 rounded" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-zinc-50 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
