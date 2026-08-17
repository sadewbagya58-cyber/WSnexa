'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { ReorderSuggestionsOverview } from '@/server/services/inventory.service';

interface InventoryReorderSuggestionsProps {
  overview: ReorderSuggestionsOverview;
  hasCostPermission?: boolean;
}

export function InventoryReorderSuggestions({
  overview,
  hasCostPermission = false,
}: InventoryReorderSuggestionsProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const formatCurrency = (cents: number | null, currency: string) => {
    if (cents === null || cents === undefined) return '—';
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

  const filteredSuggestions = useMemo(() => {
    return overview.suggestions.filter((item) => {
      const matchesFilter =
        filterStatus === 'all'
          ? true
          : filterStatus === 'critical'
          ? item.riskStatus === 'critical'
          : filterStatus === 'reorder_soon'
          ? item.riskStatus === 'reorder_soon'
          : filterStatus === 'healthy'
          ? item.riskStatus === 'healthy'
          : filterStatus === 'no_demand'
          ? item.riskStatus === 'no_demand'
          : true;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        (item.categoryName && item.categoryName.toLowerCase().includes(q)) ||
        (item.suggestedSupplier && item.suggestedSupplier.supplierName.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [overview.suggestions, filterStatus, searchQuery]);

  const getRiskBadge = (item: ReorderSuggestionsOverview['suggestions'][0]) => {
    switch (item.riskStatus) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {item.currentStock <= 0 ? 'Out of Stock' : 'Critical Stockout'}
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
            No Demand Data
          </span>
        );
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case 'high':
        return <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">High History</span>;
      case 'medium':
        return <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Medium History</span>;
      case 'low':
        return <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Sparse History</span>;
      default:
        return <span className="text-[10px] text-zinc-500 font-medium bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">No History</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <h3 className="text-base font-bold text-zinc-950">Smart Reorder & Stockout Forecast</h3>
              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-semibold">
                Decision Support
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Deterministic 14-day consumption rates, projected run-out days, and optimal supplier replenishment packs
            </p>
          </div>

          {hasCostPermission && overview.totalEstimatedReorderCostCents !== null && overview.totalEstimatedReorderCostCents > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-right">
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider block font-medium">Estimated PO Need</span>
              <span className="text-base font-bold text-zinc-950">
                {formatCurrency(overview.totalEstimatedReorderCostCents, overview.currency)}
              </span>
            </div>
          )}
        </div>

        {/* KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'critical' ? 'all' : 'critical')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'critical'
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/20'
                : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/70'
            }`}
          >
            <span className="text-xs font-medium text-zinc-600 block">Critical Risks</span>
            <span className="text-lg font-bold text-rose-600">{overview.criticalCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'reorder_soon' ? 'all' : 'reorder_soon')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'reorder_soon'
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/70'
            }`}
          >
            <span className="text-xs font-medium text-zinc-600 block">Reorder Soon</span>
            <span className="text-lg font-bold text-amber-600">{overview.reorderSoonCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'healthy' ? 'all' : 'healthy')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'healthy'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20'
                : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/70'
            }`}
          >
            <span className="text-xs font-medium text-zinc-600 block">Healthy Coverage</span>
            <span className="text-lg font-bold text-emerald-600">{overview.healthyCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus(filterStatus === 'no_demand' ? 'all' : 'no_demand')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterStatus === 'no_demand'
                ? 'bg-zinc-200 border-zinc-400 ring-2 ring-zinc-400/20'
                : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100/70'
            }`}
          >
            <span className="text-xs font-medium text-zinc-600 block">No Demand History</span>
            <span className="text-lg font-bold text-zinc-700">{overview.noDemandCount}</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search ingredient or vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 pl-8 text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950"
            />
            <span className="absolute left-2.5 top-2.5 text-zinc-400 text-xs">🔍</span>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {['all', 'critical', 'reorder_soon', 'healthy', 'no_demand'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterStatus === status
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {status === 'all'
                  ? 'All Items'
                  : status === 'critical'
                  ? 'Critical'
                  : status === 'reorder_soon'
                  ? 'Reorder Soon'
                  : status === 'healthy'
                  ? 'Healthy'
                  : 'No Demand'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="p-8 text-center text-zinc-500">
          <span className="text-3xl block mb-2">📦</span>
          <p className="text-sm font-medium text-zinc-700">No reorder suggestions match your filter.</p>
          <p className="text-xs text-zinc-400 mt-1">All monitored inventory items have sufficient coverage.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-x-auto">
          {filteredSuggestions.map((item) => {
            const hasSupplier = !!item.suggestedSupplier;
            const poHref = hasSupplier
              ? `/dashboard/inventory/purchasing/new?supplierId=${item.suggestedSupplier!.supplierId}&itemId=${item.itemId}&quantity=${item.suggestedSupplier!.packsToOrder}`
              : `/dashboard/inventory/purchasing/new?itemId=${item.itemId}`;

            return (
              <div
                key={item.itemId}
                className="p-5 hover:bg-zinc-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left info: Item name, stock status, consumption */}
                <div className="space-y-1.5 max-w-md">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/inventory/items/${item.itemId}`}
                      className="font-bold text-zinc-950 hover:text-emerald-700 transition-colors text-sm"
                    >
                      {item.itemName}
                    </Link>
                    {item.categoryName && (
                      <span className="text-[11px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full font-medium">
                        {item.categoryName}
                      </span>
                    )}
                    {getRiskBadge(item)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-600 flex-wrap">
                    <span>
                      On Hand:{' '}
                      <strong className="text-zinc-900">
                        {item.currentStock.toFixed(2)} {item.baseUnit}
                      </strong>
                    </span>
                    <span>
                      Usage:{' '}
                      <strong className="text-zinc-900">
                        {item.averageDailyDemandBase > 0 ? `${item.averageDailyDemandBase.toFixed(2)} ${item.baseUnit}/day` : '0.00'}
                      </strong>
                    </span>
                    <span>
                      Coverage:{' '}
                      <strong className={item.daysOfStockRemaining !== null && item.daysOfStockRemaining <= 3 ? 'text-rose-600' : 'text-zinc-900'}>
                        {item.daysOfStockRemaining !== null ? `${item.daysOfStockRemaining.toFixed(1)} days` : '—'}
                      </strong>
                    </span>
                    {getQualityBadge(item.demandHistoryQuality)}
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {item.explanation}
                  </p>
                </div>

                {/* Middle info: Replenishment target & Supplier intelligence */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs">
                  {/* Reorder Recommendation */}
                  <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 min-w-[150px]">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                      Recommended Reorder
                    </span>
                    <span className="text-sm font-bold text-zinc-950 block mt-0.5">
                      {item.recommendedBaseQty > 0
                        ? `${item.recommendedBaseQty.toFixed(2)} ${item.baseUnit}`
                        : '0.00 (Covered)'}
                    </span>
                    <span className="text-[10px] text-zinc-400 block">
                      Target: {item.targetStockLevelBase.toFixed(1)} {item.baseUnit}
                    </span>
                  </div>

                  {/* Supplier Pack & Estimated PO */}
                  {item.suggestedSupplier ? (
                    <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 min-w-[220px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                          Suggested Vendor Pack
                        </span>
                        {item.suggestedSupplier.isPreferred && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            ★ Preferred
                          </span>
                        )}
                      </div>

                      <div className="mt-1">
                        <span className="text-xs font-bold text-zinc-900 block">
                          {item.suggestedSupplier.supplierName}
                        </span>
                        <span className="text-[11px] text-zinc-600 block mt-0.5">
                          {item.suggestedSupplier.packsToOrder} {item.suggestedSupplier.purchasingUnit}(s) ×{' '}
                          {item.suggestedSupplier.conversionToBase} {item.baseUnit} ={' '}
                          <strong>
                            {item.suggestedSupplier.orderQuantityBase.toFixed(1)} {item.baseUnit}
                          </strong>
                        </span>

                        {hasCostPermission && item.suggestedSupplier.totalEstimatedCents !== null && (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-700">
                              {formatCurrency(item.suggestedSupplier.totalEstimatedCents, item.suggestedSupplier.currency)}
                            </span>
                            {item.potentialSavingsCents !== null && item.potentialSavingsCents !== undefined && item.potentialSavingsCents > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-1 rounded">
                                Save {formatCurrency(item.potentialSavingsCents ?? null, item.suggestedSupplier.currency)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-50 border border-zinc-200/60 rounded-xl p-3 min-w-[180px] text-zinc-400">
                      <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
                        Supplier Catalog
                      </span>
                      <span className="text-xs text-zinc-500 block mt-1">No linked vendor</span>
                    </div>
                  )}
                </div>

                {/* Right action: Create PO button */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <Link
                    href={poHref}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
                  >
                    <span>Create PO</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
