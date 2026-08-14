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
}

export function ExploreViewSwitcher({
  venues,
  total,
  totalPages,
  page,
  searchParamsObj,
}: ExploreViewSwitcherProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');

  const mappedCount = venues.filter((v) => v.latitude != null).length;

  return (
    <div className="space-y-5 max-w-full">

      {/* ── Mobile Map / List Toggle (< sm) ──────────────────────────── */}
      <div className="flex sm:hidden items-center bg-zinc-100 p-1 rounded-2xl border border-zinc-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation ${
            activeTab === 'list'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300'
          }`}
        >
          <span aria-hidden>📋</span> List View
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation ${
            activeTab === 'map'
              ? 'bg-zinc-950 text-amber-400 shadow-xs'
              : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 active:bg-zinc-300'
          }`}
        >
          <span aria-hidden>🗺️</span> Map View ({mappedCount})
        </button>
      </div>

      {/* ── Mobile Map View ───────────────────────────────────────────── */}
      {activeTab === 'map' && (
        <div className="block sm:hidden space-y-3">
          <GoogleMapView venues={venues} height="480px" />
          <p className="text-center text-xs text-zinc-500 font-bold">
            Showing {venues.length} venues on map
          </p>
        </div>
      )}

      {/* ── List Content (always visible on desktop, conditional on mobile) ── */}
      <div className={activeTab === 'list' ? 'block' : 'hidden sm:block'}>
        <div className="space-y-8">

          {/* Desktop map summary (≥ lg) */}
          <div className="hidden lg:block space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                🗺️ Interactive Nearby Map
              </h3>
              <span className="text-xs text-zinc-500 font-bold">
                {mappedCount} mapped locations
              </span>
            </div>
            <GoogleMapView venues={venues} height="360px" />
          </div>

          {/* Result count row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-bold text-zinc-500">
              Showing <span className="text-zinc-950 font-black">{venues.length}</span> of{' '}
              <span className="text-zinc-950 font-black">{total}</span> venues
            </p>
          </div>

          {/*
           * MOBILE (< sm): horizontal snap rail — same pattern as VenueCarousel.
           * DESKTOP (≥ sm): responsive 2/3/4-column grid.
           */}

          {/* Mobile Rail (< sm) */}
          <div className="block sm:hidden -mx-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-none touch-pan-x">
            <div
              className="flex items-stretch gap-3 px-4 w-max"
              role="list"
              aria-label="Venue results"
            >
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  role="listitem"
                  className="w-[80vw] max-w-[300px] shrink-0 snap-start"
                >
                  <VenueCard compact venue={venue} />
                </div>
              ))}
              <div className="w-3 shrink-0" aria-hidden />
            </div>
          </div>

          {/* Desktop Grid (≥ sm) */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-full">
            {venues.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
              {page > 1 && (
                <Link
                  href={`/explore?${new URLSearchParams({ ...searchParamsObj, page: String(page - 1) }).toString()}`}
                  className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-extrabold text-zinc-950 hover:bg-zinc-100 active:bg-zinc-200 transition-colors min-h-[44px] flex items-center touch-manipulation"
                >
                  ← Previous
                </Link>
              )}
              <span className="text-xs font-bold text-zinc-500 px-3">
                Page {page} of {totalPages} ({total} venues)
              </span>
              {page < totalPages && (
                <Link
                  href={`/explore?${new URLSearchParams({ ...searchParamsObj, page: String(page + 1) }).toString()}`}
                  className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-extrabold text-zinc-950 hover:bg-zinc-100 active:bg-zinc-200 transition-colors min-h-[44px] flex items-center touch-manipulation"
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
