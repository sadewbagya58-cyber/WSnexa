import React from 'react';

export default function AdminBusinessesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-28 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-60 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-72 bg-zinc-100 rounded-lg" />
      </div>

      <div className="h-12 w-full max-w-xl bg-zinc-200 rounded-2xl" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 bg-zinc-200 rounded" />
              <div className="h-6 w-16 bg-zinc-100 rounded-lg" />
            </div>
            <div className="h-3 w-48 bg-zinc-100 rounded" />
            <div className="h-10 bg-zinc-50 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
