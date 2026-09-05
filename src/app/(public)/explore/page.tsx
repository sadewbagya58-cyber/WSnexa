import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueRankingService } from '@/server/services/venue-ranking.service';
import { VenueSearchBar } from '@/components/discovery/venue-search-bar';
import { VenueCarousel } from '@/components/discovery/venue-carousel';
import { ExploreViewSwitcher } from '@/components/discovery/explore-view-switcher';
import { PublicBottomNav } from '@/components/discovery/public-bottom-nav';

export const metadata: Metadata = {
  title: 'Explore Hospitality Venues & In-App Maps | WSNexa',
  description:
    'Discover nearby restaurants, cafes, hotels, resorts, and villas with in-app directions, menus, table reservations, and verified reviews on WSNexa.',
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Fetch ranking sections when in default browsing view
  const [trendingVenues, topRatedVenues, hiddenGemsVenues, recommendedVenues] = isDefaultBrowse
    ? await Promise.all([
        VenueRankingService.getRankedVenues('trending', 6),
        VenueRankingService.getRankedVenues('top_rated', 6),
        VenueRankingService.getRankedVenues('hidden_gems', 6),
        VenueRankingService.getPersonalizedRecommendations(user ? user.id : null, 6),
      ])
    : [[], [], [], []];

  const userLocation = userLat != null && userLng != null ? { lat: userLat, lng: userLng } : null;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between overflow-x-hidden max-w-full">
      {/* ── Main Explore Experience ─────────────────────────────────── */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-7 max-w-full">

        {/* ── Mobile-First Hero Section ─────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-6 sm:p-10 shadow-lg border border-zinc-800">
          <div className="relative z-10 max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-black tracking-wider uppercase">
              <span>🍽️</span> WSNexa Discovery &amp; Maps
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Discover Hospitality Venues Near You
            </h1>
            <p className="text-xs sm:text-sm font-medium text-zinc-300 leading-relaxed">
              Explore curated restaurants, cafes, luxury resorts, and villas with live menus, in-app directions, and table reservations.
            </p>
          </div>

          {/* Decorative background glow */}
          <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ── Interactive Search & Filters Bar ──────────────────────── */}
        <VenueSearchBar />

        {/* ── Default Curated Discovery Carousels ───────────────────── */}
        {isDefaultBrowse && (
          <div className="space-y-4 pt-1 border-t border-zinc-200/80">
            {recommendedVenues.length > 0 && user && (
              <VenueCarousel
                title="✨ Recommended For You"
                subtitle="Curated based on your dining history and favorite spots"
                venues={recommendedVenues}
                isLoggedIn={!!user}
                seeAllHref="/explore?sort=recommended"
              />
            )}

            <VenueCarousel
              title="🔥 Trending Now"
              subtitle="Popular venues with fast-growing recent orders & customer engagement"
              venues={trendingVenues}
              isLoggedIn={!!user}
              seeAllHref="/explore?sort=trending"
            />

            <VenueCarousel
              title="⭐ Top Rated Venues"
              subtitle="Highest rating confidence calculated from verified customer visits"
              venues={topRatedVenues}
              isLoggedIn={!!user}
              seeAllHref="/explore?sort=rating"
            />

            {hiddenGemsVenues.length > 0 && (
              <VenueCarousel
                title="💎 Hidden Gems"
                subtitle="Exceptional verified ratings in undiscovered spots"
                venues={hiddenGemsVenues}
                isLoggedIn={!!user}
                seeAllHref="/explore?sort=rating"
              />
            )}
          </div>
        )}

        {/* ── Results View Switcher (List vs Map) ───────────────────── */}
        {venues.length > 0 ? (
          <ExploreViewSwitcher
            venues={venues}
            total={total}
            totalPages={totalPages}
            page={page}
            searchParamsObj={params as Record<string, string>}
            userLocation={userLocation}
            isLoggedIn={!!user}
          />
        ) : (
          /* ── Empty State ─────────────────────────────────────────── */
          <div className="rounded-3xl border border-zinc-200 bg-white p-10 sm:p-14 text-center space-y-4 shadow-sm max-w-lg mx-auto my-8 animate-in fade-in">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
              🔍
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-zinc-950">No venues match your filters</h3>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                Try searching for a different city or cuisine, increasing search radius, or clearing filters.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-zinc-950 text-white font-black text-xs hover:bg-zinc-800 transition-all min-h-[44px] active:scale-[0.98] shadow-xs"
            >
              Clear All Filters
            </Link>
          </div>
        )}
      </main>

      {/* ── Mobile Persistent Bottom Navigation ────────────────────── */}
      <PublicBottomNav isLoggedIn={!!user} />
    </div>
  );
}
