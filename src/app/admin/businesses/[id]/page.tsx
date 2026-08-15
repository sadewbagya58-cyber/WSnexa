import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminBusinessDetailClient } from './admin-business-detail';

export const metadata = {
  title: 'Business Details — Super Admin | WSNexa',
  description: 'Business tenant details, branch overview, and membership management.',
};

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await SuperAdminService.getBusinessById(id);

  if (!business) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500">
        <Link href="/admin" className="hover:text-zinc-950">
          Admin
        </Link>
        <span>/</span>
        <Link href="/admin/businesses" className="hover:text-zinc-950">
          Businesses
        </Link>
        <span>/</span>
        <span className="text-zinc-950 font-black truncate max-w-[200px]">{business.name}</span>
      </div>

      <AdminBusinessDetailClient business={business} />
    </div>
  );
}
