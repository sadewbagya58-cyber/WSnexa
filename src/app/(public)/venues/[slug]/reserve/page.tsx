import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { VenueDiscoveryService } from '@/server/services/venue-discovery.service';
import { ReservationSettingsService } from '@/server/reservations/reservation-settings.service';
import { GuestReservationBookingClient } from '@/components/discovery/guest-reservation-booking-client';

interface ReservePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ReservePageProps): Promise<Metadata> {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);
  if (!venue) return { title: 'Venue Not Found | WSNexa' };

  return {
    title: `Reserve a Table at ${venue.display_name} | WSNexa`,
    description: `Book your table at ${venue.display_name} in ${venue.city}`,
  };
}

export default async function ReservePage({ params }: ReservePageProps) {
  const { slug } = await params;
  const venue = await VenueDiscoveryService.getVenueBySlug(slug);

  if (!venue || !venue.featured_branch_id) notFound();

  const { SubscriptionService } = await import('@/server/services/subscription.service');
  const subContext = await SubscriptionService.resolveSubscriptionContext(venue.business_id);
  const isCommerciallySuspended = subContext.effectiveStatus === 'SUSPENDED' || subContext.effectiveStatus === 'CANCELLED';

  if (isCommerciallySuspended) {
    return (
      <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl text-center">
          <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-xs">
            📅
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-zinc-950 uppercase tracking-wider">Reservations Unavailable</h1>
            <p className="text-xs text-zinc-600 leading-relaxed font-medium">
              Table reservations are currently unavailable for this venue.
            </p>
          </div>

          <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2.5">
            <Link
              href={`/venues/${venue.slug}`}
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm block text-center"
            >
              Back to Venue Profile
            </Link>
            {venue.has_public_menu && (
              <Link
                href={`/venues/${venue.slug}/menu`}
                className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs uppercase tracking-wider rounded-xl transition-all block text-center"
              >
                View Menu
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const admin = createAdminClient();
  const supabase = await createClient();

  const [settings, branchRes, authRes] = await Promise.all([
    ReservationSettingsService.getBranchSettings(
      venue.business_id,
      venue.featured_branch_id
    ),
    admin
      .from('branches')
      .select('id, name')
      .eq('id', venue.featured_branch_id)
      .eq('business_id', venue.business_id)
      .single(),
    supabase.auth.getUser(),
  ]);

  const branch = branchRes.data;
  if (!branch) notFound();

  if (!settings.reservationsEnabled || (venue as unknown as { public_reservations_enabled?: boolean }).public_reservations_enabled === false) {
    notFound();
  }

  const user = authRes.data?.user || null;

  let currentUser = null;
  if (user) {
    const { AccountService } = await import('@/server/services/account.service');
    const profile = await AccountService.getCustomerProfile(user.id);
    currentUser = {
      id: user.id,
      name: profile.displayName || undefined,
      email: profile.email || user.email || undefined,
      phone: user.phone || undefined,
    };
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased text-zinc-950">
      <GuestReservationBookingClient
        venue={{
          display_name: venue.display_name,
          slug: venue.slug,
          featured_branch_id: venue.featured_branch_id,
          logo_url: venue.logo_url,
          cover_image_url: venue.cover_image_url,
        }}
        branchName={branch.name}
        initialSettings={settings}
        currentUser={currentUser}
      />
    </div>
  );
}
