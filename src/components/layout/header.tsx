import React from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AccountService } from '@/server/services/account.service';
import { PublicNavbar } from './public-navbar';

export const Header = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let workspaceRoute = '/dashboard';
  let isSuperAdmin = false;

  if (user) {
    const admin = createAdminClient();
    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id, first_name, last_name, onboarding_intent, preferred_workspace, customer_profile_created_at, is_super_admin')
        .eq('id', user.id)
        .single(),
      admin
        .from('business_memberships')
        .select('id, business_id, role, membership_status')
        .eq('user_id', user.id)
        .eq('membership_status', 'active')
        .limit(1)
        .single(),
    ]);

    isSuperAdmin = profile?.is_super_admin === true;
    workspaceRoute = await AccountService.resolveAccountRoute(user, profile, membership);
  }

  return (
    <PublicNavbar
      isAuthenticated={!!user}
      workspaceRoute={workspaceRoute}
      isSuperAdmin={isSuperAdmin}
    />
  );
};
