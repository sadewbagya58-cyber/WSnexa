'use client';

import React, { useEffect, useState } from 'react';
import { CogsFinancialReport } from '@/server/services/inventory-intelligence.service';
import { fetchCogsReportAction } from '@/server/actions/inventory-intelligence';
import { formatCurrencyMinor } from '@/lib/utils/currency';

export function CogsAnalyticsCard({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const [data, setData] = useState<CogsFinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      const res = await fetchCogsReportAction({ start: startDate, end: endDate });
      if (isMounted && res.success && res.data) {
        setData(res.data);
      }
      if (isMounted) setIsLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [startDate, endDate]);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs animate-pulse space-y-4">
        <div className="h-5 w-48 bg-zinc-200 rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-16 bg-zinc-100 rounded-xl" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
          <div className="h-16 bg-zinc-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
            <span>🥗</span> COGS, Food Cost & Gross Margins
          </h3>
          <p className="text-xs text-zinc-400">
            Authoritative cost of goods sold from immutable recipe consumption snapshots
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block">Net Sales</span>
          <span className="font-mono font-black text-lg text-zinc-950">
            {formatCurrencyMinor(data.netSalesCents, data.currency)}
          </span>
          <span className="text-[10px] text-zinc-400 block">Excl. Tax & Service</span>
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total COGS</span>
          <span className="font-mono font-black text-lg text-rose-600">
            {formatCurrencyMinor(data.totalCogsCents, data.currency)}
          </span>
          <span className="text-[10px] text-zinc-400 block">Recipe consumption</span>
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block">Food Cost %</span>
          <span
            className={`font-mono font-black text-lg ${
              data.foodCostPercentage <= 30
                ? 'text-emerald-600'
                : data.foodCostPercentage <= 38
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {data.foodCostPercentage}%
          </span>
          <span className="text-[10px] text-zinc-400 block">
            {data.foodCostPercentage <= 30 ? 'Target: < 30% ✓' : 'Above Target'}
          </span>
        </div>

        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200/70 space-y-1">
          <span className="text-[10px] uppercase font-bold text-zinc-400 block">Gross Profit</span>
          <span className="font-mono font-black text-lg text-emerald-600">
            {formatCurrencyMinor(data.grossProfitCents, data.currency)}
          </span>
          <span className="text-[10px] text-zinc-400 block">{data.grossMarginPercentage}% Margin</span>
        </div>
      </div>

      <div className="pt-2 flex flex-wrap gap-4 text-xs text-zinc-500 border-t border-zinc-100">
        <div>
          <span>Recorded Spoilage / Waste Cost: </span>
          <span className="font-bold text-zinc-900">
            {formatCurrencyMinor(data.totalWasteCostCents, data.currency)}
          </span>
        </div>
        <div>
          <span>Gross Collected Revenue: </span>
          <span className="font-bold text-zinc-900">
            {formatCurrencyMinor(data.grossRevenueCents, data.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
