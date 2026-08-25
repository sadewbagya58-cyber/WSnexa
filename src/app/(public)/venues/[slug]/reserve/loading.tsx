import React from 'react';

export default function PublicVenueReserveLoading() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased animate-pulse">
      <header className="bg-white border-b border-zinc-200 py-3.5 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="h-5 w-36 bg-zinc-200 rounded" />
          <div className="h-5 w-24 bg-zinc-200 rounded" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-4">
          <div className="h-7 w-48 bg-zinc-200 rounded" />
          <div className="h-4 w-64 bg-zinc-100 rounded" />
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="h-10 bg-zinc-100 rounded-xl" />
            <div className="h-10 bg-zinc-100 rounded-xl" />
            <div className="h-10 bg-zinc-100 rounded-xl" />
          </div>
        </div>
      </main>
    </div>
  );
}
