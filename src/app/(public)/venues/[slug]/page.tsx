import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { VenueFavoriteService } from '@/server/services/venue-favorite.service';
import { VenueReviewService, ReviewEligibilityResult } from '@/server/services/venue-review.service';
import { FavoriteButton } from '@/components/discovery/favorite-button';
import { ReviewForm } from '@/components/discovery/review-form';
import { GoogleMapView } from '@/components/maps/google-map-view';
import { getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';

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

  if (!venue) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [menuPreview, reviews, isFav, reviewEligibility] = await Promise.all([
    VenueDiscoveryService.getVenueMenuPreview(venue.business_id, venue.featured_branch_id),
    VenueReviewService.getVenueReviews(venue.id),
    user ? VenueFavoriteService.isFavorite(user.id, venue.id) : false,
    user ? VenueReviewService.checkEligibility(user.id, venue.id) : { eligible: false, reason: 'Please log in to submit a review.' },
  ]);

  const priceDisplay = '$'.repeat(venue.price_level || 2);
  const typeFormatted = venue.venue_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const hasOrdering = venue.has_wsnexa_ordering ?? venue.is_accepting_orders;
  const directionsUrl = getGoogleMapsDirectionsUrl(venue.latitude, venue.longitude, venue.address_public || venue.city);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between overflow-x-hidden max-w-full">
      {/* Mobile-First Compact Hero (Height ~220-280px) */}
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
          <div className="w-full h-full bg-gradient-to-br from-amber-950 via-zinc-900 to-zinc-950 flex items-center justify-center text-5xl">
            🏨
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-black/20 to-black/40" />

        {/* Hero Top Actions (Overlay Header) */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
          <Link
            href="/explore"
            className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white font-extrabold text-xs px-3.5 py-2 rounded-2xl border border-white/20 transition-all flex items-center gap-1.5 min-h-[44px]"
          >
            <span>←</span> Back to Explore
          </Link>
          <div className="bg-black/60 backdrop-blur-md p-1 rounded-2xl border border-white/20">
            <FavoriteButton venueProfileId={venue.id} initialIsFavorite={isFav} isLoggedIn={!!user} />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 -mt-10 relative z-10 space-y-6 pb-16">
        {/* Venue Identity Card (Immediate Info below hero) */}
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
                  <div className="w-full h-full bg-amber-500 text-black font-black text-2xl sm:text-3xl flex items-center justify-center rounded-xl">
                    {venue.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-black text-zinc-950">{venue.display_name}</h1>
                  {/* Venue Type Badge: Light neutral bg-zinc-100 text-zinc-800 */}
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

            {/* Badges */}
            <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
              {hasOrdering ? (
                <Badge className="bg-emerald-50 text-emerald-900 border border-emerald-200 font-extrabold text-xs px-3 py-1">
                  ✓ WSNexa Ordering Available
                </Badge>
              ) : (
                <Badge className="bg-zinc-100 text-zinc-800 border border-zinc-200 font-extrabold text-xs px-3 py-1">
                  View Venue Only
                </Badge>
              )}
            </div>
          </div>

          {/* Rating Summary Bar */}
          <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 text-xs font-bold text-zinc-700">
            <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-amber-500 text-sm">★</span>
              <span className="font-black text-sm">{venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}</span>
              <span className="text-zinc-500 font-medium">/ 5.0</span>
            </div>
            <span>{venue.review_count || 0} Verified Reviews</span>
          </div>

          {/* Mobile Prioritized CTA Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
            {venue.qr_token && hasOrdering ? (
              <Link href={`/m/${venue.qr_token}`}>
                <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-3 rounded-2xl shadow-2xs min-h-[44px]">
                  📖 View Menu & Order
                </Button>
              </Link>
            ) : null}

            <a href={directionsUrl} target="_blank" rel="noreferrer" className="w-full">
              <Button variant="outline" className="w-full border-zinc-200 text-zinc-950 font-extrabold text-xs py-3 rounded-2xl min-h-[44px]">
                🧭 Get Directions
              </Button>
            </a>

            {venue.phone_public && (
              <a href={`tel:${venue.phone_public}`} className="w-full">
                <Button variant="outline" className="w-full border-zinc-200 text-zinc-950 font-extrabold text-xs py-3 rounded-2xl min-h-[44px]">
                  📞 Call Venue
                </Button>
              </a>
            )}

            {(venue.booking_url || venue.external_booking_url || venue.agoda_url) && (
              <a
                href={venue.booking_url || venue.external_booking_url || venue.agoda_url!}
                target="_blank"
                rel="noreferrer"
                className="w-full"
              >
                <Button className="w-full bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs py-3 rounded-2xl min-h-[44px]">
                  🏨 Book a Stay ↗
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Desktop 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column (Info, Menu Preview, Reviews) */}
          <div className="lg:col-span-2 space-y-6">
            {/* About Description Section */}
            {venue.description && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">About the Venue</h3>
                <p className="text-xs text-zinc-800 font-medium leading-relaxed whitespace-pre-line">
                  {venue.description}
                </p>
              </div>
            )}

            {/* Menu Preview Section */}
            {menuPreview.length > 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-zinc-950">Popular Menu Items</h3>
                  {venue.qr_token && (
                    <Link href={`/m/${venue.qr_token}`} className="text-xs font-extrabold text-amber-600 hover:underline">
                      Full Menu →
                    </Link>
                  )}
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

            {/* Location & Interactive Google Map */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-zinc-950">Location & Map</h3>
                  <p className="text-xs font-semibold text-zinc-500">
                    📍 {venue.address_public || venue.city}, {venue.country}
                  </p>
                </div>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-extrabold text-amber-600 hover:underline"
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

            {/* Verified Customer Reviews Section */}
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

              {/* Review Form Component */}
              {(reviewEligibility as ReviewEligibilityResult).eligible && (reviewEligibility as ReviewEligibilityResult).eligibleOrderId ? (
                <ReviewForm
                  venueProfileId={venue.id}
                  orderId={(reviewEligibility as ReviewEligibilityResult).eligibleOrderId!}
                />
              ) : (
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs font-semibold text-zinc-600">
                  {reviewEligibility.reason || 'Log in and complete an order to post a verified review.'}
                </div>
              )}

              {/* Review List */}
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

                      <div className="flex items-center gap-1 text-amber-500 text-xs">
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

          {/* Right Column Sticky Card (Desktop >= 1024px) */}
          <div className="hidden lg:block lg:sticky lg:top-24 space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-950">Venue & Booking Options</h3>

              {venue.qr_token && hasOrdering && (
                <Link href={`/m/${venue.qr_token}`}>
                  <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-3 rounded-2xl shadow-2xs min-h-[44px]">
                    📖 View Menu & Order Online
                  </Button>
                </Link>
              )}

              <a href={directionsUrl} target="_blank" rel="noreferrer" className="block">
                <Button variant="outline" className="w-full border-zinc-200 text-zinc-950 font-extrabold text-xs py-3 rounded-2xl min-h-[44px]">
                  🧭 Get Directions in Google Maps
                </Button>
              </a>

              {venue.phone_public && (
                <a href={`tel:${venue.phone_public}`} className="block">
                  <Button variant="outline" className="w-full border-zinc-200 text-zinc-950 font-extrabold text-xs py-3 rounded-2xl min-h-[44px]">
                    📞 Call Venue ({venue.phone_public})
                  </Button>
                </a>
              )}

              {(venue.booking_url || venue.agoda_url || venue.external_booking_url) && (
                <div className="pt-4 border-t border-zinc-100 space-y-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                    External Hotel Bookings
                  </h4>
                  <div className="space-y-2">
                    {venue.booking_url && (
                      <a
                        href={venue.booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center justify-between min-h-[40px]"
                      >
                        <span>🏨 Booking.com</span>
                        <span>↗</span>
                      </a>
                    )}
                    {venue.agoda_url && (
                      <a
                        href={venue.agoda_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center justify-between min-h-[40px]"
                      >
                        <span>🌴 Agoda</span>
                        <span>↗</span>
                      </a>
                    )}
                    {venue.external_booking_url && (
                      <a
                        href={venue.external_booking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full px-4 py-2.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold hover:bg-purple-100 transition-colors flex items-center justify-between min-h-[40px]"
                      >
                        <span>🔑 Direct Reservation</span>
                        <span>↗</span>
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
