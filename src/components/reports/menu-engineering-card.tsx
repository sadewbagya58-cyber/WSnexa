'use client';

import React, { useEffect, useState } from 'react';
import { MenuEngineeringItem } from '@/server/services/inventory-intelligence.service';
import { fetchMenuEngineeringAction } from '@/server/actions/inventory-intelligence';
import { formatCurrencyMinor } from '@/lib/utils/currency';

export function MenuEngineeringCard({ currency }: { currency: string }) {
  const [data, setData] = useState<{
    items: MenuEngineeringItem[];
    averageUnitsSold: number;
    averageMarginPercentage: number;
    hasSufficientData: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      const res = await fetchMenuEngineeringAction();
      if (isMounted && res.success && res.data) {
        setData(res.data);
      }
      if (isMounted) setIsLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs animate-pulse space-y-4">
        <div className="h-5 w-48 bg-zinc-200 rounded-md" />
        <div className="h-32 bg-zinc-100 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const filteredItems = data.items.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.classification.toLowerCase() === activeFilter.toLowerCase();
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 uppercase tracking-wider flex items-center gap-2">
            <span>🎯</span> Menu Engineering & Profitability Matrix
          </h3>
          <p className="text-xs text-zinc-400">
            Categorize dishes by Popularity vs. Gross Margin to optimize menu pricing and promotional focus
          </p>
        </div>

        {/* Matrix Filter Pills */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {['all', 'star', 'plowhorse', 'puzzle', 'dog'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                activeFilter === cat
                  ? 'bg-zinc-950 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {cat === 'all'
                ? 'All Items'
                : cat === 'star'
                ? '🌟 Stars'
                : cat === 'plowhorse'
                ? '🐎 Plowhorses'
                : cat === 'puzzle'
                ? '🧩 Puzzles'
                : '🐕 Dogs'}
            </button>
          ))}
        </div>
      </div>

      {/* Category Legend Explanations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 space-y-1">
          <div className="font-bold text-emerald-800 flex items-center gap-1.5">
            <span>🌟</span> Stars
          </div>
          <p className="text-[11px] text-emerald-700">
            High popularity & high profit. Keep recipe quality and presentation consistent.
          </p>
        </div>

        <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/80 space-y-1">
          <div className="font-bold text-blue-800 flex items-center gap-1.5">
            <span>🐎</span> Plowhorses
          </div>
          <p className="text-[11px] text-blue-700">
            High volume, lower margin. Consider modest price increase or ingredient optimization.
          </p>
        </div>

        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200/80 space-y-1">
          <div className="font-bold text-purple-800 flex items-center gap-1.5">
            <span>🧩</span> Puzzles
          </div>
          <p className="text-[11px] text-purple-700">
            High margin, lower sales. Promote with specials and waiter recommendations.
          </p>
        </div>

        <div className="p-3 bg-rose-50 rounded-xl border border-rose-200/80 space-y-1">
          <div className="font-bold text-rose-800 flex items-center gap-1.5">
            <span>🐕</span> Dogs
          </div>
          <p className="text-[11px] text-rose-700">
            Low popularity & low margin. Consider recipe redesign or menu removal.
          </p>
        </div>
      </div>

      {!data.hasSufficientData && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <span>💡</span>
          <span>
            <strong>Preliminary Data:</strong> More sales volume is needed to produce authoritative classifications. Thresholds are calibrated automatically.
          </span>
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold uppercase text-zinc-500">
              <th className="py-2.5 px-3">Item Name</th>
              <th className="py-2.5 px-3">Price</th>
              <th className="py-2.5 px-3">Food Cost</th>
              <th className="py-2.5 px-3">Gross Margin</th>
              <th className="py-2.5 px-3">Units Sold</th>
              <th className="py-2.5 px-3">Total Profit</th>
              <th className="py-2.5 px-3 text-right">Classification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredItems.map((item) => (
              <tr key={item.itemId} className="hover:bg-zinc-50/50">
                <td className="py-3 px-3">
                  <div className="font-bold text-zinc-900">{item.itemName}</div>
                  <div className="text-[10px] text-zinc-400">{item.categoryName}</div>
                </td>

                <td className="py-3 px-3 font-mono text-zinc-700">
                  {formatCurrencyMinor(item.sellingPriceCents, currency)}
                </td>

                <td className="py-3 px-3 font-mono text-zinc-700">
                  {item.foodCostCents > 0 ? formatCurrencyMinor(item.foodCostCents, currency) : 'No recipe'}
                </td>

                <td className="py-3 px-3 font-mono font-bold text-emerald-600">
                  {item.grossMarginPercentage}%
                </td>

                <td className="py-3 px-3 font-bold text-zinc-950">
                  {item.unitsSold}
                </td>

                <td className="py-3 px-3 font-mono font-bold text-zinc-950">
                  {formatCurrencyMinor(item.totalGrossProfitCents, currency)}
                </td>

                <td className="py-3 px-3 text-right">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                      item.classification === 'Star'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.classification === 'Plowhorse'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : item.classification === 'Puzzle'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : item.classification === 'Dog'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                    }`}
                  >
                    {item.classification === 'Star'
                      ? '🌟 Star'
                      : item.classification === 'Plowhorse'
                      ? '🐎 Plowhorse'
                      : item.classification === 'Puzzle'
                      ? '🧩 Puzzle'
                      : item.classification === 'Dog'
                      ? '🐕 Dog'
                      : 'Pending Data'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
