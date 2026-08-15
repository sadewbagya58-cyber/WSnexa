'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BusinessItem {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  countryCode: string;
  defaultCurrency: string;
  status: string;
  isPilotDemo: boolean;
  branchCount: number;
  memberCount: number;
  ownerName: string;
  createdAt: string;
}

interface AdminBusinessListProps {
  businesses: BusinessItem[];
  total: number;
  page: number;
  totalPages: number;
  currentQuery: string;
  currentStatus: string;
}

export function AdminBusinessList({
  businesses,
  total,
  page,
  totalPages,
  currentQuery,
  currentStatus,
}: AdminBusinessListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentQuery);
  const [statusFilter, setStatusFilter] = useState(currentStatus || 'all');

  const applyFilters = (newStatus: string, newSearch: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSearch.trim()) params.set('query', newSearch.trim());
    else params.delete('query');

    if (newStatus && newStatus !== 'all') params.set('status', newStatus);
    else params.delete('status');

    if (newPage > 1) params.set('page', String(newPage));
    else params.delete('page');

    startTransition(() => {
      router.push(`/admin/businesses?${params.toString()}`);
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

  return (
    <div className="space-y-6">
      {/* Search Bar & Filter Tabs */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business by name or slug..."
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

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'all', label: 'All Businesses' },
            { id: 'active', label: 'Active' },
            { id: 'suspended', label: 'Suspended' },
            { id: 'archived', label: 'Archived' },
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

      {businesses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-white">
          <div className="text-3xl">🏢</div>
          <h3 className="text-sm font-black text-zinc-900">No businesses found.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'No businesses matched your search criteria.'
              : 'Registered tenant businesses will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Business</th>
                  <th className="p-4">Owner</th>
                  <th className="p-4">Branches</th>
                  <th className="p-4">Staff Members</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-900">
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 space-y-0.5 max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/businesses/${b.id}`}
                          className="font-black text-zinc-950 text-sm hover:text-amber-600 truncate block"
                        >
                          {b.name}
                        </Link>
                        {b.isPilotDemo && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-black text-[9px]">
                            PILOT
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate font-mono">slug: {b.slug}</div>
                      <div className="text-[10px] text-zinc-400">
                        {b.countryCode} • {b.defaultCurrency} • {b.businessType}
                      </div>
                    </td>

                    <td className="p-4 text-zinc-700">
                      <div>{b.ownerName}</div>
                      <div className="text-[10px] text-zinc-400">
                        Created {new Date(b.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="p-4">
                      <Badge variant="neutral" className="font-bold text-[10px]">
                        {b.branchCount} Branch{b.branchCount === 1 ? '' : 'es'}
                      </Badge>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-zinc-800">{b.memberCount} active</span>
                    </td>

                    <td className="p-4">
                      {b.status === 'active' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                          ACTIVE
                        </Badge>
                      )}
                      {b.status === 'suspended' && (
                        <Badge className="bg-red-600 text-white font-black text-[10px]">
                          SUSPENDED
                        </Badge>
                      )}
                      {b.status === 'archived' && (
                        <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">
                          ARCHIVED
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/businesses/${b.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-[11px] font-extrabold text-zinc-900"
                      >
                        Inspect ⚙️
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-4">
            {businesses.map((b) => (
              <div key={b.id} className="rounded-3xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/businesses/${b.id}`}
                        className="font-black text-zinc-950 text-base truncate block"
                      >
                        {b.name}
                      </Link>
                      {b.isPilotDemo && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-black text-[9px]">
                          PILOT
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-zinc-500 font-mono">slug: {b.slug}</p>
                    <p className="text-xs text-zinc-600">Owner: {b.ownerName}</p>
                  </div>

                  {b.status === 'active' && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                      ACTIVE
                    </Badge>
                  )}
                  {b.status === 'suspended' && (
                    <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="neutral" className="text-[10px] font-bold">
                    🏢 {b.branchCount} Branch{b.branchCount === 1 ? '' : 'es'}
                  </Badge>
                  <Badge variant="neutral" className="text-[10px] font-bold">
                    👥 {b.memberCount} Members
                  </Badge>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end">
                  <Link
                    href={`/admin/businesses/${b.id}`}
                    className="w-full min-h-[44px] inline-flex items-center justify-center rounded-xl bg-zinc-950 text-white font-extrabold text-xs"
                  >
                    Inspect Business ⚙️
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-xs font-semibold text-zinc-500">
                Page {page} of {totalPages} ({total} businesses)
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
