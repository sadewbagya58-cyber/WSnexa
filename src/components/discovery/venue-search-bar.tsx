'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Restaurants', value: 'restaurant' },
  { label: 'Cafés', value: 'cafe' },
  { label: 'Hotels', value: 'hotel' },
  { label: 'Resorts', value: 'resort' },
  { label: 'Villas', value: 'villa' },
  { label: 'Guest Houses', value: 'guest_house' },
  { label: 'Food Courts', value: 'food_court' },
  { label: 'Cloud Kitchens', value: 'cloud_kitchen' },
];

export function VenueSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get('q') || '';
  const currentCategory = searchParams.get('category') || 'all';
  const currentSort = searchParams.get('sort') || 'recommended';
  const currentPrice = searchParams.get('priceLevel') || '';

  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Search Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = form.elements.namedItem('q') as HTMLInputElement;
          updateFilters('q', input.value);
        }}
        className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm"
      >
        <span className="pl-3 text-lg text-zinc-400">🔍</span>
        <input
          name="q"
          type="text"
          defaultValue={currentQuery}
          placeholder="Search restaurants, cafes, hotels, resorts..."
          className="flex-1 bg-transparent px-2 py-2 text-xs font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-hidden"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs transition-colors shadow-2xs"
        >
          Search
        </button>
      </form>

      {/* Category Pills & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-x-auto pb-1">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const active = currentCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => updateFilters('category', cat.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 ${
                  active
                    ? 'bg-zinc-950 text-amber-400 shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Sort & Filter Selectors */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={currentPrice}
            onChange={(e) => updateFilters('priceLevel', e.target.value)}
            className="bg-white border border-zinc-200 text-zinc-700 text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-hidden"
          >
            <option value="">Price: All</option>
            <option value="1">$ (Budget)</option>
            <option value="2">$$ (Moderate)</option>
            <option value="3">$$$ (Upscale)</option>
            <option value="4">$$$$ (Luxury)</option>
          </select>

          <select
            value={currentSort}
            onChange={(e) => updateFilters('sort', e.target.value)}
            className="bg-white border border-zinc-200 text-zinc-700 text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-hidden"
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="rating">Highest Rated</option>
            <option value="reviews">Most Reviewed</option>
            <option value="newest">Newest Venues</option>
          </select>
        </div>
      </div>
    </div>
  );
}
