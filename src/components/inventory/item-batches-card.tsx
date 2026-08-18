'use client';

import React, { useState } from 'react';
import { FormattedItemBatch, BatchExpiryStatus } from '@/server/services/inventory.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface ItemBatchesCardProps {
  batches: FormattedItemBatch[];
  baseUnit: string;
  currency: string;
  hasCostPermission?: boolean;
}

export function ItemBatchesCard({
  batches,
  baseUnit,
  currency,
  hasCostPermission = false,
}: ItemBatchesCardProps) {
  const [showAll, setShowAll] = useState(false);

  const activeBatches = batches.filter((b) => b.remainingQuantity > 0);
  const displayedBatches = showAll ? batches : activeBatches;

  // Summary Metrics
  const activeCount = activeBatches.length;
  const totalBatchQty = activeBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);
  const expiringSoonCount = activeBatches.filter((b) => b.expiryStatus === 'expiring_soon').length;
  const expiredQty = activeBatches
    .filter((b) => b.expiryStatus === 'expired')
    .reduce((acc, b) => acc + b.remainingQuantity, 0);
  const totalValueCents = hasCostPermission
    ? activeBatches.reduce((acc, b) => acc + (b.totalStockValueCents || 0), 0)
    : null;

  const getStatusBadge = (status: BatchExpiryStatus, days: number | null) => {
    switch (status) {
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Expired {days !== null ? `(${Math.abs(days)}d ago)` : ''}
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Expiring Soon ({days !== null ? `${days}d` : ''})
          </span>
        );
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Healthy {days !== null ? `(${days}d)` : ''}
          </span>
        );
      case 'no_expiry':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            No Expiry Date
          </span>
        );
    }
  };

  if (batches.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
            Batches & Lots (0)
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
            No Active Lots
          </span>
        </div>
        <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-xl p-8 text-center">
          <span className="text-2xl">🏷️</span>
          <h4 className="text-xs font-bold text-zinc-900 mt-2">No batches or lot codes tracked yet</h4>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-md mx-auto">
            Batches are automatically recorded during Goods Receiving (GRN) when a lot number, expiration date, or supplier batch code is provided.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs space-y-4 p-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-800 flex items-center gap-2">
            <span>🏷️</span> Batches & Lots Breakdown ({displayedBatches.length})
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Physical lot composition, expiration timelines, and remaining on-hand quantities.
          </p>
        </div>

        {/* Active vs All Toggle */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={`px-3 py-1 rounded-lg transition-all ${
              !showAll
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Active On-Hand ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`px-3 py-1 rounded-lg transition-all ${
              showAll
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            All Batches ({batches.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Active Batches</span>
          <div className="text-sm font-black text-zinc-950 mt-0.5">{activeCount} Lots</div>
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Batch Stock</span>
          <div className="text-sm font-black text-zinc-950 mt-0.5">
            {totalBatchQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {baseUnit}
          </div>
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Expiring Soon (≤7d)</span>
          <div className={`text-sm font-black mt-0.5 ${expiringSoonCount > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>
            {expiringSoonCount} {expiringSoonCount === 1 ? 'Lot' : 'Lots'}
          </div>
        </div>

        <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Expired Stock</span>
          <div className={`text-sm font-black mt-0.5 ${expiredQty > 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
            {expiredQty.toFixed(2)} {baseUnit}
          </div>
        </div>
      </div>

      {/* Batches Table / Mobile Cards */}
      <div className="space-y-3">
        {/* Mobile Batches Cards */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {displayedBatches.map((b) => {
            const isDepleted = b.remainingQuantity <= 0;
            return (
              <div
                key={b.id}
                className={`bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3 ${
                  isDepleted ? 'opacity-60 bg-zinc-50/50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-zinc-950 font-mono text-sm flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>{b.batchCode || 'Unnamed Lot'}</span>
                    </div>
                    {isDepleted && (
                      <span className="text-[10px] text-zinc-400 font-sans block mt-0.5">Depleted / Consumed</span>
                    )}
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(b.expiryStatus, b.daysUntilExpiry)}
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-zinc-500 text-[11px] font-medium">On-Hand Quantity:</span>
                    <div className="font-black text-zinc-950 text-sm">
                      {b.remainingQuantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {baseUnit}
                      <span className="text-[10px] text-zinc-400 font-normal block text-right">
                        Initial: {b.initialQuantity.toLocaleString()} {baseUnit}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-600 border-t border-zinc-200/50 pt-1.5">
                    <span>Location:</span>
                    <span className="font-medium text-zinc-900">📍 {b.locationName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/50 pt-1.5 text-[11px]">
                    <div>
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Received</span>
                      <span className="text-zinc-700">
                        {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block uppercase font-bold">Expiry Date</span>
                      <span className="text-zinc-700">
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                      </span>
                    </div>
                  </div>

                  {hasCostPermission && (
                    <div className="grid grid-cols-2 gap-2 border-t border-zinc-200/50 pt-1.5">
                      <div>
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Unit Cost</span>
                        <span className="font-mono text-zinc-800 font-semibold">
                          {b.unitCostCents !== null ? formatCurrencyMinor(b.unitCostCents, currency) : '—'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 block uppercase font-bold">Stock Value</span>
                        <span className="font-mono text-zinc-950 font-bold">
                          {b.totalStockValueCents !== null ? formatCurrencyMinor(b.totalStockValueCents, currency) : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Batches Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                <th className="py-2.5 px-3">Batch / Lot Code</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Received Date</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3 text-right">Remaining / Initial</th>
                {hasCostPermission && <th className="py-2.5 px-3 text-right">Unit Cost</th>}
                {hasCostPermission && <th className="py-2.5 px-3 text-right">Stock Value</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 font-medium">
              {displayedBatches.map((b) => {
                const isDepleted = b.remainingQuantity <= 0;
                return (
                  <tr
                    key={b.id}
                    className={`hover:bg-zinc-50/50 transition-colors ${
                      isDepleted ? 'opacity-60 bg-zinc-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-bold text-zinc-950 font-mono flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>{b.batchCode || 'Unnamed Lot'}</span>
                      </div>
                      {isDepleted && (
                        <span className="text-[10px] text-zinc-400 font-sans block mt-0.5">Depleted / Fully Consumed</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {getStatusBadge(b.expiryStatus, b.daysUntilExpiry)}
                    </td>
                    <td className="py-3 px-3 text-zinc-700">
                      📍 {b.locationName}
                    </td>
                    <td className="py-3 px-3 text-zinc-500">
                      {b.receivedDate ? new Date(b.receivedDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="py-3 px-3 text-zinc-700">
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-black text-zinc-950">
                        {b.remainingQuantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {baseUnit}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Initial: {b.initialQuantity.toLocaleString()} {baseUnit}
                      </div>
                    </td>
                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right text-zinc-700 font-mono">
                        {b.unitCostCents !== null ? formatCurrencyMinor(b.unitCostCents, currency) : '—'}
                      </td>
                    )}
                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-black text-zinc-950 font-mono">
                        {b.totalStockValueCents !== null ? formatCurrencyMinor(b.totalStockValueCents, currency) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {hasCostPermission && totalValueCents !== null && activeCount > 0 && (
        <div className="flex justify-end pt-1">
          <span className="text-xs text-zinc-500 font-bold">
            Total Active Lot Value: <strong className="text-zinc-950 font-mono text-sm ml-1">{formatCurrencyMinor(totalValueCents, currency)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
