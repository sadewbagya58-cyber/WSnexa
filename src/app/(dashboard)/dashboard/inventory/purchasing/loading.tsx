import React from 'react';

export default function PurchasingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-zinc-200 rounded-md" />
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex justify-between">
          <div className="h-6 w-32 bg-zinc-200 rounded-md" />
          <div className="h-6 w-24 bg-zinc-100 rounded-md" />
        </div>
        <div className="divide-y divide-zinc-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex justify-between items-center">
              <div className="space-y-2">
                <div className="h-4 w-28 bg-zinc-200 rounded-md" />
                <div className="h-3 w-48 bg-zinc-100 rounded-md" />
              </div>
              <div className="h-6 w-20 bg-zinc-100 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
