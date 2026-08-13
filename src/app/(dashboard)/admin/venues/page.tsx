import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SuperAdminVenueService } from '@/server/services/super-admin-venue.service';
import { AdminVenueListClient } from './admin-venue-list-client';

export const metadata = {
  title: 'Super Admin — Venue Management | WSNexa',
  description: 'Super Admin platform venue management and publication control portal.',
};

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
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
          Super Admin authority is required to access the platform venue management portal.
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

  const resolvedParams = await searchParams;
  const venues = await SuperAdminVenueService.listAllVenues(resolvedParams.query);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
              Platform Admin Portal
            </span>
          </div>
          <h1 className="text-2xl font-black text-zinc-950 mt-1">Super Admin Venue Management</h1>
          <p className="text-xs font-semibold text-zinc-600 mt-0.5">
            Overview of all platform business venues, publication statuses, location completeness, and QR ordering.
          </p>
        </div>

        <Link
          href="/admin/venues/new"
          className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs px-5 py-3 rounded-2xl shadow-2xs text-center flex items-center justify-center gap-2 min-h-[44px]"
        >
          <span>➕ Create Venue as Admin</span>
        </Link>
      </div>

      <AdminVenueListClient initialVenues={venues} initialQuery={resolvedParams.query || ''} />
    </div>
  );
}
