'use client';

import React, { useState } from 'react';
import { BranchComparisonItemDTO } from '@/lib/analytics/analytics-types';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface BranchComparisonViewProps {
  branches?: BranchComparisonItemDTO[];
  currency: string;
  hasFinancialAccess: boolean;
  onSelectBranch: (branchId: string) => void;
}

type SortField =
  | 'branchName'
  | 'grossSalesCents'
  | 'completedOrdersCount'
  | 'aovCents'
  | 'completionRate'
  | 'avgPreparationTimeSeconds'
  | 'wasteCostCents'
  | 'avgRating';

export function BranchComparisonView({
  branches = [],
  currency,
  hasFinancialAccess,
  onSelectBranch,
}: BranchComparisonViewProps) {
  const [sortField, setSortField] = useState<SortField>('grossSalesCents');
  const [sortAsc, setSortAsc] = useState(false);

  if (!branches || branches.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-2">
        <div className="text-2xl">🏢</div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Multi-Branch Comparison Unavailable</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Multi-branch comparison is available when your user role is authorized across multiple property branches.
        </p>
      </div>
    );
  }

  const sortedBranches = [...branches].sort((a, b) => {
    let valA: number | string = a[sortField] ?? -Infinity;
    let valB: number | string = b[sortField] ?? -Infinity;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    valA = Number(valA);
    valB = Number(valB);
    return sortAsc ? valA - valB : valB - valA;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatPrep = (seconds: number | null) => {
    if (seconds === null || seconds <= 0) return 'N/A';
    return `${Math.round(seconds / 60)}m`;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span>🏬</span> Multi-Branch Performance Comparison ({branches.length} Branches)
          </h3>
          <p className="text-xs text-zinc-400">
            Compare sales, fulfillment efficiency, inventory waste, and rating metrics across authorized branches
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider select-none">
              <th
                onClick={() => handleSort('branchName')}
                className="py-3 px-3 cursor-pointer hover:text-white transition-colors"
              >
                Branch Name {sortField === 'branchName' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('grossSalesCents')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Gross Sales {sortField === 'grossSalesCents' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('completedOrdersCount')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Completed Orders {sortField === 'completedOrdersCount' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('aovCents')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                AOV {sortField === 'aovCents' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('completionRate')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Completion % {sortField === 'completionRate' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('avgPreparationTimeSeconds')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Kitchen Prep {sortField === 'avgPreparationTimeSeconds' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('wasteCostCents')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Waste Cost {sortField === 'wasteCostCents' && (sortAsc ? '▲' : '▼')}
              </th>
              <th
                onClick={() => handleSort('avgRating')}
                className="py-3 px-3 text-right cursor-pointer hover:text-white transition-colors"
              >
                Avg Rating {sortField === 'avgRating' && (sortAsc ? '▲' : '▼')}
              </th>
              <th className="py-3 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {sortedBranches.map((b) => (
              <tr key={b.branchId} className="hover:bg-zinc-800/40 transition-colors">
                <td className="py-3 px-3 font-sans font-bold text-white">📍 {b.branchName}</td>
                <td className="py-3 px-3 text-right font-bold text-emerald-400">
                  {b.grossSalesCents !== null && hasFinancialAccess
                    ? formatCurrency(b.grossSalesCents, currency)
                    : 'N/A'}
                </td>
                <td className="py-3 px-3 text-right text-white font-bold">{b.completedOrdersCount}</td>
                <td className="py-3 px-3 text-right text-zinc-300">
                  {b.aovCents !== null && hasFinancialAccess ? formatCurrency(b.aovCents, currency) : 'N/A'}
                </td>
                <td className="py-3 px-3 text-right text-amber-400 font-bold">
                  {b.completionRate !== null ? `${b.completionRate}%` : 'N/A'}
                </td>
                <td className="py-3 px-3 text-right text-blue-400">
                  {formatPrep(b.avgPreparationTimeSeconds)}
                </td>
                <td className="py-3 px-3 text-right text-purple-400">
                  {b.wasteCostCents !== null && hasFinancialAccess
                    ? formatCurrency(b.wasteCostCents, currency)
                    : 'N/A'}
                </td>
                <td className="py-3 px-3 text-right text-amber-300 font-bold">
                  {b.avgRating !== null ? `${b.avgRating} ★` : 'N/A'}
                </td>
                <td className="py-3 px-3 text-center font-sans">
                  <button
                    type="button"
                    onClick={() => onSelectBranch(b.branchId)}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black font-bold text-[11px] rounded-lg transition-all border border-amber-500/30"
                  >
                    Drill-down
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
