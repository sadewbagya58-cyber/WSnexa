import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PendingAccessScreen } from '@/components/auth/pending-access-screen';

export const metadata: Metadata = {
  title: 'Pending Authorization | WSNexa',
  description: 'Your manager or staff account is waiting for business authorization',
};

export default async function PendingAccessPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. If user has a verified active business membership, redirect to dashboard
  const { data: memberships } = await supabase
    .from('business_memberships')
    .select('role, membership_status')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect('/dashboard');
  }

  // 2. Fetch onboarding intent from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_intent')
    .eq('id', user.id)
    .single();

  const intent = profile?.onboarding_intent || 'staff';

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <PendingAccessScreen intent={intent} userEmail={user.email || 'User'} />
    </div>
  );
}
