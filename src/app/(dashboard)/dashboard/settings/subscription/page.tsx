import React from 'react';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { SubscriptionService } from '@/server/services/subscription.service';
import { SubscriptionPaymentQueryService } from '@/server/services/subscription-payment-query.service';
import { OwnerSubscriptionClient } from '@/components/subscription/owner-subscription-client';
import { OwnerBillingHistoryClient } from '@/components/subscription/owner-billing-history-client';
import { SettingsSubNav } from '@/components/settings/settings-subnav';

export const metadata = {
  title: 'Subscription & Plan Management — WSNexa',
  description: 'Manage your WSNexa SaaS subscription, limits, plan upgrades, and billing history.',
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function OwnerSubscriptionPage({ searchParams }: PageProps) {
  const context = await resolveActiveBusinessContext();
  if (!context) {
    return <div className="p-8 text-center font-bold">Unauthorized business context.</div>;
  }

  const sParams = await searchParams;
  const page = parseInt(sParams.page || '1', 10) || 1;

  const subContext = await SubscriptionService.resolveSubscriptionContext(context.business.id);
  const usage = await SubscriptionService.getUsageSnapshot(context.business.id);
  const paymentHistory = await SubscriptionPaymentQueryService.listOwnerSubscriptionPayments({
    businessId: context.business.id,
    page,
    limit: 10,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <SettingsSubNav canViewSubscription={true} />

      <OwnerSubscriptionClient
        businessName={context.business.name}
        subContext={subContext}
        usage={usage}
      />

      <OwnerBillingHistoryClient
        initialPayments={paymentHistory.data}
        total={paymentHistory.total}
        page={paymentHistory.page}
        totalPages={paymentHistory.totalPages}
      />
    </div>
  );
}
