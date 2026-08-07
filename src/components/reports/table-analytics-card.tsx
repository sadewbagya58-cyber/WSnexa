'use client';

import React from 'react';
import { TablePerformance } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface TableAnalyticsCardProps {
  tables: TablePerformance[];
  currency: string;
}

export function TableAnalyticsCard({ tables, currency }: TableAnalyticsCardProps) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Dining Table Performance</h3>
          <p className="text-xs text-zinc-400">Order count and gross revenue per physical table</p>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="text-center text-zinc-500 text-xs py-8">No dining table orders recorded in this period</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-2 px-2">Table</th>
                <th className="py-2 px-2 text-center">Orders</th>
                <th className="py-2 px-2 text-right">Total Revenue</th>
                <th className="py-2 px-2 text-right">AOV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {tables.map((t) => (
                <tr key={t.table_id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-2 font-sans font-medium text-zinc-200">
                    <span className="font-bold text-amber-400 font-mono mr-1">[{t.table_code}]</span>
                    {t.table_name}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">{t.orders_count}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">
                    {formatCurrency(t.total_revenue_cents, currency)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-zinc-400">
                    {formatCurrency(t.avg_order_value_cents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
