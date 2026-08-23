'use client';

import React, { useState } from 'react';
import { TimeSeriesPointDTO } from '@/lib/analytics/analytics-types';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface TimeSeriesChartProps {
  series: TimeSeriesPointDTO[];
  currency: string;
  title?: string;
  hasFinancialAccess?: boolean;
}

export function TimeSeriesChart({
  series,
  currency,
  title = 'Revenue & Volume Trend',
  hasFinancialAccess = true,
}: TimeSeriesChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-500 text-sm italic">
        No trend data available for selected period.
      </div>
    );
  }

  const maxRevenue = Math.max(...series.map((s) => s.value || 0), 1);
  const maxOrders = Math.max(...series.map((s) => s.ordersCount || 0), 1);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>📈</span> {title}
        </h3>
        <div className="flex items-center gap-4 text-xs">
          {hasFinancialAccess && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Revenue</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Orders</span>
          </div>
        </div>
      </div>

      {/* SVG Responsive Bar & Line Chart Container */}
      <div className="relative h-56 w-full pt-4 pb-8">
        <div className="absolute inset-x-0 bottom-8 top-4 flex items-end justify-between gap-1 sm:gap-2 px-2">
          {series.map((pt, idx) => {
            const revHeightPct = (pt.value / maxRevenue) * 100;
            const ordHeightPct = ((pt.ordersCount || 0) / maxOrders) * 100;
            const isHovered = hoveredIdx === idx;

            return (
              <div
                key={pt.period || idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="relative flex-1 h-full flex items-end justify-center group cursor-pointer"
              >
                {/* Order count bar */}
                <div
                  style={{ height: `${Math.max(ordHeightPct, 4)}%` }}
                  className={`w-full max-w-[28px] rounded-t-md transition-all ${
                    isHovered ? 'bg-blue-400 opacity-90' : 'bg-blue-600/60'
                  }`}
                />

                {/* Revenue line/bar overlay */}
                {hasFinancialAccess && pt.value > 0 && (
                  <div
                    style={{ height: `${Math.max(revHeightPct, 4)}%` }}
                    className={`absolute bottom-0 w-full max-w-[14px] rounded-t-md transition-all ${
                      isHovered ? 'bg-amber-400' : 'bg-amber-500/80'
                    }`}
                  />
                )}

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 z-20 bg-zinc-950 border border-zinc-700 text-white rounded-xl p-2.5 shadow-2xl text-xs whitespace-nowrap min-w-[120px] pointer-events-none">
                    <div className="font-bold text-amber-400 border-b border-zinc-800 pb-1 mb-1">
                      {pt.period}
                    </div>
                    {hasFinancialAccess && (
                      <div>Revenue: <span className="font-mono text-white">{formatCurrency(pt.value, currency)}</span></div>
                    )}
                    <div>Orders: <span className="font-mono text-blue-400">{pt.ordersCount || 0}</span></div>
                  </div>
                )}

                {/* Period label under bar */}
                <div className="absolute top-full mt-1.5 text-[10px] text-zinc-500 truncate max-w-full font-mono">
                  {pt.period.replace(/^Hour\s+/, '')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
