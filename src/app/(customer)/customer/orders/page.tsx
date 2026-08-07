import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { CustomerOrdersList } from '@/components/customer/customer-orders-list';

export const metadata: Metadata = {
  title: 'My Orders | WSNexa Customer',
  description: 'View active and historical guest orders',
};

export default async function CustomerOrdersPage() {
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
    .eq('membership_status', 'active')
    .limit(1);

  const customerData = await AccountService.getCustomerProfile(user.id);
  const hasBusinessAccess = !!(memberships && memberships.length > 0);

  const { CustomerOrderService } = await import('@/server/services/customer-order.service');
  const orders = await CustomerOrderService.getCustomerOrders(user.id, 'all');

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <CustomerOrdersList initialOrders={orders} />
    </CustomerShell>
  );
}
