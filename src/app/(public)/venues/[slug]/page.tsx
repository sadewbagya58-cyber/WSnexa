import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueFavoriteService } from '@/server/services/venue-favorite.service';
import { VenueReviewService, ReviewEligibilityResult } from '@/server/services/venue-review.service';
import { FavoriteButton } from '@/components/discovery/favorite-button';
import { ReviewForm } from '@/components/discovery/review-form';
import { GoogleMapView } from '@/components/maps/google-map-view';
import { getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';

// ── Reusable CTA button style helpers ────────────────────────────────────────

/** Primary amber CTA (e.g. View Menu) */
const ctaPrimary =
  'w-full flex items-center justify-center gap-1.5 min-h-[48px] px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black text-xs shadow-xs transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1';

/** Primary dark CTA (e.g. Book a Stay) */
const ctaDark =
  'w-full flex items-center justify-center gap-1.5 min-h-[48px] px-4 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white font-extrabold text-xs shadow-xs transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1';

/** Outline secondary CTA (e.g. Get Directions, Call) */
const ctaOutline =
  'w-full flex items-center justify-center gap-1.5 min-h-[48px] px-4 py-3 rounded-2xl bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-300 text-zinc-950 font-extrabold text-xs transition-colors touch-manipulation focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-1';

interface VenuePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: VenuePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);
  if (!venue) return { title: 'Venue Not Found | WSNexa' };

  return {
    title: `${venue.display_name} | WSNexa Venue`,
    description: venue.short_description || `Discover ${venue.display_name} in ${venue.city}`,
  };
}

