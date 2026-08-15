import React from 'react';
import Link from 'next/link';

export const SupportFallbackCard: React.FC = () => {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-8 text-center space-y-4 shadow-2xs">
      <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 flex items-center justify-center text-2xl mx-auto shadow-2xs">
        💬
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-sm sm:text-base font-extrabold text-zinc-950">
          Still need help with your venue?
        </h3>
        <p className="text-xs text-zinc-500 font-medium leading-relaxed">
          Can&apos;t find what you are looking for? Our operational guides and troubleshooting steps cover 95% of common restaurant workflows.
        </p>
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/dashboard/help/troubleshooting"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 active:scale-[0.97] transition-all"
        >
          🔧 Troubleshooting Directory
        </Link>
        <Link
          href="/dashboard/help"
          className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 active:scale-[0.97] transition-all"
        >
          🏠 Help Center Home
        </Link>
      </div>
    </div>
  );
};
