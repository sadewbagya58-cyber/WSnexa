'use client';

import React from 'react';
import { PaymentBreakdownItem } from '@/server/services/report.service';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface PaymentAnalyticsCardProps {
  payments: PaymentBreakdownItem[];
  currency: string;
}

export function PaymentAnalyticsCard({ payments, currency }: PaymentAnalyticsCardProps) {
  const methodIcons: Record<string, string> = {
    cash: '💵',
    card: '💳',
    qr_pay: '📱',
    pay_at_counter: '🏪',
    online: '🌐',
  };

  const totalPaidCents = payments.reduce((acc, curr) => acc + curr.total_cents, 0);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Payment Method Breakdown</h3>
          <p className="text-xs text-zinc-400">Settlement method distribution and percentages</p>
        </div>
        <span className="font-mono text-xs text-emerald-400 font-bold">
          Total: {formatCurrency(totalPaidCents, currency)}
        </span>
      </div>

      {payments.length === 0 ? (
        <div className="text-center text-zinc-500 text-xs py-8">No completed payments recorded in this period</div>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const icon = methodIcons[p.payment_method] || '💳';
            return (
              <div key={p.payment_method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="font-semibold text-zinc-200 uppercase">{p.payment_method.replace(/_/g, ' ')}</span>
                    <span className="text-zinc-500 font-mono">({p.transaction_count} txns)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white">{formatCurrency(p.total_cents, currency)}</span>
                    <span className="font-mono text-xs text-amber-400 w-12 text-right">{p.percentage}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, p.percentage)}%` }}
                    className="h-full bg-amber-500 rounded-full"
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
