import React from 'react';
import { Metadata } from 'next';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { redirect } from 'next/navigation';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';

export const metadata: Metadata = {
  title: 'Favorite Venues | WSNexa Customer',
  description: 'Your saved restaurants, hotels, and cafés',
};

export default async function CustomerFavoritesPage() {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user) redirect('/login');

  const customerData = await AccountService.getCustomerProfile(context.user.id);
  const hasBusinessAccess = !!(context.membership && context.membership.status === 'active');

  return (
    <CustomerShell
      displayName={customerData.displayName}
      email={customerData.email}
      hasBusinessAccess={hasBusinessAccess}
    >
      <div className="space-y-6">
        <h1 className="text-xl font-black text-white uppercase tracking-wider">Favorite Venues</h1>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500 text-xs space-y-2">
          <div className="text-3xl mb-2">⭐</div>
          <div>No saved favorite venues yet.</div>
          <div className="text-[10px] text-zinc-600">
            Venue discovery & favorite saved places will be enabled in Phase 16.
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
