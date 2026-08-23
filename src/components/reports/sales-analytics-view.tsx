'use client';

import React from 'react';
import { SalesAnalyticsResult } from '@/server/analytics/sales-analytics';
import { TimeSeriesChart } from './time-series-chart';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface SalesAnalyticsViewProps {
  sales: SalesAnalyticsResult;
  currency: string;
  hasFinancialAccess: boolean;
}

export function SalesAnalyticsView({ sales, currency, hasFinancialAccess }: SalesAnalyticsViewProps) {
  return (
    <div className="space-y-6">
      {/* Revenue & Volume Trend Chart */}
      <TimeSeriesChart
        series={sales.timeSeries}
        currency={currency}
        title="Daily Revenue & Order Volume"
        hasFinancialAccess={hasFinancialAccess}
      />

      {/* Hourly Trend Chart & Payment Methods Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Peak Distribution */}
        <TimeSeriesChart
          series={sales.salesByHour}
          currency={currency}
          title="Sales & Orders by Hour"
          hasFinancialAccess={hasFinancialAccess}
        />

        {/* Payment Methods Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>💳</span> Payment Methods Breakdown
          </h3>

          {!sales.salesByPaymentMethod || sales.salesByPaymentMethod.length === 0 ? (
            <div className="text-xs text-zinc-500 italic p-4 text-center">
              No payment transactions recorded for selected period.
            </div>
          ) : (
            <div className="space-y-3">
              {sales.salesByPaymentMethod.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-300">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-mono">
                        {hasFinancialAccess ? formatCurrency(item.value, currency) : `${item.subValue} txns`}
                      </span>
                      <span className="text-amber-400 font-bold font-mono">({item.percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(item.percentage || 0, 100)}%` }}
                      className="bg-amber-500 h-full rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
