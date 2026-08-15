'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toggleAdminUserStatusAction } from '@/server/actions/super-admin';

interface UserItem {
  id: string;
  email: string;
  name: string;
  accountStatus: string;
  onboardingIntent: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
}

interface AdminUserListProps {
  users: UserItem[];
  total: number;
  page: number;
  totalPages: number;
  currentQuery: string;
  currentStatus: string;
}

export function AdminUserList({
  users: initialUsers,
  total,
  page,
  totalPages,
  currentQuery,
  currentStatus,
}: AdminUserListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState(currentQuery);
  const [statusFilter, setStatusFilter] = useState(currentStatus || 'all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const applyFilters = (newStatus: string, newSearch: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSearch.trim()) params.set('query', newSearch.trim());
    else params.delete('query');

    if (newStatus && newStatus !== 'all') params.set('status', newStatus);
    else params.delete('status');

    if (newPage > 1) params.set('page', String(newPage));
    else params.delete('page');

    startTransition(() => {
      router.push(`/admin/users?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(statusFilter, search, 1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    applyFilters(status, search, 1);
  };

  const handleToggleUserStatus = async (user: UserItem) => {
    const nextStatus = user.accountStatus === 'active' ? 'suspended' : 'active';
    setUpdatingId(user.id);

    const res = await toggleAdminUserStatusAction(user.id, nextStatus);
    setUpdatingId(null);

    if (res.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, accountStatus: nextStatus } : u))
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="flex-1 rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden transition-all"
          />
          <Button
            type="submit"
            disabled={isPending}
            className="bg-zinc-950 hover:bg-zinc-800 active:scale-[0.97] text-white font-extrabold text-xs px-6 rounded-2xl min-h-[44px] transition-all cursor-pointer"
          >
            {isPending ? 'Searching...' : 'Search'}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'all', label: 'All Users' },
            { id: 'active', label: 'Active' },
            { id: 'suspended', label: 'Suspended' },
            { id: 'deactivated', label: 'Deactivated' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleStatusChange(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all min-h-[36px] active:scale-[0.97] cursor-pointer touch-manipulation ${
                statusFilter === tab.id
                  ? 'bg-zinc-950 text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-white">
          <div className="text-3xl">👥</div>
          <h3 className="text-sm font-black text-zinc-900">No users found.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'No users matched your criteria.'
              : 'Registered platform users will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Intent / Role</th>
                  <th className="p-4">Super Admin</th>
                  <th className="p-4">Account Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-900">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 space-y-0.5 max-w-[240px]">
                      <div className="font-black text-zinc-950 text-sm truncate">{u.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono truncate">{u.email}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">ID: {u.id.slice(0, 8)}...</div>
                    </td>

                    <td className="p-4">
                      <Badge variant="neutral" className="capitalize text-[10px] font-bold">
                        {u.onboardingIntent || 'Unassigned'}
                      </Badge>
                    </td>

                    <td className="p-4">
                      {u.isSuperAdmin ? (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                          🛡️ SUPER ADMIN
                        </Badge>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Regular User</span>
                      )}
                    </td>

                    <td className="p-4">
                      {u.accountStatus === 'active' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                          ACTIVE
                        </Badge>
                      )}
                      {u.accountStatus === 'suspended' && (
                        <Badge className="bg-red-600 text-white font-black text-[10px]">
                          SUSPENDED
                        </Badge>
                      )}
                      {u.accountStatus === 'deactivated' && (
                        <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">
                          DEACTIVATED
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={u.accountStatus === 'active' ? 'outline' : 'primary'}
                        disabled={updatingId === u.id || u.isSuperAdmin}
                        onClick={() => handleToggleUserStatus(u)}
                        className="text-[11px] font-extrabold"
                      >
                        {updatingId === u.id
                          ? 'Updating...'
                          : u.accountStatus === 'active'
                          ? 'Suspend'
                          : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-4">
            {users.map((u) => (
              <div key={u.id} className="rounded-3xl border border-zinc-200 bg-white p-4 space-y-2 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-zinc-950 text-base">{u.name}</h4>
                    <p className="text-xs font-semibold text-zinc-500 font-mono">{u.email}</p>
                  </div>
                  {u.accountStatus === 'active' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                      ACTIVE
                    </Badge>
                  ) : (
                    <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {u.isSuperAdmin && (
                    <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
                      🛡️ SUPER ADMIN
                    </Badge>
                  )}
                  <Badge variant="neutral" className="text-[10px] capitalize">
                    {u.onboardingIntent || 'General User'}
                  </Badge>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant={u.accountStatus === 'active' ? 'outline' : 'primary'}
                    disabled={updatingId === u.id || u.isSuperAdmin}
                    onClick={() => handleToggleUserStatus(u)}
                    className="w-full min-h-[44px] text-xs font-extrabold"
                  >
                    {updatingId === u.id
                      ? 'Updating...'
                      : u.accountStatus === 'active'
                      ? 'Suspend Account'
                      : 'Reactivate Account'}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-xs font-semibold text-zinc-500">
                Page {page} of {totalPages} ({total} users)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => applyFilters(statusFilter, search, page - 1)}
                  className="text-xs font-bold min-h-[36px]"
                >
                  ← Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => applyFilters(statusFilter, search, page + 1)}
                  className="text-xs font-bold min-h-[36px]"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
