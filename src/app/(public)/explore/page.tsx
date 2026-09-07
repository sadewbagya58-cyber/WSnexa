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

import { VenueRankingMetrics } from '@/lib/validation/ranking';

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    priceLevel?: string;
    city?: string;
    sort?: string;
    section?: string;
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

  const section = params.section;
  const hasSpecificSort = Boolean(
    params.sort &&
    params.sort !== 'recommended' &&
    params.sort !== 'nearest'
  );

  const isDefaultBrowse =
    !params.q &&
    (!params.category || params.category === 'all') &&
    !params.city &&
    !userLat &&
    !orderingAvailableOnly &&
    !hasPublicMenuOnly &&
    !hasSpecificSort &&
    !section;

  const limit = section ? 50 : 12;
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
      (section === 'trending'
        ? 'trending'
        : section === 'top_rated'
        ? 'rating'
        : userLat != null
        ? 'nearest'
        : 'recommended'),
    page,
    limit,
  });

  let { venues, total, totalPages } = searchResult;

  if (section) {
    let rankedMetrics: VenueRankingMetrics[] = [];
    if (section === 'trending') {
      rankedMetrics = await VenueRankingService.getRankedVenues('trending', 50);
    } else if (section === 'top_rated') {
      rankedMetrics = await VenueRankingService.getRankedVenues('top_rated', 50);
    } else if (section === 'hidden_gems') {
      rankedMetrics = await VenueRankingService.getRankedVenues('hidden_gems', 50);
    } else if (section === 'recommended') {
      rankedMetrics = await VenueRankingService.getPersonalizedRecommendations(user ? user.id : null, 50);
    }

    if (rankedMetrics.length > 0) {
      const rankOrderMap = new Map<string, number>();
      const tagMap = new Map<string, string>();
      rankedMetrics.forEach((m, idx) => {
        rankOrderMap.set(m.venueId, idx);
        if (m.explanationTag || m.recommendationReason) {
          tagMap.set(m.venueId, m.explanationTag || m.recommendationReason || '');
        }
      });

      if (section === 'hidden_gems') {
        venues = venues
          .filter((v) => rankOrderMap.has(v.id))
          .sort((a, b) => (rankOrderMap.get(a.id) ?? 999) - (rankOrderMap.get(b.id) ?? 999))
          .map((v) => ({
            ...v,
            short_description: tagMap.get(v.id) || v.short_description,
          }));
      } else {
        venues = [...venues]
          .sort((a, b) => {
            const rankA = rankOrderMap.has(a.id) ? (rankOrderMap.get(a.id) as number) : 9999;
            const rankB = rankOrderMap.has(b.id) ? (rankOrderMap.get(b.id) as number) : 9999;
            return rankA - rankB;
          })
          .map((v) => ({
            ...v,
            short_description: tagMap.get(v.id) || v.short_description,
          }));
      }
      total = venues.length;
      totalPages = Math.ceil(total / 12) || 1;
    }
  }

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

        {/* ── Active Section Banner (When navigating from "See All →") ─ */}
        {section && (
          <div className="flex items-center justify-between bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-zinc-950">
                  {section === 'trending' && '🔥 Trending Now'}
                  {section === 'top_rated' && '⭐ Top Rated Venues'}
                  {section === 'hidden_gems' && '💎 Hidden Gems'}
                  {section === 'recommended' && '✨ Recommended For You'}
                  {!['trending', 'top_rated', 'hidden_gems', 'recommended'].includes(section) &&
                    `Curated Collection (${section})`}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  {venues.length} {venues.length === 1 ? 'venue' : 'venues'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-medium">
                {section === 'trending' && 'Popular venues with fast-growing recent orders & customer engagement'}
                {section === 'top_rated' && 'Highest rating confidence calculated from verified customer visits'}
                {section === 'hidden_gems' && 'Exceptional verified ratings in undiscovered spots'}
                {section === 'recommended' && 'Curated based on your dining history and favorite spots'}
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 rounded-xl transition-all min-h-[44px] touch-manipulation active:scale-95 shrink-0"
            >
              <span>← Back to Explore</span>
            </Link>
          </div>
        )}

        {/* ── Default Curated Discovery Carousels ───────────────────── */}
        {isDefaultBrowse && (
          <div className="space-y-4 pt-1 border-t border-zinc-200/80">
            {recommendedVenues.length > 0 && user && (
              <VenueCarousel
                title="✨ Recommended For You"
                subtitle="Curated based on your dining history and favorite spots"
                venues={recommendedVenues}
                isLoggedIn={!!user}
                seeAllHref="/explore?section=recommended"
              />
            )}

            <VenueCarousel
              title="🔥 Trending Now"
              subtitle="Popular venues with fast-growing recent orders & customer engagement"
              venues={trendingVenues}
              isLoggedIn={!!user}
              seeAllHref="/explore?section=trending"
            />

            <VenueCarousel
              title="⭐ Top Rated Venues"
              subtitle="Highest rating confidence calculated from verified customer visits"
              venues={topRatedVenues}
              isLoggedIn={!!user}
              seeAllHref="/explore?section=top_rated"
            />

            {hiddenGemsVenues.length > 0 && (
              <VenueCarousel
                title="💎 Hidden Gems"
                subtitle="Exceptional verified ratings in undiscovered spots"
                venues={hiddenGemsVenues}
                isLoggedIn={!!user}
                seeAllHref="/explore?section=hidden_gems"
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
