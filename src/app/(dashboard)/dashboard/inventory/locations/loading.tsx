import React from 'react';

export default function StorageLocationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="space-y-2">
          <div className="h-6 w-44 bg-zinc-200 rounded-md" />
          <div className="h-3.5 w-64 bg-zinc-100 rounded-md" />
        </div>
      </div>

      {/* Storage Locations Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-zinc-200 rounded" />
              <div className="h-4 w-14 bg-zinc-100 rounded-full" />
            </div>
            <div className="h-3 w-48 bg-zinc-100 rounded" />
            <div className="pt-2 border-t border-zinc-100 flex justify-between">
              <div className="h-3 w-20 bg-zinc-100 rounded" />
              <div className="h-3 w-16 bg-zinc-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
