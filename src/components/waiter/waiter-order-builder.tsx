'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWaiterOrderAction } from '@/server/actions/waiter-order';

export interface WaiterAreaOption {
  id: string;
  name: string;
}

export interface WaiterTableOption {
  id: string;
  name: string;
  tableNumber: number | null;
  serviceAreaId: string;
}

export interface WaiterMenuItem {
  id: string;
  name: string;
  price: number;
  categoryName: string;
  description?: string | null;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

interface WaiterOrderBuilderProps {
  areas: WaiterAreaOption[];
  tables: WaiterTableOption[];
  menuItems: WaiterMenuItem[];
  activeBranchName: string;
}

export function WaiterOrderBuilder({
  areas,
  tables,
  menuItems,
  activeBranchName,
}: WaiterOrderBuilderProps) {
  const router = useRouter();
  const [selectedAreaId, setSelectedAreaId] = useState<string>(areas[0]?.id || '');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  const [step, setStep] = useState<'table' | 'menu' | 'cart'>('table');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredTables = tables.filter((t) => !selectedAreaId || t.serviceAreaId === selectedAreaId);
  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  const categories = Array.from(new Set(menuItems.map((m) => m.categoryName)));
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || '');

  const filteredMenuItems = menuItems.filter(
    (m) => !activeCategory || m.categoryName === activeCategory
  );

