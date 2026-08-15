import React from 'react';
import Link from 'next/link';
import { SuperAdminService, AdminVenueFilterParams } from '@/server/services/super-admin.service';
import { AdminVenueList } from './admin-venue-list';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Venue Management — Super Admin | WSNexa',
  description: 'Manage all platform venues, publication states, location coordinates, and suspension controls.',
};

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10) || 1;

  const filterParams: AdminVenueFilterParams = {
    query: resolvedParams.query,
    status: (resolvedParams.status as AdminVenueFilterParams['status']) || 'all',
    page,
    limit: 15,
  };

  const { venues, total, totalPages } = await SuperAdminService.listVenues(filterParams);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Platform Catalog
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform Venue Management
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Oversee venue publication, coordinates configuration, ordering status, and tenant isolation.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/venues/new"
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-xs font-black text-black shadow-2xs transition-all active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Create Venue</span>
          </Link>
        </div>
      </div>

      {/* Venues List Client */}
      <AdminVenueList
        venues={venues}
        total={total}
        page={page}
        limit={15}
        totalPages={totalPages}
        currentQuery={resolvedParams.query || ''}
        currentStatus={resolvedParams.status || 'all'}
      />
    </div>
  );
}
