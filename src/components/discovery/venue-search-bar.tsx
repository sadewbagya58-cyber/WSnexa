'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const CATEGORIES = [
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
  const [isPending, startTransition] = useTransition();

  // ── Local / Optimistic State for 0ms visual feedback ───────────────────────
  const [localQuery, setLocalQuery] = useState(searchParams.get('q') || '');
  const [localCategory, setLocalCategory] = useState(searchParams.get('category') || 'all');
  const [localPrice, setLocalPrice] = useState(searchParams.get('priceLevel') || '');
  const [localSort, setLocalSort] = useState(searchParams.get('sort') || 'recommended');
  const [localRadius, setLocalRadius] = useState(searchParams.get('radiusKm') || '25');
  const [localOrderingOnly, setLocalOrderingOnly] = useState(searchParams.get('orderingAvailableOnly') === 'true');
  const [localMenuOnly, setLocalMenuOnly] = useState(searchParams.get('hasPublicMenuOnly') === 'true');

  // Filter drawer / sheet state for mobile
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Geolocation states
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<{ title: string; message: string; isBlocked?: boolean } | null>(null);

  const hasLocationActive = searchParams.has('userLat') && searchParams.has('userLng');

  // Count active secondary filters for the filter button badge
  const activeFilterCount = [
    Boolean(localPrice),
    localSort !== 'recommended' && localSort !== 'nearest',
    localOrderingOnly,
    localMenuOnly,
    hasLocationActive && localRadius !== '25',
  ].filter(Boolean).length;

  // Keep local state in sync when URL searchParams change (e.g. back/forward navigation)
  useEffect(() => {
    setLocalQuery(searchParams.get('q') || '');
    setLocalCategory(searchParams.get('category') || 'all');
    setLocalPrice(searchParams.get('priceLevel') || '');
    setLocalSort(searchParams.get('sort') || 'recommended');
    setLocalRadius(searchParams.get('radiusKm') || '25');
    setLocalOrderingOnly(searchParams.get('orderingAvailableOnly') === 'true');
    setLocalMenuOnly(searchParams.get('hasPublicMenuOnly') === 'true');
  }, [searchParams]);

  // ── Batch URL update helper with React startTransition ─────────────────────
  const applyFilterUpdates = useCallback(
    (updates: Record<string, string | boolean | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== false && value !== 'all') {
          params.set(key, String(value));
        } else {
          params.delete(key);
        }
      });

      params.set('page', '1');

      startTransition(() => {
        router.push(`/explore?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  // ── Category selection with instant optimistic reaction ───────────────────
  const handleCategorySelect = (catValue: string) => {
    if (isPending) return; // Prevent duplicate taps during transition
    setLocalCategory(catValue);
    applyFilterUpdates({ category: catValue });
  };

  // ── Filter toggles with instant optimistic reaction ───────────────────────
  const handleOrderingToggle = () => {
    if (isPending) return;
    const nextVal = !localOrderingOnly;
    setLocalOrderingOnly(nextVal);
    applyFilterUpdates({ orderingAvailableOnly: nextVal });
  };

  const handleMenuToggle = () => {
    if (isPending) return;
    const nextVal = !localMenuOnly;
    setLocalMenuOnly(nextVal);
    applyFilterUpdates({ hasPublicMenuOnly: nextVal });
  };

  const handlePriceChange = (priceVal: string) => {
    setLocalPrice(priceVal);
    applyFilterUpdates({ priceLevel: priceVal });
  };

  const handleSortChange = (sortVal: string) => {
    setLocalSort(sortVal);
    applyFilterUpdates({ sort: sortVal });
  };

  const handleRadiusChange = (radiusVal: string) => {
    setLocalRadius(radiusVal);
    applyFilterUpdates({ radiusKm: radiusVal });
  };

  // ── Search form submit ───────────────────────────────────────────────────
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = (formData.get('q') as string) || '';
    setLocalQuery(query);
    applyFilterUpdates({ q: query.trim() });
  };

  const handleClearSearch = () => {
    setLocalQuery('');
    applyFilterUpdates({ q: null });
  };

  // ── Near Me / Robust Geolocation Permission & Error Handling ───────────────
  const handleNearMe = async () => {
    if (locating || isPending) return;

    if (!navigator.geolocation) {
      setLocError({
        title: 'Geolocation Unsupported',
        message: 'Your browser does not support GPS location. Please search by city or cuisine instead.',
      });
      return;
    }

    setLocating(true);
    setLocError(null);

    // Check Permissions API if available to know beforehand if blocked
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm.state === 'denied') {
          setLocating(false);
          setLocError({
            title: 'Location Permission Blocked',
            message:
              'Location access is blocked for this site. Tap the lock/tune icon in your browser address bar to allow location permissions, then retry.',
            isBlocked: true,
          });
          return;
        }
      } catch {
        // Permissions API query not supported for geolocation on all browsers, continue
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setLocError(null);
        setLocalSort('nearest');
        applyFilterUpdates({
          userLat: pos.coords.latitude.toFixed(6),
          userLng: pos.coords.longitude.toFixed(6),
          sort: 'nearest',
        });
      },
      (err) => {
        setLocating(false);
        console.warn('[VenueSearchBar] Geolocation error:', err.code, err.message);

        // Distinguish the exact error cause
        if (err.code === err.PERMISSION_DENIED) {
          setLocError({
            title: 'Permission Denied',
            message:
              'Browser location permission was not granted. Please allow location access in your browser or search by city.',
            isBlocked: true,
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocError({
            title: 'GPS Unavailable',
            message:
              'Device location is currently unavailable. Please check that your device GPS / location services are switched ON.',
          });
        } else if (err.code === err.TIMEOUT) {
          setLocError({
            title: 'Request Timed Out',
            message:
              'Acquiring your location timed out. Please check your signal and tap Retry.',
          });
        } else {
          setLocError({
            title: 'Location Error',
            message: 'Unable to determine your current position. You can search by city or cuisine.',
          });
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 30000 }
    );
  };

  const handleClearLocation = () => {
    applyFilterUpdates({
      userLat: null,
      userLng: null,
      sort: localSort === 'nearest' ? 'recommended' : localSort,
    });
  };

  const selectClass =
    'bg-white border border-zinc-200 text-zinc-900 text-xs font-bold px-3 py-2.5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px] w-full cursor-pointer touch-manipulation shadow-2xs transition-all';

  return (
    <div className="space-y-3.5">
      {/* ── Search Input + Filter Trigger (Reference-inspired Hero Search) ─── */}
      <div className="flex items-center gap-2">
        <form
          onSubmit={handleSearchSubmit}
          className="flex-1 flex items-center gap-2 bg-white p-1.5 sm:p-2 rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-sm focus-within:ring-2 focus-within:ring-zinc-950 focus-within:border-transparent transition-all"
        >
          <span className="pl-3 text-base text-zinc-400 shrink-0" aria-hidden>
            🔍
          </span>
          <input
            name="q"
            type="text"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Search venue name, city, cuisine..."
            className="flex-1 bg-transparent px-1 py-2 text-xs sm:text-sm font-semibold text-zinc-950 placeholder-zinc-400 focus:outline-none min-w-0"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 text-xs font-bold shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}

          {/* Inline Filter Drawer Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFilterSheetOpen(!isFilterSheetOpen)}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center min-h-[40px] min-w-[40px] transition-all touch-manipulation active:scale-95 ${
              activeFilterCount > 0
                ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
            }`}
            aria-label="Toggle filter options"
          >
            <span className="text-sm">⚙️</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 text-[10px] font-black bg-amber-400 text-black px-1.5 py-0.2 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Search Action Button */}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-xs transition-all min-h-[42px] touch-manipulation active:scale-[0.98] focus:outline-none shrink-0 disabled:opacity-60 flex items-center gap-1.5"
          >
            {isPending && <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />}
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* ── Geolocation Error / Warning Banner with Retry ─────────────────── */}
      {locError && (
        <div
          className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-xs text-amber-950 font-semibold space-y-2 shadow-xs animate-in fade-in"
          role="alert"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">📍</span>
              <span className="font-extrabold text-amber-900">{locError.title}</span>
            </div>
            <button
              type="button"
              onClick={() => setLocError(null)}
              className="text-amber-800 hover:text-black font-bold text-xs min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg"
              aria-label="Dismiss message"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
            {locError.message}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleNearMe}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition-all touch-manipulation active:scale-95 shadow-2xs"
            >
              🔄 Retry Location
            </button>
            <button
              type="button"
              onClick={() => setLocError(null)}
              className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 font-bold text-[11px] hover:bg-amber-100 transition-all touch-manipulation"
            >
              Search by City Instead
            </button>
          </div>
        </div>
      )}

      {/* ── Category Chips (Reference-Inspired Responsive Chip Row) ──────── */}
      <div
        className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none -mx-4 sm:mx-0 px-4 sm:px-0 touch-pan-x"
        role="group"
        aria-label="Filter by category"
      >
        {CATEGORIES.map((cat) => {
          const active = localCategory === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              disabled={isPending}
              onClick={() => handleCategorySelect(cat.value)}
              aria-pressed={active}
              className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-black transition-all duration-150 shrink-0 min-h-[44px] flex items-center gap-1.5 touch-manipulation active:scale-[0.97] focus:outline-none ${
                active
                  ? 'bg-zinc-950 text-white shadow-sm ring-2 ring-zinc-950 ring-offset-1'
                  : 'bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-800 border border-zinc-200/90'
              }`}
            >
              <span aria-hidden className="text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Compact Filter Control Row (Near Me, Price, Sort, More Filters) ── */}
      <div className="pt-2 border-t border-zinc-200/80 space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Near Me CTA Button */}
          <div>
            {hasLocationActive ? (
              <button
                type="button"
                onClick={handleClearLocation}
                disabled={isPending}
                className="w-full px-3 py-2.5 rounded-2xl bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 border border-emerald-300 text-emerald-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation active:scale-[0.98]"
              >
                <span>📍 Nearby Active</span>
                <span className="text-emerald-700 font-black" aria-label="Clear location">✕</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNearMe}
                disabled={locating || isPending}
                className="w-full px-3 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation disabled:opacity-60 active:scale-[0.98] shadow-xs"
                aria-label={locating ? 'Locating your position...' : 'Find venues near me'}
              >
                {locating ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-black animate-ping" />
                    <span>Locating…</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden>📍</span>
                    <span>Near Me</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Price Level Selector */}
          <div>
            <label className="sr-only" htmlFor="filter-price">Price level</label>
            <select
              id="filter-price"
              value={localPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
              className={selectClass}
            >
              <option value="">Price: All</option>
              <option value="1">$ Budget</option>
              <option value="2">$$ Moderate</option>
              <option value="3">$$$ Upscale</option>
              <option value="4">$$$$ Luxury</option>
            </select>
          </div>

          {/* Sort Order Selector */}
          <div>
            <label className="sr-only" htmlFor="filter-sort">Sort order</label>
            <select
              id="filter-sort"
              value={localSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className={selectClass}
            >
              <option value="recommended">Sort: Recommended</option>
              {hasLocationActive && <option value="nearest">Sort: Nearest First</option>}
              <option value="rating">Sort: Top Rated</option>
              <option value="reviews">Sort: Most Reviewed</option>
              <option value="trending">Sort: Trending</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>

          {/* Radius Selector (when GPS is active) OR Secondary Filter Sheet Trigger */}
          <div>
            {hasLocationActive ? (
              <>
                <label className="sr-only" htmlFor="filter-radius">Search radius</label>
                <select
                  id="filter-radius"
                  value={localRadius}
                  onChange={(e) => handleRadiusChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="5">Radius: 5 km</option>
                  <option value="10">Radius: 10 km</option>
                  <option value="25">Radius: 25 km</option>
                  <option value="50">Radius: 50 km</option>
                  <option value="100">Radius: 100 km</option>
                </select>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(!isFilterSheetOpen)}
                className={`w-full px-3 py-2.5 rounded-2xl border text-xs font-extrabold flex items-center justify-center gap-1.5 min-h-[44px] transition-all touch-manipulation active:scale-[0.98] ${
                  isFilterSheetOpen || activeFilterCount > 0
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
                    : 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200/90'
                }`}
              >
                <span>⚙️ More Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-amber-400 text-black px-1.5 py-0.2 rounded-full text-[10px] font-black">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Feature Toggle Pills (Instant Optimistic Toggle) ─────────────── */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* WSNexa Ordering Only Toggle Pill */}
          <button
            type="button"
            disabled={isPending}
            onClick={handleOrderingToggle}
            aria-pressed={localOrderingOnly}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all duration-150 touch-manipulation min-h-[44px] active:scale-[0.97] focus:outline-none ${
              localOrderingOnly
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black border ${
              localOrderingOnly ? 'bg-white text-emerald-700 border-transparent' : 'border-zinc-300'
            }`}>
              {localOrderingOnly ? '✓' : ''}
            </span>
            <span>WSNexa Ordering Only</span>
          </button>

          {/* Public Menu Available Toggle Pill */}
          <button
            type="button"
            disabled={isPending}
            onClick={handleMenuToggle}
            aria-pressed={localMenuOnly}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-extrabold transition-all duration-150 touch-manipulation min-h-[44px] active:scale-[0.97] focus:outline-none ${
              localMenuOnly
                ? 'bg-amber-500 text-black shadow-sm ring-2 ring-amber-500 ring-offset-1'
                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-black border ${
              localMenuOnly ? 'bg-black text-amber-400 border-transparent' : 'border-zinc-300'
            }`}>
              {localMenuOnly ? '✓' : ''}
            </span>
            <span>📖 Public Menu Available</span>
          </button>
        </div>

        {/* ── More Filters Drawer / Surface (Mobile Friendly) ─────────────── */}
        {isFilterSheetOpen && (
          <div className="p-4 rounded-3xl bg-white border border-zinc-200/90 shadow-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950">
                Filter &amp; Refine Venues
              </h3>
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="text-zinc-400 hover:text-zinc-950 text-xs font-bold min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Feature checkboxes in sheet */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  Service Availability
                </span>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-white cursor-pointer touch-manipulation">
                    <span className="font-extrabold text-zinc-900">✓ In-App WSNexa Ordering Only</span>
                    <input
                      type="checkbox"
                      checked={localOrderingOnly}
                      onChange={handleOrderingToggle}
                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-white cursor-pointer touch-manipulation">
                    <span className="font-extrabold text-zinc-900">📖 Public Live Menu Available</span>
                    <input
                      type="checkbox"
                      checked={localMenuOnly}
                      onChange={handleMenuToggle}
                      className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Reset Filters CTA */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setLocalQuery('');
                    setLocalCategory('all');
                    setLocalPrice('');
                    setLocalSort('recommended');
                    setLocalRadius('25');
                    setLocalOrderingOnly(false);
                    setLocalMenuOnly(false);
                    setIsFilterSheetOpen(false);
                    startTransition(() => {
                      router.push('/explore');
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-colors min-h-[44px]"
                >
                  Clear All Filters
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-zinc-950 text-white text-xs font-black hover:bg-zinc-800 transition-colors min-h-[44px]"
                >
                  Apply &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
