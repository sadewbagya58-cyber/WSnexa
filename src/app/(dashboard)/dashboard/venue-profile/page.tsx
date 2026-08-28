import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueProfileService } from '@/server/services/venue-profile.service';
import { VenueProfileForm } from '@/components/dashboard/venue-profile-form';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

import { SettingsSubNav } from '@/components/settings/settings-subnav';
import { resolveSettingsSubNavPermissions } from '@/server/navigation/settings-nav-permissions';

export const metadata: Metadata = {
  title: 'Public Venue Profile | WSNexa B2B',
  description: 'Manage your public venue discovery profile, branding, and publication status',
};

export default async function VenueProfileDashboardPage() {
  const { can, resolveAuthorizationContext } = await import('@/server/auth');
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    redirect('/login');
  }

  if (!authContext) redirect('/onboarding/account-type');

  const hasPerm = await can({
    context: authContext,
    permission: 'venue_profile.manage',
  });

  if (!hasPerm && !authContext.isBusinessOwner) {
    redirect('/dashboard');
  }

  const navPermissions = await resolveSettingsSubNavPermissions(
    authContext,
    authContext.activeBranchId,
    authContext.businessId
  );

  const profile = await VenueProfileService.getProfileByBusinessId(authContext.businessId);

  const supabase = await createClient();

  // Fetch active branches for featured branch selector
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('business_id', authContext.businessId)
    .eq('status', 'active');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-950">Public Venue Profile</h1>
          <p className="text-xs text-zinc-500 font-medium">
            Configure your public profile visible on WSNexa Explore. Control branding, descriptions, contact info, and publication status.
          </p>
        </div>
        <div className="shrink-0">
          <ContextualHelpButton explicitSlug="setting-up-public-venue-profile" />
        </div>
      </div>

      <SettingsSubNav {...navPermissions} />

      <VenueProfileForm
        businessId={authContext.businessId}
        initialProfile={profile}
        branches={branches || []}
      />
    </div>
  );
}
