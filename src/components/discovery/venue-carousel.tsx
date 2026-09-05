'use client';

import React from 'react';
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
            className="text-xs font-black text-amber-600 hover:text-amber-700 shrink-0 min-h-[36px] flex items-center px-2.5 py-1 rounded-xl hover:bg-amber-50 active:scale-95 transition-all"
          >
            See All →
          </Link>
        )}
      </div>

      {/*
       * Horizontal snap rail.
       * Viewport relative width (82vw on small mobile) ensures next card preview is clearly visible.
       */}
      <div className="-mx-4 sm:mx-0 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none touch-pan-x">
        <div
          className="flex items-stretch gap-4 px-4 sm:px-0 w-max"
          role="list"
          aria-label={title}
        >
          {venues.map((v) => (
            <div
              key={v.venueId}
              role="listitem"
              className="w-[82vw] max-w-[320px] sm:w-[290px] lg:w-[320px] shrink-0 snap-start"
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
