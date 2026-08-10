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
import { VenueReviewService } from '@/server/services/venue-review.service';
import { FavoriteButton } from '@/components/discovery/favorite-button';
import { ReviewForm } from '@/components/discovery/review-form';

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
  const typeFormatted = venue.venue_type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased flex flex-col justify-between">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200 text-zinc-950 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/explore" className="flex items-center gap-2 font-black text-sm text-zinc-700 hover:text-zinc-950">
            ← Back to Explore
          </Link>
          <div className="flex items-center gap-3">
            <FavoriteButton venueProfileId={venue.id} initialIsFavorite={isFav} isLoggedIn={!!user} />
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="relative h-64 sm:h-80 w-full bg-zinc-950 overflow-hidden border-b border-zinc-200">
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
          <div className="w-full h-full bg-gradient-to-br from-amber-950 via-zinc-900 to-zinc-950 flex items-center justify-center text-6xl">
            🏨
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-black/20" />
      </div>

      {/* Main Details Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 -mt-16 relative z-10 space-y-8 pb-16">
        {/* Profile Card Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Logo Avatar */}
              <div className="h-20 w-20 rounded-2xl bg-white p-1 shadow-md border border-zinc-200 shrink-0 overflow-hidden">
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
                  <div className="w-full h-full bg-amber-500 text-black font-black text-3xl flex items-center justify-center rounded-xl">
                    {venue.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-zinc-950">{venue.display_name}</h1>
                  <Badge className="bg-zinc-950 text-amber-400 font-extrabold text-xs">
                    {typeFormatted}
                  </Badge>
                  <span className="text-xs font-mono font-extrabold text-zinc-500">{priceDisplay}</span>
                </div>
                <p className="text-xs font-bold text-zinc-500">📍 {venue.address_public || venue.city}, {venue.country}</p>
              </div>
            </div>

            {/* Ordering Availability & Handoff */}
            <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
              <Badge
                variant={venue.is_accepting_orders ? 'success' : 'neutral'}
                className="text-xs font-bold px-3 py-1 self-start sm:self-end"
              >
                {venue.is_accepting_orders ? '• Accepting Orders' : 'Not Accepting Orders'}
              </Badge>

              {venue.qr_token ? (
                <Link href={`/m/${venue.qr_token}`}>
                  <Button className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-6 py-2.5 shadow-md">
                    📖 Browse Menu & Order
                  </Button>
                </Link>
              ) : (
                <p className="text-[11px] text-zinc-400 font-medium">Scan venue QR code at table to order</p>
              )}
            </div>
          </div>

          {/* Rating Summary Bar */}
          <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 text-xs font-bold text-zinc-700">
            <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-amber-500 text-sm">★</span>
              <span className="font-black text-sm">{venue.average_rating ? venue.average_rating.toFixed(1) : 'New'}</span>
              <span className="text-zinc-500 font-medium">/ 5.0</span>
            </div>
            <span>{venue.review_count || 0} Verified Reviews</span>
          </div>

          {/* About Description */}
          {venue.description && (
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">About the Venue</h3>
              <p className="text-xs text-zinc-700 font-medium leading-relaxed whitespace-pre-line">
                {venue.description}
              </p>
            </div>
          )}

          {/* Contact Details */}
          <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-semibold text-zinc-600">
            {venue.phone_public && <div>📞 <strong>Phone:</strong> {venue.phone_public}</div>}
            {venue.email_public && <div>✉️ <strong>Email:</strong> {venue.email_public}</div>}
            {venue.website_url && (
              <div>
                🌐 <strong>Website:</strong>{' '}
                <a href={venue.website_url} target="_blank" rel="noreferrer" className="text-amber-600 hover:underline">
                  Visit Website
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Menu Preview Catalog */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-zinc-950">Menu Preview</h2>
            {venue.qr_token && (
              <Link href={`/m/${venue.qr_token}`} className="text-xs font-extrabold text-amber-600 hover:underline">
                View Full Digital Menu →
              </Link>
            )}
          </div>

          {menuPreview.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuPreview.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <span className="text-[10px] font-extrabold uppercase text-amber-600">{item.category_name}</span>
                    <h4 className="text-xs font-black text-zinc-950">{item.name}</h4>
                    {item.description && <p className="text-[11px] text-zinc-500 line-clamp-1">{item.description}</p>}
                    <div className="text-xs font-mono font-extrabold text-zinc-900">
                      ${(item.price_cents / 100).toFixed(2)}
                    </div>
                  </div>
                  {item.image_url && (
                    <div className="h-16 w-16 rounded-xl bg-zinc-100 shrink-0 relative overflow-hidden border border-zinc-200">
                      <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 font-medium italic">No menu preview items available currently.</p>
          )}
        </div>

        {/* Verified Reviews Section */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
            <h2 className="text-xl font-black text-zinc-950">Customer Reviews & Ratings</h2>
            <div className="text-xs font-bold text-zinc-500">
              {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
            </div>
          </div>

          {/* Review Submission Form if Eligible */}
          {reviewEligibility.eligible && 'eligibleOrderId' in reviewEligibility && reviewEligibility.eligibleOrderId ? (
            <ReviewForm
              venueProfileId={venue.id}
              orderId={reviewEligibility.eligibleOrderId}
            />
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-100 border border-zinc-200 text-xs text-zinc-600 font-medium">
              ℹ️ {reviewEligibility.reason}
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-950">{r.user_name}</span>
                      {r.is_verified_visit && (
                        <Badge className="bg-emerald-100 text-emerald-950 border border-emerald-300 text-[10px] font-black">
                          ✓ Verified Visit
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Stars */}
                  <div className="flex items-center gap-1 text-amber-500 text-sm">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <span key={i}>★</span>
                    ))}
                  </div>

                  {r.review_text && (
                    <p className="text-xs text-zinc-700 font-medium leading-relaxed">{r.review_text}</p>
                  )}

                  {/* Owner Response */}
                  {r.owner_response && (
                    <div className="mt-3 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                      <div className="text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                        <span>🏢</span> Response from Venue Manager:
                      </div>
                      <p className="text-xs text-amber-900 font-medium">{r.owner_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 font-medium text-center py-6">
              No customer reviews published yet. Be the first to review after your visit!
            </p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 text-zinc-600 text-xs py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span>© {new Date().getFullYear()} WSNexa Venue Discovery</span>
          <Link href="/explore" className="text-zinc-950 hover:underline font-extrabold">
            Explore All Venues →
          </Link>
        </div>
      </footer>
    </div>
  );
}
