'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency, calculateRewardDiscountCents } from '@/features/cart/cart-calculations';
import { isTableAccessVerified } from '@/features/cart/cart-types';
import { saveActiveOrderToStorage } from '@/features/cart/active-order-storage';
import { submitGuestOrderAction, generateLocationProofAction } from '@/server/actions/order';

import { BranchPaymentMethod, BranchOrderSecuritySettings } from '@/types/database.types';

interface CheckoutPreviewProps {
  token: string;
  branchName: string;
  businessName: string;
  enabledPaymentMethods?: BranchPaymentMethod[];
  securitySettings?: BranchOrderSecuritySettings | null;
  isLoggedIn?: boolean;
}

const PAYMENT_METHOD_MAP: Record<string, { icon: string; title: string; description: string; enumValue: 'pay_at_counter' | 'cash' | 'card' | 'qr_pay' | 'online' }> = {
  pay_at_counter: {
    icon: '🏪',
    title: 'Pay at Counter',
    description: 'Pay at the main cashier counter when ready.',
    enumValue: 'pay_at_counter',
  },
  cash: {
    icon: '💵',
    title: 'Cash',
    description: 'Pay cash to cashier or waiter upon delivery.',
    enumValue: 'cash',
  },
  card: {
    icon: '💳',
    title: 'Card at Venue',
    description: 'Pay via venue card terminal.',
    enumValue: 'card',
  },
  qr_payment: {
    icon: '📱',
    title: 'Venue QR Pay',
    description: 'Scan venue mobile banking QR at counter.',
    enumValue: 'qr_pay',
  },
  online_payment: {
    icon: '🌐',
    title: 'Pay Online Now',
    description: 'Pay securely online.',
    enumValue: 'online',
  },
};

