import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import { VenueReviewService } from '@/server/services/venue-review.service';
import { OwnerReviewList } from '@/components/dashboard/owner-review-list';

export const metadata: Metadata = {
  title: 'Customer Reviews | WSNexa B2B',
  description: 'View customer reviews, ratings, verified visits, and post manager responses',
};

export default async function ReviewsDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const context = await resolveActiveBusinessContext();
  if (!context) redirect('/onboarding/account-type');

  const hasPerm = await PermissionService.hasPermission(
    user.id,
    context.business.id,
    context.activeBranch?.id || null,
    'reviews.view'
  );

  if (!hasPerm) {
    redirect('/dashboard');
  }

  const canRespond = await PermissionService.hasPermission(
    user.id,
    context.business.id,
    context.activeBranch?.id || null,
    'reviews.respond'
  );

  const reviews = await VenueReviewService.getBusinessReviews(context.business.id);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">Customer Reviews & Ratings</h1>
          <p className="text-xs text-zinc-500 font-medium">
            Monitor verified guest reviews submitted for completed visits. Respond to feedback on behalf of your business.
          </p>
        </div>
      </div>

      <OwnerReviewList reviews={reviews} canRespond={canRespond} />
    </div>
  );
}
