import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminVenueDetailClient } from './admin-venue-detail';

export const metadata = {
  title: 'Manage Venue — Super Admin | WSNexa',
  description: 'Venue lifecycle management, coordinates setup, and suspension controls.',
};

export default async function AdminVenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await SuperAdminService.getVenueById(id);

  if (!venue) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
        <Link href="/admin" className="hover:text-zinc-950">
          Admin
        </Link>
        <span>/</span>
        <Link href="/admin/venues" className="hover:text-zinc-950">
          Venues
        </Link>
        <span>/</span>
        <span className="text-zinc-950 font-black truncate max-w-[200px]">{venue.displayName}</span>
      </div>

      <AdminVenueDetailClient venue={venue} />
    </div>
  );
}
