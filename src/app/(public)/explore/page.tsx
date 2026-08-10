import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueRankingService } from '@/server/services/venue-ranking.service';
import { VenueSearchBar } from '@/components/discovery/venue-search-bar';
import { VenueCard } from '@/components/discovery/venue-card';
import { VenueCarousel } from '@/components/discovery/venue-carousel';

export const metadata: Metadata = {
  title: 'Explore Venues | WSNexa Discovery',
  description: 'Discover restaurants, cafes, hotels, resorts, villas and hospitality venues on WSNexa',
};

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    priceLevel?: string;
    city?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10);
  const priceLevel = params.priceLevel ? parseInt(params.priceLevel, 10) : undefined;
  const isDefaultBrowse = !params.q && (!params.category || params.category === 'all') && !params.city;

  const searchResult = await VenueDiscoveryService.searchVenues({
    query: params.q,
    category: params.category,
    priceLevel,
    city: params.city,
    sort: (params.sort as 'recommended' | 'rating' | 'reviews' | 'newest') || 'recommended',
    page,
    limit: 12,
  });

  const { venues, total, totalPages } = searchResult;

  // Fetch ranking sections for default browsing view
  const trendingVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('trending', 6) : [];
  const topRatedVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('top_rated', 6) : [];
  const hiddenGemsVenues = isDefaultBrowse ? await VenueRankingService.getRankedVenues('hidden_gems', 6) : [];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between">
      {/* Public Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 text-zinc-950 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/explore" className="flex items-center gap-2 font-black text-lg uppercase tracking-wider text-zinc-950">
            <span className="text-2xl">🍽️</span> WSNexa Explore
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-extrabold bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-xs transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-950 hover:bg-zinc-800 text-white transition-colors shadow-xs"
            >
              Join Customer Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Title Hero */}
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
            Discover Great Hospitality Venues
          </h1>
          <p className="text-sm font-medium text-zinc-600 max-w-2xl leading-relaxed">
            Browse verified restaurants, cafes, hotels, resorts, and villas. View menus, save favorites, and place orders directly.
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

        {/* Results Grid */}
        {venues.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                {page > 1 && (
                  <Link
                    href={`/explore?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold hover:bg-zinc-100 transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                <span className="text-xs font-bold text-zinc-500 px-3">
                  Page {page} of {totalPages} ({total} venues)
                </span>
                {page < totalPages && (
                  <Link
                    href={`/explore?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold hover:bg-zinc-100 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty Search State */
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center space-y-4 shadow-sm max-w-lg mx-auto my-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              🔍
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-950">No venues match your search</h3>
              <p className="text-xs text-zinc-500 font-medium">
                Try searching for a different city, adjusting category filters, or resetting your query.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-block px-5 py-2.5 rounded-xl bg-zinc-950 text-white font-extrabold text-xs hover:bg-amber-500 hover:text-black transition-all"
            >
              Clear Filters
            </Link>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="bg-white border-t border-zinc-200 text-zinc-600 text-xs py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-zinc-950 font-black uppercase tracking-wider">
            <span>🍽️</span> WSNexa Venue Discovery
          </div>
          <div>© {new Date().getFullYear()} WSNexa. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
