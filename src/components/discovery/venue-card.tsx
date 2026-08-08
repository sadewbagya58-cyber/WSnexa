import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';

interface VenueCardProps {
  venue: VenuePublicProfileRecord;
}

export function VenueCard({ venue }: VenueCardProps) {
  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type
    .replace('_', ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="group rounded-3xl border border-zinc-200 bg-white shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between">
      {/* Cover Header */}
      <div className="relative h-48 w-full bg-zinc-900 overflow-hidden">
        {venue.cover_image_url ? (
          <Image
            src={venue.cover_image_url}
            alt={venue.display_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-900/40 via-zinc-900 to-zinc-950 flex items-center justify-center text-4xl">
            🏨
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <Badge className="bg-zinc-950/80 backdrop-blur-md text-amber-400 font-extrabold text-[10px] px-2.5 py-1 border border-zinc-800">
            {typeFormatted}
          </Badge>
          <Badge
            variant={venue.is_accepting_orders ? 'success' : 'neutral'}
            className="text-[10px] font-bold px-2 py-0.5"
          >
            {venue.is_accepting_orders ? '• Accepting Orders' : 'Not Accepting Orders'}
          </Badge>
        </div>

        {/* Logo Avatar */}
        <div className="absolute -bottom-5 left-5 h-14 w-14 rounded-2xl bg-white p-1 shadow-lg border border-zinc-100 overflow-hidden">
          {venue.logo_url ? (
            <Image
              src={venue.logo_url}
              alt={venue.display_name}
              width={56}
              height={56}
              className="object-cover rounded-xl w-full h-full"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-amber-500 text-black font-black text-xl flex items-center justify-center rounded-xl">
              {venue.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-5 pt-8 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-zinc-950 truncate group-hover:text-amber-600 transition-colors">
              {venue.display_name}
            </h3>
            <span className="text-xs font-mono font-extrabold text-zinc-400 shrink-0">{priceDisplay}</span>
          </div>

          <p className="text-xs text-zinc-500 font-medium line-clamp-2 leading-relaxed">
            {venue.short_description || `${typeFormatted} located in ${venue.city}.`}
          </p>
        </div>

        {/* Footer Meta & Link */}
        <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-amber-500">★</span>
            <span className="text-zinc-950 font-black">
              {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}
            </span>
            {venue.review_count ? (
              <span className="text-zinc-400 text-[11px]">({venue.review_count})</span>
            ) : null}
          </div>

          <span className="text-[11px] font-bold text-zinc-400">📍 {venue.city}</span>
        </div>
      </div>

      {/* Action Button Link */}
      <div className="p-4 pt-0">
        <Link
          href={`/venues/${venue.slug}`}
          className="w-full block text-center py-2.5 rounded-xl bg-zinc-950 hover:bg-amber-500 hover:text-black text-white text-xs font-extrabold transition-all"
        >
          Explore Venue →
        </Link>
      </div>
    </div>
  );
}
