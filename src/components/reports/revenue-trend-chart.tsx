'use client';

import React from 'react';
import { TimeSeriesBucket } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface RevenueTrendChartProps {
  series: TimeSeriesBucket[];
  currency: string;
}

export function RevenueTrendChart({ series, currency }: RevenueTrendChartProps) {
  if (!series || series.length === 0) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-zinc-500 text-sm">No revenue trend data in selected period</div>
      </div>
    );
  }

  const maxVal = Math.max(...series.map((s) => s.gross_sales_cents), 1000);
  const height = 220;
  const width = 600;
  const padding = 30;

  const points = series.map((item, index) => {
    const x = padding + (index / Math.max(1, series.length - 1)) * (width - padding * 2);
    const y = height - padding - (item.gross_sales_cents / maxVal) * (height - padding * 2);
    return { x, y, item };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Revenue Trend Over Time</h3>
          <p className="text-xs text-zinc-400">Database aggregated gross sales and order volume</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-zinc-300">Gross Sales</span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#27272a" strokeDasharray="3 3" />
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="#27272a"
            strokeDasharray="3 3"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#3f3f46"
          />

          {/* Y Axis Labels */}
          <text x={padding - 5} y={padding + 4} fill="#a1a1aa" fontSize="10" textAnchor="end">
            {formatCurrency(maxVal, currency)}
          </text>
          <text x={padding - 5} y={height - padding + 4} fill="#a1a1aa" fontSize="10" textAnchor="end">
            0
          </text>

          {/* Area Fill */}
          <path d={areaD} fill="url(#revenueGrad)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />

          {/* Data Points & Tooltips */}
          {points.map((p, i) => (
            <g key={i} className="group cursor-pointer">
              <circle cx={p.x} cy={p.y} r="4" fill="#f59e0b" className="transition-all group-hover:r-6" />
              <title>{`${new Date(p.item.bucket).toLocaleDateString()}: ${formatCurrency(p.item.gross_sales_cents, currency)} (${p.item.orders_count} orders)`}</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-500">
        <span>Start: {new Date(series[0]?.bucket).toLocaleDateString()}</span>
        <span>End: {new Date(series[series.length - 1]?.bucket).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
