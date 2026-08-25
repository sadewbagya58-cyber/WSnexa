import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PendingAccessScreen } from '@/components/auth/pending-access-screen';

export const metadata: Metadata = {
  title: 'Pending Access | WSNexa',
  description: 'Your account access status and workspace authorization',
};

export default async function PendingAccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const reason = resolvedParams.reason || null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Redirect active memberships to /dashboard ONLY when no explicit restriction reason is present.
  // When reason=subscription_suspended or reason=platform_suspended is set, staff members have an
  // active membership record in DB, but their workspace is restricted. Skipping this check prevents
  // infinite redirect loops between /dashboard and /account/pending-access.
  if (!reason) {
    const { data: memberships } = await supabase
      .from('business_memberships')
      .select('role, membership_status')
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .limit(1);

    if (memberships && memberships.length > 0) {
      redirect('/dashboard');
    }
  }

  // 2. Fetch onboarding intent from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_intent')
    .eq('id', user.id)
    .single();

  const intent = profile?.onboarding_intent || 'staff';

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <PendingAccessScreen intent={intent} userEmail={user.email || 'User'} reason={reason} />
    </div>
  );
}
