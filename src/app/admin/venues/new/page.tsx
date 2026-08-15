import React from 'react';
import Link from 'next/link';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminCreateVenueClient } from './admin-create-venue-client';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create Venue — Super Admin | WSNexa',
  description: 'Create and configure new platform venues, location coordinates, and OTA booking links.',
};

export default async function AdminCreateVenuePage() {
  const { businesses } = await SuperAdminService.listBusinesses({ limit: 100 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Venue Provisioning
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Create Platform Venue
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Provision a new venue record for live hospitality businesses, onboarding pilots, or demonstration venues.
          </p>
        </div>

        <Link
          href="/admin/venues"
          className="text-xs font-extrabold text-zinc-600 hover:text-zinc-950 flex items-center gap-1.5"
        >
          <span>←</span>
          <span>Back to Venues List</span>
        </Link>
      </div>

      <AdminCreateVenueClient existingBusinesses={businesses.map((b) => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
