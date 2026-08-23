'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createWaiterOrderAction } from '@/server/actions/waiter-order';
import { BranchMenuCatalog, CatalogMenuItem } from '@/server/services/menu-catalog.service';
import { MenuBrandHeader } from '@/components/menu/menu-brand-header';
import { MenuSearch } from '@/components/menu/menu-search';
import { CategoryTabs } from '@/components/menu/category-tabs';
import { MenuItemCard } from '@/components/menu/menu-item-card';
import { MenuItemDetails } from '@/components/menu/menu-item-details';
import { QuantityStepper } from '@/components/guest/quantity-stepper';
import { formatCurrency, calculateLineUnitPriceCents } from '@/features/cart/cart-calculations';
import {
  saveWaiterCartToStorage,
  loadWaiterCartFromStorage,
  clearWaiterCartStorage,
} from '@/features/cart/waiter-cart-storage';

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

interface WaiterCartLine {
  lineId: string;
  menuItemId: string;
  itemName: string;
  imageUrl?: string | null;
  quantity: number;
  basePriceCents: number;
  selectedModifiers: Array<{
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    additionalPriceCents: number;
  }>;
  specialInstructions?: string;
  unitPriceCents: number;
  totalPriceCents: number;
}

interface WaiterOrderBuilderProps {
  areas: WaiterAreaOption[];
  tables: WaiterTableOption[];
  catalog: BranchMenuCatalog;
  activeBranchName: string;
  waiterName?: string;
  businessId?: string;
  activeBranchId?: string;
  userId?: string;
  canCreateOrders?: boolean;
}

