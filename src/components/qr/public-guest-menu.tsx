'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { verifyTableAccessAction } from '@/server/actions/table';
import { useCart } from '@/features/cart/cart-context';
import { ItemDetailSheet } from '../guest/item-detail-sheet';
import { FloatingCartBar } from '../guest/floating-cart-bar';
import { CartDrawer } from '../guest/cart-drawer';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { CartLine, isTableAccessVerified } from '@/features/cart/cart-types';

interface PublicGuestMenuProps {
  token: string;
  business: {
    id: string;
    name: string;
    logo_url: string | null;
    description: string | null;
    currency: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    require_table_selection: boolean;
    require_table_pin: boolean;
    table_pin_length: number;
    currency?: string;
  };
  service_areas: Array<{
    id: string;
    name: string;
    code: string;
    display_order: number;
  }>;
  dining_tables: Array<{
    id: string;
    name: string;
    code: string;
    table_number: number | null;
    capacity: number;
    service_area_id: string;
    has_pin: boolean;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    display_order: number;
  }>;
  items: Array<{
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number;
    currency: string;
    availability_status: string;
    is_featured: boolean;
    primary_image_url: string | null;
    display_order: number;
    modifier_groups?: Array<{
      id: string;
      name: string;
      description: string | null;
      selection_type: string;
      min_selections: number;
      max_selections: number;
      is_required: boolean;
      options: Array<{
        id: string;
        name: string;
        price_cents: number;
        is_available: boolean;
      }>;
    }>;
  }>;
}

