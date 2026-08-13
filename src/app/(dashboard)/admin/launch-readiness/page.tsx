import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SuperAdminVenueService } from '@/server/services/super-admin-venue.service';
import { LaunchReadinessService } from '@/server/services/launch-readiness.service';
import { LaunchReadinessClient } from './launch-readiness-client';

export const metadata = {
  title: 'Super Admin — Platform Launch Readiness | WSNexa',
  description: 'Platform health diagnostics, RLS security audit, system metrics, and pilot onboarding portal.',
};

export default async function LaunchReadinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isSuperAdmin = await SuperAdminVenueService.verifySuperAdminAuthority(user.id);
  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-black mx-auto">
          ⛔
        </div>
        <h1 className="text-xl font-black text-zinc-950">Access Denied</h1>
        <p className="text-xs font-semibold text-zinc-600">
          Super Admin authority is required to access the Platform Launch Readiness portal.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs px-6 py-3 rounded-2xl"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const initialReport = await LaunchReadinessService.getHealthReport();

  return <LaunchReadinessClient initialReport={initialReport} />;
}