export default async function PublicVenuePage({ params }: VenuePageProps) {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);

  if (!venue) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { ReservationSettingsService } = await import('@/server/reservations/reservation-settings.service');

  const [menuPreview, reviews, isFav, reviewEligibility, reservationSettings] = await Promise.all([
    VenueDiscoveryService.getVenueMenuPreview(venue.business_id, venue.featured_branch_id),
    VenueReviewService.getVenueReviews(venue.id),
    user ? VenueFavoriteService.isFavorite(user.id, venue.id) : false,
    user
      ? VenueReviewService.checkEligibility(user.id, venue.id)
      : { eligible: false, reason: 'Please log in to submit a review.' },
    venue.featured_branch_id
      ? ReservationSettingsService.getBranchSettings(venue.business_id, venue.featured_branch_id)
      : Promise.resolve(null),
  ]);

  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  const hasOrdering = venue.has_wsnexa_ordering ?? venue.is_accepting_orders;
  const directionsUrl = getGoogleMapsDirectionsUrl(
    venue.latitude,
    venue.longitude,
    venue.address_public || venue.city
  );

  // Logo/cover initials fallback
  const initials = venue.display_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between overflow-x-hidden max-w-full">

      {/* ── Hero Cover ───────────────────────────────────────────────── */}
      <div className="relative h-56 sm:h-72 w-full bg-zinc-950 overflow-hidden border-b border-zinc-200">
        {venue.cover_image_url ? (
          <Image
            src={venue.cover_image_url}
            alt={venue.display_name}
            fill
            className="object-cover"
            priority
            unoptimized
          />
        ) : (
          /* Clean initials fallback */
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 flex items-center justify-center">
            <span className="text-6xl font-black text-zinc-600 select-none" aria-hidden>
              {initials}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-black/20 to-black/40 pointer-events-none" />

        {/* Hero overlay actions */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <Link
            href="/explore"
            className="bg-white/90 backdrop-blur-sm hover:bg-white active:bg-zinc-100 text-zinc-950 font-extrabold text-xs px-3.5 py-2 rounded-2xl border border-white/80 transition-all flex items-center gap-1.5 min-h-[44px] shadow-sm touch-manipulation focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-1"
          >
            <span aria-hidden>←</span> Back to Explore
          </Link>
          <div className="bg-black/50 backdrop-blur-sm p-1 rounded-2xl border border-white/20">
            <FavoriteButton venueProfileId={venue.id} initialIsFavorite={isFav} isLoggedIn={!!user} />
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 -mt-10 relative z-10 space-y-6 pb-16">

        {/* Venue Identity Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-7 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Logo Avatar */}
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white p-1 shadow-xs border border-zinc-200 shrink-0 overflow-hidden">
                {venue.logo_url ? (
                  <Image
                    src={venue.logo_url}
                    alt={venue.display_name}
                    width={80}
                    height={80}
                    className="object-cover rounded-xl w-full h-full"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-950 text-white font-black text-2xl sm:text-3xl flex items-center justify-center rounded-xl select-none">
                    {initials.charAt(0)}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-black text-zinc-950">{venue.display_name}</h1>
                  {/* Venue Type Badge — high-contrast light neutral */}
                  <span className="bg-zinc-100 border border-zinc-200 text-zinc-800 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                    {typeFormatted}
                  </span>
                  <span className="text-xs font-mono font-extrabold text-zinc-500">{priceDisplay}</span>
                </div>
                <p className="text-xs font-bold text-zinc-600">
                  📍 {venue.address_public || venue.city}, {venue.country}
                </p>
              </div>
            </div>

            {/* Feature Status Badge */}
            <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
              {(venue.public_menu_enabled ?? true) && venue.has_public_menu ? (
                <Badge className="bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-xs px-3 py-1">
                  ✓ Menu Available
                </Badge>
              ) : (
                <Badge className="bg-zinc-100 text-zinc-800 border border-zinc-200 font-extrabold text-xs px-3 py-1">
                  Verified Venue Profile
                </Badge>
              )}
            </div>
          </div>

          {/* Rating Summary */}
          <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-700">
            <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-amber-500 text-sm">★</span>
              <span className="font-black text-sm">
                {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}
              </span>
              <span className="text-zinc-500 font-medium">/ 5.0</span>
            </div>
            <span>{venue.review_count || 0} Verified Reviews</span>
          </div>

          {/*
           * ── CTA Buttons ─────────────────────────────────────────────
           * All CTAs are <Link> or <a> — no <button> nested inside <a>.
           * This prevents the invalid HTML <a><button> pattern which causes
           * click failures on mobile Safari and some Android browsers.
           */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
            {(venue.public_menu_enabled ?? true) && venue.has_public_menu && (
              <Link href={`/venues/${venue.slug}/menu`} className={ctaPrimary}>
                <span aria-hidden>📖</span> View Menu
              </Link>
            )}

            <a href={directionsUrl} target="_blank" rel="noreferrer" className={ctaOutline}>
              <span aria-hidden>🧭</span> Get Directions
            </a>

            {venue.phone_public && (
              <a href={`tel:${venue.phone_public}`} className={ctaOutline}>
                <span aria-hidden>📞</span> Call Venue
              </a>
            )}

            {reservationSettings?.reservationsEnabled && (venue.public_reservations_enabled ?? true) && (
              <Link href={`/venues/${venue.slug}/reserve`} className={ctaDark}>
                <span aria-hidden>📅</span> Reserve Table
              </Link>
            )}

            {(venue.booking_url || venue.external_booking_url || venue.agoda_url) && (
              <a
                href={venue.booking_url || venue.external_booking_url || venue.agoda_url!}
                target="_blank"
                rel="noreferrer"
                className={ctaOutline}
              >
                <span aria-hidden>🏨</span> Book a Stay ↗
              </a>
            )}
          </div>
        </div>

        {/* ── Desktop 2-Column Layout ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">

            {/* About */}
            {venue.description && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">About the Venue</h3>
                <p className="text-xs text-zinc-800 font-medium leading-relaxed whitespace-pre-line">
                  {venue.description}
                </p>
              </div>
            )}

            {/* Menu Preview */}
            {menuPreview.length > 0 && (venue.public_menu_enabled ?? true) && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-zinc-950">Popular Menu Items</h3>
                  <Link href={`/venues/${venue.slug}/menu`} className="text-xs font-extrabold text-amber-600 hover:underline">
                    Full Menu →
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {menuPreview.map((item) => (
                    <div key={item.id} className="p-3 rounded-2xl border border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-xs text-zinc-950">{item.name}</div>
                        {item.description && (
                          <div className="text-[11px] text-zinc-500 line-clamp-1">{item.description}</div>
                        )}
                      </div>
                      <div className="font-mono font-black text-xs text-zinc-950 shrink-0">
                        ${(item.price_cents / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Location Map */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-zinc-950">Location &amp; Map</h3>
                  <p className="text-xs font-semibold text-zinc-500">
                    📍 {venue.address_public || venue.city}, {venue.country}
                  </p>
                </div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-extrabold text-amber-600 hover:underline touch-manipulation"
                >
                  Open Maps ↗
                </a>
              </div>
              <GoogleMapView
                singleVenue={{
                  displayName: venue.display_name,
                  venueType: venue.venue_type,
                  address: venue.address_public || venue.city,
                  city: venue.city,
                  lat: venue.latitude,
                  lng: venue.longitude,
                }}
              />
            </div>

            {/* Reviews */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-zinc-950">Verified Customer Reviews</h3>
                  <p className="text-xs font-semibold text-zinc-500">
                    Reviews from verified guests who ordered at this venue.
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 text-amber-900 font-extrabold text-xs">
                  <span>★</span> {venue.average_rating ? venue.average_rating.toFixed(1) : 'New'} ({reviews.length})
                </div>
              </div>

              {(reviewEligibility as ReviewEligibilityResult).eligible &&
              (reviewEligibility as ReviewEligibilityResult).eligibleOrderId ? (
                <ReviewForm
                  venueProfileId={venue.id}
                  orderId={(reviewEligibility as ReviewEligibilityResult).eligibleOrderId!}
                />
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-600">
                  {reviewEligibility.reason || 'Log in and complete an order to post a verified review.'}
                </div>
              )}

              {reviews.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  No customer reviews submitted yet.
                </div>
              ) : (
                <div className="space-y-4 divide-y divide-zinc-100">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-zinc-950">
                            {rev.user_name || 'Verified Guest'}
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                            ✓ Verified Visit
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-400">
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-500 text-xs" aria-label={`Rating: ${rev.rating} out of 5`}>
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                      </div>

                      {rev.review_text && (
                        <p className="text-xs font-medium text-zinc-800 leading-relaxed">
                          {rev.review_text}
                        </p>
                      )}

                      {rev.owner_response && (
                        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 text-xs space-y-1 mt-2">
                          <div className="font-black text-amber-950">Venue Owner Response:</div>
                          <p className="text-zinc-800 font-medium">{rev.owner_response}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sticky Card (desktop ≥ 1024px) ─────────────────── */}
          <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Venue &amp; Booking Options</h3>

              {venue.qr_token && hasOrdering && (
                <Link href={`/m/${venue.qr_token}`} className={ctaPrimary}>
                  <span aria-hidden>📖</span> View Menu &amp; Order Online
                </Link>
              )}

              <a href={directionsUrl} target="_blank" rel="noreferrer" className={ctaOutline}>
                <span aria-hidden>🧭</span> Get Directions in Google Maps
              </a>

              {venue.phone_public && (
                <a href={`tel:${venue.phone_public}`} className={ctaOutline}>
                  <span aria-hidden>📞</span> Call Venue ({venue.phone_public})
                </a>
              )}

              {(venue.booking_url || venue.agoda_url || venue.external_booking_url) && (
                <div className="pt-3 border-t border-zinc-100 space-y-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    External Hotel Bookings
                  </h4>
                  <div className="space-y-2">
                    {venue.booking_url && (
                      <a
                        href={venue.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold hover:bg-blue-100 active:bg-blue-200 transition-colors flex items-center justify-between min-h-[44px] touch-manipulation"
                      >
                        <span>🏨 Booking.com</span>
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                    {venue.agoda_url && (
                      <a
                        href={venue.agoda_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold hover:bg-emerald-100 active:bg-emerald-200 transition-colors flex items-center justify-between min-h-[44px] touch-manipulation"
                      >
                        <span>🌴 Agoda</span>
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                    {venue.external_booking_url && (
                      <a
                        href={venue.external_booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold hover:bg-purple-100 active:bg-purple-200 transition-colors flex items-center justify-between min-h-[44px] touch-manipulation"
                      >
                        <span>🔑 Direct Reservation</span>
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
