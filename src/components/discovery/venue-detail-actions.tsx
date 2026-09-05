'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { InAppDirectionsModal } from './in-app-directions-modal';

interface VenueDetailActionsProps {
  venue: {
    id: string;
    slug: string;
    displayName: string;
    venueType: string;
    phonePublic: string | null;
    addressPublic: string | null;
    city: string;
    latitude: number | null;
    longitude: number | null;
    bookingUrl?: string | null;
    agodaUrl?: string | null;
    externalBookingUrl?: string | null;
    hasPublicMenu: boolean;
    publicMenuEnabled: boolean;
    publicReservationsEnabled: boolean;
    reservationsEnabled: boolean;
    isCommerciallySuspended: boolean;
  };
}

const ctaPrimary =
  'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs shadow-xs transition-all duration-150 touch-manipulation active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 text-center';

const ctaDark =
  'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-black text-xs shadow-xs transition-all duration-150 touch-manipulation active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1 text-center';

const ctaOutline =
  'w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-300/90 text-zinc-950 font-extrabold text-xs transition-all duration-150 touch-manipulation active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-1 text-center';

export function VenueDetailActions({ venue }: VenueDetailActionsProps) {
  const [directionsModalOpen, setDirectionsModalOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
        {/* View Menu CTA */}
        {venue.publicMenuEnabled && venue.hasPublicMenu && (
          <Link href={`/venues/${venue.slug}/menu`} className={ctaPrimary}>
            <span aria-hidden>📖</span>
            <span>View Menu</span>
          </Link>
        )}

        {/* In-App Get Directions CTA */}
        <button
          type="button"
          onClick={() => setDirectionsModalOpen(true)}
          className={ctaOutline}
        >
          <span aria-hidden>🧭</span>
          <span>Get Directions</span>
        </button>

        {/* Call Venue CTA */}
        {venue.phonePublic && (
          <a href={`tel:${venue.phonePublic}`} className={ctaOutline}>
            <span aria-hidden>📞</span>
            <span>Call Venue</span>
          </a>
        )}

        {/* Reserve Table CTA */}
        {venue.reservationsEnabled && venue.publicReservationsEnabled && (
          venue.isCommerciallySuspended ? (
            <span className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-zinc-200 text-zinc-500 font-extrabold text-xs cursor-not-allowed opacity-75">
              <span aria-hidden>📅</span>
              <span>Reservations Unavailable</span>
            </span>
          ) : (
            <Link href={`/venues/${venue.slug}/reserve`} className={ctaDark}>
              <span aria-hidden>📅</span>
              <span>Reserve Table</span>
            </Link>
          )
        )}

        {/* External Hotel Booking Links */}
        {(venue.bookingUrl || venue.externalBookingUrl || venue.agodaUrl) && (
          <a
            href={venue.bookingUrl || venue.externalBookingUrl || venue.agodaUrl!}
            target="_blank"
            rel="noreferrer"
            className={ctaOutline}
          >
            <span aria-hidden>🏨</span>
            <span>Book a Stay ↗</span>
          </a>
        )}
      </div>

      {/* ── In-App Directions Modal ─────────────────────────────────── */}
      <InAppDirectionsModal
        venue={{
          id: venue.id,
          displayName: venue.displayName,
          venueType: venue.venueType,
          address: venue.addressPublic,
          city: venue.city,
          lat: venue.latitude,
          lng: venue.longitude,
          slug: venue.slug,
        }}
        isOpen={directionsModalOpen}
        onClose={() => setDirectionsModalOpen(false)}
      />
    </>
  );
}
