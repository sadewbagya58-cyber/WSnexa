import React from 'react';

export default function WasteTrackingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-zinc-200 rounded-md" />
          <div className="h-3.5 w-64 bg-zinc-100 rounded-md" />
        </div>
      </div>

      {/* Waste Table Skeleton */}
      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex justify-between">
          <div className="h-4 w-28 bg-zinc-200 rounded" />
          <div className="h-4 w-24 bg-zinc-200 rounded" />
          <div className="h-4 w-20 bg-zinc-200 rounded" />
          <div className="h-4 w-24 bg-zinc-200 rounded" />
        </div>
        <div className="divide-y divide-zinc-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="h-4 w-32 bg-zinc-200 rounded" />
                <div className="h-3 w-20 bg-zinc-100 rounded" />
              </div>
              <div className="h-4 w-16 bg-zinc-200 rounded" />
              <div className="h-5 w-24 bg-zinc-100 rounded-full" />
              <div className="h-3.5 w-28 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
