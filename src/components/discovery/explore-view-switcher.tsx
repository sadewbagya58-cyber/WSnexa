'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';
import { VenueCard } from '@/components/discovery/venue-card';
import { GoogleMapView } from '@/components/maps/google-map-view';

interface ExploreViewSwitcherProps {
  venues: VenuePublicProfileRecord[];
  total: number;
  totalPages: number;
  page: number;
  searchParamsObj: Record<string, string>;
  userLocation?: { lat: number; lng: number } | null;
  isLoggedIn?: boolean;
}

export function ExploreViewSwitcher({
  venues,
  total,
  totalPages,
  page,
  searchParamsObj,
  userLocation,
  isLoggedIn = false,
}: ExploreViewSwitcherProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  const mappedCount = venues.filter((v) => v.latitude != null).length;

  return (
    <div className="space-y-6 max-w-full">

      {/* ── Mobile Map / List View Toggle Switcher (< sm) ──────────── */}
      <div className="flex sm:hidden items-center bg-zinc-200/70 p-1 rounded-2xl border border-zinc-300/80 gap-1 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:scale-[0.98] ${
            activeTab === 'list'
              ? 'bg-zinc-950 text-white shadow-sm'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          <span aria-hidden>📋</span>
          <span>List View ({venues.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:scale-[0.98] ${
            activeTab === 'map'
              ? 'bg-zinc-950 text-amber-400 shadow-sm'
              : 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100'
          }`}
        >
          <span aria-hidden>🗺️</span>
          <span>Map View ({mappedCount})</span>
        </button>
      </div>

      {/* ── Mobile Map View Screen ─────────────────────────────────── */}
      {activeTab === 'map' && (
        <div className="block sm:hidden space-y-3">
          <GoogleMapView
            venues={venues}
            userLocation={userLocation}
            height="520px"
          />
          <p className="text-center text-xs text-zinc-500 font-bold">
            Tap any venue marker to preview in-app route &amp; directions
          </p>
        </div>
      )}

      {/* ── List Content (conditional on mobile, always visible on desktop) ── */}
      <div className={activeTab === 'list' ? 'block' : 'hidden sm:block'}>
        <div className="space-y-6">

          {/* Desktop map summary section (≥ lg) */}
          <div className="hidden lg:block space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                <span>🗺️</span> Interactive Discovery Map
              </h3>
              <span className="text-xs text-zinc-500 font-bold">
                {mappedCount} mapped locations
              </span>
            </div>
            <GoogleMapView
              venues={venues}
              userLocation={userLocation}
              height="380px"
            />
          </div>

          {/* Result count & active query summary */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <h2 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
              All Results
            </h2>
            <p className="text-xs font-bold text-zinc-500">
              Showing <span className="text-zinc-950 font-black">{venues.length}</span> of{' '}
              <span className="text-zinc-950 font-black">{total}</span> venues
            </p>
          </div>

          {/*
           * Mobile: clean responsive vertical stack with spacious card layouts.
           * Tablet/Desktop: responsive multi-column grid.
           */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-full">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6 flex-wrap border-t border-zinc-200/80">
              {page > 1 && (
                <Link
                  href={`/explore?${new URLSearchParams({ ...searchParamsObj, page: String(page - 1) }).toString()}`}
                  className="px-5 py-2.5 rounded-2xl bg-white border border-zinc-300 text-xs font-black text-zinc-950 hover:bg-zinc-100 active:bg-zinc-200 transition-all min-h-[44px] flex items-center touch-manipulation active:scale-[0.98] shadow-2xs"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-xs font-bold text-zinc-600 px-3">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/explore?${new URLSearchParams({ ...searchParamsObj, page: String(page + 1) }).toString()}`}
                  className="px-5 py-2.5 rounded-2xl bg-white border border-zinc-300 text-xs font-black text-zinc-950 hover:bg-zinc-100 active:bg-zinc-200 transition-all min-h-[44px] flex items-center touch-manipulation active:scale-[0.98] shadow-2xs"
                >
                  Next →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
