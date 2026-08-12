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

  return (
    <div className="space-y-6 max-w-full">
      {/* Mobile Map / List Toggle Bar (375px touch-friendly 44px+ buttons) */}
      <div className="flex sm:hidden items-center justify-between bg-zinc-200/80 p-1 rounded-2xl border border-zinc-300">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
            activeTab === 'list'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <span>📋</span> List View
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
            activeTab === 'map'
              ? 'bg-zinc-950 text-amber-400 shadow-xs'
              : 'text-zinc-700 hover:text-zinc-950'
          }`}
        >
          <span>🗺️</span> Map View ({venues.filter((v) => v.latitude != null).length})
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="space-y-6">
        {/* Mobile Map View */}
        {activeTab === 'map' && (
          <div className="block sm:hidden space-y-4">
            <GoogleMapView venues={venues} height="480px" />
            <div className="text-center text-xs text-zinc-500 font-bold">
              Showing {venues.length} venues on map
            </div>
          </div>
        )}

        {/* Mobile List View OR Desktop Split/Grid View */}
        <div className={activeTab === 'list' ? 'block' : 'hidden sm:block'}>
          {/* Desktop Map + Grid Responsive Split Layout */}
          <div className="space-y-8">
            {/* Desktop Map Summary Section */}
            <div className="hidden lg:block space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">
                  🗺️ Interactive Nearby Map
                </h3>
                <span className="text-xs text-zinc-500 font-bold">
                  {venues.filter((v) => v.latitude != null).length} mapped locations
                </span>
              </div>
              <GoogleMapView venues={venues} height="360px" />
            </div>

            {/* Venues Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-full">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6 flex-wrap">
                {page > 1 && (
                  <Link
                    href={`/explore?${new URLSearchParams({ ...searchParamsObj, page: String(page - 1) }).toString()}`}
                    className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-extrabold hover:bg-zinc-100 transition-colors min-h-[44px] flex items-center"
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
                    className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-extrabold hover:bg-zinc-100 transition-colors min-h-[44px] flex items-center"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
