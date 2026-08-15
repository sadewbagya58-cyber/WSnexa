'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface BranchItem {
  id: string;
  name: string;
  code: string;
  businessId: string;
  businessName: string;
  isPilot: boolean;
  city: string | null;
  countryCode: string;
  status: string;
  isDefault: boolean;
  hasCoordinates: boolean;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

interface AdminBranchListProps {
  branches: BranchItem[];
  total: number;
  page: number;
  totalPages: number;
  currentQuery: string;
  currentStatus: string;
}

export function AdminBranchList({
  branches,
  total,
  page,
  totalPages,
  currentQuery,
  currentStatus,
}: AdminBranchListProps) {
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
      router.push(`/admin/branches?${params.toString()}`);
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
      {/* Search & Filters */}
      <div className="space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search branches by name, code, or city..."
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
            { id: 'all', label: 'All Branches' },
            { id: 'active', label: 'Active' },
            { id: 'inactive', label: 'Inactive' },
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

      {branches.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-white">
          <div className="text-3xl">📍</div>
          <h3 className="text-sm font-black text-zinc-900">No branches found.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'No branches matched your criteria.'
              : 'Registered branch locations will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Branch Name</th>
                  <th className="p-4">Parent Business</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Coordinates</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-900">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-zinc-950 text-sm">{b.name}</span>
                        {b.isDefault && <Badge variant="neutral" className="text-[9px]">DEFAULT</Badge>}
                        {b.isPilot && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold text-[9px]">
                            PILOT
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">Code: {b.code}</div>
                    </td>

                    <td className="p-4 text-zinc-700">
                      <Link
                        href={`/admin/businesses/${b.businessId}`}
                        className="font-bold text-amber-600 hover:underline"
                      >
                        {b.businessName}
                      </Link>
                    </td>

                    <td className="p-4">
                      <span>{b.city || 'City not set'}, {b.countryCode}</span>
                    </td>

                    <td className="p-4">
                      {b.hasCoordinates ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                          ✓ Coords Set
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                          ⚠ Missing
                        </Badge>
                      )}
                    </td>

                    <td className="p-4">
                      {b.status === 'active' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">
                          {b.status.toUpperCase()}
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/businesses/${b.businessId}`}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-[11px] font-extrabold text-zinc-900"
                      >
                        Inspect Business ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards */}
          <div className="md:hidden space-y-4">
            {branches.map((b) => (
              <div key={b.id} className="rounded-3xl border border-zinc-200 bg-white p-4 space-y-2 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-zinc-950 text-base">{b.name}</h4>
                      {b.isDefault && <Badge variant="neutral" className="text-[9px]">DEFAULT</Badge>}
                    </div>
                    <p className="text-xs font-semibold text-zinc-500">Business: {b.businessName}</p>
                    <p className="text-xs font-bold text-zinc-400 font-mono">Code: {b.code}</p>
                  </div>
                  {b.status === 'active' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                      ACTIVE
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">{b.status}</Badge>
                  )}
                </div>

                <div className="text-xs text-zinc-600">
                  📍 {b.city || 'No city'}, {b.countryCode}
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  {b.hasCoordinates ? (
                    <span className="text-[11px] font-bold text-emerald-700">✓ Coordinates configured</span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700">⚠ Missing coordinates</span>
                  )}
                  <Link
                    href={`/admin/businesses/${b.businessId}`}
                    className="text-xs font-extrabold text-amber-600 hover:underline"
                  >
                    Parent Business →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-xs font-semibold text-zinc-500">
                Page {page} of {totalPages} ({total} branches)
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
