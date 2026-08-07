import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AccountTypeSelector } from '@/components/auth/account-type-selector';

export const metadata: Metadata = {
  title: 'Choose Account Type | WSNexa',
  description: 'Select your workspace role intent during onboarding',
};

export default async function AccountTypePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Check if user already holds a verified active business membership
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('role, membership_status')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .limit(1);

  if (memberships && memberships.length > 0) {
    const role = memberships[0].role;
    switch (role) {
      case 'business_owner':
      case 'branch_manager':
        redirect('/dashboard');
      case 'cashier':
        redirect('/dashboard/cashier');
      case 'kitchen_staff':
        redirect('/dashboard/kitchen');
      case 'waiter':
        redirect('/dashboard/waiter');
      default:
        redirect('/dashboard');
    }
  }

  // 2. Check if user has an existing onboarding intent
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_intent, customer_profile_created_at')
    .eq('id', user.id)
    .single();

  const intent = profile?.onboarding_intent;

  if (intent === 'customer' || profile?.customer_profile_created_at) {
    redirect('/customer');
  }
  if (intent === 'branch_manager' || intent === 'staff') {
    redirect('/account/pending-access');
  }
  if (intent === 'business_owner') {
    redirect('/onboarding');
  }

  // 3. User is authenticated, has no business membership, and onboarding_intent is NULL -> Render Selector UI
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <AccountTypeSelector />
    </div>
  );
}
