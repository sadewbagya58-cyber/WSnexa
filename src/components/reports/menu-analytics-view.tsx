'use client';

import React from 'react';
import { MenuAnalyticsResult } from '@/server/analytics/menu-analytics';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface MenuAnalyticsViewProps {
  menu: MenuAnalyticsResult;
  currency: string;
  hasFinancialAccess: boolean;
}

export function MenuAnalyticsView({ menu, currency, hasFinancialAccess }: MenuAnalyticsViewProps) {
  return (
    <div className="space-y-6">
      {/* Recipe Cost & Contribution Margin Header Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <span>Estimated Food Cost (BOM)</span>
            <span>🥗</span>
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {menu.estimatedFoodCost.value !== null && hasFinancialAccess
              ? formatCurrency(menu.estimatedFoodCost.value, currency)
              : 'N/A'}
          </div>
          {menu.estimatedFoodCost.qualityNote && (
            <div className="text-xs text-amber-400/90 italic">
              ℹ️ {menu.estimatedFoodCost.qualityNote}
            </div>
          )}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <span>Contribution Margin</span>
            <span>💎</span>
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {menu.contributionMargin.value !== null && hasFinancialAccess
              ? formatCurrency(menu.contributionMargin.value, currency)
              : 'N/A'}
          </div>
          <div className="text-xs text-zinc-500">Gross Sales minus estimated recipe ingredient costs</div>
        </div>
      </div>

      {/* Top Selling Menu Items Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span>🍽️</span> Top Selling Menu Items
        </h3>

        {!menu.topSellingItems || menu.topSellingItems.length === 0 ? (
          <div className="text-xs text-zinc-500 italic p-4 text-center">
            No menu item sales recorded for selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3 text-right">Qty Sold</th>
                  <th className="py-2.5 px-3 text-right">Revenue</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Penetration Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {menu.topSellingItems.map((item, idx) => (
                  <tr key={item.itemName || idx} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3 font-sans font-bold text-white flex items-center gap-2">
                      <span className="text-zinc-500 text-xs w-4">#{idx + 1}</span>
                      <span>{item.itemName}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white">{item.quantitySold}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {item.revenueCents !== null && hasFinancialAccess ? formatCurrency(item.revenueCents, currency) : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right text-zinc-300">{item.orderCount}</td>
                    <td className="py-3 px-3 text-right text-amber-400 font-bold">
                      {item.penetrationRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>📂</span> Sales by Category
          </h3>
          <div className="space-y-3">
            {menu.categorySales.map((cat) => (
              <div key={cat.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">{cat.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-mono">
                      {hasFinancialAccess ? formatCurrency(cat.value, currency) : `${cat.subValue} items`}
                    </span>
                    <span className="text-amber-400 font-bold font-mono">({cat.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(cat.percentage || 0, 100)}%` }}
                    className="bg-emerald-500 h-full rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modifier Selections Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>➕</span> Popular Modifier Selections
          </h3>
          <div className="space-y-3">
            {menu.modifierPerformance.map((mod) => (
              <div key={mod.key} className="flex items-center justify-between p-2.5 bg-zinc-800/50 rounded-xl text-xs">
                <span className="font-medium text-white">{mod.label}</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-zinc-400">{mod.subValue} selections</span>
                  {hasFinancialAccess && (
                    <span className="text-emerald-400 font-bold">+{formatCurrency(mod.value, currency)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
