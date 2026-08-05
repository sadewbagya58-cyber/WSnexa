'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
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
  menu_categories: { name: string } | null;
}

interface ItemListProps {
  initialItems: MenuItem[];
  categories: { id: string; name: string }[];
}

export const ItemList: React.FC<ItemListProps> = ({ initialItems, categories }) => {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});

  const handleAvailabilityChange = async (
    itemId: string,
    nextStatus: 'available' | 'out_of_stock' | 'hidden'
  ) => {
    const currentItem = items.find((i) => i.id === itemId);
    if (!currentItem || currentItem.availability_status === nextStatus) return;

    const previousStatus = currentItem.availability_status;

    // 1. Immediate Optimistic UI Update (< 50ms)
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, availability_status: nextStatus } : item
      )
    );

    // 2. Track Per-Item Pending State
    setPendingItemIds((prev) => new Set(prev).add(itemId));
    setErrorMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

    // 3. Background Server Action Execution
    const res = await updateMenuItemAvailabilityAction(itemId, nextStatus);

    setPendingItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });

    // 4. Rollback on Error
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

    // 1. Immediate Optimistic UI Update (< 50ms)
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

    // Rollback on Error
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

  const handleArchive = async (itemId: string) => {
    if (!confirm('Are you sure you want to archive this menu item?')) return;
    setPendingItemIds((prev) => new Set(prev).add(itemId));

    const res = await archiveMenuItemAction(itemId);

    if (res.success) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      alert(res.message);
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
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
          className="w-full sm:w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
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
            <Card key={item.id} className="flex flex-col justify-between p-5">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
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
                      <p className="text-xs text-zinc-600">{item.description}</p>
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
                      className="h-16 w-16 rounded-md object-cover border border-zinc-200"
                    />
                  )}
                </div>

                {errorMsg && (
                  <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* Actions Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                {/* Immediate Optimistic Availability Buttons */}
                <div className="flex flex-wrap gap-1 text-xs">
                  <button
                    type="button"
                    disabled={isPending}
                    aria-pressed={item.availability_status === 'available'}
                    onClick={() => handleAvailabilityChange(item.id, 'available')}
                    className={`flex min-h-[44px] items-center justify-center rounded px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'available'
                        ? 'bg-emerald-600 text-white shadow-sm'
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
                    className={`flex min-h-[44px] items-center justify-center rounded px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'out_of_stock'
                        ? 'bg-amber-600 text-white shadow-sm'
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
                    className={`flex min-h-[44px] items-center justify-center rounded px-3 py-2 font-semibold touch-manipulation transition-all duration-100 active:scale-[0.98] disabled:opacity-50 ${
                      item.availability_status === 'hidden'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 active:bg-zinc-300'
                    }`}
                  >
                    Hidden
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/menu/items/${item.id}/modifiers`}>
                    <Button variant="outline" size="sm">
                      Modifiers
                    </Button>
                  </Link>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggleFeatured(item.id, item.is_featured)}
                  >
                    {item.is_featured ? 'Unfeature' : 'Feature'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleArchive(item.id)}
                  >
                    Archive
                  </Button>
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
    </div>
  );
};
