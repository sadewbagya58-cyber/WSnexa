'use client';

import React from 'react';
import { SalesSummaryData } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface KpiSummaryCardsProps {
  summary: SalesSummaryData;
  currency: string;
}

export function KpiSummaryCards({ summary, currency }: KpiSummaryCardsProps) {
  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return '0 min';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Gross Sales */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Gross Sales</span>
          <span className="text-amber-400 font-mono">💰</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black text-white">
          {formatCurrency(summary.gross_sales_cents, currency)}
        </div>
        <div className="mt-2 text-xs text-zinc-400 flex justify-between">
          <span>Completed: {summary.completed_orders} orders</span>
          <span className="text-zinc-500">Total: {summary.total_orders}</span>
        </div>
      </div>

      {/* Net Paid Revenue */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Net Paid Revenue</span>
          <span className="text-emerald-400 font-mono">✅</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black text-emerald-400">
          {formatCurrency(summary.paid_revenue_cents, currency)}
        </div>
        <div className="mt-2 text-xs text-zinc-400 flex justify-between">
          <span>Refunded: {formatCurrency(summary.refunded_cents, currency)}</span>
        </div>
      </div>

      {/* Outstanding Balance */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Unpaid Balance</span>
          <span className="text-amber-500 font-mono">⏳</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black text-amber-400">
          {formatCurrency(summary.outstanding_balance_cents, currency)}
        </div>
        <div className="mt-2 text-xs text-zinc-400 flex justify-between">
          <span>Pending Orders: {summary.pending_orders}</span>
          <span className="text-rose-400">Cancelled: {summary.cancelled_orders}</span>
        </div>
      </div>

      {/* Average Order Value (AOV) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          <span>Average Order Value</span>
          <span className="text-blue-400 font-mono">📊</span>
        </div>
        <div className="mt-2 font-mono text-2xl font-black text-white">
          {formatCurrency(summary.aov_cents, currency)}
        </div>
        <div className="mt-2 text-xs text-zinc-400 flex justify-between">
          <span>Tax: {formatCurrency(summary.tax_cents, currency)}</span>
          <span>Service: {formatCurrency(summary.service_charge_cents, currency)}</span>
        </div>
      </div>

      {/* Top Item */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Top Selling Item</div>
        <div className="mt-1 text-lg font-bold text-amber-400 truncate">{summary.top_item_name}</div>
        <div className="mt-1 text-xs text-zinc-500">Category: {summary.top_category_name}</div>
      </div>

      {/* Top Payment Method */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Top Payment Method</div>
        <div className="mt-1 text-lg font-bold text-white uppercase">{summary.top_payment_method.replace(/_/g, ' ')}</div>
        <div className="mt-1 text-xs text-zinc-500">Primary preferred settlement</div>
      </div>

      {/* Avg Kitchen Prep Time */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Avg Kitchen Prep Time</div>
        <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
          {formatDuration(summary.avg_prep_seconds)}
        </div>
        <div className="mt-1 text-xs text-zinc-500">Status transition: preparing → ready</div>
      </div>

      {/* Orders Count */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Total Volume</div>
        <div className="mt-1 font-mono text-xl font-bold text-white">{summary.total_orders} Orders</div>
        <div className="mt-1 text-xs text-zinc-500">{summary.completed_orders} Completed</div>
      </div>
    </div>
  );
}
