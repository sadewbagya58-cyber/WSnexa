import React from 'react';

export default function AdminUsersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-28 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-56 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-72 bg-zinc-100 rounded-lg" />
      </div>

      <div className="h-12 w-full max-w-xl bg-zinc-200 rounded-2xl" />

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="h-6 w-32 bg-zinc-200 rounded" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <div key={r} className="h-16 bg-zinc-50 rounded-2xl border border-zinc-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
