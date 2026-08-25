import React from 'react';
import { redirect } from 'next/navigation';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    const { createClient, createAdminClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect('/login');
    }

    const { AccountService } = await import('@/server/services/account.service');
    const admin = createAdminClient();
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name, onboarding_intent, preferred_workspace, customer_profile_created_at')
      .eq('id', user.id)
      .single();

    const targetRoute = await AccountService.resolveAccountRoute(user, userProfile, null);
    redirect(targetRoute);
  }

  const { user, profile, business, activeBranch, branches, membership, subscription } = context;

  // 1. Platform Administrative Suspension Precedence (abuse, security, legal)
  if (business.status === 'suspended' || business.status === 'archived') {
    redirect('/account/pending-access?reason=platform_suspended');
  }

  // 2. Commercial Subscription Suspension Redirect for Non-Owner Staff
  const isCommerciallySuspended = subscription?.effectiveStatus === 'SUSPENDED' || subscription?.effectiveStatus === 'CANCELLED';
  if (isCommerciallySuspended && membership.role !== 'business_owner') {
    redirect('/account/pending-access?reason=subscription_suspended');
  }

  const userName = profile
    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
    : '';

  const { resolveAuthorizationContext } = await import('@/server/auth');
  const { resolveDashboardNavigation } = await import('@/server/navigation/navigation-engine');

  let navSections = undefined;
  try {
    const authContext = await resolveAuthorizationContext();
    navSections = resolveDashboardNavigation(authContext);
  } catch {
    navSections = undefined;
  }

  return (
    <DashboardShell
      userId={user.id}
      businessId={business.id}
      businessName={business.name}
      activeBranch={activeBranch}
      branches={branches}
      userEmail={user.email || ''}
      userName={userName || user.email || ''}
      userRole={membership.role}
      navSections={navSections}
      subscription={subscription}
    >
      {children}
    </DashboardShell>
  );
}
