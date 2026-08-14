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
    if (params.get('sort') === 'nearest') params.set('sort', 'recommended');
    router.push(`/explore?${params.toString()}`);
  };

  const selectClass =
    'bg-white border border-zinc-200 text-zinc-800 text-xs font-extrabold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-300 min-h-[44px] w-full cursor-pointer touch-manipulation';

  return (
    <div className="space-y-3">
      {/* ── Search Input + Near Me ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement;
            updateFilters('q', input.value);
          }}
          className="flex-1 flex items-center gap-2 bg-white p-2 rounded-2xl border border-zinc-200 shadow-sm"
        >
          <span className="pl-2 text-lg text-zinc-400" aria-hidden>🔍</span>
          <input
            name="q"
            type="text"
            defaultValue={currentQuery}
            placeholder="Search venue name, city, cuisine..."
            className="flex-1 bg-transparent px-2 py-2 text-xs font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-xs transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
          >
            Search
          </button>
        </form>

        {/* Near Me / Nearby Active */}
        {hasLocationActive ? (
          <button
            type="button"
            onClick={clearLocation}
            className="px-4 py-2.5 rounded-2xl bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 border border-emerald-300 text-emerald-950 font-black text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation"
          >
            <span>📍 Nearby Active</span>
            <span className="text-emerald-700 font-bold" aria-label="Clear location">✕</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNearMe}
            disabled={locating}
            className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs transition-all shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1"
            aria-label={locating ? 'Locating your position...' : 'Find venues near me'}
          >
            <span aria-hidden>📍</span>
            <span>{locating ? 'Locating...' : 'Near Me'}</span>
          </button>
        )}
      </div>

      {/* ── Error Banner ──────────────────────────────────────────── */}
      {locError && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center justify-between gap-2" role="alert">
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

      {/* ── Category Chips (horizontal scroll) ────────────────────── */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 touch-pan-x"
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
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 min-h-[40px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                active
                  ? 'bg-zinc-950 text-white shadow-xs focus:ring-zinc-950'
                  : 'bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-800 focus:ring-zinc-300'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* ── Secondary Filters ─────────────────────────────────────── */}
      <div className="pt-1 border-t border-zinc-100 space-y-2.5">
        {/* Radius (only when location is active) */}
        {hasLocationActive && (
          <div>
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

        {/* Price + Sort — 2-column grid on mobile, inline on desktop */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
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
          <div>
            <label className="sr-only" htmlFor="filter-sort">Sort order</label>
            <select
              id="filter-sort"
              value={currentSort}
              onChange={(e) => updateFilters('sort', e.target.value)}
              className={selectClass}
            >
              <option value="recommended">Recommended</option>
              {hasLocationActive && <option value="nearest">Nearest First</option>}
              <option value="rating">Highest Rated</option>
              <option value="reviews">Most Reviewed</option>
              <option value="trending">Trending Now</option>
              <option value="newest">Newest</option>
            </select>
          </div>
        </div>

        {/* Checkbox toggles */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-0.5">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer min-h-[40px] touch-manipulation">
            <input
              type="checkbox"
              checked={orderingOnly}
              onChange={(e) => updateFilters('orderingAvailableOnly', e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
            />
            <span>WSNexa Ordering Only</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer min-h-[40px] touch-manipulation">
            <input
              type="checkbox"
              checked={menuOnly}
              onChange={(e) => updateFilters('hasPublicMenuOnly', e.target.checked)}
              className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
            />
            <span>Public Menu Available</span>
          </label>
        </div>
      </div>
    </div>
  );
}
