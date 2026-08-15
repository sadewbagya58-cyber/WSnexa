import React from 'react';

export default function AdminLaunchReadinessLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-zinc-200 rounded" />
          <div className="h-10 w-32 bg-zinc-900/10 rounded-xl" />
        </div>
        <div className="h-3 w-full bg-zinc-100 rounded-full" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div key={s} className="rounded-2xl border border-zinc-100 bg-white p-4 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-zinc-200 rounded" />
              <div className="h-5 w-16 bg-zinc-100 rounded-full" />
            </div>
            <div className="h-2.5 w-56 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
