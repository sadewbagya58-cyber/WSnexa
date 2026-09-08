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
import { TablePickerGrid } from './table-picker-grid';
import { CartDrawer } from '../guest/cart-drawer';
import { RewardsDrawer } from '../loyalty/rewards-drawer';
import { CartLine, ConfirmedTableContext, isTableAccessVerified } from '@/features/cart/cart-types';
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
  serviceAreaId?: string | null;
  initialTableId?: string | null;
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
  serviceAreaId = null,
  initialTableId = null,
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

  type PendingCustomerAction =
    | { type: 'quick_add'; item: MenuItemCardProps['item'] }
    | { type: 'open_details'; item: (typeof items)[0] }
    | null;
  const [pendingAction, setPendingAction] = useState<PendingCustomerAction>(null);

  // Filter tables and service areas if QR is scoped to an area
  const availableTables = useMemo(() => {
    if (serviceAreaId) {
      const areaScoped = dining_tables.filter((t) => t.service_area_id === serviceAreaId);
      if (areaScoped.length > 0) return areaScoped;
    }
    return dining_tables;
  }, [dining_tables, serviceAreaId]);

  const availableAreas = useMemo(() => {
    if (serviceAreaId) {
      const areaScoped = service_areas.filter((a) => a.id === serviceAreaId);
      if (areaScoped.length > 0) return areaScoped;
    }
    return service_areas;
  }, [service_areas, serviceAreaId]);

  // Smart Table Context: Auto-select or prompt PIN if initialTableId is given
  React.useEffect(() => {
    if (initialTableId && !isTableAccessVerified(confirmedTable)) {
      const targetTable = dining_tables.find((t) => t.id === initialTableId);
      if (targetTable) {
        if (!branch.require_table_pin) {
          setConfirmedTable({
            branchId: branch.id,
            tableId: targetTable.id,
            tableName: targetTable.name,
            tableCode: targetTable.code,
            serviceAreaId: targetTable.service_area_id || serviceAreaId || null,
            serviceAreaName: service_areas.find((a) => a.id === targetTable.service_area_id)?.name || null,
            verifiedAt: new Date().toISOString(),
          });
        } else {
          setTableModalOpen(true);
        }
      }
    }
  }, [initialTableId, dining_tables, branch.id, branch.require_table_pin, confirmedTable, setConfirmedTable, serviceAreaId, service_areas]);

  const handleSelectCategory = useCallback((catId: string) => {
    setSelectedCategory(catId);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleTableConfirmedFromGrid = useCallback(
    (table: ConfirmedTableContext) => {
      setConfirmedTable(table);
      setTableModalOpen(false);

      if (pendingAction) {
        if (pendingAction.type === 'quick_add') {
          const fullItem = items.find((i) => i.id === pendingAction.item.id);
          if (fullItem) {
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
          }
        } else if (pendingAction.type === 'open_details') {
          setEditingCartLine(null);
          setSelectedItem(pendingAction.item);
        }
        setPendingAction(null);
      }
    },
    [setConfirmedTable, pendingAction, items, addLine]
  );

  const handleItemClick = useCallback(
    (item: MenuItemCardProps['item']) => {
      const fullItem = items.find((i) => i.id === item.id);
      if (!fullItem) return;

      if (branch.require_table_selection && !isTableAccessVerified(confirmedTable)) {
        setPendingAction({ type: 'open_details', item: fullItem });
        setTableModalOpen(true);
        return;
      }

      setEditingCartLine(null);
      setSelectedItem(fullItem);
    },
    [items, branch.require_table_selection, confirmedTable]
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

      if (branch.require_table_selection && !isTableAccessVerified(confirmedTable)) {
        setPendingAction({ type: 'quick_add', item });
        setTableModalOpen(true);
        return;
      }

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
    [items, addLine, branch.require_table_selection, confirmedTable]
  );

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
                onClick={() => {
                  setPendingAction(null);
                  setTableModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                <span>📍</span>
                {isTableVerified ? (
                  <span className="text-emerald-800 font-extrabold truncate max-w-[140px]">
                    {confirmedTable?.serviceAreaName ? `${confirmedTable.serviceAreaName} · ` : ''}
                    {confirmedTable!.tableName}
                  </span>
                ) : (
                  <span className="text-amber-800 font-extrabold">Select Table</span>
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

        {/* Step 1 Hero Journey Card: Touch Table Grid */}
        {branch.require_table_selection && !isTableVerified && (
          <div className="rounded-3xl border-2 border-amber-400/90 bg-amber-50/80 p-4 sm:p-5 shadow-sm space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900">
                Step 1 of 3: Select Your Table
              </span>
              <span className="text-[11px] font-extrabold text-amber-900">Required to Order</span>
            </div>

            <TablePickerGrid
              branchId={branch.id}
              serviceAreaId={serviceAreaId}
              serviceAreaName={service_areas.find((a) => a.id === serviceAreaId)?.name}
              diningTables={availableTables}
              serviceAreas={availableAreas}
              requireTablePin={branch.require_table_pin}
              tablePinLength={branch.table_pin_length}
              currentTableId={confirmedTable?.tableId}
              onTableConfirmed={handleTableConfirmedFromGrid}
              isInline={true}
              title="ඔයා ඉන්නේ කුමන Table එකේද?"
              subtitle="Order එක නිවැරදි Table එකට එවන්න ඔයාගේ Table එක තෝරන්න."
            />
          </div>
        )}

        {/* Collapsed Active Table Confirmation */}
        {branch.require_table_selection && isTableVerified && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white shadow-xs">
                ✓
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Dining Table Confirmed
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <span className="text-sm font-black text-zinc-950">
                  {confirmedTable?.serviceAreaName ? `${confirmedTable.serviceAreaName} · ` : ''}
                  {confirmedTable!.tableName}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingAction(null);
                setTableModalOpen(true);
              }}
              className="text-xs font-black text-emerald-800 hover:text-emerald-950 underline px-2 py-1 cursor-pointer"
            >
              Change Table
            </button>
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

      {/* Table Selection Bottom Sheet / Modal */}
      {tableModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTableModalOpen(false);
              setPendingAction(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl border border-zinc-200 max-h-[85vh] overflow-y-auto">
            <TablePickerGrid
              branchId={branch.id}
              serviceAreaId={serviceAreaId}
              serviceAreaName={service_areas.find((a) => a.id === serviceAreaId)?.name}
              diningTables={availableTables}
              serviceAreas={availableAreas}
              requireTablePin={branch.require_table_pin}
              tablePinLength={branch.table_pin_length}
              currentTableId={confirmedTable?.tableId}
              onTableConfirmed={handleTableConfirmedFromGrid}
              onCancel={() => {
                setTableModalOpen(false);
                setPendingAction(null);
              }}
              title={pendingAction ? '🪑 Table එක select කරන්න' : 'ඔයා ඉන්නේ කුමන Table එකේද?'}
              subtitle={
                pendingAction
                  ? 'ඔයාගේ Order එක යවන්න කලින් Table එක තෝරන්න. (Select table before adding)'
                  : 'Order එක නිවැරදි Table එකට එවන්න ඔයාගේ Table එක තෝරන්න.'
              }
            />
          </div>
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
