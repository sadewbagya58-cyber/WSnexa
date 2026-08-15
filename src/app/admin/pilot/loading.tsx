import React from 'react';

export default function AdminPilotLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
          <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
          <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
        </div>
        <div className="h-10 w-44 bg-zinc-900/10 rounded-2xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((t) => (
          <div key={t} className="rounded-3xl border border-zinc-200 bg-white p-6 space-y-3">
            <div className="h-8 w-8 bg-zinc-100 rounded-xl" />
            <div className="h-5 w-32 bg-zinc-200 rounded" />
            <div className="h-3 w-48 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="h-5 w-36 bg-zinc-200 rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map((p) => (
            <div key={p} className="h-16 bg-zinc-50 rounded-2xl border border-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
