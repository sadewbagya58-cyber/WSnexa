import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SuperAdminVenueService } from '@/server/services/super-admin-venue.service';
import { AdminCreateVenueClient } from './admin-create-venue-client';

export const metadata = {
  title: 'Super Admin — Create Venue Wizard | WSNexa',
  description: 'Super Admin multi-step venue creation wizard.',
};

export default async function AdminNewVenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const isSuperAdmin = await SuperAdminVenueService.verifySuperAdminAuthority(user.id);
  if (!isSuperAdmin) {
    redirect('/dashboard');
  }

  const admin = createAdminClient();
  const { data: businesses } = await admin.from('businesses').select('id, name').order('name', { ascending: true });

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
        <div>
          <Link href="/admin/venues" className="text-xs font-bold text-amber-600 hover:underline">
            ← Back to All Venues
          </Link>
          <h1 className="text-2xl font-black text-zinc-950 mt-1">Super Admin — Create Venue</h1>
        </div>
      </div>

      <AdminCreateVenueClient existingBusinesses={businesses || []} />
    </div>
  );
}
