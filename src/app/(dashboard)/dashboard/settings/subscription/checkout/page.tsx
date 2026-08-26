import React from 'react';
import { redirect } from 'next/navigation';
import { requireRoutePermission, resolveDefaultWorkspaceRoute } from '@/server/tenant/guard';
import { AccessDenied } from '@/components/auth/access-denied';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { SubscriptionPlanCode } from '@/lib/config/subscription-plans';
import { previewSubscriptionCheckoutAction } from '@/server/actions/subscription-checkout';
import { SubscriptionCheckoutReviewClient } from '@/components/subscription/subscription-checkout-review-client';
import { Card } from '@/components/ui/card';

interface CheckoutPageProps {
  searchParams: Promise<{
    plan?: string;
    branches?: string;
    staff?: string;
  }>;
}

export default async function SubscriptionCheckoutPage({ searchParams }: CheckoutPageProps) {
  const { allowed, context } = await requireRoutePermission('/dashboard/settings/subscription');
  if (!allowed) {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  if (!context || !context.business) {
    redirect('/login');
  }

  const authContext = await resolveAuthorizationContext();
  if (!authContext.isBusinessOwner && authContext.membershipRole !== 'business_owner') {
    return <AccessDenied workspaceRoute={resolveDefaultWorkspaceRoute(context?.membership?.role)} />;
  }

  const resolvedParams = await searchParams;
  const rawPlan = (resolvedParams.plan || 'starter').toLowerCase();
  const planCode: SubscriptionPlanCode =
    rawPlan === 'growth' ? 'growth' : rawPlan === 'enterprise' ? 'enterprise' : 'starter';

  let enterpriseConfig = undefined;
  if (planCode === 'enterprise') {
    const branches = Math.max(1, parseInt(resolvedParams.branches || '5', 10) || 5);
    const staff = Math.max(1, parseInt(resolvedParams.staff || '75', 10) || 75);
    enterpriseConfig = { branches, activeStaff: staff };
  }

  const previewRes = await previewSubscriptionCheckoutAction({
    planCode,
    enterpriseConfig,
  });

  if (!previewRes.success || !previewRes.data) {
    if (previewRes.error === 'PLATFORM_SUSPENDED') {
      return (
        <div className="max-w-xl mx-auto p-8 space-y-4 text-center">
          <Card className="p-8 border-red-200 bg-red-50 space-y-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-black text-red-950">Platform Workspace Suspended</h2>
            <p className="text-xs text-red-800 font-medium leading-relaxed">
              Your platform workspace access has been suspended by system administration. Subscription checkout and payment intent creation are unavailable while platform suspended. Contact support for assistance.
            </p>
          </Card>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <Card className="p-8 border-amber-200 bg-amber-50 space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-black text-amber-950">Checkout Preview Error</h2>
          <p className="text-xs text-amber-800 font-medium">
            {previewRes.message || 'Unable to calculate subscription quote.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <SubscriptionCheckoutReviewClient
      businessName={context.business.name}
      planCode={planCode}
      enterpriseConfig={enterpriseConfig}
      preview={previewRes.data}
    />
  );
}
