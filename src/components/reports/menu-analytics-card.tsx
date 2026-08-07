'use client';

import React from 'react';
import { MenuItemPerformance } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface MenuAnalyticsCardProps {
  items: MenuItemPerformance[];
  currency: string;
}

export function MenuAnalyticsCard({ items, currency }: MenuAnalyticsCardProps) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Selling Menu Items</h3>
          <p className="text-xs text-zinc-400">Ranked by gross line revenue and quantity sold</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center text-zinc-500 text-xs py-8">No menu item sales recorded in this period</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-2 px-2">Item</th>
                <th className="py-2 px-2 text-center">Qty Sold</th>
                <th className="py-2 px-2 text-right">Revenue</th>
                <th className="py-2 px-2 text-right">Avg Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-2 font-sans font-medium text-zinc-200 truncate max-w-[180px]">
                    <span className="text-amber-400 font-mono mr-2">#{index + 1}</span>
                    {item.item_name}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">{item.quantity_sold}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">
                    {formatCurrency(item.total_revenue_cents, currency)}
                  </td>
                  <td className="py-2.5 px-2 text-right text-zinc-400">
                    {formatCurrency(item.avg_price_cents, currency)}
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
