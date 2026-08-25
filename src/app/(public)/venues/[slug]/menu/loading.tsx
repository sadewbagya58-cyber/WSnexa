import React from 'react';

export default function PublicVenueMenuLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased animate-pulse">
      <header className="bg-white border-b border-zinc-200 py-3.5 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-5 w-36 bg-zinc-200 rounded" />
          <div className="h-5 w-24 bg-amber-100 rounded" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-3">
          <div className="h-7 w-56 bg-zinc-200 rounded" />
          <div className="h-4 w-40 bg-zinc-100 rounded" />
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <div className="h-9 w-28 bg-white border border-zinc-200 rounded-2xl shrink-0" />
          <div className="h-9 w-32 bg-white border border-zinc-200 rounded-2xl shrink-0" />
          <div className="h-9 w-24 bg-white border border-zinc-200 rounded-2xl shrink-0" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-2">
              <div className="h-5 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-48 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
