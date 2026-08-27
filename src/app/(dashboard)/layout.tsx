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

  // Unified Platform + Commercial Access Precedence Evaluation
  const { resolveUnifiedAccessState } = await import('@/server/tenant/unified-access');
  const accessState = resolveUnifiedAccessState({
    businessStatus: business.status,
    effectiveSubscriptionStatus: subscription?.effectiveStatus || 'TRIALING',
  });

  if (accessState.isRestricted) {
    if (accessState.reason === 'platform_suspended') {
      redirect('/account/pending-access?reason=platform_suspended');
    } else if (membership.role !== 'business_owner') {
      redirect(`/account/pending-access?reason=${accessState.reason}`);
    }
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
      userCustomRoleId={membership.customRoleId}
      userCustomRoleName={membership.customRoleName}
      navSections={navSections}
      subscription={subscription}
    >
      {children}
    </DashboardShell>
  );
}
