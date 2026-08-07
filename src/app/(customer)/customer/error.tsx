'use client';

import React from 'react';

export default function CustomerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md mx-auto my-12 text-center space-y-4 shadow-2xl">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-xl mx-auto">
        ⚠️
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-black text-white uppercase tracking-wider">Customer Portal Error</h2>
        <p className="text-xs text-zinc-400">
          {error.message || 'An error occurred while loading your customer profile.'}
        </p>
      </div>
      <div className="pt-2 flex flex-col gap-2">
        <button
          onClick={() => reset()}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all"
        >
          🔄 Retry
        </button>
        <a
          href="/customer"
          className="text-xs text-zinc-500 hover:text-zinc-400 font-medium py-1 transition-colors"
        >
          Refresh Portal
        </a>
      </div>
    </div>
  );
}
