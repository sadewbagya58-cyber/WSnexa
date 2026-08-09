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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-zinc-950 flex items-center gap-2">{title}</h2>
          {subtitle && <p className="text-xs font-medium text-zinc-500">{subtitle}</p>}
        </div>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scrollbar-none">
        {venues.map((v) => (
          <div key={v.venueId} className="w-[280px] sm:w-[320px] shrink-0 snap-start">
            <VenueCard
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
      </div>
    </div>
  );
}
