'use client';

import React, { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { QuantityStepper } from './quantity-stepper';
import { CartLine } from '@/features/cart/cart-types';

interface CartDrawerProps {
  token: string;
  requireTableSelection: boolean;
  requireTablePin: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: () => void;
  onEditLine: (line: CartLine) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  token,
  requireTableSelection,
  isOpen,
  onClose,
  onSelectTable,
  onEditLine,
}) => {
  const { state, updateQuantity, removeLine, clearCart } = useCart();

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isTableConfirmed = !!state.confirmedTable;
  const canProceedToCheckout =
    state.lines.length > 0 && (!requireTableSelection || isTableConfirmed);

  const handleCheckoutClick = () => {
    if (!canProceedToCheckout) return;
    onClose();
    // Navigate to checkout preview route
    if (typeof window !== 'undefined') {
      window.location.href = `/m/${token}/checkout`;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 flex items-center justify-between">
          <div className="space-y-1">
            <h2 id="cart-drawer-title" className="text-lg font-black text-zinc-950 flex items-center gap-2">
              Your Guest Cart
              <Badge variant="neutral">{state.totalQuantity} items</Badge>
            </h2>

            {/* Table Context Indicator */}
            {requireTableSelection && (
              <div className="text-xs">
                {isTableConfirmed ? (
                  <div className="flex items-center gap-1 text-emerald-800 font-bold">
                    <span>📍</span>
                    <span>Confirmed Table: {state.confirmedTable?.tableName}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onSelectTable}
                    className="text-amber-800 font-bold underline hover:text-amber-900"
                  >
                    ⚠️ Table selection required. Click to select.
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Close cart"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Cart Lines List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {state.lines.map((line) => (
            <div
              key={line.lineId}
              className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <h3 className="text-sm font-bold text-zinc-950">{line.itemName}</h3>

                  {/* Selected Modifiers Summary */}
                  {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                    <div className="space-y-0.5 text-[11px] text-zinc-600">
                      {line.selectedModifiers.map((mod) => (
                        <div key={mod.optionId} className="flex items-center justify-between">
                          <span>
                            • {mod.groupName}: {mod.optionName}
                          </span>
                          {mod.additionalPriceCents > 0 && (
                            <span className="font-semibold text-zinc-900">
                              +{formatCurrency(mod.additionalPriceCents, state.currency)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Special Instructions Note */}
                  {line.specialInstructions && (
                    <p className="text-xs text-amber-900 bg-amber-50 rounded-md p-2 border border-amber-200 mt-1">
                      📝 &quot;{line.specialInstructions}&quot;
                    </p>
                  )}
                </div>

                <div className="text-right font-black text-sm text-zinc-950 shrink-0">
                  {formatCurrency(line.lineTotalCents, state.currency)}
                </div>
              </div>

              {/* Quantity Stepper & Actions Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <QuantityStepper
                  quantity={line.quantity}
                  min={1}
                  max={99}
                  onChange={(q) => updateQuantity(line.lineId, q)}
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditLine(line)}
                    className="rounded bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.lineId)}
                    className="rounded bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 border border-red-200 hover:bg-red-100"
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {state.lines.length === 0 && (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-400">
              <span className="text-4xl">🛒</span>
              <span className="text-sm font-bold text-zinc-700">Your cart is empty</span>
              <p className="text-xs text-zinc-500">Add delicious items from the branch menu to get started.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {state.lines.length > 0 && (
          <div className="p-5 border-t border-zinc-200 bg-zinc-50 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-600">
                <span>Items Subtotal ({state.totalQuantity} items)</span>
                <span className="font-mono font-bold text-zinc-950">
                  {formatCurrency(state.subtotalCents, state.currency)}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-zinc-950 pt-1 border-t border-zinc-200">
                <span>Subtotal</span>
                <span>{formatCurrency(state.subtotalCents, state.currency)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearCart}
                className="text-xs text-zinc-600"
              >
                Clear Cart
              </Button>

              <Button
                className="flex-1 text-sm font-bold py-3"
                disabled={!canProceedToCheckout}
                onClick={handleCheckoutClick}
              >
                {!isTableConfirmed && requireTableSelection
                  ? 'Confirm Table to Proceed'
                  : 'Continue to Checkout →'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
