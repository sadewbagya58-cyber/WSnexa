import React from 'react';

export default function SuppliersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-zinc-200 rounded-md" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-3">
            <div className="h-5 w-32 bg-zinc-200 rounded-md" />
            <div className="h-4 w-48 bg-zinc-100 rounded-md" />
            <div className="h-4 w-24 bg-zinc-100 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
