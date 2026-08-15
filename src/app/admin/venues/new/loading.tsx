import React from 'react';

export default function AdminCreateVenueLoading() {
  return (
    <div className="space-y-8 animate-pulse max-w-4xl mx-auto">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-28 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="h-8 flex-1 bg-zinc-100 rounded-xl" />
        ))}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-8 space-y-6">
        <div className="h-6 w-48 bg-zinc-200 rounded" />
        <div className="space-y-4">
          <div className="h-12 bg-zinc-100 rounded-2xl" />
          <div className="h-12 bg-zinc-100 rounded-2xl" />
          <div className="h-24 bg-zinc-100 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