export const PublicGuestMenu: React.FC<PublicGuestMenuProps> = ({
  token,
  business,
  branch,
  service_areas,
  dining_tables,
  categories,
  items,
}) => {
  const { state, addLine, editLine, setConfirmedTable } = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<(typeof items)[0] | null>(null);
  const [editingCartLine, setEditingCartLine] = useState<{
    lineId: string;
    quantity: number;
    selectedModifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      additionalPriceCents: number;
    }>;
    specialInstructions?: string;
  } | null>(null);

  // Cart Drawer & Table Modal state
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [tableModalOpen, setTableModalOpen] = useState<boolean>(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category_id === selectedCategory;
  });

  const handleConfirmTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableId) {
      setVerifyError('Please select a dining table');
      return;
    }

    if (branch.require_table_pin && pinInput.length !== (branch.table_pin_length || 4)) {
      setVerifyError(`Please enter your ${branch.table_pin_length || 4}-digit Table PIN`);
      return;
    }

    setVerifying(true);
    setVerifyError(null);

    const res = await verifyTableAccessAction(branch.id, selectedTableId, pinInput);

    setVerifying(false);

    if (res.success && res.data?.table) {
      setConfirmedTable({
        branchId: branch.id,
        tableId: res.data.table.id,
        tableName: res.data.table.name,
        tableCode: res.data.table.code,
        signedTableAccessProof: res.data.signedTableAccessProof,
        verifiedAt: res.data.verifiedAt || new Date().toISOString(),
        expiresAt: res.data.expiresAt,
      });
      setTableModalOpen(false);
      setPinInput('');
    } else {
      setVerifyError(res.message || 'Table verification failed');
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
    editingLineId?: string;
  }) => {
    if (configuredItem.editingLineId) {
      editLine(
        configuredItem.editingLineId,
        configuredItem.quantity,
        configuredItem.selectedModifiers,
        configuredItem.specialInstructions
      );
    } else {
      addLine({
        menuItemId: configuredItem.menuItemId,
        itemName: configuredItem.itemName,
        imageUrl: configuredItem.imageUrl,
        quantity: configuredItem.quantity,
        basePriceCents: configuredItem.basePriceCents,
        selectedModifiers: configuredItem.selectedModifiers,
        specialInstructions: configuredItem.specialInstructions,
      });
    }

    setSelectedItem(null);
    setEditingCartLine(null);
  };

  const handleEditCartLine = (line: CartLine) => {
    const itemCatalog = items.find((i) => i.id === line.menuItemId);
    if (!itemCatalog) {
      alert('This item is no longer available in the branch menu.');
      return;
    }

    setEditingCartLine({
      lineId: line.lineId,
      quantity: line.quantity,
      selectedModifiers: line.selectedModifiers,
      specialInstructions: line.specialInstructions,
    });
    setSelectedItem(itemCatalog);
    setCartDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-24">
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200 px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {business.name}
            </span>
            <h1 className="text-base font-black tracking-tight text-zinc-950 flex items-center gap-2">
              {branch.name}
              <Badge variant="neutral" className="text-[10px] py-0">
                Digital Menu
              </Badge>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Table Selection Status Pill */}
            {branch.require_table_selection && (
              <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-200 transition-all"
              >
                <span>📍</span>
                {isTableAccessVerified(state.confirmedTable) ? (
                  <span className="text-emerald-800 font-extrabold">{state.confirmedTable!.tableName}</span>
                ) : (
                  <span className="text-zinc-600">Select Table</span>
                )}
              </button>
            )}

            {/* Cart Icon Action Button */}
            {state.isHydrated && state.totalQuantity > 0 && (
              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="flex items-center justify-center rounded-full bg-zinc-950 p-2 text-white shadow-xs hover:bg-zinc-800 transition-all"
                aria-label="Open cart"
              >
                🛒
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        {/* Table Selection Prompt Banner */}
        {branch.require_table_selection && !isTableAccessVerified(state.confirmedTable) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between text-xs text-amber-900">
            <div>
              <span className="font-bold">Select your Table Number</span>
              <p className="text-[11px] text-amber-800">
                Please select your table before ordering {branch.require_table_pin && 'with PIN verification'}.
              </p>
            </div>
            <Button size="sm" onClick={() => setTableModalOpen(true)}>
              Select Table
            </Button>
          </div>
        )}

        {/* Categories Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
              selectedCategory === 'all'
                ? 'bg-zinc-950 text-white shadow-xs'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            All Items ({items.length})
          </button>
          {categories.map((cat) => {
            const count = items.filter((i) => i.category_id === cat.id).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>

        {/* Menu Items List */}
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isOutOfStock = item.availability_status === 'out_of_stock';

            return (
              <div
                key={item.id}
                onClick={() => {
                  setEditingCartLine(null);
                  setSelectedItem(item);
                }}
                className="group cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-400 hover:shadow-xs transition-all flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-zinc-950 group-hover:text-zinc-900">
                      {item.name}
                    </h3>
                    {item.is_featured && <Badge variant="warning">Featured</Badge>}
                    {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
                  </div>
                  {item.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  <div className="pt-1 text-sm font-black text-zinc-950">
                    {formatCurrency(item.price_cents, item.currency)}
                  </div>
                </div>

                {item.primary_image_url ? (
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.primary_image_url}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center text-xl text-zinc-400">
                    🍽️
                  </div>
                )}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500">
              No items available in this category.
            </div>
          )}
        </div>
      </main>

      {/* Item Details & Modifiers Sheet */}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          currency={branch.currency || business.currency || 'USD'}
          editingLine={editingCartLine}
          onClose={() => {
            setSelectedItem(null);
            setEditingCartLine(null);
          }}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Sticky Floating Mobile Cart Bar */}
      <FloatingCartBar onOpenCart={() => setCartDrawerOpen(true)} />

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        token={token}
        requireTableSelection={branch.require_table_selection}
        requireTablePin={branch.require_table_pin}
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        onSelectTable={() => {
          setCartDrawerOpen(false);
          setTableModalOpen(true);
        }}
        onEditLine={handleEditCartLine}
      />

      {/* Table Selection & PIN Verification Modal */}
      {tableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <form
            onSubmit={handleConfirmTable}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-5"
          >
            <div className="space-y-1 border-b border-zinc-100 pb-3">
              <h2 className="text-lg font-bold text-zinc-950">Select Dining Table</h2>
              <p className="text-xs text-zinc-500">
                Select your table number to start your guest ordering session at {branch.name}.
              </p>
            </div>

            {verifyError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                ⚠️ {verifyError}
              </div>
            )}

            <div className="space-y-4">
              {/* Select grouped by Service Area */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                  Dining Table Number *
                </label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-300 p-3 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                >
                  <option value="">-- Choose Table Number --</option>
                  {service_areas.map((area) => {
                    const areaTables = dining_tables.filter((t) => t.service_area_id === area.id);
                    if (areaTables.length === 0) return null;
                    return (
                      <optgroup key={area.id} label={`${area.name} (${area.code})`}>
                        {areaTables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* PIN Input field if require_table_pin is ON */}
              {branch.require_table_pin && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                    Table Security PIN ({branch.table_pin_length || 4} Digits) *
                  </label>
                  <input
                    type="text"
                    maxLength={branch.table_pin_length || 4}
                    placeholder={`Enter ${branch.table_pin_length || 4}-digit PIN on table sticker`}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full font-mono text-center text-xl tracking-widest rounded-xl border border-zinc-300 p-3 text-zinc-950 focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setTableModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={verifying}>
                {verifying ? 'Verifying...' : 'Confirm Table'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
