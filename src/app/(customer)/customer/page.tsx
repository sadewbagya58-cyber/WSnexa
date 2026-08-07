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
  const [analytics, recentOrders] = await Promise.all([
    CustomerOrderService.getCustomerAnalytics(user.id),
    CustomerOrderService.getCustomerOrders(user.id, 'all'),
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
      />
    </CustomerShell>
  );
}
