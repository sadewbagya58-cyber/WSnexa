import React from 'react';
import { SuperAdminService } from '@/server/services/super-admin.service';
import { AdminUserList } from './admin-user-list';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'User Directory — Super Admin | WSNexa',
  description: 'Manage platform user profiles, onboarding intents, and account statuses safely.',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10) || 1;

  const { users, total, totalPages } = await SuperAdminService.listUsers({
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
              Platform Accounts
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mt-1">
            Platform User Directory
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-0.5">
            Safely oversee registered user profiles, account statuses, and platform role classifications.
          </p>
        </div>
      </div>

      <AdminUserList
        users={users}
        total={total}
        page={page}
        totalPages={totalPages}
        currentQuery={resolvedParams.query || ''}
        currentStatus={resolvedParams.status || 'all'}
      />
    </div>
  );
}
