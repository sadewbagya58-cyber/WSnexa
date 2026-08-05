'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface CheckoutPreviewProps {
  token: string;
  branchName: string;
  businessName: string;
}

export const CheckoutPreview: React.FC<CheckoutPreviewProps> = ({
  token,
  branchName,
  businessName,
}) => {
  const { state } = useCart();

  if (!state.isHydrated) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="text-sm font-bold text-zinc-500">Loading guest checkout...</div>
      </div>
    );
  }

  // Redirect to menu if cart is empty
  if (state.lines.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg border border-zinc-200 space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
            🛒
          </div>
          <h1 className="text-xl font-bold text-zinc-950">Your Cart is Empty</h1>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Please add items from the digital menu before proceeding to checkout.
          </p>
          <Link href={`/m/${token}`}>
            <Button className="w-full text-xs font-bold mt-2">← Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/m/${token}`}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              ←
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {businessName}
              </span>
              <h1 className="text-base font-black tracking-tight text-zinc-950">
                Checkout Preview
              </h1>
            </div>
          </div>
          <Badge variant="neutral">{state.totalQuantity} items</Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Phase 10 Preview Banner */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-1 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-sm text-blue-950">
            <span>ℹ️</span>
            <span>Phase 10 Preview Notice</span>
          </div>
          <p className="text-blue-800 leading-relaxed">
            Order placement, kitchen transmission, and payment processing will be completed in Phase 10. No order or payment record has been created in the database.
          </p>
        </div>

        {/* Table Status */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Dining Context
          </span>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>Branch Location:</span>
            <span className="font-semibold">{branchName}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-bold text-zinc-950">
            <span>Confirmed Table:</span>
            {state.confirmedTable ? (
              <span className="text-emerald-800 font-extrabold">📍 {state.confirmedTable.tableName}</span>
            ) : (
              <span className="text-zinc-500 font-normal">No Table Selected (Direct Ordering)</span>
            )}
          </div>
        </div>

        {/* Items Summary List */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
            Order Summary
          </h2>

          <div className="space-y-3 divide-y divide-zinc-100">
            {state.lines.map((line) => (
              <div key={line.lineId} className="pt-3 first:pt-0 flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-950">
                    <span className="font-mono text-zinc-500 text-xs">{line.quantity}x</span>
                    <span>{line.itemName}</span>
                  </div>

                  {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                    <div className="pl-6 space-y-0.5 text-xs text-zinc-500">
                      {line.selectedModifiers.map((mod) => (
                        <div key={mod.optionId}>
                          • {mod.groupName}: {mod.optionName}
                        </div>
                      ))}
                    </div>
                  )}

                  {line.specialInstructions && (
                    <div className="pl-6 text-xs text-amber-900 italic">
                      📝 &quot;{line.specialInstructions}&quot;
                    </div>
                  )}
                </div>

                <div className="text-sm font-black text-zinc-950">
                  {formatCurrency(line.lineTotalCents, state.currency)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-200 space-y-2">
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Items Subtotal</span>
              <span className="font-mono font-bold">{formatCurrency(state.subtotalCents, state.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
              <span>Estimated Subtotal</span>
              <span>{formatCurrency(state.subtotalCents, state.currency)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <Button
            className="w-full text-sm font-bold py-3.5"
            disabled
          >
            Submit Order (Phase 10 Feature)
          </Button>

          <Link href={`/m/${token}`} className="block text-center">
            <span className="text-xs font-bold text-zinc-600 hover:text-zinc-950 underline">
              ← Return to Branch Menu
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
};
