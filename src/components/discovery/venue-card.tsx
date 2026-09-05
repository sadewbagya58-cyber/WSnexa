'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';
import { FavoriteButton } from './favorite-button';

interface VenueCardProps {
  venue: VenuePublicProfileRecord;
  /** When true, renders as a compact horizontal or carousel rail card */
  compact?: boolean;
  isLoggedIn?: boolean;
  isFavorite?: boolean;
}

export function VenueCard({
  venue,
  compact = false,
  isLoggedIn = false,
  isFavorite = false,
}: VenueCardProps) {
  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const hasOrdering = venue.has_wsnexa_ordering ?? venue.is_accepting_orders;

  // Initials for logo/cover fallback
  const initials = venue.display_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="group rounded-3xl border border-zinc-200/90 bg-white shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full relative">

      {/* ── Cover Image Area (Consistent 16:10 Aspect Ratio) ─────────── */}
      <div className="relative aspect-[16/10] w-full bg-zinc-900 overflow-hidden shrink-0">
        {venue.cover_image_url ? (
          <Image
            src={venue.cover_image_url}
            alt={venue.display_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 flex items-center justify-center">
            <span className="text-4xl font-black text-zinc-600 select-none" aria-hidden>
              {initials}
            </span>
          </div>
        )}

        {/* Gradient scrim for badge readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

        {/* ── Top Floating Badges + Favorite Button ─────────────────── */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Category Badge */}
            <span className="bg-white/95 backdrop-blur-md text-zinc-900 font-black text-[11px] px-2.5 py-1 rounded-xl border border-white/70 shadow-xs leading-none">
              {typeFormatted}
            </span>

            {/* WSNexa Ordering Badge */}
            {hasOrdering && (
              <span className="bg-emerald-500/90 backdrop-blur-md text-white font-black text-[10px] px-2 py-1 rounded-xl shadow-xs leading-none">
                ✓ Ordering
              </span>
            )}
          </div>

          {/* Integrated Floating Favorite Button */}
          <FavoriteButton
            venueProfileId={venue.id}
            initialIsFavorite={isFavorite}
            isLoggedIn={isLoggedIn}
            variant="card-floating"
          />
        </div>

        {/* ── Venue Logo Avatar (Overlaps Image Bottom Left) ─────────── */}
        <div className="absolute -bottom-3 left-4 h-12 w-12 rounded-2xl bg-white p-0.5 shadow-md border border-zinc-200 overflow-hidden shrink-0 z-10">
          {venue.logo_url ? (
            <Image
              src={venue.logo_url}
              alt={venue.display_name}
              width={48}
              height={48}
              className="object-cover rounded-[14px] w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-zinc-950 text-white font-black text-sm flex items-center justify-center rounded-[14px] select-none">
              {initials.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* ── Card Body Content ─────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col justify-between ${compact ? 'p-3.5 pt-5' : 'p-4 sm:p-5 pt-6'}`}>
        <div className="space-y-2">
          {/* Venue Name & Price Tier */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-black text-zinc-950 leading-snug line-clamp-1 group-hover:text-amber-600 transition-colors">
              {venue.display_name}
            </h3>
            <span className="text-xs font-mono font-black text-zinc-400 shrink-0 pt-0.5">
              {priceDisplay}
            </span>
          </div>

          {/* Rating, Reviews & Location */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 font-extrabold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 text-amber-900">
              <span className="text-amber-500">★</span>
              <span className="text-zinc-950 font-black">
                {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}
              </span>
              {venue.review_count ? (
                <span className="text-zinc-500 font-medium">({venue.review_count})</span>
              ) : null}
            </div>

            <span className="text-zinc-300 text-[10px]">•</span>

            {/* Distance badge when active */}
            {venue.distance_text ? (
              <span className="text-[11px] font-black text-emerald-950 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-300 leading-tight">
                📍 {venue.distance_text}
              </span>
            ) : (
              <span className="text-xs font-bold text-zinc-500 truncate max-w-[120px]">
                {venue.city}
              </span>
            )}
          </div>

          {/* Short Description snippet */}
          {venue.short_description && (
            <p className="text-xs text-zinc-500 font-medium line-clamp-2 leading-relaxed">
              {venue.short_description}
            </p>
          )}
        </div>

        {/* ── Primary CTA Action ──────────────────────────────────────── */}
        <div className="pt-4 mt-auto">
          <Link
            href={`/venues/${venue.slug}`}
            className="w-full flex items-center justify-center gap-1.5 min-h-[44px] rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white text-xs font-black shadow-xs transition-all duration-150 touch-manipulation active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
          >
            <span>Explore Venue</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
