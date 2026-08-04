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

  const handleAvailabilityChange = async (
    itemId: string,
    status: 'available' | 'out_of_stock' | 'hidden'
  ) => {
    const res = await updateMenuItemAvailabilityAction(itemId, status);
    if (res.success) {
      setItems(
        items.map((item) =>
          item.id === itemId ? { ...item, availability_status: status } : item
        )
      );
    } else {
      alert(res.message);
    }
  };

  const handleToggleFeatured = async (itemId: string, currentFeatured: boolean) => {
    const res = await toggleMenuItemFeaturedAction(itemId, !currentFeatured);
    if (res.success) {
      setItems(
        items.map((item) =>
          item.id === itemId ? { ...item, is_featured: !currentFeatured } : item
        )
      );
    } else {
      alert(res.message);
    }
  };

  const handleArchive = async (itemId: string) => {
    if (!confirm('Are you sure you want to archive this menu item?')) return;
    const res = await archiveMenuItemAction(itemId);
    if (res.success) {
      setItems(items.filter((item) => item.id !== itemId));
    } else {
      alert(res.message);
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
        {filteredItems.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-950">{item.name}</span>
                  {item.is_featured && <Badge variant="neutral">⭐ Featured</Badge>}
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

            {/* Actions Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
              <div className="flex gap-1 text-[11px]">
                <button
                  onClick={() => handleAvailabilityChange(item.id, 'available')}
                  className={`rounded px-2 py-1 font-semibold ${
                    item.availability_status === 'available'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Available
                </button>
                <button
                  onClick={() => handleAvailabilityChange(item.id, 'out_of_stock')}
                  className={`rounded px-2 py-1 font-semibold ${
                    item.availability_status === 'out_of_stock'
                      ? 'bg-amber-600 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Out of Stock
                </button>
                <button
                  onClick={() => handleAvailabilityChange(item.id, 'hidden')}
                  className={`rounded px-2 py-1 font-semibold ${
                    item.availability_status === 'hidden'
                      ? 'bg-zinc-800 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  Hidden
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link href={`/dashboard/menu/items/${item.id}/modifiers`}>
                  <Button variant="outline" size="sm">
                    Modifiers
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleFeatured(item.id, item.is_featured)}
                >
                  {item.is_featured ? 'Unfeature' : 'Feature'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleArchive(item.id)}>
                  Archive
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredItems.length === 0 && (
          <Card className="col-span-full p-8 text-center text-xs text-zinc-500">
            No menu items found. Click &quot;+ Add Menu Item&quot; above to add your first item.
          </Card>
        )}
      </div>
    </div>
  );
};
