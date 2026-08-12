import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueRankingService } from '@/server/services/venue-ranking.service';
import { VenueSearchBar } from '@/components/discovery/venue-search-bar';
import { VenueCarousel } from '@/components/discovery/venue-carousel';
import { ExploreViewSwitcher } from '@/components/discovery/explore-view-switcher';

export const metadata: Metadata = {
  title: 'Explore Venues & Map | WSNexa Discovery',
  description: 'Discover nearby restaurants, cafes, hotels, resorts, villas and hospitality venues on WSNexa',
};

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    priceLevel?: string;
    city?: string;
    sort?: string;
    page?: string;
    userLat?: string;
    userLng?: string;
    radiusKm?: string;
    orderingAvailableOnly?: string;
    hasPublicMenuOnly?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10);
  const priceLevel = params.priceLevel ? parseInt(params.priceLevel, 10) : undefined;
  const userLat = params.userLat ? parseFloat(params.userLat) : undefined;
  const userLng = params.userLng ? parseFloat(params.userLng) : undefined;
  const radiusKm = params.radiusKm ? parseFloat(params.radiusKm) : undefined;
  const orderingAvailableOnly = params.orderingAvailableOnly === 'true';
  const hasPublicMenuOnly = params.hasPublicMenuOnly === 'true';

  const isDefaultBrowse =
    !params.q &&
    (!params.category || params.category === 'all') &&
    !params.city &&
    !userLat &&
    !orderingAvailableOnly &&
    !hasPublicMenuOnly;

  const searchResult = await VenueDiscoveryService.searchVenues({
    query: params.q,
    category: params.category,
    priceLevel,
    city: params.city,
    userLat,
    userLng,
    radiusKm,
    orderingAvailableOnly,
    hasPublicMenuOnly,
    sort:
      (params.sort as 'recommended' | 'nearest' | 'rating' | 'reviews' | 'trending' | 'newest') ||
      (userLat != null ? 'nearest' : 'recommended'),
    page,
    limit: 12,
  });

  const { venues, total, totalPages } = searchResult;

  // Fetch ranking sections for default browsing view
  const trendingVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('trending', 6) : [];
  const topRatedVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('top_rated', 6) : [];
  const hiddenGemsVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('hidden_gems', 6) : [];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between overflow-x-hidden max-w-full">
      {/* Public Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 text-zinc-950 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/explore" className="flex items-center gap-2 font-black text-lg uppercase tracking-wider text-zinc-950">
            <span className="text-2xl">🍽️</span> WSNexa Explore
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-xs transition-colors min-h-[38px] flex items-center"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-950 hover:bg-zinc-800 text-white transition-colors shadow-xs min-h-[38px] flex items-center"
            >
              Join Customer Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8 max-w-full">
        {/* Title Hero */}
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Discover Hospitality Venues Near You
          </h1>
          <p className="text-sm font-medium text-zinc-600 max-w-2xl leading-relaxed">
            Browse verified restaurants, cafes, hotels, resorts, and villas with location maps, menus, and direct ordering.
          </p>
        </div>

        {/* Search & Filter Component */}
        <VenueSearchBar />

        {/* Trending & Ranking Sections (when browsing defaults) */}
        {isDefaultBrowse && (
          <div className="space-y-6 pt-2 border-t border-zinc-200">
            <VenueCarousel
              title="🔥 Trending Now"
              subtitle="Popular venues with fast-growing recent orders & customer engagement"
              venues={trendingVenues}
            />

            <VenueCarousel
              title="⭐ Top Rated Venues"
              subtitle="Highest rating confidence calculated from verified customer visits"
              venues={topRatedVenues}
            />

            {hiddenGemsVenues.length > 0 && (
              <VenueCarousel
                title="💎 Hidden Gems"
                subtitle="Exceptional verified ratings in undiscovered spots"
                venues={hiddenGemsVenues}
              />
            )}
          </div>
        )}

        {/* Results View Switcher (Map / List) */}
        {venues.length > 0 ? (
          <ExploreViewSwitcher
            venues={venues}
            total={total}
            totalPages={totalPages}
            page={page}
            searchParamsObj={params as Record<string, string>}
          />
        ) : (
          /* Empty Search State */
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-4 shadow-sm max-w-lg mx-auto my-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              🔍
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-950">No venues match your search</h3>
              <p className="text-xs text-zinc-500 font-medium">
                Try searching for a different city, increasing search radius, or clearing category filters.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-block px-5 py-2.5 rounded-xl bg-zinc-950 text-white font-extrabold text-xs hover:bg-amber-500 hover:text-black transition-all min-h-[44px]"
            >
              Clear All Filters
            </Link>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-zinc-200 text-zinc-600 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-950 font-black uppercase tracking-wider">
            <span>🍽️</span> WSNexa Venue Discovery & Maps
          </div>
          <div>© {new Date().getFullYear()} WSNexa. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
