'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ExpiryAlertSummary, ExpiryAlertSeverity } from '@/server/services/inventory.service';
import { formatCurrencyMinor } from '@/lib/utils/currency';

interface InventoryExpiryAlertsProps {
  summary: ExpiryAlertSummary;
  currency: string;
  hasCostPermission?: boolean;
}

export function InventoryExpiryAlerts({
  summary,
  currency,
  hasCostPermission = false,
}: InventoryExpiryAlertsProps) {
  const [filter, setFilter] = useState<'all' | ExpiryAlertSeverity>('all');

  const displayedBatches =
    filter === 'all'
      ? summary.batches
      : summary.batches.filter((b) => b.severity === filter);

  const getSeverityBadge = (severity: ExpiryAlertSeverity, days: number) => {
    switch (severity) {
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
            Expired ({Math.abs(days)}d ago)
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse" />
            {days === 0 ? 'Expires Today' : `Critical (${days}d left)`}
          </span>
        );
      case 'expiring_soon':
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Expiring Soon ({days}d left)
          </span>
        );
      case 'upcoming':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Upcoming ({days}d left)
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-950 flex items-center gap-2">
            <span>⏳</span> Near-Expiry & Perishable Alerts ({summary.totalExpiringCount})
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Proactive shelf-life tracking for perishable ingredient lots expiring within 14 days.
          </p>
        </div>

        {/* Severity Tabs Filter */}
        {summary.totalExpiringCount > 0 && (
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                filter === 'all'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              All ({summary.totalExpiringCount})
            </button>
            {summary.expiredCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('expired')}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filter === 'expired'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                Expired ({summary.expiredCount})
              </button>
            )}
            {summary.criticalCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('critical')}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filter === 'critical'
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'text-orange-700 hover:bg-orange-50'
                }`}
              >
                Critical ({summary.criticalCount})
              </button>
            )}
            {summary.soonCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('expiring_soon')}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filter === 'expiring_soon'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                4-7 Days ({summary.soonCount})
              </button>
            )}
            {summary.upcomingCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('upcoming')}
                className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                  filter === 'upcoming'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                8-14 Days ({summary.upcomingCount})
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Tiles Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100">
          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Expired Lots</span>
          <div className="text-lg font-black text-rose-700 mt-0.5">{summary.expiredCount} Lots</div>
          {summary.expiredQuantity > 0 && (
            <span className="text-[11px] text-rose-600 font-semibold block mt-0.5">
              {summary.expiredQuantity.toFixed(2)} units at risk
            </span>
          )}
        </div>

        <div className="bg-orange-50/60 p-3.5 rounded-xl border border-orange-100">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">Critical (0–3 Days)</span>
          <div className="text-lg font-black text-orange-800 mt-0.5">{summary.criticalCount} Lots</div>
          <span className="text-[11px] text-orange-600 font-semibold block mt-0.5">Use immediately</span>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Expiring Soon (4–7d)</span>
          <div className="text-lg font-black text-amber-800 mt-0.5">{summary.soonCount} Lots</div>
          <span className="text-[11px] text-amber-600 font-semibold block mt-0.5">Prioritize prep/specials</span>
        </div>

        <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Upcoming (8–14d)</span>
          <div className="text-lg font-black text-blue-800 mt-0.5">{summary.upcomingCount} Lots</div>
          <span className="text-[11px] text-blue-600 font-semibold block mt-0.5">Plan consumption</span>
        </div>
      </div>

      {/* Alert Feed / Table */}
      {summary.totalExpiringCount === 0 ? (
        <div className="bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl p-8 text-center space-y-1.5">
          <span className="text-2xl">🌿</span>
          <h4 className="text-xs font-bold text-emerald-950 mt-1">No inventory batches are approaching expiry</h4>
          <p className="text-[11px] text-emerald-700 max-w-md mx-auto">
            All active on-hand ingredient lots have healthy shelf life with more than 14 days remaining.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Alert Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {displayedBatches.map((b) => (
              <div
                key={b.id}
                className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/inventory/items/${b.itemId}`}
                      className="font-bold text-zinc-950 hover:underline text-sm flex items-center gap-1.5 truncate"
                    >
                      <span>🥦</span>
                      <span className="truncate">{b.itemName}</span>
                    </Link>
                    <span className="font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md text-[10px] font-bold mt-1 inline-block">
                      {b.batchCode}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {getSeverityBadge(b.severity, b.daysUntilExpiry)}
                  </div>
                </div>

                <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 space-y-2 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="text-zinc-500 text-[11px] font-medium">Remaining At Risk:</span>
                    <div className="font-black text-zinc-950 text-sm">
                      {b.remainingQuantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                      <span className="text-zinc-500 font-normal">{b.baseUnit}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-600 border-t border-zinc-200/50 pt-1.5">
                    <span>Location:</span>
                    <span className="font-medium text-zinc-900">📍 {b.locationName}</span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-zinc-600 border-t border-zinc-200/50 pt-1.5">
                    <span>Expires On:</span>
                    <span className="font-mono text-zinc-800 font-medium">
                      {new Date(b.expiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>

                  {hasCostPermission && (
                    <div className="flex justify-between items-center text-[11px] border-t border-zinc-200/50 pt-1.5">
                      <span className="text-zinc-400 uppercase font-bold text-[10px]">At-Risk Stock Value:</span>
                      <span className="font-mono text-zinc-950 font-bold">
                        {b.totalStockValueCents !== null ? formatCurrencyMinor(b.totalStockValueCents, currency) : '—'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <Link
                    href={`/dashboard/inventory/items/${b.itemId}`}
                    className="w-full text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 min-h-[38px]"
                  >
                    <span>View Ingredient Record</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                  <th className="py-2.5 px-3">Ingredient Item</th>
                  <th className="py-2.5 px-3">Batch Code</th>
                  <th className="py-2.5 px-3">Severity & Timeline</th>
                  <th className="py-2.5 px-3">Storage Location</th>
                  <th className="py-2.5 px-3 text-right">Remaining Stock</th>
                  {hasCostPermission && <th className="py-2.5 px-3 text-right">Stock Value</th>}
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {displayedBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <Link
                        href={`/dashboard/inventory/items/${b.itemId}`}
                        className="font-bold text-zinc-950 hover:underline hover:text-zinc-800 flex items-center gap-1.5"
                      >
                        <span>🥦</span>
                        <span>{b.itemName}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-md text-[11px] font-bold">
                        {b.batchCode}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {getSeverityBadge(b.severity, b.daysUntilExpiry)}
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Exp: {new Date(b.expiryDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-700">
                      📍 {b.locationName}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-black text-zinc-950">
                        {b.remainingQuantity.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                        <span className="text-zinc-500 font-normal">{b.baseUnit}</span>
                      </div>
                    </td>
                    {hasCostPermission && (
                      <td className="py-3 px-3 text-right font-black text-zinc-950 font-mono">
                        {b.totalStockValueCents !== null ? formatCurrencyMinor(b.totalStockValueCents, currency) : '—'}
                      </td>
                    )}
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/dashboard/inventory/items/${b.itemId}`}
                        className="text-[11px] font-bold text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-2.5 py-1 rounded-lg transition-colors inline-block"
                      >
                        View Item →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
