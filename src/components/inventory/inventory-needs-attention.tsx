'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { InventoryOverviewPayload } from '@/server/services/inventory.service';

interface InventoryNeedsAttentionProps {
  items: InventoryOverviewPayload['needsAttention'];
}

export function InventoryNeedsAttention({ items }: InventoryNeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-6 text-center">
        <span className="text-2xl">✨</span>
        <h3 className="text-sm font-bold text-emerald-950 mt-1">Everything is in order</h3>
        <p className="text-xs text-emerald-700 mt-1">
          No urgent stockouts, low-stock alerts, or pending transfer actions require your attention right now.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          Requires Attention Right Now
        </h2>
        <span className="text-xs font-semibold text-zinc-400">
          {items.length} {items.length === 1 ? 'action' : 'actions'}
        </span>
      </div>

      <div className="divide-y divide-zinc-100">
        {items.map((item, idx) => (
          <div key={idx} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2.5">
              <span className="text-base mt-0.5">
                {item.type === 'out_of_stock'
                  ? '🔴'
                  : item.type === 'low_stock'
                  ? '⚠️'
                  : item.type === 'expiring'
                  ? '⏳'
                  : '🚚'}
              </span>
              <div>
                <p className="text-xs font-bold text-zinc-900">{item.message}</p>
                {item.currentQuantity !== undefined && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Current balance: {item.currentQuantity} {item.baseUnit}
                  </p>
                )}
              </div>
            </div>

            <Link href={item.actionHref}>
              <Button size="sm" variant="outline" className="text-xs font-bold h-8 shrink-0">
                {item.actionLabel} →
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
