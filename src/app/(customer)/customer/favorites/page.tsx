import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { VenueFavoriteService } from '@/server/services/venue-favorite.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { VenueCard } from '@/components/discovery/venue-card';

export const metadata: Metadata = {
  title: 'My Favorites | WSNexa Customer',
  description: 'Manage your saved favorite hospitality venues',
};

export default async function CustomerFavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('id')
    .eq('user_id', user.id);

  const customerData = await AccountService.getCustomerProfile(user.id);
  const favorites = await VenueFavoriteService.getCustomerFavorites(user.id);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={!!(memberships && memberships.length > 0)}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white">My Favorite Venues</h1>
            <p className="text-xs text-zinc-400 font-medium">
              Venues you have saved to view menus, track visits, and place quick orders.
            </p>
          </div>
          <Link
            href="/explore"
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors"
          >
            + Explore More Venues
          </Link>
        </div>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((venue) => (
              <div key={venue.id} className="relative group">
                <VenueCard venue={venue} />
                {venue.last_visit_at && (
                  <div className="mt-2 text-[11px] font-bold text-amber-400 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-center">
                    🗓️ Last visit: {new Date(venue.last_visit_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Empty Favorites State */
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-12 text-center space-y-4 max-w-md mx-auto my-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 text-3xl">
              ⭐
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">You haven&apos;t saved any venues yet</h3>
              <p className="text-xs text-zinc-400">
                Explore restaurants, cafes, hotels, and resorts, and click &quot;Save Venue&quot; to bookmark them.
              </p>
            </div>
            <Link
              href="/explore"
              className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition-colors"
            >
              Explore Venues
            </Link>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
