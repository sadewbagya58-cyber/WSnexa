'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toggleAdminPublishAction } from '@/server/actions/super-admin';

interface VenueItem {
  id: string;
  businessId: string;
  businessName: string;
  businessStatus: string;
  isPilotDemo: boolean;
  displayName: string;
  slug: string;
  venueType: string;
  city: string;
  country: string;
  isPublished: boolean;
  isAcceptingOrders: boolean;
  hasWsnexaOrdering: boolean;
  isLocationComplete: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  latitude: number | null;
  longitude: number | null;
  addressPublic: string | null;
  featuredBranchId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminVenueListProps {
  venues: VenueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  currentQuery: string;
  currentStatus: string;
}

export function AdminVenueList({
  venues: initialVenues,
  total,
  page,
  totalPages,
  currentQuery,
  currentStatus,
}: AdminVenueListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [venues, setVenues] = useState<VenueItem[]>(initialVenues);
  const [search, setSearch] = useState(currentQuery);
  const [activeTab, setActiveTab] = useState(currentStatus || 'all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; text: string } | null>(null);

  const applyFilters = (newStatus: string, newSearch: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSearch.trim()) params.set('query', newSearch.trim());
    else params.delete('query');

    if (newStatus && newStatus !== 'all') params.set('status', newStatus);
    else params.delete('status');

    if (newPage > 1) params.set('page', String(newPage));
    else params.delete('page');

    router.push(`/admin/venues?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(activeTab, search, 1);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    applyFilters(tab, search, 1);
  };

  const handleTogglePublish = async (v: VenueItem) => {
    const nextStatus = !v.isPublished;
    setTogglingId(v.id);
    setFeedback(null);

    const res = await toggleAdminPublishAction(v.id, nextStatus);
    setTogglingId(null);

    if (res.success) {
      setFeedback({ id: v.id, success: true, text: res.message });
      setVenues((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, isPublished: nextStatus } : item))
      );
    } else {
      setFeedback({ id: v.id, success: false, text: res.message });
    }
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
            placeholder="Search venue by name, city, or slug..."
            className="flex-1 rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
          />
          <Button
            type="submit"
            className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs px-6 rounded-2xl min-h-[44px]"
          >
            Search
          </Button>
        </form>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'all', label: 'All Venues' },
            { id: 'published', label: 'Live Published' },
            { id: 'draft', label: 'Drafts' },
            { id: 'suspended', label: 'Suspended' },
            { id: 'ordering', label: 'Ordering Active' },
            { id: 'pilot', label: 'Pilot / Demo' },
            { id: 'missing_location', label: 'Missing Coordinates' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all min-h-[36px] ${
                activeTab === tab.id
                  ? 'bg-zinc-950 text-white shadow-2xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {venues.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-white">
          <div className="text-3xl">🏛️</div>
          <h3 className="text-sm font-black text-zinc-900">No venues found.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {search || activeTab !== 'all'
              ? 'No venues matched your current search or filter criteria.'
              : 'Create a venue to start onboarding businesses.'}
          </p>
          <Link
            href="/admin/venues/new"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-amber-500 px-6 py-2.5 text-xs font-black text-black"
          >
            ➕ Create New Venue
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Venue & Business</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Location Gate</th>
                  <th className="p-4">Digital Ordering</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-900">
                {venues.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 space-y-0.5 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/venues/${v.id}`}
                          className="font-black text-zinc-950 text-sm hover:text-amber-600 truncate block"
                        >
                          {v.displayName}
                        </Link>
                        {v.isPilotDemo && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-black text-[9px]">
                            PILOT
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">🏢 {v.businessName}</div>
                      <div className="text-[11px] text-amber-600 font-mono truncate">/{v.slug}</div>
                    </td>

                    <td className="p-4">
                      <div>{v.city}, {v.country}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {v.latitude != null && v.longitude != null
                          ? `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`
                          : 'No coords'}
                      </div>
                    </td>

                    <td className="p-4">
                      {v.isLocationComplete ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                          ✓ Configured
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                          ⚠ Incomplete
                        </Badge>
                      )}
                    </td>

                    <td className="p-4">
                      {v.hasWsnexaOrdering ? (
                        <Badge className="bg-emerald-500 text-white font-extrabold text-[10px]">
                          ✓ Ordering Active
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-100 text-zinc-700 font-bold text-[10px]">
                          View Only
                        </Badge>
                      )}
                    </td>

                    <td className="p-4 space-y-1">
                      {v.isSuspended ? (
                        <Badge className="bg-red-600 text-white font-black text-[10px]">
                          SUSPENDED
                        </Badge>
                      ) : v.isPublished ? (
                        <Badge className="bg-emerald-600 text-white font-black text-[10px]">
                          LIVE PUBLISHED
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">
                          DRAFT
                        </Badge>
                      )}

                      {feedback?.id === v.id && (
                        <div className={`text-[10px] font-bold ${feedback.success ? 'text-emerald-700' : 'text-red-600'}`}>
                          {feedback.text}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-right space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={v.isPublished ? 'outline' : 'primary'}
                        onClick={() => handleTogglePublish(v)}
                        disabled={togglingId === v.id || v.isSuspended}
                        className="text-[11px] font-extrabold"
                      >
                        {togglingId === v.id
                          ? 'Updating...'
                          : v.isPublished
                          ? 'Unpublish'
                          : 'Publish Live'}
                      </Button>

                      <Link
                        href={`/admin/venues/${v.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 text-[11px] font-extrabold text-zinc-900"
                      >
                        Manage ⚙️
                      </Link>

                      {v.isPublished && !v.isSuspended && (
                        <a
                          href={`/venues/${v.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block text-[11px] font-extrabold text-amber-600 hover:text-amber-700 underline"
                        >
                          View ↗
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View (320px - 768px) */}
          <div className="md:hidden space-y-4">
            {venues.map((v) => (
              <div key={v.id} className="rounded-3xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/venues/${v.id}`}
                        className="font-black text-zinc-950 text-base truncate block"
                      >
                        {v.displayName}
                      </Link>
                      {v.isPilotDemo && (
                        <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-black text-[9px]">
                          PILOT
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-zinc-500 truncate">🏢 {v.businessName}</p>
                    <p className="text-xs font-bold text-amber-600 font-mono truncate">/{v.slug}</p>
                  </div>

                  {v.isSuspended ? (
                    <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>
                  ) : v.isPublished ? (
                    <Badge className="bg-emerald-600 text-white font-black text-[10px]">LIVE</Badge>
                  ) : (
                    <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">DRAFT</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {v.isLocationComplete ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                      ✓ Location configured
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                      ⚠ Missing coordinates
                    </Badge>
                  )}

                  {v.hasWsnexaOrdering ? (
                    <Badge className="bg-emerald-500 text-white font-extrabold text-[10px]">
                      ✓ Ordering Active
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-100 text-zinc-700 font-bold text-[10px]">
                      View Only
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-zinc-600">
                  📍 {v.city}, {v.country}
                </div>

                {feedback?.id === v.id && (
                  <div className={`text-xs font-bold ${feedback.success ? 'text-emerald-700' : 'text-red-600'}`}>
                    {feedback.text}
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={v.isPublished ? 'outline' : 'primary'}
                    onClick={() => handleTogglePublish(v)}
                    disabled={togglingId === v.id || v.isSuspended}
                    className="text-xs font-extrabold flex-1 min-h-[44px]"
                  >
                    {togglingId === v.id
                      ? 'Updating...'
                      : v.isPublished
                      ? 'Unpublish'
                      : 'Publish Live'}
                  </Button>

                  <Link
                    href={`/admin/venues/${v.id}`}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl bg-zinc-950 text-white font-extrabold text-xs text-center"
                  >
                    Manage ⚙️
                  </Link>

                  {v.isPublished && !v.isSuspended && (
                    <a
                      href={`/venues/${v.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[44px] px-3 inline-flex items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 font-bold text-xs"
                    >
                      View ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-xs font-semibold text-zinc-500">
                Showing page {page} of {totalPages} ({total} total venues)
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => applyFilters(activeTab, search, page - 1)}
                  className="text-xs font-bold min-h-[36px]"
                >
                  ← Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => applyFilters(activeTab, search, page + 1)}
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
