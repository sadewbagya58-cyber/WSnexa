import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import { VenueProfileService } from '@/server/services/venue-profile.service';
import { VenueProfileForm } from '@/components/dashboard/venue-profile-form';
import { ContextualHelpButton } from '@/components/help/contextual-help-button';

export const metadata: Metadata = {
  title: 'Public Venue Profile | WSNexa B2B',
  description: 'Manage your public venue discovery profile, branding, and publication status',
};

export default async function VenueProfileDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const context = await resolveActiveBusinessContext();
  if (!context) redirect('/onboarding/account-type');

  const hasPerm = await PermissionService.hasPermission(
    user.id,
    context.business.id,
    context.activeBranch?.id || null,
    'venue_profile.manage'
  );

  if (!hasPerm) {
    redirect('/dashboard');
  }

  const profile = await VenueProfileService.getProfileByBusinessId(context.business.id);

  // Fetch active branches for featured branch selector
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('business_id', context.business.id)
    .eq('status', 'active');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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

      <VenueProfileForm
        businessId={context.business.id}
        initialProfile={profile}
        branches={branches || []}
      />
    </div>
  );
}
