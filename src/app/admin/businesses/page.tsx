import React from 'react';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminBusinessList } from './admin-business-list';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'Business Tenants — Super Admin | WSNexa',
  description: 'Manage platform business tenants, operational branches, and ownership memberships.',
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10) || 1;

  const { businesses, total, totalPages } = await SuperAdminService.listBusinesses({
    query: resolvedParams.query,
    status: resolvedParams.status,
    page,
    limit: 15,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] uppercase">
              Tenant Administration
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform Business Tenants
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Inspect all registered SaaS businesses, branch hierarchies, owner profiles, and suspension status.
          </p>
        </div>
      </div>

      <AdminBusinessList
        businesses={businesses}
        total={total}
        page={page}
        totalPages={totalPages}
        currentQuery={resolvedParams.query || ''}
        currentStatus={resolvedParams.status || 'all'}
      />
    </div>
  );
}
