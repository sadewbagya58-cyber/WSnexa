import React from 'react';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminBranchList } from './admin-branch-list';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Branch Directory — Super Admin | WSNexa',
  description: 'Manage cross-business branch locations, location coordinates, and operational statuses.',
};

export default async function AdminBranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10) || 1;

  const { branches, total, totalPages } = await SuperAdminService.listBranches({
    query: resolvedParams.query,
    status: resolvedParams.status,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Location Network
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform Branch Directory
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Cross-business directory of all operational branches, service areas, and geolocation readiness.
          </p>
        </div>
      </div>

      <AdminBranchList
        branches={branches}
        total={total}
        page={page}
        totalPages={totalPages}
        currentQuery={resolvedParams.query || ''}
        currentStatus={resolvedParams.status || 'all'}
      />
    </div>
  );
}
