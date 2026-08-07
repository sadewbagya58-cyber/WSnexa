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
    .eq('membership_status', 'active')
    .limit(1);

  const customerData = await AccountService.getCustomerProfile(user.id);
  const hasBusinessAccess = !!(memberships && memberships.length > 0);

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <CustomerDashboard displayName={customerData.displayName} email={customerData.email} />
    </CustomerShell>
  );
}
