'use client';

import React from 'react';

interface CustomerDashboardProps {
  displayName: string;
  email: string;
}

export function CustomerDashboard({ displayName, email }: CustomerDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Hospitality Member</span>
          <h1 className="text-2xl font-black text-white mt-1">Welcome, {displayName}!</h1>
          <p className="text-xs text-zinc-400 mt-1 font-mono">{email}</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-950/80 px-4 py-2 rounded-xl border border-zinc-800 text-xs text-zinc-300">
          <span>🛡️</span>
          <span>Verified Customer Account</span>
        </div>
      </div>

      {/* KPI Cards Placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase">Active Orders</div>
          <div className="text-2xl font-black font-mono text-white">0</div>
          <div className="text-[10px] text-zinc-500">Live guest orders in progress</div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase">Total Orders</div>
          <div className="text-2xl font-black font-mono text-white">0</div>
          <div className="text-[10px] text-zinc-500">Completed hospitality visits</div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase">Total Spend</div>
          <div className="text-2xl font-black font-mono text-emerald-400">LKR 0</div>
          <div className="text-[10px] text-zinc-500">Combined order history total</div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-2">
          <div className="text-xs font-bold text-zinc-400 uppercase">Saved Venues</div>
          <div className="text-2xl font-black font-mono text-amber-400">0</div>
          <div className="text-[10px] text-zinc-500">Favorite restaurants & hotels</div>
        </div>
      </div>

      {/* Activity & Order History Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🧾</span> Recent Order Activity
          </h3>
          <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
            <div>No guest orders linked to your customer profile yet.</div>
            <div className="text-[10px] text-zinc-600">
              * Order linkage engine will be available in Phase 15.
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🏬</span> Venues Visited
          </h3>
          <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl space-y-2">
            <div>Your visited hospitality venues will appear here.</div>
            <div className="text-[10px] text-zinc-600">
              * Restaurant & hotel discovery foundation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