  const addToCart = (item: WaiterMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.menuItemId === menuItemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : null;
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmitOrder = async () => {
    if (!selectedTableId || cart.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await createWaiterOrderAction({
        tableId: selectedTableId,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        notes: orderNotes,
      });

      if (res.success) {
        setSuccessMsg(`Order #${res.orderNumber} created successfully!`);
        setCart([]);
        setOrderNotes('');
        setTimeout(() => {
          router.push('/dashboard/waiter');
          router.refresh();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Failed to place order.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 p-3 sm:p-6 text-zinc-950 max-w-2xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-zinc-950">New Staff Order</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 border border-zinc-200">
              📍 {activeBranchName}
            </span>
          </div>
          <p className="text-xs text-zinc-500">Fast mobile order entry for active tables</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/waiter')}
          className="text-xs font-bold text-zinc-600 hover:text-zinc-950 px-3 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200"
        >
          Cancel
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          ✅ {successMsg}
        </div>
      )}

      {/* Step Progress Pills */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <button
          onClick={() => setStep('table')}
          className={`py-2 rounded-lg border transition-all ${
            step === 'table'
              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
              : 'bg-white text-zinc-700 border-zinc-200'
          }`}
        >
          1. Table
        </button>
        <button
          onClick={() => selectedTableId && setStep('menu')}
          disabled={!selectedTableId}
          className={`py-2 rounded-lg border transition-all ${
            step === 'menu'
              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
              : 'bg-white text-zinc-700 border-zinc-200 disabled:opacity-40'
          }`}
        >
          2. Menu ({cart.length})
        </button>
        <button
          onClick={() => cart.length > 0 && setStep('cart')}
          disabled={cart.length === 0}
          className={`py-2 rounded-lg border transition-all ${
            step === 'cart'
              ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
              : 'bg-white text-zinc-700 border-zinc-200 disabled:opacity-40'
          }`}
        >
          3. Review
        </button>
      </div>

      {/* STEP 1: Area & Table Selector */}
      {step === 'table' && (
        <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs">
          {/* Area Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-zinc-700 mb-2">
              Select Service Area
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => {
                    setSelectedAreaId(area.id);
                    setSelectedTableId('');
                  }}
                  className={`p-3 rounded-lg border text-left font-bold text-xs transition-all min-h-[48px] ${
                    selectedAreaId === area.id
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                      : 'bg-zinc-50 text-zinc-900 border-zinc-200 hover:bg-zinc-100'
                  }`}
                >
                  📍 {area.name}
                </button>
              ))}
            </div>
          </div>

          {/* Table Selector */}
          <div>
            <label className="block text-xs font-extrabold uppercase text-zinc-700 mb-2">
              Select Table ({selectedArea?.name || 'All Areas'})
            </label>
            {filteredTables.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-300 rounded-lg">
                No tables found in this service area.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredTables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTableId(t.id);
                      setStep('menu');
                    }}
                    className={`p-4 rounded-xl border text-center font-extrabold text-sm transition-all min-h-[54px] flex flex-col justify-center items-center ${
                      selectedTableId === t.id
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-zinc-950 border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <div>{t.name}</div>
                    {t.tableNumber && <div className="text-[10px] font-normal opacity-80">#{t.tableNumber}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Menu Browser */}
      {step === 'menu' && (
        <div className="space-y-4">
          {/* Selected Context Banner */}
          <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500">Selected Table:</span>{' '}
              <strong className="text-zinc-950 font-bold">{selectedTable?.name}</strong>{' '}
              <span className="text-zinc-400">({selectedArea?.name})</span>
            </div>
            <button
              onClick={() => setStep('table')}
              className="text-[11px] font-bold text-zinc-900 underline"
            >
              Change Table
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                  activeCategory === cat
                    ? 'bg-zinc-950 text-white'
                    : 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Items List */}
          <div className="grid grid-cols-1 gap-2">
            {filteredMenuItems.map((item) => {
              const inCart = cart.find((c) => c.menuItemId === item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm text-zinc-950">{item.name}</div>
                    {item.description && (
                      <div className="text-xs text-zinc-500 line-clamp-1">{item.description}</div>
                    )}
                    <div className="font-mono text-xs font-extrabold text-zinc-900 mt-0.5">
                      LKR {item.price.toLocaleString()}
                    </div>
                  </div>

                  {inCart ? (
                    <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-md bg-white text-zinc-900 font-extrabold flex items-center justify-center border border-zinc-200"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs px-1">{inCart.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-md bg-zinc-950 text-white font-extrabold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="px-3 py-2 rounded-lg text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 shrink-0"
                    >
                      + Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Cart Bar */}
          {cart.length > 0 && (
            <div className="sticky bottom-4 z-40 bg-zinc-950 text-white p-4 rounded-xl shadow-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400 font-medium">{cart.length} items selected</div>
                <div className="text-base font-extrabold">LKR {totalAmount.toLocaleString()}</div>
              </div>
              <button
                onClick={() => setStep('cart')}
                className="px-5 py-2.5 rounded-lg text-xs font-extrabold bg-white text-zinc-950 hover:bg-zinc-100"
              >
                Review Order →
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Cart Review & Submit */}
      {step === 'cart' && (
        <div className="space-y-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
          <div className="border-b border-zinc-100 pb-3">
            <h2 className="text-base font-extrabold text-zinc-950">Review Order Details</h2>
            <p className="text-xs text-zinc-500">
              Table: <strong className="text-zinc-900">{selectedTable?.name}</strong> ({selectedArea?.name})
            </p>
          </div>

          <div className="space-y-2">
            {cart.map((item) => (
              <div
                key={item.menuItemId}
                className="flex items-center justify-between py-2 border-b border-zinc-100 text-xs"
              >
                <div>
                  <div className="font-bold text-zinc-900">{item.name}</div>
                  <div className="text-zinc-500 font-mono">
                    LKR {item.price.toLocaleString()} × {item.quantity}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono font-extrabold text-zinc-950">
                    LKR {(item.price * item.quantity).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.menuItemId, -1)}
                      className="w-6 h-6 rounded bg-zinc-100 font-bold text-zinc-700"
                    >
                      -
                    </button>
                    <button
                      onClick={() => updateQuantity(item.menuItemId, 1)}
                      className="w-6 h-6 rounded bg-zinc-100 font-bold text-zinc-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-sm font-extrabold text-zinc-950">
            <span>Total Amount</span>
            <span className="font-mono text-base">LKR {totalAmount.toLocaleString()}</span>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-zinc-700 mb-1">
              Order Notes / Special Requests
            </label>
            <input
              type="text"
              placeholder="e.g. Less spicy, extra ice, separate cutlery"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-xs focus:outline-hidden focus:border-zinc-950"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <button
              onClick={() => setStep('menu')}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            >
              ← Add More Items
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={isPending || cart.length === 0}
              className="flex-1 py-2.5 rounded-lg text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isPending ? 'Placing Order...' : 'Confirm & Send to Kitchen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
