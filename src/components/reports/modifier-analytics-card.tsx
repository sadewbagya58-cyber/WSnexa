'use client';

import React from 'react';
import { ModifierPerformance } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface ModifierAnalyticsCardProps {
  modifiers: ModifierPerformance[];
  currency: string;
}

export function ModifierAnalyticsCard({ modifiers, currency }: ModifierAnalyticsCardProps) {
  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Selected Modifiers</h3>
          <p className="text-xs text-zinc-400">Modifier option selection frequency and added revenue</p>
        </div>
      </div>

      {modifiers.length === 0 ? (
        <div className="text-center text-zinc-500 text-xs py-8">No modifier selections recorded in this period</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase text-[10px]">
                <th className="py-2 px-2">Group</th>
                <th className="py-2 px-2">Option</th>
                <th className="py-2 px-2 text-center">Selections</th>
                <th className="py-2 px-2 text-right">Added Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {modifiers.map((m, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2.5 px-2 font-sans text-zinc-400 font-medium">{m.group_name}</td>
                  <td className="py-2.5 px-2 font-sans font-bold text-zinc-200">{m.option_name}</td>
                  <td className="py-2.5 px-2 text-center font-bold text-white">{m.selections_count}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-400 font-bold">
                    {formatCurrency(m.additional_revenue_cents, currency)}
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
