import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

  if (!venue) notFound();

  const admin = createAdminClient();
  const { data: branches } = await admin
    .from('branches')
    .select('id, name')
    .eq('business_id', venue.business_id);

  const featuredBranchId = venue.featured_branch_id || (branches && branches[0]?.id);
  const settings = featuredBranchId
    ? await ReservationSettingsService.getBranchSettings(venue.business_id, featuredBranchId)
    : null;

  if (settings && !settings.reservationsEnabled) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          featured_branch_id: featuredBranchId || '',
          logo_url: venue.logo_url,
          cover_image_url: venue.cover_image_url,
        }}
        branches={branches || []}
        initialSettings={settings}
        currentUser={currentUser}
      />
    </div>
  );
}
