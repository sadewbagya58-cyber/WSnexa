import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';
import { CustomerDashboard } from '@/components/customer/customer-dashboard';

export const metadata: Metadata = {
  title: 'Customer Dashboard | WSNexa',
  description: 'Manage your hospitality activity, order history, and saved venues',
};

export default async function CustomerPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) {
    redirect('/login');
  }

  const customerData = await AccountService.getCustomerProfile(context.user.id);
  const hasBusinessAccess = !!(context.membership && context.membership.status === 'active');

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
