'use client';

import React from 'react';
import { InventoryAnalyticsResult } from '@/server/analytics/inventory-analytics';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface InventoryAnalyticsViewProps {
  inventory: InventoryAnalyticsResult;
  currency: string;
  hasFinancialAccess: boolean;
}

export function InventoryAnalyticsView({ inventory, currency, hasFinancialAccess }: InventoryAnalyticsViewProps) {
  const cards = [
    {
      title: 'Current Total Stock',
      value: `${inventory.currentStock.value || 0} Units`,
      subtitle: 'Across all active storage locations',
      icon: '📦',
      color: 'text-white',
    },
    {
      title: 'Low Stock Items',
      value: `${inventory.lowStockItemCount.value || 0} Items`,
      subtitle: 'At or below min reorder level',
      icon: '⚠️',
      color: 'text-amber-400',
    },
    {
      title: 'Out of Stock Items',
      value: `${inventory.outOfStockItemCount.value || 0} Items`,
      subtitle: 'Zero stock balance remaining',
      icon: '🚨',
      color: 'text-rose-400',
    },
    {
      title: 'Recorded Waste Cost',
      value: inventory.wasteCostCents.value !== null && hasFinancialAccess
        ? formatCurrency(inventory.wasteCostCents.value, currency)
        : 'N/A',
      subtitle: `${inventory.wasteQuantity.value || 0} units wasted`,
      icon: '🗑️',
      color: 'text-purple-400',
    },
    {
      title: 'Cross-Branch Transfer Volume',
      value: `${inventory.transferVolume.value || 0} Units`,
      subtitle: 'Received stock transfers',
      icon: '🚚',
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider">
              <span>{c.title}</span>
              <span className="text-base">{c.icon}</span>
            </div>
            <div className={`text-2xl font-black font-mono tracking-tight ${c.color}`}>
              {c.value}
            </div>
            <div className="text-xs text-zinc-500 italic">{c.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
