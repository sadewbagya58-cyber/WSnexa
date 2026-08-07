'use client';

import React from 'react';
import { BranchComparisonItem } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface BranchComparisonCardProps {
  branches: BranchComparisonItem[];
  currency: string;
}

export function BranchComparisonCard({ branches, currency }: BranchComparisonCardProps) {
  if (!branches || branches.length === 0) {
    return null;
  }

  const maxSales = Math.max(...branches.map((b) => b.gross_sales_cents), 1);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
            <span>👑</span> Cross-Branch Performance Comparison (Business Owner Only)
          </h3>
          <p className="text-xs text-zinc-400">Comparative revenue, order counts, and paid totals across owned branches</p>
        </div>
      </div>

      <div className="space-y-4">
        {branches.map((b) => {
          const pct = Math.round((b.gross_sales_cents / maxSales) * 100);
          return (
            <div key={b.branch_id} className="space-y-1 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/80">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <span className="text-amber-400 font-mono">[{b.branch_code}]</span>
                  <span>{b.branch_name}</span>
                </div>
                <div className="flex items-center gap-4 font-mono">
                  <span className="text-zinc-400 text-[11px]">{b.orders_count} Orders</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(b.paid_revenue_cents, currency)} Paid</span>
                  <span className="text-white font-bold">{formatCurrency(b.gross_sales_cents, currency)} Gross</span>
                </div>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mt-1">
                <div
                  style={{ width: `${Math.max(4, pct)}%` }}
                  className="h-full bg-amber-500 rounded-full transition-all"
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
