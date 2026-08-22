import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VenueReviewService } from '@/server/services/venue-review.service';
import { OwnerReviewList } from '@/components/dashboard/owner-review-list';

export const metadata: Metadata = {
  title: 'Customer Reviews | WSNexa B2B',
  description: 'View customer reviews, ratings, verified visits, and post manager responses',
};

export default async function ReviewsDashboardPage() {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext) redirect('/onboarding/account-type');

  const hasPerm = await can({
    context: authContext,
    permission: 'reviews.view',
  });

  if (!hasPerm) {
    redirect('/dashboard');
  }

  const canRespond = await can({
    context: authContext,
    permission: 'reviews.respond',
  });

  const reviews = await VenueReviewService.getBusinessReviews(authContext.businessId);

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
