import React from 'react';

export default function AccessHubLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Banner Skeleton */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-zinc-200 rounded-lg w-64" />
          <div className="h-6 bg-zinc-100 rounded-full w-28" />
        </div>
        <div className="h-4 bg-zinc-100 rounded-lg w-3/4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-zinc-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-zinc-200 rounded-xl" />
              <div className="w-5 h-5 bg-zinc-200 rounded-full" />
            </div>
            <div className="h-5 bg-zinc-200 rounded-lg w-48" />
            <div className="h-4 bg-zinc-100 rounded-lg w-full" />
            <div className="h-8 bg-zinc-100 rounded-xl w-full pt-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
