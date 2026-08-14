'use client';

import React from 'react';
import { VenueCard } from './venue-card';
import { VenueRankingMetrics } from '@/lib/validation/ranking';

interface VenueCarouselProps {
  title: string;
  subtitle?: string;
  venues: VenueRankingMetrics[];
}

export function VenueCarousel({ title, subtitle, venues }: VenueCarouselProps) {
  if (!venues || venues.length === 0) return null;

  return (
    <div className="space-y-3 py-4">
      {/* Section header */}
      <div className="px-4 sm:px-0">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        {subtitle && <p className="text-xs font-medium text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>

      {/*
       * Horizontal snap rail.
       *
       * Pattern: negative horizontal margins break out of the parent page
       * padding (px-4 sm:px-6), then re-add the same padding as scroll inset
       * so the first card aligns with the page content and the trailing end
       * has a breathing gap.
       *
       * Card widths are viewport-relative on mobile (~80vw) so the partial
       * peek of the next card is guaranteed regardless of screen width.
       */}
      <div className="-mx-4 sm:-mx-6 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scrollbar-none touch-pan-x">
        <div
          className="flex items-stretch gap-3 px-4 sm:px-6 w-max"
          role="list"
          aria-label={title}
        >
          {venues.map((v) => (
            <div
              key={v.venueId}
              role="listitem"
              className="w-[80vw] max-w-[320px] sm:w-[280px] lg:w-[320px] shrink-0 snap-start"
            >
              <VenueCard
                compact
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
          {/* Trailing spacer: ensures last card scrolls fully into view */}
          <div className="w-3 sm:w-4 shrink-0" aria-hidden />
        </div>
      </div>
    </div>
  );
}
