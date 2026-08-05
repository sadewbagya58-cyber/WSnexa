'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PublicGuestMenuProps {
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
  };
  area: {
    id: string;
    name: string;
    code: string;
  };
  table: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
    capacity: number;
  };
  categories: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    display_order: number;
  }[];
  items: {
    id: string;
    category_id: string;
    name: string;
    slug: string;
    description: string | null;
    price_cents: number;
    currency: string;
    availability_status: 'available' | 'out_of_stock' | 'hidden';
    is_featured: boolean;
    primary_image_url: string | null;
    display_order: number;
    modifier_groups: {
      id: string;
      name: string;
      description: string | null;
      selection_type: 'single' | 'multiple';
      min_selections: number;
      max_selections: number | null;
      is_required: boolean;
      options: {
        id: string;
        name: string;
        price_cents: number;
        is_available: boolean;
      }[];
    }[];
  }[];
}

export const PublicGuestMenu: React.FC<PublicGuestMenuProps> = ({
  business,
  branch,
  area,
  table,
  categories,
  items,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeItemModal, setActiveItemModal] = useState<PublicGuestMenuProps['items'][0] | null>(null);

  const featuredItems = items.filter((item) => item.is_featured);

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      selectedCategory === 'all' || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-zinc-50 antialiased pb-12">
      {/* Header Container */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur shadow-xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-10 w-10 rounded-full object-cover border border-zinc-200"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-white">
                {business.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-base font-bold leading-tight text-zinc-950">{business.name}</h1>
              <p className="text-[11px] text-zinc-500">{branch.name} • {area.name}</p>
            </div>
          </div>

          <div className="rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800">
            {table.name}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-6">
        {/* Search & Category Filter Navigation */}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-xs focus:border-zinc-950 focus:outline-hidden"
          />

          {/* Category Tabs Scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                selectedCategory === 'all'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
              }`}
            >
              All Items ({items.length})
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Items Section */}
        {selectedCategory === 'all' && !searchTerm && featuredItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-900">
              ⭐ Featured Favorites
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {featuredItems.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => setActiveItemModal(item)}
                  className="min-w-[200px] max-w-[200px] flex-shrink-0 cursor-pointer p-3 transition-transform active:scale-[0.98] space-y-2"
                >
                  {item.primary_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.primary_image_url}
                      alt={item.name}
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs text-zinc-950 line-clamp-1">{item.name}</h3>
                    <p className="text-xs font-black text-zinc-900">
                      {item.currency} {(item.price_cents / 100).toFixed(2)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Main Items List */}
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              onClick={() => setActiveItemModal(item)}
              className="flex items-center justify-between p-4 cursor-pointer hover:border-zinc-300 transition-all active:scale-[0.99]"
            >
              <div className="space-y-1 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-zinc-950">{item.name}</h3>
                  {item.availability_status === 'out_of_stock' && (
                    <Badge variant="warning">Out of Stock</Badge>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>
                )}

                <p className="text-xs font-bold text-zinc-900 pt-1">
                  {item.currency} {(item.price_cents / 100).toFixed(2)}
                </p>
              </div>

              {item.primary_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.primary_image_url}
                  alt={item.name}
                  className="h-20 w-20 flex-shrink-0 rounded-lg object-cover border border-zinc-200"
                />
              )}
            </Card>
          ))}

          {filteredItems.length === 0 && (
            <Card className="p-8 text-center text-xs text-zinc-500">
              No menu items available in this category.
            </Card>
          )}
        </div>
      </main>

      {/* Item Detail & Modifiers Preview Modal */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-zinc-950">{activeItemModal.name}</h2>
                <p className="text-sm font-black text-zinc-900">
                  {activeItemModal.currency} {(activeItemModal.price_cents / 100).toFixed(2)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveItemModal(null)}
              >
                ✕
              </Button>
            </div>

            {activeItemModal.primary_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeItemModal.primary_image_url}
                alt={activeItemModal.name}
                className="h-48 w-full rounded-xl object-cover"
              />
            )}

            {activeItemModal.description && (
              <p className="text-xs text-zinc-600 leading-relaxed">
                {activeItemModal.description}
              </p>
            )}

            {/* Modifier Groups Preview */}
            {activeItemModal.modifier_groups && activeItemModal.modifier_groups.length > 0 && (
              <div className="space-y-4 border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-900">
                  Customization Options
                </h3>
                {activeItemModal.modifier_groups.map((group) => (
                  <div key={group.id} className="space-y-2 rounded-lg border border-zinc-200 p-3 bg-zinc-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-900">{group.name}</span>
                      {group.is_required ? (
                        <Badge variant="destructive">Required</Badge>
                      ) : (
                        <Badge variant="neutral">Optional</Badge>
                      )}
                    </div>
                    <div className="space-y-1 pt-1">
                      {group.options.map((opt) => (
                        <div key={opt.id} className="flex justify-between text-xs text-zinc-700">
                          <span>{opt.name}</span>
                          <span>
                            {opt.price_cents > 0
                              ? `+${activeItemModal.currency} ${(opt.price_cents / 100).toFixed(2)}`
                              : 'Free'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={() => setActiveItemModal(null)}
            >
              Close Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
