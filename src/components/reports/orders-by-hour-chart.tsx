'use client';

import React from 'react';
import { OrdersByHourBucket } from '@/server/services/report.service';

interface OrdersByHourChartProps {
  hours: OrdersByHourBucket[];
}

export function OrdersByHourChart({ hours }: OrdersByHourChartProps) {
  if (!hours || hours.length === 0) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 flex items-center justify-center min-h-[250px]">
        <div className="text-zinc-500 text-sm">No hourly data available</div>
      </div>
    );
  }

  const maxOrders = Math.max(...hours.map((h) => h.orders_count), 1);
  const peakHour = hours.reduce((max, curr) => (curr.orders_count > max.orders_count ? curr : max), hours[0]);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Orders By Hour (Peak Analysis)</h3>
          <p className="text-xs text-zinc-400">Distribution of guest order volume across 24-hour branch cycle</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-zinc-400">Peak Hour: </span>
          <span className="text-xs font-bold text-amber-400 font-mono">
            {peakHour ? `${peakHour.hour}:00 (${peakHour.orders_count} orders)` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-36 pt-4 px-2 border-b border-zinc-800">
        {hours.map((item) => {
          const heightPct = Math.round((item.orders_count / maxOrders) * 100);
          const isPeak = item.hour === peakHour.hour && item.orders_count > 0;

          return (
            <div key={item.hour} className="flex-1 flex flex-col items-center group relative cursor-pointer">
              <div
                style={{ height: `${Math.max(4, heightPct)}%` }}
                className={`w-full rounded-t transition-all ${
                  isPeak ? 'bg-amber-400 group-hover:bg-amber-300' : 'bg-zinc-700 group-hover:bg-amber-500/80'
                }`}
              ></div>
              <title>{`Hour ${item.hour}:00 — ${item.orders_count} orders`}</title>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-zinc-500 font-mono pt-2">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
