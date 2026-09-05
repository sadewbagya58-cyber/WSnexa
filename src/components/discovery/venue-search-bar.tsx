'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const CATEGORIES = [
  { label: 'All', value: 'all', icon: '✨' },
  { label: 'Restaurants', value: 'restaurant', icon: '🍽️' },
  { label: 'Cafés', value: 'cafe', icon: '☕' },
  { label: 'Hotels', value: 'hotel', icon: '🏨' },
  { label: 'Resorts', value: 'resort', icon: '🌴' },
  { label: 'Villas', value: 'villa', icon: '🏡' },
  { label: 'Guest Houses', value: 'guest_house', icon: '🛏️' },
  { label: 'Food Courts', value: 'food_court', icon: '🍱' },
  { label: 'Cloud Kitchens', value: 'cloud_kitchen', icon: '📦' },
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
        setLocError('Location access was not granted. You can still search by city.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const clearLocation = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('userLat');
    params.delete('userLng');
    if (params.get('sort') === 'nearest') params.set('sort', 'recommended');
    router.push(`/explore?${params.toString()}`);
  };

  const selectClass =
    'bg-white border border-zinc-200 text-zinc-900 text-xs font-bold px-3 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 min-h-[44px] w-full cursor-pointer touch-manipulation shadow-2xs transition-all';

  return (
    <div className="space-y-3.5">
      {/* ── Search Input + Near Me Bar ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement;
            updateFilters('q', input.value);
          }}
          className="flex-1 flex items-center gap-2 bg-white p-1.5 sm:p-2 rounded-2xl border border-zinc-200 shadow-xs focus-within:ring-2 focus-within:ring-zinc-950 transition-all"
        >
          <span className="pl-3 text-base text-zinc-400" aria-hidden>🔍</span>
          <input
            name="q"
            type="text"
            defaultValue={currentQuery}
            placeholder="Search venue name, city, cuisine..."
            className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-none"
          />
          {currentQuery && (
            <button
              type="button"
              onClick={() => updateFilters('q', null)}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 text-xs font-bold"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-xs transition-all min-h-[42px] touch-manipulation active:scale-[0.98] focus:outline-none"
          >
            Search
          </button>
        </form>

        {/* Near Me CTA Button */}
        {hasLocationActive ? (
          <button
            type="button"
            onClick={clearLocation}
            className="px-4 py-2.5 rounded-2xl bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 border border-emerald-300 text-emerald-950 font-black text-xs transition-all shrink-0 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:scale-[0.98]"
          >
            <span>📍 Nearby Active</span>
            <span className="text-emerald-700 font-black" aria-label="Clear location">✕</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNearMe}
            disabled={locating}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] shadow-xs"
            aria-label={locating ? 'Locating your position...' : 'Find venues near me'}
          >
            <span aria-hidden>📍</span>
            <span>{locating ? 'Locating...' : 'Near Me'}</span>
          </button>
        )}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────── */}
      {locError && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center justify-between gap-2 animate-in fade-in" role="alert">
          <span>⚠️ {locError}</span>
          <button
            type="button"
            onClick={() => setLocError(null)}
            className="text-zinc-500 hover:text-zinc-900 font-bold min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg hover:bg-amber-100 touch-manipulation"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Category Chips (Horizontal Swipeable Row) ───────────────── */}
      <div
        className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 touch-pan-x"
        role="group"
        aria-label="Filter by category"
      >
        {CATEGORIES.map((cat) => {
          const active = currentCategory === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => updateFilters('category', cat.value)}
              aria-pressed={active}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all duration-150 shrink-0 min-h-[42px] flex items-center gap-1.5 touch-manipulation active:scale-[0.97] focus:outline-none ${
                active
                  ? 'bg-zinc-950 text-white shadow-sm ring-2 ring-zinc-950 ring-offset-1'
                  : 'bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-800 border border-zinc-200'
              }`}
            >
              <span aria-hidden>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Compact Filter Row (Price, Sort, Radius, Checkboxes) ──────── */}
      <div className="pt-2 border-t border-zinc-200/80 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {/* Price Level */}
          <div>
            <label className="sr-only" htmlFor="filter-price">Price level</label>
            <select
              id="filter-price"
              value={currentPrice}
              onChange={(e) => updateFilters('priceLevel', e.target.value)}
              className={selectClass}
            >
              <option value="">Price: All</option>
              <option value="1">$ Budget</option>
              <option value="2">$$ Moderate</option>
              <option value="3">$$$ Upscale</option>
              <option value="4">$$$$ Luxury</option>
            </select>
          </div>

          {/* Sort Order */}
          <div>
            <label className="sr-only" htmlFor="filter-sort">Sort order</label>
            <select
              id="filter-sort"
              value={currentSort}
              onChange={(e) => updateFilters('sort', e.target.value)}
              className={selectClass}
            >
              <option value="recommended">Sort: Recommended</option>
              {hasLocationActive && <option value="nearest">Sort: Nearest First</option>}
              <option value="rating">Sort: Highest Rated</option>
              <option value="reviews">Sort: Most Reviewed</option>
              <option value="trending">Sort: Trending Now</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>

          {/* Radius Filter (when GPS location is active) */}
          {hasLocationActive && (
            <div className="col-span-2 sm:col-span-1">
              <label className="sr-only" htmlFor="filter-radius">Search radius</label>
              <select
                id="filter-radius"
                value={currentRadius}
                onChange={(e) => updateFilters('radiusKm', e.target.value)}
                className={selectClass}
              >
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="25">Within 25 km</option>
                <option value="50">Within 50 km</option>
                <option value="100">Within 100 km</option>
              </select>
            </div>
          )}
        </div>

        {/* Feature Checkbox Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all touch-manipulation min-h-[40px] ${
            orderingOnly
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black'
              : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}>
            <input
              type="checkbox"
              checked={orderingOnly}
              onChange={(e) => updateFilters('orderingAvailableOnly', e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
            />
            <span>✓ WSNexa Ordering Only</span>
          </label>

          <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all touch-manipulation min-h-[40px] ${
            menuOnly
              ? 'bg-amber-50 border-amber-300 text-amber-950 font-black'
              : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
          }`}>
            <input
              type="checkbox"
              checked={menuOnly}
              onChange={(e) => updateFilters('hasPublicMenuOnly', e.target.checked)}
              className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
            />
            <span>📖 Public Menu Available</span>
          </label>
        </div>
      </div>
    </div>
  );
}
