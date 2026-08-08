import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { VenueReviewService } from '@/server/services/venue-review.service';
import { CustomerShell } from '@/components/customer/customer-shell';

export const metadata: Metadata = {
  title: 'My Reviews | WSNexa Customer',
  description: 'Manage your verified customer reviews and ratings',
};

export default async function CustomerReviewsPage() {
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
  const reviews = await VenueReviewService.getCustomerReviews(user.id);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={!!(memberships && memberships.length > 0)}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-white">My Verified Reviews</h1>
            <p className="text-xs text-zinc-400 font-medium">
              Manage ratings and reviews submitted for your completed venue visits.
            </p>
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{r.venue_name}</h3>
                    {r.is_verified_visit && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black">
                        ✓ Verified Visit
                      </Badge>
                    )}
                    {r.order_number_formatted && (
                      <span className="text-[11px] font-mono text-zinc-500">{r.order_number_formatted}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-500">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>

                {/* Rating Stars */}
                <div className="flex items-center gap-1 text-amber-500 text-sm">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                </div>

                {r.review_text && <p className="text-xs text-zinc-300 font-medium leading-relaxed">{r.review_text}</p>}

                {/* Owner Response */}
                {r.owner_response && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                    <div className="font-bold text-amber-400">🏢 Venue Response:</div>
                    <p className="text-zinc-300">{r.owner_response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Empty Reviews State */
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-12 text-center space-y-4 max-w-md mx-auto my-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 text-3xl">
              ✍️
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">You haven&apos;t reviewed any visits yet</h3>
              <p className="text-xs text-zinc-400">
                After completing an order at a venue, visit the venue page to leave a verified review.
              </p>
            </div>
            <Link
              href="/customer/orders"
              className="inline-block px-5 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs hover:bg-amber-400 transition-colors"
            >
              View Order History
            </Link>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
