'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import {
  updateMenuItemAction,
  updateMenuItemAvailabilityAction,
  toggleMenuItemFeaturedAction,
  archiveMenuItemAction,
} from '@/server/actions/menu';

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  availability_status: 'available' | 'out_of_stock' | 'hidden';
  is_featured: boolean;
  is_active: boolean;
  primary_image_url: string | null;
  category_id: string;
  display_order?: number;
  menu_categories: { name: string } | null;
}

interface ItemListProps {
  initialItems: MenuItem[];
  categories: { id: string; name: string }[];
  canEditPrice?: boolean;
}

export const ItemList: React.FC<ItemListProps> = ({
  initialItems,
  categories,
  canEditPrice = true,
}) => {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  // Edit Item Modal state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editAvailability, setEditAvailability] = useState<'available' | 'out_of_stock' | 'hidden'>('available');
  const [editFeatured, setEditFeatured] = useState(false);
  const [editOrder, setEditOrder] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditCategoryId(item.category_id);
    setEditDesc(item.description || '');
    setEditPrice((item.price_cents / 100).toFixed(2));
    setEditImageUrl(item.primary_image_url || '');
    setEditAvailability(item.availability_status);
    setEditFeatured(item.is_featured);
    setEditOrder(item.display_order || 0);
    setEditModalError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editName.trim() || !editCategoryId) return;

    setIsSavingEdit(true);
    setEditModalError(null);

    const priceNum = parseFloat(editPrice);
    if (canEditPrice && (isNaN(priceNum) || priceNum < 0)) {
      setEditModalError('Please enter a valid price.');
      setIsSavingEdit(false);
      return;
    }

    const payload = {
      id: editingItem.id,
      name: editName.trim(),
      categoryId: editCategoryId,
      description: editDesc.trim() || undefined,
      ...(canEditPrice ? { price: priceNum } : {}),
      primaryImageUrl: editImageUrl.trim() || undefined,
      availabilityStatus: editAvailability,
      isFeatured: editFeatured,
      displayOrder: editOrder,
    };

    const res = await updateMenuItemAction(payload);

    if (res.success) {
      const updatedPriceCents = canEditPrice
        ? Math.round(priceNum * 100)
        : editingItem.price_cents;

      const categoryObj = categories.find((c) => c.id === editCategoryId);

      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                name: editName.trim(),
                category_id: editCategoryId,
                description: editDesc.trim() || null,
                price_cents: updatedPriceCents,
                primary_image_url: editImageUrl.trim() || null,
                availability_status: editAvailability,
                is_featured: editFeatured,
                display_order: editOrder,
                menu_categories: categoryObj ? { name: categoryObj.name } : i.menu_categories,
              }
            : i
        )
      );
      setEditingItem(null);
    } else {
      setEditModalError(res.message || 'Failed to update menu item.');
    }
    setIsSavingEdit(false);
  };

  const handleAvailabilityChange = async (
    itemId: string,
    nextStatus: 'available' | 'out_of_stock' | 'hidden'
  ) => {
    const currentItem = items.find((i) => i.id === itemId);
    if (!currentItem || currentItem.availability_status === nextStatus) return;

    const previousStatus = currentItem.availability_status;

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, availability_status: nextStatus } : item
      )
    );

    setPendingItemIds((prev) => new Set(prev).add(itemId));
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    const res = await updateMenuItemAvailabilityAction(itemId, nextStatus);

    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });

    if (!res.success) {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, availability_status: previousStatus } : item
        )
      );
      setErrorMap((prev) => ({
        ...prev,
        [itemId]: res.message || 'Failed to update item availability.',
      }));
    }
  };

  const handleToggleFeatured = async (itemId: string, currentFeatured: boolean) => {
    const nextFeatured = !currentFeatured;

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, is_featured: nextFeatured } : item
      )
    );

    setPendingItemIds((prev) => new Set(prev).add(itemId));

    const res = await toggleMenuItemFeaturedAction(itemId, nextFeatured);

    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });

    if (!res.success) {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, is_featured: currentFeatured } : item
        )
      );
      setErrorMap((prev) => ({
        ...prev,
        [itemId]: res.message || 'Failed to update featured status.',
      }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    const itemId = deletingItem.id;
    setIsDeleting(true);
    setPendingItemIds((prev) => new Set(prev).add(itemId));

    const res = await archiveMenuItemAction(itemId);

    if (res.success) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      setDeletingItem(null);
    } else {
      setErrorMap((prev) => ({
        ...prev,
        [itemId]: res.message || 'Failed to delete menu item.',
      }));
      setDeletingItem(null);
    }

    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    setIsDeleting(false);
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          placeholder="Search items by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64 min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-950 focus:outline-hidden"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-48 min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-950 focus:outline-hidden"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Items List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredItems.map((item) => {
          const isPending = pendingItemIds.has(item.id);
          const errorMsg = errorMap[item.id];

          return (
            <Card key={item.id} className="flex flex-col justify-between p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-zinc-950">{item.name}</span>
                      {item.is_featured && <Badge variant="neutral">⭐ Featured</Badge>}
                      {isPending && (
                        <span className="text-[10px] text-zinc-500 font-semibold animate-pulse">
                          Saving...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Category: {item.menu_categories?.name || 'Uncategorized'}
                    </p>
                    {item.description && (
                      <p className="text-xs text-zinc-600 line-clamp-2">{item.description}</p>
                    )}
                    <p className="text-sm font-bold text-zinc-900">
                      {item.currency} {(item.price_cents / 100).toFixed(2)}
                    </p>
                  </div>

                  {item.primary_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.primary_image_url}
                      alt={item.name}
                      className="h-16 w-16 rounded-lg object-cover border border-zinc-200 shrink-0"
                    />
                  )}
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Actions Bar */}
              <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
                {/* Immediate Optimistic Availability Buttons */}
                <div className="flex flex-wrap gap-1 text-xs">
                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={item.availability_status === 'available'}
                    onClick={() => handleAvailabilityChange(item.id, 'available')}
                    className={`flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'available'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-zinc-300'
                    }`}
                  >
                    Available
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={item.availability_status === 'out_of_stock'}
                    onClick={() => handleAvailabilityChange(item.id, 'out_of_stock')}
                    className={`flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'out_of_stock'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-zinc-300'
                    }`}
                  >
                    Out of Stock
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={item.availability_status === 'hidden'}
                    onClick={() => handleAvailabilityChange(item.id, 'hidden')}
                    className={`flex min-h-[44px] items-center justify-center rounded-lg px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'hidden'
                        ? 'bg-zinc-800 text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-zinc-300'
                    }`}
                  >
                    Hidden
                  </button>
                </div>

                {/* Secondary Edit/Modifiers/Delete Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      disabled={isPending}
                      className="flex min-h-[44px] items-center justify-center px-3 py-2 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 border border-zinc-200 touch-manipulation"
                    >
                      Edit Item
                    </button>

                    <Link href={`/dashboard/menu/items/${item.id}/modifiers`}>
                      <Button variant="outline" size="sm" className="min-h-[44px]">
                        Modifiers
                      </Button>
                    </Link>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleFeatured(item.id, item.is_featured)}
                      className="min-h-[44px]"
                    >
                      {item.is_featured ? 'Unfeature' : 'Feature'}
                    </Button>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeletingItem(item)}
                    className="flex min-h-[44px] items-center justify-center px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 touch-manipulation"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredItems.length === 0 && (
          <Card className="col-span-full p-8 text-center text-xs text-zinc-500">
            No menu items found. Click &quot;+ Add Menu Item&quot; above to add your first item.
          </Card>
        )}
      </div>

      {/* Edit Menu Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 space-y-4 text-zinc-950 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-extrabold text-zinc-950">Edit Menu Item</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            {editModalError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
                {editModalError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Item ingredients, notes, or details..."
                  className="w-full p-3 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Price ({editingItem.currency}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={!canEditPrice}
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950 disabled:bg-zinc-100 disabled:text-zinc-500"
                  />
                  {!canEditPrice && (
                    <p className="text-[10px] text-amber-700 mt-1 font-semibold">
                      🔒 You need &apos;menu.price.update&apos; permission to modify prices.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editOrder}
                    onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Primary Image URL
                </label>
                <input
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                    Availability Status
                  </label>
                  <select
                    value={editAvailability}
                    onChange={(e) =>
                      setEditAvailability(e.target.value as 'available' | 'out_of_stock' | 'hidden')
                    }
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                  >
                    <option value="available">Available</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="editFeatured"
                    checked={editFeatured}
                    onChange={(e) => setEditFeatured(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0"
                  />
                  <label htmlFor="editFeatured" className="text-xs font-bold text-zinc-900">
                    Feature on Menu Header
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Item Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setDeletingItem(null)}
          title={`Delete ${deletingItem.name}?`}
          description="This removes the item from active menus. Historical order records will not be affected."
          isDestructive={true}
          confirmLabel="Delete Item"
          cancelLabel="Cancel"
          isLoading={isDeleting}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
};
