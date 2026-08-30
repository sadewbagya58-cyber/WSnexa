'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { verifyTableAccessAction } from '@/server/actions/table';
import {
  useCartActions,
  useConfirmedTable,
  useCartTotalQuantity,
} from '@/features/cart/cart-context';
import { MenuBrandHeader } from '@/components/menu/menu-brand-header';
import { MenuSearch } from '@/components/menu/menu-search';
import { CategoryTabs } from '@/components/menu/category-tabs';
import { MenuItemCard, MenuItemCardProps } from '@/components/menu/menu-item-card';
import { MenuItemDetails } from '@/components/menu/menu-item-details';
import { GuestMenuBottomActions } from './guest-menu-bottom-actions';
import { CartDrawer } from '../guest/cart-drawer';
import { RewardsDrawer } from '../loyalty/rewards-drawer';
import { CartLine, isTableAccessVerified } from '@/features/cart/cart-types';
import { CustomerLoyaltyAccountRecord, LoyaltyRewardRecord } from '@/lib/validation/loyalty';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';

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
  isAuthenticated?: boolean;
  loyaltyAccount?: CustomerLoyaltyAccountRecord | null;
  availableRewards?: LoyaltyRewardRecord[];
  isOrderingUnavailable?: boolean;
}

const HeaderCartButton = React.memo(function HeaderCartButton({
  onOpenCart,
}: {
  onOpenCart: () => void;
}) {
  const totalQty = useCartTotalQuantity();
  if (totalQty <= 0) return null;

  return (
    <button
      type="button"
      onClick={onOpenCart}
      className="flex items-center justify-center rounded-full bg-zinc-950 p-2 text-white shadow-xs hover:bg-zinc-800 active:scale-95 transition-transform cursor-pointer"
      aria-label="Open cart"
    >
      🛒
    </button>
  );
});

export const PublicGuestMenu: React.FC<PublicGuestMenuProps> = ({
  token,
  business,
  branch,
  service_areas,
  dining_tables,
  categories,
  items,
  isAuthenticated = false,
  loyaltyAccount = null,
  availableRewards = [],
  isOrderingUnavailable = false,
}) => {
  const { addLine, editLine, setConfirmedTable } = useCartActions();
  const confirmedTable = useConfirmedTable();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<(typeof items)[0] | null>(null);
  const [rewardsDrawerOpen, setRewardsDrawerOpen] = useState<boolean>(false);
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

  const handleSelectCategory = useCallback((catId: string) => {
    setSelectedCategory(catId);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleItemClick = useCallback(
    (item: MenuItemCardProps['item']) => {
      const fullItem = items.find((i) => i.id === item.id);
      if (fullItem) {
        setEditingCartLine(null);
        setSelectedItem(fullItem);
      }
    },
    [items]
  );

  const handleCloseItemDetails = useCallback(() => {
    setSelectedItem(null);
    setEditingCartLine(null);
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category_id === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleQuickAdd = useCallback(
    (item: MenuItemCardProps['item'], e: React.MouseEvent) => {
      e.stopPropagation();
      const fullItem = items.find((i) => i.id === item.id);
      if (!fullItem) return;

      const hasModifiers = fullItem.modifier_groups && fullItem.modifier_groups.length > 0;
      if (hasModifiers) {
        setEditingCartLine(null);
        setSelectedItem(fullItem);
      } else {
        addLine({
          menuItemId: fullItem.id,
          itemName: fullItem.name,
          imageUrl: fullItem.primary_image_url,
          quantity: 1,
          basePriceCents: fullItem.price_cents,
          selectedModifiers: [],
        });
      }
    },
    [items, addLine]
  );

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

    const res = await verifyTableAccessAction(
      branch.id,
      selectedTableId,
      pinInput
    );

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

  const isTableVerified = isTableAccessVerified(confirmedTable);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-900 pb-32">
      {/* Brand Header */}
      <MenuBrandHeader
        logoUrl={business.logo_url}
        businessName={business.name}
        branchName={branch.name}
        address={branch.city || branch.address_line1 || undefined}
        rightActions={
          <div className="flex items-center gap-2">
            {/* Loyalty Rewards Pill Button */}
            {IS_LOYALTY_ENABLED && (
              <button
                type="button"
                onClick={() => setRewardsDrawerOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-950 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
              >
                <span>🎁</span>
                {isAuthenticated ? (
                  <span className="font-extrabold text-amber-900">{loyaltyAccount?.pointsBalance || 0} pts</span>
                ) : (
                  <span>Rewards</span>
                )}
              </button>
            )}

            {/* Table Selection Status Pill */}
            {branch.require_table_selection && (
              <button
                type="button"
                onClick={() => setTableModalOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>📍</span>
                {isTableVerified ? (
                  <span className="text-emerald-800 font-extrabold">{confirmedTable!.tableName}</span>
                ) : (
                  <span className="text-zinc-600">Select Table</span>
                )}
              </button>
            )}

            {/* Cart Icon Action Button */}
            <HeaderCartButton onOpenCart={() => setCartDrawerOpen(true)} />
          </div>
        }
      />

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {isOrderingUnavailable && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-xs text-amber-950">
            <span className="text-xl">💳</span>
            <div>
              <span className="font-extrabold uppercase tracking-wider text-[10px] block text-amber-900">Ordering Unavailable</span>
              <p className="text-amber-950 font-medium leading-relaxed">
                Ordering is currently unavailable for this venue. Menu is view-only.
              </p>
            </div>
          </div>
        )}

        {/* Table Selection Prompt Banner */}
        {branch.require_table_selection && !isTableVerified && (
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

        {/* Search Bar */}
        <MenuSearch value={searchQuery} onChange={handleSearchChange} />

        {/* Categories Horizontal Sticky Tabs */}
        <CategoryTabs
          categories={categories}
          items={items}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
        />

        {/* Menu Items Grid/List */}
        <div className="space-y-3 pt-1">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              currency={branch.currency || business.currency || 'USD'}
              onClick={handleItemClick}
              onQuickAdd={handleQuickAdd}
            />
          ))}

          {filteredItems.length === 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-xs text-zinc-500">
              No items matching your search or selected category.
            </div>
          )}
        </div>
      </main>

      {/* Item Details & Modifiers Sheet */}
      {selectedItem && (
        <MenuItemDetails
          item={selectedItem}
          currency={branch.currency || business.currency || 'USD'}
          editingLine={editingCartLine}
          onClose={handleCloseItemDetails}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Unified Floating Bottom Actions */}
      <GuestMenuBottomActions
        branchId={branch.id}
        token={token}
        currency={branch.currency || business.currency || 'USD'}
        onOpenCart={() => setCartDrawerOpen(true)}
      />

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleConfirmTable}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-5"
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
                className="flex-1 cursor-pointer"
                onClick={() => setTableModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 cursor-pointer" disabled={verifying}>
                {verifying ? 'Verifying...' : 'Confirm Table'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Rewards Drawer Modal */}
      {IS_LOYALTY_ENABLED && (
        <RewardsDrawer
          isOpen={rewardsDrawerOpen}
          onClose={() => setRewardsDrawerOpen(false)}
          isAuthenticated={isAuthenticated}
          loyaltyAccount={loyaltyAccount}
          availableRewards={availableRewards}
          subtotalCents={0}
        />
      )}
    </div>
  );
};
