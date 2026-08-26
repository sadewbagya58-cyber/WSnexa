import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PendingAccessScreen } from '@/components/auth/pending-access-screen';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { resolveUnifiedAccessState } from '@/server/tenant/unified-access';

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
  const requestedReason = resolvedParams.reason || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Authoritatively resolve active tenant & subscription context from DB
  let confirmedReason: string | null = requestedReason;
  try {
    const tenantContext = await resolveActiveBusinessContext();
    if (tenantContext && tenantContext.business) {
      const accessState = resolveUnifiedAccessState({
        businessStatus: tenantContext.business.status,
        effectiveSubscriptionStatus: tenantContext.subscription?.effectiveStatus || 'TRIALING',
      });

      if (!accessState.isRestricted) {
        // Access restriction is NO LONGER ACTIVE! (Super Admin reactivated business/subscription)
        // Automatically redirect to operational workspace destination!
        redirect('/dashboard');
      } else {
        // Restriction is STILL ACTIVE. Use authoritative server-confirmed reason.
        confirmedReason = accessState.reason;
      }
    }
  } catch {
    // If context resolution fails (e.g. no active membership), fall back to pending screen
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_intent')
    .eq('id', user.id)
    .single();

  const intent = profile?.onboarding_intent || 'staff';

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <PendingAccessScreen intent={intent} userEmail={user.email || 'User'} reason={confirmedReason} />
    </div>
  );
}
