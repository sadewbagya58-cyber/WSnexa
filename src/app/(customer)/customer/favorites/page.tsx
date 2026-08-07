import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { CustomerShell } from '@/components/customer/customer-shell';

export const metadata: Metadata = {
  title: 'Favorite Venues | WSNexa Customer',
  description: 'Your saved restaurants, hotels, and cafés',
};

export default async function CustomerFavoritesPage() {
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
