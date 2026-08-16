'use client';

import React from 'react';
import { FormattedStockMovement } from '@/server/services/inventory.service';

interface InventoryMovementTimelineProps {
  movements: FormattedStockMovement[];
  baseUnit: string;
  hasCostPermission?: boolean;
}

export function InventoryMovementTimeline({
  movements,
  baseUnit,
  hasCostPermission = false,
}: InventoryMovementTimelineProps) {
  if (movements.length === 0) {
    return (
      <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-8 text-center">
        <span className="text-2xl">📜</span>
        <h4 className="text-xs font-bold text-zinc-900 mt-2">No stock movements recorded yet</h4>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          All stock adjustments, deliveries, counts, waste, and transfers will be logged here chronologically.
        </p>
      </div>
    );
  }

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'opening_balance':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Opening Balance</span>;
      case 'adjustment_add':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Stock Added</span>;
      case 'adjustment_remove':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">Stock Removed</span>;
      case 'stock_count_adjustment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Audit Count</span>;
      case 'waste':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Waste Log</span>;
      case 'transfer_out':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Transfer Out</span>;
      case 'transfer_in':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">Transfer In</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600">{type}</span>;
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Stock Movement Ledger ({movements.length})
        </h3>
      </div>

      <div className="divide-y divide-zinc-100">
        {movements.map((m) => (
          <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {m.direction === 'in' ? '📈' : m.direction === 'out' ? '📉' : '⚖️'}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {getMovementBadge(m.movementType)}
                  <span className="text-xs font-bold text-zinc-900">{m.locationName}</span>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {m.reason && (
                  <p className="text-xs text-zinc-600 mt-1 font-medium">{m.reason}</p>
                )}
                {m.notes && (
                  <p className="text-[11px] text-zinc-400 mt-0.5 italic">{m.notes}</p>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="text-sm font-black text-zinc-950">
                {m.direction === 'in' ? '+' : m.direction === 'out' ? '-' : ''}{m.quantityBase} {baseUnit}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                {m.previousBalanceBase} → <strong className="text-zinc-700">{m.newBalanceBase} {baseUnit}</strong>
              </div>
              {hasCostPermission && m.totalCostCents !== null && (
                <div className="text-[10px] text-zinc-500 font-medium mt-0.5">
                  Cost: {m.currency} {(m.totalCostCents / 100).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
