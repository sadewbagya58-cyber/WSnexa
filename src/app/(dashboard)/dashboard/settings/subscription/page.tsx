import React from 'react';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { SubscriptionService } from '@/server/services/subscription.service';
import { OwnerSubscriptionClient } from '@/components/subscription/owner-subscription-client';

export const metadata = {
  title: 'Subscription & Plan Management — WSNexa',
  description: 'Manage your WSNexa SaaS subscription, limits, and plan upgrades.',
};

export default async function OwnerSubscriptionPage() {
  const context = await resolveActiveBusinessContext();
  if (!context) {
    return <div className="p-8 text-center font-bold">Unauthorized business context.</div>;
  }

  const subContext = await SubscriptionService.resolveSubscriptionContext(context.business.id);
  const usage = await SubscriptionService.getUsageSnapshot(context.business.id);

  return (
    <OwnerSubscriptionClient
      businessName={context.business.name}
      subContext={subContext}
      usage={usage}
    />
  );
}