export function WaiterOrderBuilder({
  areas,
  tables,
  catalog,
  activeBranchName,
  waiterName = 'Staff',
  businessId,
  activeBranchId,
  userId,
  canCreateOrders = true,
}: WaiterOrderBuilderProps) {
  const router = useRouter();
  const currency = catalog.branch.currency || catalog.business.currency || 'USD';
  const effectiveBizId = businessId || catalog.business.id;
  const effectiveBranchId = activeBranchId || catalog.branch.id;

  const [selectedAreaId, setSelectedAreaId] = useState<string>(areas[0]?.id || '');
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [cart, setCart] = useState<WaiterCartLine[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  const [step, setStep] = useState<'table' | 'menu' | 'cart'>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<CatalogMenuItem | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [branchNotice, setBranchNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const prevBranchIdRef = React.useRef<string>(effectiveBranchId);

  // Restore saved draft from storage for current branch on mount
  useEffect(() => {
    const loaded = loadWaiterCartFromStorage(effectiveBizId, effectiveBranchId, userId);
    if (loaded) {
      const validCart = loaded.cart.filter((c) =>
        catalog.items.some((i) => i.id === c.menuItemId)
      );
      const validTable = tables.find((t) => t.id === loaded.selectedTableId);
      const validArea = areas.find((a) => a.id === loaded.selectedAreaId);

      queueMicrotask(() => {
        setCart(validCart);
        if (validTable) setSelectedTableId(validTable.id);
        if (validArea) setSelectedAreaId(validArea.id);
        setOrderNotes(loaded.orderNotes || '');
      });
    }
  }, [effectiveBizId, effectiveBranchId, userId, catalog.items, tables, areas]);

  // Detect branch switch and reset client state safely
  useEffect(() => {
    if (prevBranchIdRef.current !== effectiveBranchId) {
      clearWaiterCartStorage(effectiveBizId, prevBranchIdRef.current, userId);
      prevBranchIdRef.current = effectiveBranchId;
      setCart([]);
      setSelectedTableId('');
      setSelectedAreaId(areas[0]?.id || '');
      setOrderNotes('');
      setStep('table');
      setSearchQuery('');
      setSelectedCategory('all');
      setBranchNotice('Branch changed. Your previous waiter order draft was cleared.');
    }
  }, [effectiveBranchId, effectiveBizId, userId, areas]);

  // Persist draft on state changes
  useEffect(() => {
    if (cart.length > 0 || selectedTableId || orderNotes) {
      saveWaiterCartToStorage({
        businessId: effectiveBizId,
        branchId: effectiveBranchId,
        userId,
        selectedAreaId,
        selectedTableId,
        orderNotes,
        cart,
        updatedAt: Date.now(),
      });
    } else {
      clearWaiterCartStorage(effectiveBizId, effectiveBranchId, userId);
    }
  }, [effectiveBizId, effectiveBranchId, userId, selectedAreaId, selectedTableId, orderNotes, cart]);

  const filteredTables = tables.filter((t) => !selectedAreaId || t.serviceAreaId === selectedAreaId);
  const selectedTable = tables.find((t) => t.id === selectedTableId);
  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  const filteredMenuItems = catalog.items.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleGoToReview = () => {
    const validCart = cart.filter((c) => catalog.items.some((i) => i.id === c.menuItemId));
    if (validCart.length !== cart.length) {
      setCart(validCart);
      setErrorMsg('Some items in your cart were no longer available in this branch and were removed.');
    }
    if (validCart.length > 0) {
      setStep('cart');
    } else {
      setStep('menu');
    }
  };

  const handleAddToCart = (configuredItem: {
    menuItemId: string;
    itemName: string;
    imageUrl?: string | null;
    quantity: number;
    basePriceCents: number;
    selectedModifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      additionalPriceCents: number;
    }>;
    specialInstructions?: string;
  }) => {
    const unitPriceCents = calculateLineUnitPriceCents(
      configuredItem.basePriceCents,
      configuredItem.selectedModifiers
    );
    const totalPriceCents = unitPriceCents * configuredItem.quantity;
    const lineId = `${configuredItem.menuItemId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setCart((prev) => [
      ...prev,
      {
        lineId,
        menuItemId: configuredItem.menuItemId,
        itemName: configuredItem.itemName,
        imageUrl: configuredItem.imageUrl,
        quantity: configuredItem.quantity,
        basePriceCents: configuredItem.basePriceCents,
        selectedModifiers: configuredItem.selectedModifiers,
        specialInstructions: configuredItem.specialInstructions,
        unitPriceCents,
        totalPriceCents,
      },
    ]);

    setSelectedItem(null);
  };

  const updateLineQuantity = (lineId: string, newQty: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.lineId === lineId) {
            if (newQty <= 0) return null;
            return {
              ...line,
              quantity: newQty,
              totalPriceCents: line.unitPriceCents * newQty,
            };
          }
          return line;
        })
        .filter(Boolean) as WaiterCartLine[]
    );
  };

  const totalCartCents = cart.reduce((sum, item) => sum + item.totalPriceCents, 0);

  const handleSubmitOrder = async () => {
    if (!selectedTableId || cart.length === 0) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const orderItemsInput = cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        selectedModifiers: c.selectedModifiers.map((m) => ({
          groupId: m.groupId,
          optionId: m.optionId,
          nameSnapshot: m.optionName,
          priceSnapshot: m.additionalPriceCents / 100,
        })),
        notes: c.specialInstructions,
      }));

      const res = await createWaiterOrderAction({
        tableId: selectedTableId,
        items: orderItemsInput,
        notes: orderNotes,
      });

      if (res.success) {
        setSuccessMsg(`Order #${res.orderNumber} created successfully!`);
        clearWaiterCartStorage(effectiveBizId, effectiveBranchId, userId);
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
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-950 pb-20">
      {/* Venue & Waiter Header */}
      <MenuBrandHeader
        logoUrl={catalog.business.logo_url}
        businessName={catalog.business.name}
        branchName={activeBranchName || catalog.branch.name}
        address={catalog.branch.city || catalog.branch.address_line1 || undefined}
        waiterIdentity={`Serving as: ${waiterName}`}
        rightActions={
          <button
            onClick={() => router.push('/dashboard/waiter')}
            className="text-xs font-bold text-zinc-700 hover:text-zinc-950 px-3 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200"
          >
            Cancel
          </button>
        }
      />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Feedback Alerts */}
        {branchNotice && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between gap-2">
            <div>ℹ️ {branchNotice}</div>
            <button
              type="button"
              onClick={() => setBranchNotice(null)}
              className="text-xs font-bold text-amber-700 hover:text-amber-950 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              ⚠️ {errorMsg}
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                router.refresh();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-extrabold text-[11px] shrink-0 border border-red-300"
            >
              🔄 Refresh Menu
            </button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            ✅ {successMsg}
          </div>
        )}

        {/* Step Progress Bar */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <button
            type="button"
            onClick={() => setStep('table')}
            className={`py-2 rounded-xl border transition-all ${
              step === 'table'
                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                : 'bg-white text-zinc-700 border-zinc-200'
            }`}
          >
            1. Table {selectedTable ? `(${selectedTable.name})` : ''}
          </button>
          <button
            type="button"
            onClick={() => selectedTableId && setStep('menu')}
            disabled={!selectedTableId}
            className={`py-2 rounded-xl border transition-all ${
              step === 'menu'
                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                : 'bg-white text-zinc-700 border-zinc-200 disabled:opacity-40'
            }`}
          >
            2. Menu ({cart.length})
          </button>
          <button
            type="button"
            onClick={() => cart.length > 0 && handleGoToReview()}
            disabled={cart.length === 0}
            className={`py-2 rounded-xl border transition-all ${
              step === 'cart'
                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                : 'bg-white text-zinc-700 border-zinc-200 disabled:opacity-40'
            }`}
          >
            3. Review
          </button>
        </div>

        {/* STEP 1: Area & Table Selection */}
        {step === 'table' && (
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
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
                    className={`p-3 rounded-xl border text-left font-bold text-xs transition-all min-h-[48px] ${
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

            <div>
              <label className="block text-xs font-extrabold uppercase text-zinc-700 mb-2">
                Select Dining Table ({selectedArea?.name || 'All Areas'})
              </label>
              {filteredTables.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-300 rounded-xl">
                  No active dining tables found in this service area.
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
                      className={`p-4 rounded-xl border text-center font-extrabold text-sm transition-all min-h-[56px] flex flex-col justify-center items-center ${
                        selectedTableId === t.id
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-zinc-950 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div>{t.name}</div>
                      {t.tableNumber && (
                        <div className="text-[10px] font-normal opacity-80">#{t.tableNumber}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Unified Menu Browser */}
        {step === 'menu' && (
          <div className="space-y-4">
            {/* Selected Context Banner */}
            <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-2xs flex items-center justify-between text-xs">
              <div>
                <span className="text-zinc-500">Selected Table:</span>{' '}
                <strong className="text-zinc-950 font-extrabold">{selectedTable?.name}</strong>{' '}
                <span className="text-zinc-400">({selectedArea?.name})</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('table')}
                className="text-xs font-bold text-zinc-900 underline"
              >
                Change Table
              </button>
            </div>

            {/* Search Input */}
            <MenuSearch value={searchQuery} onChange={setSearchQuery} />

            {/* Category Tabs */}
            <CategoryTabs
              categories={catalog.categories}
              items={catalog.items}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />

            {/* Menu Items Grid/List */}
            <div className="space-y-3 pt-1">
              {filteredMenuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  onClick={() => setSelectedItem(item)}
                />
              ))}

              {filteredMenuItems.length === 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500">
                  No menu items found matching search or category.
                </div>
              )}
            </div>

            {/* Sticky Bottom Cart Review Bar */}
            {cart.length > 0 && (
              <div className="sticky bottom-4 z-40 bg-zinc-950 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between border border-zinc-800">
                <div>
                  <div className="text-xs text-zinc-400 font-medium">
                    {cart.reduce((sum, c) => sum + c.quantity, 0)} items in staff cart
                  </div>
                  <div className="text-base font-extrabold">
                    {formatCurrency(totalCartCents, currency)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleGoToReview()}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-white text-zinc-950 hover:bg-zinc-100 shadow-md"
                >
                  Review Order →
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Review Order & Submit */}
        {step === 'cart' && (
          <div className="space-y-4 bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3">
              <h2 className="text-base font-extrabold text-zinc-950">Review Staff Order</h2>
              <p className="text-xs text-zinc-500">
                Table: <strong className="text-zinc-900">{selectedTable?.name}</strong> ({selectedArea?.name})
              </p>
            </div>

            <div className="space-y-3">
              {cart.map((line) => (
                <div
                  key={line.lineId}
                  className="flex items-start justify-between py-2 border-b border-zinc-100 text-xs gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-zinc-900">{line.itemName}</div>
                    {line.selectedModifiers && line.selectedModifiers.length > 0 && (
                      <div className="text-[11px] text-zinc-500">
                        {line.selectedModifiers.map((m) => m.optionName).join(', ')}
                      </div>
                    )}
                    {line.specialInstructions && (
                      <div className="text-[11px] italic text-amber-700">
                        Note: {line.specialInstructions}
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-zinc-500">
                      {formatCurrency(line.unitPriceCents, currency)} × {line.quantity}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="font-mono font-black text-zinc-950">
                      {formatCurrency(line.totalPriceCents, currency)}
                    </div>
                    <QuantityStepper
                      quantity={line.quantity}
                      min={0}
                      max={99}
                      onChange={(q) => updateLineQuantity(line.lineId, q)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-200 flex justify-between items-center text-sm font-extrabold text-zinc-950">
              <span>Order Subtotal</span>
              <span className="font-mono text-base">{formatCurrency(totalCartCents, currency)}</span>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-zinc-700 mb-1">
                Kitchen / Staff Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Rush order, serve starters first..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-xs text-zinc-950 focus:outline-none focus:border-zinc-950"
              />
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="flex-1 py-3 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              >
                ← Add More Items
              </button>
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={isPending || cart.length === 0 || !canCreateOrders}
                className="flex-1 py-3 rounded-xl text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50 shadow-md"
              >
                {!canCreateOrders ? 'Order Creation Disabled' : isPending ? 'Placing Order...' : 'Confirm & Send to Kitchen'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Item Details & Modifiers Sheet */}
      {selectedItem && (
        <MenuItemDetails
          item={selectedItem}
          currency={currency}
          onClose={() => setSelectedItem(null)}
          onAddToCart={handleAddToCart}
        />
      )}
    </div>
  );
}
