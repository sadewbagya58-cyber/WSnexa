import React from 'react';

export default function AdminSystemLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-zinc-200 rounded" />
              <div className="h-4 w-12 bg-zinc-100 rounded" />
            </div>
            <div className="h-3 w-44 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
