import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';

interface VenueCardProps {
  venue: VenuePublicProfileRecord;
  /** When true, renders as a compact rail card (narrower, shorter body) */
  compact?: boolean;
}

export function VenueCard({ venue, compact = false }: VenueCardProps) {
  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const hasOrdering = venue.has_wsnexa_ordering ?? venue.is_accepting_orders;

  // Initials for logo fallback (up to 2 chars)
  const initials = venue.display_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="group rounded-2xl border border-zinc-200 bg-white shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col h-full">

      {/* ── Cover Image (consistent 16:10 ratio) ─────────────────────── */}
      <div className="relative aspect-[16/10] w-full bg-zinc-100 overflow-hidden shrink-0">
        {venue.cover_image_url ? (
          <Image
            src={venue.cover_image_url}
            alt={venue.display_name}
            fill
            className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
            unoptimized
          />
        ) : (
          /* Clean initials fallback — no emoji, no broken images */
          <div className="w-full h-full bg-gradient-to-br from-zinc-200 to-zinc-300 flex items-center justify-center">
            <span className="text-4xl font-black text-zinc-500 select-none" aria-hidden>
              {initials}
            </span>
          </div>
        )}

        {/* Gradient scrim for badge legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

        {/* ── Top Badges (pointer-events-none — decorative only) ──────── */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2 pointer-events-none">
          {/* Venue Type Badge — high contrast on any image */}
          <span className="bg-white/90 backdrop-blur-sm text-zinc-900 font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-white/60 shadow-xs leading-tight">
            {typeFormatted}
          </span>

          {/* WSNexa Ordering Badge */}
          {hasOrdering ? (
            <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10px] px-2 py-1 rounded-lg shadow-xs leading-tight shrink-0 whitespace-nowrap">
              ✓ WSNexa Ordering
            </span>
          ) : (
            <span className="bg-white/80 backdrop-blur-sm text-zinc-700 border border-white/60 font-bold text-[10px] px-2 py-1 rounded-lg shadow-xs leading-tight shrink-0 whitespace-nowrap">
              View Only
            </span>
          )}
        </div>

        {/* ── Logo Avatar (overlaps image bottom) ─────────────────────── */}
        <div className="absolute -bottom-4 left-4 h-11 w-11 rounded-xl bg-white p-0.5 shadow-md border border-zinc-200 overflow-hidden shrink-0">
          {venue.logo_url ? (
            <Image
              src={venue.logo_url}
              alt={venue.display_name}
              width={44}
              height={44}
              className="object-cover rounded-[10px] w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-zinc-950 text-white font-black text-sm flex items-center justify-center rounded-[10px] select-none">
              {initials.charAt(0)}
            </div>
          )}
        </div>
      </div>

      {/* ── Body Content ─────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col justify-between ${compact ? 'p-3 pt-6' : 'p-4 pt-7'}`}>
        <div className="space-y-1.5">
          {/* Name + Price row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-black text-zinc-950 leading-tight line-clamp-1 group-hover:text-zinc-700 transition-colors">
              {venue.display_name}
            </h3>
            <span className="text-[11px] font-mono font-extrabold text-zinc-400 shrink-0 leading-tight pt-px">
              {priceDisplay}
            </span>
          </div>

          {/* Rating + Location row */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[11px] font-bold">
              <span className="text-amber-500">★</span>
              <span className="text-zinc-950 font-black">
                {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}
              </span>
              {venue.review_count ? (
                <span className="text-zinc-400">({venue.review_count})</span>
              ) : null}
            </div>

            <span className="text-zinc-300 text-[10px]">•</span>

            {venue.distance_text ? (
              <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 leading-tight">
                📍 {venue.distance_text}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-zinc-500 truncate">
                {venue.city}
              </span>
            )}
          </div>
        </div>

        {/* ── Action CTA ──────────────────────────────────────────────── */}
        <div className="pt-3">
          <Link
            href={`/venues/${venue.slug}`}
            className="w-full flex items-center justify-center min-h-[40px] rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white text-[11px] font-extrabold transition-all touch-manipulation active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
          >
            Explore Venue →
          </Link>
        </div>
      </div>
    </div>
  );
}
