'use client';

import React from 'react';
import { InventoryOverviewPayload } from '@/server/services/inventory.service';

interface InventoryKpiSummaryProps {
  overview: InventoryOverviewPayload;
}

export function InventoryKpiSummary({ overview }: InventoryKpiSummaryProps) {
  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${currency} ${(cents / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Total Stock Value */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Stock Value</span>
          <div className="text-xl sm:text-2xl font-black text-zinc-950 mt-1">
            {overview.totalStockValueCents !== null
              ? formatCurrency(overview.totalStockValueCents, overview.currency)
              : 'Cost Hidden'}
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          {overview.totalItemsCount} active tracked ingredients
        </p>
      </div>

      {/* Out of Stock */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Out of Stock</span>
          <div className="text-xl sm:text-2xl font-black text-rose-600 mt-1">
            {overview.outOfStockItemsCount}
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          {overview.outOfStockItemsCount > 0 ? 'Requires immediate replenishment' : 'Zero stockouts'}
        </p>
      </div>

      {/* Low Stock */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Low Stock Alerts</span>
          <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
            {overview.lowStockItemsCount}
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          Below minimum par threshold
        </p>
      </div>

      {/* Healthy Items */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Healthy Stock</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {overview.healthyItemsCount}
          </div>
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">
          Sufficient operational inventory
        </p>
      </div>
    </div>
  );
}
