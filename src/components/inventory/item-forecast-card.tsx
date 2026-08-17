'use client';

import React from 'react';
import Link from 'next/link';
import { ItemForecastMetric } from '@/server/services/inventory.service';

interface ItemForecastCardProps {
  forecast: ItemForecastMetric | null;
  currency?: string;
  hasCostPermission?: boolean;
}

export function ItemForecastCard({
  forecast,
  hasCostPermission = false,
}: ItemForecastCardProps) {
  if (!forecast) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-bold text-zinc-950">Smart Reorder & Demand Forecast</h3>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Insufficient data to compute consumption rate or reorder suggestions for this item.
        </p>
      </div>
    );
  }

  const formatCurrency = (cents: number | null, curr: string) => {
    if (cents === null || cents === undefined) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: curr || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `${curr} ${(cents / 100).toFixed(2)}`;
    }
  };

  const getRiskBadge = (item: ItemForecastMetric) => {
    switch (item.riskStatus) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {item.currentStock <= 0 ? 'Out of Stock' : 'Critical Stockout (≤ 3d)'}
          </span>
        );
      case 'reorder_soon':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {item.daysOfStockRemaining !== null && item.daysOfStockRemaining <= 7
              ? 'Reorder Soon (≤ 7d)'
              : 'Reorder Needed (Below Min)'}
          </span>
        );
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Healthy Coverage
          </span>
        );
      case 'no_demand':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            No Recent Demand
          </span>
        );
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'high':
        return <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">High History</span>;
      case 'medium':
        return <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200">Medium History</span>;
      case 'low':
        return <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200">Sparse History</span>;
      default:
        return <span className="text-[10px] text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full font-semibold border border-zinc-200">No History</span>;
    }
  };

  const hasSupplier = !!forecast.suggestedSupplier;
  const poHref = hasSupplier
    ? `/dashboard/inventory/purchasing/new?supplierId=${forecast.suggestedSupplier!.supplierId}&itemId=${forecast.itemId}&quantity=${forecast.suggestedSupplier!.packsToOrder}`
    : `/dashboard/inventory/purchasing/new?itemId=${forecast.itemId}`;

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h3 className="text-base font-bold text-zinc-950">Demand Forecasting & Reorder Intelligence</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative 14-day consumption rate, days of stock remaining, and suggested replenishment pack
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getRiskBadge(forecast)}
          {getQualityBadge(forecast.demandHistoryQuality)}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Daily Usage</span>
            <span className="text-base font-bold text-zinc-950 block mt-0.5">
              {forecast.averageDailyDemandBase > 0
                ? `${forecast.averageDailyDemandBase.toFixed(2)} ${forecast.baseUnit}/day`
                : '0.00'}
            </span>
            <span className="text-[10px] text-zinc-400 block">
              14-day weighted rate
            </span>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Days Remaining</span>
            <span
              className={`text-base font-bold block mt-0.5 ${
                forecast.daysOfStockRemaining !== null && forecast.daysOfStockRemaining <= 3
                  ? 'text-rose-600'
                  : 'text-zinc-950'
              }`}
            >
              {forecast.daysOfStockRemaining !== null ? `${forecast.daysOfStockRemaining.toFixed(1)} days` : '—'}
            </span>
            <span className="text-[10px] text-zinc-400 block">
              On-hand stock only
            </span>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Reorder Point</span>
            <span className="text-base font-bold text-zinc-950 block mt-0.5">
              {forecast.reorderPointBase.toFixed(2)} {forecast.baseUnit}
            </span>
            <span className="text-[10px] text-zinc-400 block">
              {forecast.hasLeadTimeIntelligence ? `Includes lead time` : `Min buffer`}
            </span>
          </div>

          <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Open Incoming PO</span>
            <span className="text-base font-bold text-zinc-950 block mt-0.5">
              {forecast.openIncomingStock > 0
                ? `+${forecast.openIncomingStock.toFixed(2)} ${forecast.baseUnit}`
                : '0.00'}
            </span>
            <span className="text-[10px] text-zinc-400 block">
              Approved / Sent POs
            </span>
          </div>
        </div>

        {/* Operational Explanation */}
        <div className="bg-zinc-50/60 border border-zinc-200 rounded-xl p-4 flex items-start gap-3 text-xs text-zinc-600">
          <span className="text-base">💡</span>
          <div className="space-y-1">
            <span className="font-bold text-zinc-900 block">Forecast Explanation</span>
            <p className="leading-relaxed text-zinc-600">
              {forecast.explanation}
            </p>
          </div>
        </div>

        {/* Reorder Recommendation Box */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-zinc-900 block">Replenishment Recommendation</span>
              <p className="text-xs text-zinc-500 mt-0.5">
                Targeting {forecast.targetCoverageDays} days coverage ({forecast.targetStockLevelBase.toFixed(1)} {forecast.baseUnit}) minus {forecast.projectedAvailableStock.toFixed(1)} {forecast.baseUnit} available
              </p>
            </div>

            <div className="text-right">
              <span className="text-xs text-zinc-500 block">Recommended Base Qty</span>
              <span className="text-lg font-bold text-zinc-950">
                {forecast.recommendedBaseQty > 0
                  ? `${forecast.recommendedBaseQty.toFixed(2)} ${forecast.baseUnit}`
                  : '0.00 (Adequate Stock)'}
              </span>
            </div>
          </div>

          {/* Supplier Purchasing Cards */}
          {forecast.suggestedSupplier && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Cheapest / Recommended Supplier */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">
                    Suggested Supplier (Best Price)
                  </span>
                  {forecast.suggestedSupplier.isPreferred && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      ★ Preferred
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1">
                  <span className="font-bold text-zinc-900 block text-sm">
                    {forecast.suggestedSupplier.supplierName}
                  </span>
                  <span className="text-zinc-600 block">
                    Order <strong>{forecast.suggestedSupplier.packsToOrder} {forecast.suggestedSupplier.purchasingUnit}(s)</strong> ({forecast.suggestedSupplier.conversionToBase} {forecast.baseUnit}/{forecast.suggestedSupplier.purchasingUnit})
                    = <strong>{forecast.suggestedSupplier.orderQuantityBase.toFixed(1)} {forecast.baseUnit}</strong>
                  </span>
                  {hasCostPermission && forecast.suggestedSupplier.packPriceCents !== null && (
                    <span className="text-zinc-500 block">
                      Pack Price: {formatCurrency(forecast.suggestedSupplier.packPriceCents, forecast.suggestedSupplier.currency)}
                    </span>
                  )}
                </div>

                {hasCostPermission && forecast.suggestedSupplier.totalEstimatedCents !== null && (
                  <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                    <span className="text-zinc-600">Estimated Total:</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatCurrency(forecast.suggestedSupplier.totalEstimatedCents, forecast.suggestedSupplier.currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Preferred Supplier Alternative (if distinct) */}
              {forecast.preferredSupplierAlternative && (
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800">
                      Preferred Supplier Alternative
                    </span>
                    <span className="text-[10px] bg-zinc-200 text-zinc-800 font-bold px-1.5 py-0.5 rounded">
                      ★ Preferred
                    </span>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="font-bold text-zinc-900 block text-sm">
                      {forecast.preferredSupplierAlternative.supplierName}
                    </span>
                    <span className="text-zinc-600 block">
                      Order <strong>{forecast.preferredSupplierAlternative.packsToOrder} {forecast.preferredSupplierAlternative.purchasingUnit}(s)</strong> ({forecast.preferredSupplierAlternative.conversionToBase} {forecast.baseUnit}/{forecast.preferredSupplierAlternative.purchasingUnit})
                      = <strong>{forecast.preferredSupplierAlternative.orderQuantityBase.toFixed(1)} {forecast.baseUnit}</strong>
                    </span>
                    {hasCostPermission && forecast.preferredSupplierAlternative.packPriceCents !== null && (
                      <span className="text-zinc-500 block">
                        Pack Price: {formatCurrency(forecast.preferredSupplierAlternative.packPriceCents, forecast.preferredSupplierAlternative.currency)}
                      </span>
                    )}
                  </div>

                  {hasCostPermission && forecast.preferredSupplierAlternative.totalEstimatedCents !== null && (
                    <div className="pt-2 border-t border-zinc-200 flex items-center justify-between text-xs">
                      <span className="text-zinc-600">Estimated Total:</span>
                      <span className="text-sm font-bold text-zinc-800">
                        {formatCurrency(forecast.preferredSupplierAlternative.totalEstimatedCents, forecast.preferredSupplierAlternative.currency)}
                      </span>
                    </div>
                  )}

                  {hasCostPermission && forecast.potentialSavingsCents !== null && forecast.potentialSavingsCents !== undefined && forecast.potentialSavingsCents > 0 && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-medium border border-emerald-200">
                      💡 Saving vs Preferred: {formatCurrency(forecast.potentialSavingsCents ?? null, forecast.suggestedSupplier.currency)} by choosing {forecast.suggestedSupplier.supplierName}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end pt-3 border-t border-zinc-100">
            <Link
              href={poHref}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              <span>Draft Purchase Order</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
