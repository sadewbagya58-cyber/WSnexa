'use client';

import React from 'react';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency } from '@/features/cart/cart-calculations';

interface FloatingCartBarProps {
  onOpenCart: () => void;
}

export const FloatingCartBar: React.FC<FloatingCartBarProps> = ({ onOpenCart }) => {
  const { state } = useCart();

  // Hidden when cart is unhydrated or has no items
  if (!state.isHydrated || state.totalQuantity === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 print:hidden">
      <button
        type="button"
        onClick={onOpenCart}
        className="w-full rounded-2xl bg-zinc-950 px-5 py-4 text-white shadow-xl hover:bg-zinc-900 active:scale-[0.99] transition-all flex items-center justify-between touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-black">
            {state.totalQuantity}
          </span>
          <div className="text-left">
            <span className="text-[11px] uppercase font-bold tracking-wider text-zinc-400">Cart Subtotal</span>
            <div className="text-sm font-black tracking-tight text-white">
              {formatCurrency(state.subtotalCents, state.currency)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
          <span>View Cart</span>
          <span>→</span>
        </div>
      </button>
    </div>
  );
};
