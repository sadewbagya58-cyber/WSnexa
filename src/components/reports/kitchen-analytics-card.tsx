'use client';

import React from 'react';
import { KitchenPerformance } from '@/server/services/report.service';

interface KitchenAnalyticsCardProps {
  kitchen: KitchenPerformance;
}

export function KitchenAnalyticsCard({ kitchen }: KitchenAnalyticsCardProps) {
  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Kitchen & Prep Operational Performance</h3>
          <p className="text-xs text-zinc-400">Order lifecycle status transition timings (from order status history)</p>
        </div>
        <span className="text-xl">👨‍🍳</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Avg Confirmation Time */}
        <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg Confirmation Time</div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            {formatDuration(kitchen.avg_confirmation_seconds)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">pending → confirmed</div>
        </div>

        {/* Avg Preparation Time */}
        <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg Preparation Time</div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            {formatDuration(kitchen.avg_preparation_seconds)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">preparing → ready</div>
        </div>

        {/* Avg Ready to Complete */}
        <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg Ready to Table</div>
          <div className="mt-1 font-mono text-lg font-bold text-blue-400">
            {formatDuration(kitchen.avg_ready_seconds)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">ready → completed</div>
        </div>

        {/* Longest Prep Time */}
        <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Peak Longest Prep</div>
          <div className="mt-1 font-mono text-lg font-bold text-rose-400">
            {formatDuration(kitchen.longest_preparation_seconds)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Maximum prep duration</div>
        </div>
      </div>
    </div>
  );
}
