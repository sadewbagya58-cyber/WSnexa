import React from 'react';

export default function AdminSuperAdminsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="border-b border-zinc-200 pb-6 space-y-2">
        <div className="h-4 w-32 bg-zinc-200 rounded-lg" />
        <div className="h-8 w-64 bg-zinc-200 rounded-xl" />
        <div className="h-3 w-80 bg-zinc-100 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="h-5 w-36 bg-zinc-200 rounded" />
          <div className="h-10 bg-zinc-50 rounded-xl" />
          <div className="h-10 bg-zinc-900/10 rounded-xl" />
        </div>

        <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="h-5 w-40 bg-zinc-200 rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map((a) => (
              <div key={a} className="h-16 bg-zinc-50 rounded-2xl border border-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
