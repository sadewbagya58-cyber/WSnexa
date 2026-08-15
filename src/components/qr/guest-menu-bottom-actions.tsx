'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/features/cart/cart-context';
import { formatCurrency } from '@/features/cart/cart-calculations';
import {
  getActiveOrdersFromStorage,
  SafeActiveOrderRecord,
} from '@/features/cart/active-order-storage';

interface GuestMenuBottomActionsProps {
  branchId: string;
  token: string;
  currency: string;
  onOpenCart: () => void;
  onStateChange?: (state: 'none' | 'cart_only' | 'order_only' | 'dual') => void;
}

export function GuestMenuBottomActions({
  branchId,
  token,
  currency,
  onOpenCart,
  onStateChange,
}: GuestMenuBottomActionsProps) {
  const { state } = useCart();
  const subtotalCents = state.subtotalCents || 0;
  const totalCartQuantity = state.isHydrated ? state.totalQuantity : 0;
  const hasCartItems = totalCartQuantity > 0;

  const [activeOrders, setActiveOrders] = useState<SafeActiveOrderRecord[]>([]);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  useEffect(() => {
    const handleStorage = () => {
      const orders = getActiveOrdersFromStorage(branchId);
      // Explicit deduplication by stable orderId
      const uniqueOrdersMap = new Map<string, SafeActiveOrderRecord>();
      for (const ord of orders) {
        if (ord && ord.orderId && !uniqueOrdersMap.has(ord.orderId)) {
          uniqueOrdersMap.set(ord.orderId, ord);
        }
      }
      setActiveOrders(Array.from(uniqueOrdersMap.values()));
    };

    handleStorage();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [branchId]);

  const hasActiveOrders = activeOrders.length > 0;
  const primaryOrder = hasActiveOrders ? activeOrders[0] : null;

  // Determine Canonical 4-State Behavior
  let currentState: 'none' | 'cart_only' | 'order_only' | 'dual' = 'none';
  if (!hasActiveOrders && !hasCartItems) {
    currentState = 'none';
  } else if (hasCartItems && !hasActiveOrders) {
    currentState = 'cart_only';
  } else if (hasActiveOrders && !hasCartItems) {
    currentState = 'order_only';
  } else if (hasActiveOrders && hasCartItems) {
    currentState = 'dual';
  }

  // Notify parent component of state change to adapt scroll padding dynamically
  useEffect(() => {
    if (onStateChange) {
      onStateChange(currentState);
    }
  }, [currentState, onStateChange]);

  if (currentState === 'none') {
    return null;
  }

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    let classes = 'bg-zinc-100 text-zinc-700 border-zinc-200';

    if (s === 'pending') {
      classes = 'bg-amber-50 text-amber-900 border-amber-300 font-extrabold';
    } else if (s === 'confirmed' || s === 'accepted') {
      classes = 'bg-blue-50 text-blue-900 border-blue-300 font-extrabold';
    } else if (s === 'preparing') {
      classes = 'bg-orange-50 text-orange-900 border-orange-300 font-extrabold';
    } else if (s === 'ready') {
      classes = 'bg-emerald-50 text-emerald-950 border-emerald-300 font-black';
    } else if (s === 'cancelled' || s === 'rejected') {
      classes = 'bg-red-50 text-red-900 border-red-300 font-extrabold';
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase border ${classes}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 p-3 sm:p-4 pointer-events-none pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div className="max-w-xl mx-auto pointer-events-auto">
          {/* STATE 2: Cart Only */}
          {currentState === 'cart_only' && (
            <div className="rounded-2xl bg-zinc-950 text-white p-3 sm:p-3.5 shadow-2xl border border-zinc-800 backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 text-lg">
                  🛒
                </div>
                <div>
                  <div className="text-xs font-black tracking-tight text-zinc-300 uppercase">
                    New Cart ({totalCartQuantity} {totalCartQuantity === 1 ? 'item' : 'items'})
                  </div>
                  <div className="text-sm font-black font-mono text-white">
                    {formatCurrency(subtotalCents, currency)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenCart}
                className="inline-flex items-center justify-center rounded-xl bg-white text-zinc-950 font-black text-xs px-4 py-2.5 shadow-xs hover:bg-zinc-100 active:scale-95 transition-all min-h-[44px] cursor-pointer touch-manipulation"
              >
                View Cart →
              </button>
            </div>
          )}

          {/* STATE 3: Active Order Only */}
          {currentState === 'order_only' && primaryOrder && (
            <div className="rounded-2xl bg-zinc-950 text-white p-3 sm:p-3.5 shadow-2xl border border-zinc-800 backdrop-blur-md flex items-center justify-between gap-3 animate-in slide-in-from-bottom-4 duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 text-lg border border-emerald-500/30">
                  🛎️
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black tracking-tight text-white truncate">
                      Order {primaryOrder.orderNumberFormatted}
                    </span>
                    {renderStatusBadge(primaryOrder.latestStatus)}
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {primaryOrder.tableName ? `📍 ${primaryOrder.tableName}` : 'Active Order'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeOrders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowOrdersModal(true)}
                    className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-2.5 py-2 min-h-[44px] cursor-pointer"
                    aria-label={`View all ${activeOrders.length} active orders`}
                  >
                    +{activeOrders.length - 1} more
                  </button>
                )}

                <Link
                  href={`/m/${token}/order/${primaryOrder.orderId}?access_token=${primaryOrder.accessToken}`}
                  className="inline-flex items-center justify-center rounded-xl bg-white text-zinc-950 font-black text-xs px-4 py-2.5 shadow-xs hover:bg-zinc-100 active:scale-95 transition-all min-h-[44px] cursor-pointer touch-manipulation"
                >
                  View Status →
                </Link>
              </div>
            </div>
          )}

          {/* STATE 4: Unified Active Order AND New Cart Container */}
          {currentState === 'dual' && primaryOrder && (
            <div className="rounded-2xl bg-zinc-950 text-white shadow-2xl border border-zinc-800 backdrop-blur-md overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
              {/* TOP SECTION: ACTIVE ORDER */}
              <div className="p-3 sm:p-3.5 bg-zinc-900/90 border-b border-zinc-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-base border border-emerald-500/30">
                    🛎️
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        Active Order
                      </span>
                      <span className="text-xs font-black text-white">
                        {primaryOrder.orderNumberFormatted}
                      </span>
                      {renderStatusBadge(primaryOrder.latestStatus)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {activeOrders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowOrdersModal(true)}
                      className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-[11px] px-2 py-1 min-h-[36px] cursor-pointer"
                    >
                      +{activeOrders.length - 1}
                    </button>
                  )}

                  <Link
                    href={`/m/${token}/order/${primaryOrder.orderId}?access_token=${primaryOrder.accessToken}`}
                    className="inline-flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-bold text-xs px-3 py-1.5 min-h-[36px] cursor-pointer transition-all"
                  >
                    View Status →
                  </Link>
                </div>
              </div>

              {/* BOTTOM SECTION: NEW CART */}
              <div className="p-3 sm:p-3.5 bg-zinc-950 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-base">
                    🛒
                  </div>
                  <div>
                    <div className="text-[10px] font-black tracking-wider text-zinc-400 uppercase">
                      New Cart ({totalCartQuantity} {totalCartQuantity === 1 ? 'item' : 'items'})
                    </div>
                    <div className="text-sm font-black font-mono text-white">
                      {formatCurrency(subtotalCents, currency)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenCart}
                  className="inline-flex items-center justify-center rounded-xl bg-white text-zinc-950 font-black text-xs px-4 py-2.5 shadow-xs hover:bg-zinc-100 active:scale-95 transition-all min-h-[44px] cursor-pointer touch-manipulation"
                >
                  View Cart →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multiple Active Orders Modal */}
      {showOrdersModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-sm font-black text-zinc-950">Active Orders ({activeOrders.length})</h3>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 text-sm font-bold min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                onClick={() => setShowOrdersModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {activeOrders.map((rec) => (
                <div
                  key={rec.orderId}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-zinc-950">
                        {rec.orderNumberFormatted}
                      </span>
                      {renderStatusBadge(rec.latestStatus)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 font-semibold">
                      {rec.tableName ? `📍 ${rec.tableName}` : 'Direct Order'} •{' '}
                      {new Date(rec.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <Link
                    href={`/m/${token}/order/${rec.orderId}?access_token=${rec.accessToken}`}
                    onClick={() => setShowOrdersModal(false)}
                    className="inline-flex items-center justify-center rounded-xl bg-zinc-950 text-white font-extrabold text-xs px-3.5 py-2 shadow-xs hover:bg-zinc-800 min-h-[44px] cursor-pointer"
                  >
                    View Status →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
