import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { CustomerDashboard } from '@/components/customer/customer-dashboard';

export const metadata: Metadata = {
  title: 'Customer Dashboard | WSNexa',
  description: 'Manage your hospitality activity, order history, and saved venues',
};

export default async function CustomerPage() {
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
    .eq('user_id', user.id)
  const customerData = await AccountService.getCustomerProfile(user.id);
  const hasBusinessAccess = !!(memberships && memberships.length > 0);

  const { CustomerOrderService } = await import('@/server/services/customer-order.service');
  const { VenueRankingService } = await import('@/server/services/venue-ranking.service');
  const { LoyaltyService } = await import('@/server/services/loyalty.service');

  const [analytics, recentOrders, recommendations, retentionInsights, loyaltyAccounts] = await Promise.all([
    CustomerOrderService.getCustomerAnalytics(user.id),
    CustomerOrderService.getCustomerOrders(user.id, 'all'),
    VenueRankingService.getPersonalizedRecommendations(user.id, 6),
    VenueRankingService.getCustomerRetentionInsights(user.id),
    LoyaltyService.getCustomerLoyaltyAccounts(user.id),
  ]);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <CustomerDashboard
        displayName={customerData.displayName}
        email={customerData.email}
        analytics={analytics}
        recentOrders={recentOrders}
        recommendations={recommendations}
        retentionInsights={retentionInsights}
        loyaltyAccounts={loyaltyAccounts}
      />
    </CustomerShell>
  );
}