export const CheckoutPreview: React.FC<CheckoutPreviewProps> = ({
  token,
  branchName,
  businessName,
  enabledPaymentMethods,
  securitySettings,
  isLoggedIn = false,
}) => {
  const router = useRouter();
  const { state, clearCart } = useCart();

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNotes, setGuestNotes] = useState('');

  const activeMethods = React.useMemo(() => {
    if (enabledPaymentMethods && enabledPaymentMethods.length > 0) {
      return enabledPaymentMethods;
    }
    return [
      { method: 'pay_at_counter', display_name: 'Pay at Counter', instructions: '', is_enabled: true, sort_order: 1 },
      { method: 'cash', display_name: 'Cash', instructions: '', is_enabled: true, sort_order: 2 },
      { method: 'card', display_name: 'Card at Venue', instructions: '', is_enabled: true, sort_order: 3 },
    ] as BranchPaymentMethod[];
  }, [enabledPaymentMethods]);

  const [paymentMethod, setPaymentMethod] = useState<
    'pay_at_counter' | 'cash' | 'card' | 'qr_pay' | 'online'
  >(() => {
    const first = activeMethods[0]?.method;
    return PAYMENT_METHOD_MAP[first]?.enumValue || 'pay_at_counter';
  });

  const [locationState, setLocationState] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    coords?: { latitude: number; longitude: number; accuracy?: number };
    proof?: string;
    errorMessage?: string;
  }>({ status: 'idle' });

  const [inputPin, setInputPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleVerifyLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationState({
        status: 'error',
        errorMessage: 'Geolocation is not supported by your mobile browser.',
      });
      return;
    }

    setLocationState({ status: 'loading' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const accuracy = pos.coords.accuracy;
        if (accuracy > 500) {
          setLocationState({
            status: 'error',
            errorMessage: 'Your location is not accurate enough. Move closer to an open area and try again.',
          });
          return;
        }

        const proofRes = await generateLocationProofAction(
          state.branchId,
          pos.coords.latitude,
          pos.coords.longitude,
          state.confirmedTable?.tableId
        );

        if (!proofRes.success || !proofRes.data?.proof) {
          setLocationState({
            status: 'error',
            errorMessage: proofRes.message || 'Device location verification failed.',
          });
          return;
        }

        setLocationState({
          status: 'success',
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
          proof: proofRes.data.proof,
        });
      },
      (err) => {
        let msg = 'We could not determine your location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission is required by this venue to place an order.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location check took too long. Try again.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable.';
        }
        setLocationState({ status: 'error', errorMessage: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

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
        signedTableAccessProof: state.confirmedTable?.signedTableAccessProof || null,
        guestName: guestName.trim() || null,
        guestPhone: guestPhone.trim() || null,
        guestNotes: guestNotes.trim() || null,
        paymentMethod,
        idempotencyKey: getOrCreateIdempotencyKey(),
        cartItems: cartItemsPayload,
        selectedRewardId: state.selectedReward?.id || null,
        userCoordinates: locationState.coords
          ? {
              latitude: locationState.coords.latitude,
              longitude: locationState.coords.longitude,
              accuracy: locationState.coords.accuracy,
            }
          : null,
        locationProof: locationState.proof || null,
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

      // Save safe active order metadata to sessionStorage for recovery
      saveActiveOrderToStorage({
        orderId: res.data.orderId,
        orderNumberFormatted: res.data.orderNumberFormatted,
        branchId: state.branchId,
        tableId: state.confirmedTable?.tableId || null,
        tableName: state.confirmedTable?.tableName || null,
        createdAt: new Date().toISOString(),
        latestStatus: res.data.status,
        accessToken: res.data.accessToken,
      });

      // Clear local cart state
      clearCart();

      // Redirect to confirmation status page with access_token security parameter
      router.push(`/m/${token}/order/${res.data.orderId}?access_token=${res.data.accessToken}`);
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
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-red-950">
              <span>⚠️</span>
              <span>Order Submission Failed</span>
            </div>
            <p className="leading-relaxed text-red-800">{errorMessage}</p>

            {(errorMessage.includes('expired') || errorMessage.includes('tampered') || errorMessage.includes('PIN')) && (
              <div className="pt-2">
                <Link href={`/m/${token}`}>
                  <Button variant="outline" size="sm" className="text-xs font-bold bg-white text-zinc-950 border-red-300">
                    Verify Table Again →
                  </Button>
                </Link>
              </div>
            )}
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
            <span>Table Status:</span>
            {isTableAccessVerified(state.confirmedTable) ? (
              <Badge variant="success">📍 Table Verified ({state.confirmedTable!.tableName})</Badge>
            ) : (
              <Badge variant="warning">No Valid Table Verification</Badge>
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

          {/* Customer Account Sign-In Card if required by venue security */}
          {securitySettings?.require_customer_account && !isLoggedIn && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Sign-in Required by Venue
                  </h3>
                  <p className="text-[11px] text-amber-800 mt-0.5 font-medium leading-relaxed">
                    This venue requires a customer account before placing an order. Sign in to continue.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/login?redirectTo=${encodeURIComponent(`/m/${token}/checkout`)}`}
                  className="w-1/2 text-center text-xs font-extrabold py-3 rounded-xl bg-amber-900 hover:bg-amber-950 text-white shadow-xs"
                >
                  Sign In to Order
                </Link>
                <Link
                  href={`/register?redirectTo=${encodeURIComponent(`/m/${token}/checkout`)}`}
                  className="w-1/2 text-center text-xs font-extrabold py-3 rounded-xl bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 shadow-xs"
                >
                  Create Account
                </Link>
              </div>
            </div>
          )}

          {/* Geolocation Verification Card if required by venue security */}
          {securitySettings?.require_location_verification && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-950">
                    Location Verification Required
                  </h3>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    This venue requires device location verification to ensure you are physically present at the venue.
                  </p>
                </div>
              </div>

              {locationState.status === 'success' ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 p-3 rounded-xl border border-emerald-300">
                  <span>✅</span>
                  <span>Location Verified Successfully</span>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={handleVerifyLocation}
                  disabled={locationState.status === 'loading'}
                  className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
                >
                  {locationState.status === 'loading' ? 'Verifying Device Location...' : '📍 Verify My Location'}
                </Button>
              )}

              {locationState.errorMessage && (
                <div className="p-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-medium space-y-1">
                  <div className="font-bold">⚠️ Location Check Notice</div>
                  <p>{locationState.errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selection Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                Payment Method
              </h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                Select your preferred payment method enabled by this venue
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {activeMethods.map((m) => {
                const info = PAYMENT_METHOD_MAP[m.method] || {
                  icon: '💳',
                  title: m.display_name || m.method,
                  description: m.instructions || 'Pay at venue',
                  enumValue: 'pay_at_counter',
                };

                const isSelected = paymentMethod === info.enumValue;

                return (
                  <button
                    key={m.method}
                    type="button"
                    onClick={() => setPaymentMethod(info.enumValue)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between touch-manipulation ${
                      isSelected
                        ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm ring-1 ring-zinc-950'
                        : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{info.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold">{m.display_name || info.title}</span>
                        </div>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            isSelected ? 'text-zinc-300' : 'text-zinc-500'
                          }`}
                        >
                          {m.instructions || info.description}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-white bg-white'
                          : 'border-zinc-300 bg-transparent'
                      }`}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-zinc-950" />}
                    </div>
                  </button>
                );
              })}
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
                <span>Subtotal</span>
                <span className="font-mono font-bold">{formatCurrency(state.subtotalCents, state.currency)}</span>
              </div>
              {state.selectedReward && (
                <>
                  <div className="flex justify-between text-xs text-emerald-600 font-bold">
                    <span>Reward — {state.selectedReward.title}</span>
                    <span className="font-mono">
                      -{formatCurrency(
                        calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines),
                        state.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-amber-700 italic">
                    <span>Points to redeem</span>
                    <span className="font-mono font-bold">{state.selectedReward.pointsRequired} pts</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-base font-black text-zinc-950 pt-2 border-t border-zinc-100">
                <span>Total Amount</span>
                <span>
                  {formatCurrency(
                    Math.max(
                      0,
                      state.subtotalCents -
                        calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines)
                    ),
                    state.currency
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {(() => {
              const isAccountGateBlocked = Boolean(securitySettings?.require_customer_account) && !isLoggedIn;
              const isLocationGateBlocked = Boolean(securitySettings?.require_location_verification) && locationState.status !== 'success';
              const isSubmitDisabled = isSubmitting || isAccountGateBlocked || isLocationGateBlocked;

              let buttonText = `Confirm & Submit Order (${formatCurrency(
                Math.max(
                  0,
                  state.subtotalCents -
                    calculateRewardDiscountCents(state.selectedReward, state.subtotalCents, state.lines)
                ),
                state.currency
              )})`;

              if (isSubmitting) buttonText = 'Placing Order...';
              else if (isAccountGateBlocked) buttonText = '🔐 Sign in Required to Place Order';
              else if (isLocationGateBlocked) buttonText = '📍 Verify Device Location First';

              return (
                <Button
                  type="submit"
                  className={`w-full text-sm font-extrabold py-3.5 shadow-md ${
                    isSubmitDisabled
                      ? 'bg-zinc-300 text-zinc-600 cursor-not-allowed border-zinc-300 shadow-none'
                      : 'bg-zinc-950 hover:bg-zinc-800 text-white'
                  }`}
                  disabled={isSubmitDisabled}
                >
                  {buttonText}
                </Button>
              );
            })()}

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
