'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { submitGuestOrderAction } from '@/server/actions/order';

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
  const router = useRouter();
  const { state, clearCart } = useCart();

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNotes, setGuestNotes] = useState('');
  const [inputPin, setInputPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const guestNameId = useId();
  const guestPhoneId = useId();
  const guestNotesId = useId();
  const inputPinId = useId();

  const getOrCreateIdempotencyKey = (): string => {
    if (typeof window === 'undefined') return `idemp_${Date.now()}`;
    let key = sessionStorage.getItem(`wsnexa_checkout_key_${state.branchId}`);
    if (!key) {
      key = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      sessionStorage.setItem(`wsnexa_checkout_key_${state.branchId}`, key);
    }
    return key;
  };

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

  const handleOrderSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cartItemsPayload = state.lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        specialInstructions: line.specialInstructions || null,
        selectedModifiers: line.selectedModifiers.map((mod) => ({
          groupId: mod.groupId,
          optionId: mod.optionId,
        })),
      }));

      const res = await submitGuestOrderAction({
        rawQrToken: token,
        tableId: state.confirmedTable?.tableId || null,
        inputPin: inputPin.trim() || null,
        guestName: guestName.trim() || null,
        guestPhone: guestPhone.trim() || null,
        guestNotes: guestNotes.trim() || null,
        idempotencyKey: getOrCreateIdempotencyKey(),
        cartItems: cartItemsPayload,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.message || 'Failed to submit order. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Clear idempotency key from session storage so subsequent orders use a new key
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`wsnexa_checkout_key_${state.branchId}`);
      }

      // Clear cart state
      clearCart();

      // Redirect to confirmation status page
      router.push(`/m/${token}/order/${res.data.orderId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-16">
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
                Checkout &amp; Place Order
              </h1>
            </div>
          </div>
          <Badge variant="neutral">{state.totalQuantity} items</Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-2xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-sm text-red-950">
              <span>⚠️</span>
              <span>Order Submission Failed</span>
            </div>
            <p className="leading-relaxed text-red-800">{errorMessage}</p>
          </div>
        )}

        {/* Dining Table Context */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-2">
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

        {/* Guest Details Form */}
        <form onSubmit={handleOrderSubmission} className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 border-b border-zinc-100 pb-3">
              Guest Contact Details (Optional)
            </h2>

            <div className="space-y-3">
              <div>
                <label htmlFor={guestNameId} className="block text-xs font-bold text-zinc-700 mb-1">
                  Your Name
                </label>
                <input
                  id={guestNameId}
                  type="text"
                  placeholder="e.g. John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor={guestPhoneId} className="block text-xs font-bold text-zinc-700 mb-1">
                  Phone Number
                </label>
                <input
                  id={guestPhoneId}
                  type="tel"
                  placeholder="e.g. +94 77 123 4567"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
                  maxLength={30}
                />
              </div>

              <div>
                <label htmlFor={guestNotesId} className="block text-xs font-bold text-zinc-700 mb-1">
                  Order / Preparation Notes
                </label>
                <textarea
                  id={guestNotesId}
                  placeholder="e.g. Please make it extra spicy, cutlery needed..."
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none h-20 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Table PIN input if required but not previously verified */}
              {!state.confirmedTable && (
                <div>
                  <label htmlFor={inputPinId} className="block text-xs font-bold text-zinc-700 mb-1">
                    Table PIN (If required by branch)
                  </label>
                  <input
                    id={inputPinId}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 4-digit table PIN"
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-xs font-mono text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none tracking-widest"
                  />
                </div>
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
                <span>Total Amount</span>
                <span>{formatCurrency(state.subtotalCents, state.currency)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full text-sm font-extrabold py-3.5 shadow-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Placing Order...' : `Confirm & Submit Order (${formatCurrency(state.subtotalCents, state.currency)})`}
            </Button>

            <Link href={`/m/${token}`} className="block text-center">
              <span className="text-xs font-bold text-zinc-600 hover:text-zinc-950 underline">
                ← Return to Branch Menu
              </span>
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
};
