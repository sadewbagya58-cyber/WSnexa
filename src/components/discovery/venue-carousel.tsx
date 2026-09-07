'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { VenueCard } from './venue-card';
import { VenueRankingMetrics } from '@/lib/validation/ranking';

interface VenueCarouselProps {
  title: string;
  subtitle?: string;
  venues: VenueRankingMetrics[];
  isLoggedIn?: boolean;
  seeAllHref?: string;
}

export function VenueCarousel({ title, subtitle, venues, isLoggedIn = false, seeAllHref }: VenueCarouselProps) {
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset navigating state when venues or seeAllHref changes
  useEffect(() => {
    setIsNavigating(false);
  }, [seeAllHref, venues]);

  if (!venues || venues.length === 0) return null;

  return (
    <div className="space-y-3 py-3">
      {/* Section Header with Title, Subtitle, and See All Action */}
      <div className="flex items-center justify-between gap-2 px-1 sm:px-0">
        <div>
          <h2 className="text-base sm:text-lg font-black text-zinc-950 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs font-semibold text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            prefetch={true}
            onClick={() => setIsNavigating(true)}
            className={`text-xs font-black text-amber-600 hover:text-amber-700 shrink-0 min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-amber-50 active:scale-95 transition-all touch-manipulation ${
              isNavigating ? 'opacity-75 pointer-events-none' : ''
            }`}
            aria-label={`See all ${title} venues`}
          >
            {isNavigating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <span>See All →</span>
            )}
          </Link>
        )}
      </div>

      {/*
       * Horizontal snap rail with dual-axis touch support and momentum scrolling.
       * Viewport relative width ensures 2 cards are clearly recognizable on mobile.
       */}
      <div
        className="-mx-4 sm:mx-0 overflow-x-auto pb-4 pt-1 snap-x snap-proximity overscroll-x-contain scrollbar-none touch-pan-x touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div
          className="flex items-stretch gap-2.5 sm:gap-4 px-4 sm:px-0 w-max"
          role="list"
          aria-label={title}
        >
          {venues.map((v) => (
            <div
              key={v.venueId}
              role="listitem"
              className="w-[calc(50vw-1.25rem)] min-w-[150px] max-w-[210px] sm:w-[290px] sm:max-w-none lg:w-[320px] shrink-0 snap-start"
            >
              <VenueCard
                compact
                isLoggedIn={isLoggedIn}
                venue={{
                  id: v.venueId,
                  business_id: v.businessId,
                  slug: v.slug,
                  display_name: v.displayName,
                  short_description: v.explanationTag || null,
                  description: null,
                  venue_type: v.venueType,
                  logo_url: v.logoUrl,
                  cover_image_url: v.coverImageUrl,
                  phone_public: null,
                  email_public: null,
                  website_url: null,
                  address_public: null,
                  city: v.city,
                  country: 'US',
                  latitude: null,
                  longitude: null,
                  price_level: v.priceLevel,
                  is_published: v.isPublished,
                  is_accepting_orders: v.isAcceptingOrders,
                  featured_branch_id: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  average_rating: v.rawRatingAverage,
                  review_count: v.verifiedReviewCount,
                }}
              />
            </div>
          ))}
          {/* Trailing breathing spacer */}
          <div className="w-3 sm:w-4 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
