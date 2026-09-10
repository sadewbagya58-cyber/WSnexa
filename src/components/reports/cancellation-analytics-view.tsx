'use client';

import React, { useState } from 'react';
import { CancellationAnalyticsResult } from '@/server/analytics/cancellation-analytics';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface CancellationAnalyticsViewProps {
  cancellations: CancellationAnalyticsResult;
  currency: string;
  hasFinancialAccess: boolean;
}

export function CancellationAnalyticsView({
  cancellations,
  currency,
  hasFinancialAccess,
}: CancellationAnalyticsViewProps) {
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const {
    totalOrders,
    cancelledOrders,
    cancellationRate,
    dailyTrend,
    actorBreakdown,
    stageBreakdown,
    reasonBreakdown,
    financialImpact,
  } = cancellations;

  // Safe maximum calculations for chart scaling
  const maxTrendTotal = Math.max(...dailyTrend.map((d) => d.totalOrders), 1);
  const maxTrendCancelled = Math.max(...dailyTrend.map((d) => d.cancelledOrders), 1);

  // Rate threshold styling
  const getRateBadge = (rate: number) => {
    if (rate <= 3.0) {
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        label: 'Optimal (< 3%)',
      };
    }
    if (rate <= 7.0) {
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        label: 'Moderate (3 - 7%)',
      };
    }
    return {
      bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      label: 'High (> 7%)',
    };
  };

  const rateBadge = getRateBadge(cancellationRate);

  const kpis = [
    {
      title: 'Total Placed Orders',
      value: totalOrders.toLocaleString(),
      subtitle: 'Across selected period',
      icon: '📋',
      color: 'text-zinc-100',
    },
    {
      title: 'Cancelled Orders',
      value: cancelledOrders.toLocaleString(),
      subtitle: `${cancellationRate}% of total volume`,
      icon: '🚫',
      color: 'text-rose-400',
    },
    {
      title: 'Cancellation Rate',
      value: `${cancellationRate}%`,
      subtitle: rateBadge.label,
      icon: '📉',
      color: cancellationRate > 7 ? 'text-rose-400' : cancellationRate > 3 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      title: 'Cancelled Order Value',
      value: hasFinancialAccess && financialImpact.cancelledOrderValueCents !== null
        ? formatCurrency(financialImpact.cancelledOrderValueCents, currency)
        : '••••••',
      subtitle: hasFinancialAccess ? 'Gross volume cancelled' : 'Permission required',
      icon: '💸',
      color: 'text-amber-400',
    },
    {
      title: 'Refunds Processed',
      value: hasFinancialAccess && financialImpact.totalRefundedCents !== null
        ? formatCurrency(financialImpact.totalRefundedCents, currency)
        : '••••••',
      subtitle: hasFinancialAccess ? 'Paid orders refunded' : 'Permission required',
      icon: '💳',
      color: 'text-purple-400',
    },
    {
      title: 'Wasted Food Cost',
      value: hasFinancialAccess && financialImpact.totalWasteCostCents !== null
        ? formatCurrency(financialImpact.totalWasteCostCents, currency)
        : '••••••',
      subtitle: hasFinancialAccess ? 'Discarded prep inventory' : 'Permission required',
      icon: '🗑️',
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Headline & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.title}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-2 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span className="truncate">{kpi.title}</span>
              <span className="text-base">{kpi.icon}</span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${kpi.color}`}>
              {kpi.value}
            </div>
            <div className="text-[11px] text-zinc-500 italic truncate">{kpi.subtitle}</div>
          </div>
        ))}
      </div>

      {/* Daily Cancellation Trend Chart */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>📈</span> Daily Cancellation Trend
            </h3>
            <p className="text-xs text-zinc-400">
              Daily order volume vs. cancellations with relative cancellation rate
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
              <span>Total Orders</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Cancellations</span>
            </div>
          </div>
        </div>

        {dailyTrend.length === 0 ? (
          <div className="text-center text-xs text-zinc-500 italic py-12">
            No order data available for the selected time period.
          </div>
        ) : (
          <div className="relative h-60 w-full pt-4 pb-8">
            <div className="absolute inset-x-0 bottom-8 top-4 flex items-end justify-between gap-1 sm:gap-2 px-2">
              {dailyTrend.map((point, idx) => {
                const totalHeightPct = (point.totalOrders / maxTrendTotal) * 100;
                const cancHeightPct = (point.cancelledOrders / maxTrendCancelled) * 100;
                const isHovered = hoveredTrendIdx === idx;

                return (
                  <div
                    key={point.date}
                    onMouseEnter={() => setHoveredTrendIdx(idx)}
                    onMouseLeave={() => setHoveredTrendIdx(null)}
                    className="relative flex-1 h-full flex items-end justify-center group cursor-pointer"
                  >
                    {/* Total orders background column */}
                    <div
                      style={{ height: `${Math.max(totalHeightPct, 4)}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all ${
                        isHovered ? 'bg-zinc-600' : 'bg-zinc-800'
                      }`}
                    />

                    {/* Cancelled orders foreground column */}
                    {point.cancelledOrders > 0 && (
                      <div
                        style={{ height: `${Math.max(cancHeightPct, 6)}%` }}
                        className={`absolute bottom-0 w-full max-w-[14px] rounded-t-md transition-all ${
                          isHovered ? 'bg-rose-400' : 'bg-rose-500/80'
                        }`}
                      />
                    )}

                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-2 z-20 bg-zinc-950 border border-zinc-700 text-white rounded-xl p-3 shadow-2xl text-xs whitespace-nowrap min-w-[150px] pointer-events-none">
                        <div className="font-bold text-amber-400 border-b border-zinc-800 pb-1 mb-1.5 flex items-center justify-between gap-2">
                          <span>{point.formattedDate}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">({point.date})</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-3 text-zinc-300">
                            <span>Total Orders:</span>
                            <span className="font-mono text-white font-bold">{point.totalOrders}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-rose-300">
                            <span>Cancelled:</span>
                            <span className="font-mono text-rose-400 font-bold">{point.cancelledOrders}</span>
                          </div>
                          <div className="flex justify-between gap-3 text-amber-300">
                            <span>Cancellation Rate:</span>
                            <span className="font-mono text-amber-400 font-bold">{point.cancellationRate}%</span>
                          </div>
                          {hasFinancialAccess && point.cancelledValueCents !== null && (
                            <div className="flex justify-between gap-3 text-zinc-400 pt-1 border-t border-zinc-800">
                              <span>Lost Value:</span>
                              <span className="font-mono text-zinc-200">
                                {formatCurrency(point.cancelledValueCents, currency)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Date label */}
                    <div className="absolute top-full mt-1.5 text-[10px] text-zinc-500 truncate max-w-full font-mono">
                      {point.formattedDate}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Breakdowns 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. By Actor / Originator */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>👤</span> By Originator / Actor
            </h3>
            <span className="text-[11px] text-zinc-400">{actorBreakdown.length} roles</span>
          </div>

          {actorBreakdown.length === 0 ? (
            <div className="text-xs text-zinc-500 italic py-8 text-center">
              No cancellations recorded for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {actorBreakdown.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 truncate max-w-[180px]">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-amber-400">({item.percentage}%)</span>
                      {hasFinancialAccess && item.valueCents !== null && (
                        <span className="text-zinc-500 text-[11px]">
                          {formatCurrency(item.valueCents, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      className="bg-blue-500 h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. By Preparation Stage */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🍳</span> By Preparation Stage
            </h3>
            <span className="text-[11px] text-zinc-400">{stageBreakdown.length} stages</span>
          </div>

          {stageBreakdown.length === 0 ? (
            <div className="text-xs text-zinc-500 italic py-8 text-center">
              No cancellations recorded for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {stageBreakdown.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 truncate max-w-[180px]">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-amber-400">({item.percentage}%)</span>
                      {hasFinancialAccess && item.valueCents !== null && (
                        <span className="text-zinc-500 text-[11px]">
                          {formatCurrency(item.valueCents, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      className="bg-amber-500 h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. By Reason Category */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>❓</span> By Reason Category
            </h3>
            <span className="text-[11px] text-zinc-400">{reasonBreakdown.length} reasons</span>
          </div>

          {reasonBreakdown.length === 0 ? (
            <div className="text-xs text-zinc-500 italic py-8 text-center">
              No cancellations recorded for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {reasonBreakdown.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300 truncate max-w-[180px]">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-white font-bold">{item.count}</span>
                      <span className="text-amber-400">({item.percentage}%)</span>
                      {hasFinancialAccess && item.valueCents !== null && (
                        <span className="text-zinc-500 text-[11px]">
                          {formatCurrency(item.valueCents, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      className="bg-rose-500 h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Financial & Inventory Waste Impact Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>💰</span> Financial & Inventory Waste Impact
            </h3>
            <p className="text-xs text-zinc-400">
              Audit of revenue lost, customer refunds issued, and kitchen inventory discarded
            </p>
          </div>
          {!hasFinancialAccess && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full font-medium">
              🔒 Financial Permissions Required for Currency Figures
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 space-y-1.5">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Cancelled Orders Total</div>
            <div className="text-xl font-black font-mono text-zinc-200">
              {hasFinancialAccess && financialImpact.cancelledOrderValueCents !== null
                ? formatCurrency(financialImpact.cancelledOrderValueCents, currency)
                : '••••••'}
            </div>
            <div className="text-[11px] text-zinc-500">Gross menu price of full cancelled orders</div>
          </div>

          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 space-y-1.5">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Cancelled Line Items</div>
            <div className="text-xl font-black font-mono text-zinc-200">
              {hasFinancialAccess && financialImpact.cancelledItemValueCents !== null
                ? formatCurrency(financialImpact.cancelledItemValueCents, currency)
                : '••••••'}
            </div>
            <div className="text-[11px] text-zinc-500">Subtotal of individually cancelled items</div>
          </div>

          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 space-y-1.5">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Refunds Processed</div>
            <div className="text-xl font-black font-mono text-purple-400">
              {hasFinancialAccess && financialImpact.totalRefundedCents !== null
                ? formatCurrency(financialImpact.totalRefundedCents, currency)
                : '••••••'}
            </div>
            <div className="text-[11px] text-zinc-500">Total settlement refunds returned to guests</div>
          </div>

          <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 space-y-1.5">
            <div className="text-xs text-zinc-400 font-semibold uppercase">Discarded Food Cost</div>
            <div className="text-xl font-black font-mono text-orange-400">
              {hasFinancialAccess && financialImpact.totalWasteCostCents !== null
                ? formatCurrency(financialImpact.totalWasteCostCents, currency)
                : '••••••'}
            </div>
            <div className="text-[11px] text-zinc-500">Authoritative cost of in-prep food wasted</div>
          </div>
        </div>

        <div className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="text-base">ℹ️</span>
            <span>
              <strong>Inventory Disposition Rule:</strong> Orders cancelled before preparation are returned to stock without loss. Items cancelled after kitchen cooking commences are logged as authoritative inventory waste.
            </span>
          </div>
          {hasFinancialAccess && (
            <div className="text-right font-mono font-bold whitespace-nowrap pl-4">
              <span className="text-zinc-400 text-[11px] block uppercase">Est. Venue Direct Loss</span>
              <span className="text-rose-400 text-base">
                {formatCurrency(financialImpact.estimatedFinancialLossCents || 0, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
