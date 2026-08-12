'use client';

import React, { useState } from 'react';
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

  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const currentQuery = searchParams.get('q') || '';
  const currentCategory = searchParams.get('category') || 'all';
  const currentSort = searchParams.get('sort') || 'recommended';
  const currentPrice = searchParams.get('priceLevel') || '';
  const currentRadius = searchParams.get('radiusKm') || '25';
  const orderingOnly = searchParams.get('orderingAvailableOnly') === 'true';
  const menuOnly = searchParams.get('hasPublicMenuOnly') === 'true';
  const hasLocationActive = searchParams.has('userLat') && searchParams.has('userLng');

  const updateFilters = (key: string, value: string | boolean | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value !== null && value !== '' && value !== false && value !== 'all') {
      params.set(key, String(value));
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`/explore?${params.toString()}`);
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser. Search by city instead.');
      return;
    }

    setLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const params = new URLSearchParams(searchParams.toString());
        params.set('userLat', pos.coords.latitude.toFixed(6));
        params.set('userLng', pos.coords.longitude.toFixed(6));
        params.set('sort', 'nearest');
        params.set('page', '1');
        router.push(`/explore?${params.toString()}`);
      },
      (err) => {
        setLocating(false);
        console.warn('[VenueSearchBar] Geolocation error:', err);
        setLocError('Location access is off. Search by city instead.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const clearLocation = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('userLat');
    params.delete('userLng');
    if (params.get('sort') === 'nearest') {
      params.set('sort', 'recommended');
    }
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Search Input & Near Me Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const input = form.elements.namedItem('q') as HTMLInputElement;
            updateFilters('q', input.value);
          }}
          className="flex-1 flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm"
        >
          <span className="pl-3 text-lg text-zinc-400">🔍</span>
          <input
            name="q"
            type="text"
            defaultValue={currentQuery}
            placeholder="Search venue name, city, cuisine..."
            className="flex-1 bg-transparent px-2 py-2 text-xs font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-hidden"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs transition-colors shadow-2xs min-h-[44px]"
          >
            Search
          </button>
        </form>

        {/* Near Me Button (44px touch target) */}
        {hasLocationActive ? (
          <button
            onClick={clearLocation}
            className="px-4 py-2.5 rounded-2xl bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-950 font-black text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <span>📍 Nearby Active</span>
            <span className="text-zinc-500 font-bold hover:text-black">✕</span>
          </button>
        ) : (
          <button
            onClick={handleNearMe}
            disabled={locating}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-2xs min-h-[44px] disabled:opacity-50"
          >
            <span>📍</span>
            <span>{locating ? 'Locating...' : 'Near Me'}</span>
          </button>
        )}
      </div>

      {/* Permission Denied / Error Banner */}
      {locError && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center justify-between">
          <span>⚠️ {locError}</span>
          <button onClick={() => setLocError(null)} className="text-zinc-400 hover:text-zinc-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Filter Chips & Bar */}
      <div className="flex flex-col space-y-3">
        {/* Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const active = currentCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => updateFilters('category', cat.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 min-h-[36px] ${
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

        {/* Radius, Price, Sort & Toggles Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-100">
          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {hasLocationActive && (
              <select
                value={currentRadius}
                onChange={(e) => updateFilters('radiusKm', e.target.value)}
                className="bg-white border border-zinc-200 text-zinc-800 text-xs font-extrabold px-3 py-2 rounded-xl focus:outline-hidden min-h-[38px]"
              >
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
              </select>
            )}

            <select
              value={currentPrice}
              onChange={(e) => updateFilters('priceLevel', e.target.value)}
              className="bg-white border border-zinc-200 text-zinc-800 text-xs font-extrabold px-3 py-2 rounded-xl focus:outline-hidden min-h-[38px]"
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
              className="bg-white border border-zinc-200 text-zinc-800 text-xs font-extrabold px-3 py-2 rounded-xl focus:outline-hidden min-h-[38px]"
            >
              <option value="recommended">Sort: Recommended</option>
              {hasLocationActive && <option value="nearest">Distance (Nearest First)</option>}
              <option value="rating">Highest Rated</option>
              <option value="reviews">Most Reviewed</option>
              <option value="trending">Trending Now</option>
              <option value="newest">Newest Venues</option>
            </select>
          </div>

          {/* Toggle Switches */}
          <div className="flex items-center gap-3 shrink-0 py-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={orderingOnly}
                onChange={(e) => updateFilters('orderingAvailableOnly', e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
              />
              <span>WSNexa Ordering Only</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={menuOnly}
                onChange={(e) => updateFilters('hasPublicMenuOnly', e.target.checked)}
                className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
              />
              <span>Public Menu Available</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
