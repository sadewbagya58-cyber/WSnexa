import React from 'react';

export default function CustomerReservationsLoading() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-pulse font-sans">
      <div className="space-y-2">
        <div className="h-7 w-48 bg-slate-200 rounded-lg" />
        <div className="h-4 w-72 bg-slate-100 rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-4 w-56 bg-slate-100 rounded" />
            <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
