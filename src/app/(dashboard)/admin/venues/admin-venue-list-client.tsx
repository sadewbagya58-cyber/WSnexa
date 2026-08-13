'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminVenueListItem } from '@/server/services/super-admin-venue.service';
import { toggleAdminPublishAction } from '@/server/actions/super-admin-venue';

interface AdminVenueListClientProps {
  initialVenues: AdminVenueListItem[];
  initialQuery: string;
}

export function AdminVenueListClient({ initialVenues, initialQuery }: AdminVenueListClientProps) {
  const router = useRouter();
  const [venues, setVenues] = useState(initialVenues);
  const [search, setSearch] = useState(initialQuery);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; text: string } | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin/venues?query=${encodeURIComponent(search)}`);
  };

  const handleTogglePublish = async (venue: AdminVenueListItem) => {
    const nextStatus = !venue.isPublished;
    setTogglingId(venue.id);
    setFeedback(null);

    const res = await toggleAdminPublishAction(venue.id, nextStatus);
    setTogglingId(null);

    if (res.success) {
      setFeedback({ id: venue.id, success: true, text: res.message });
      setVenues((prev) =>
        prev.map((v) => (v.id === venue.id ? { ...v, isPublished: nextStatus } : v))
      );
    } else {
      setFeedback({ id: venue.id, success: false, text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-xl">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by venue name, city, or slug..."
          className="flex-1 rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
        />
        <Button
          type="submit"
          className="bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs px-6 rounded-2xl min-h-[44px]"
        >
          Search
        </Button>
      </form>

      {venues.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 p-12 text-center space-y-3 bg-zinc-50">
          <div className="text-3xl">🏛️</div>
          <h3 className="text-sm font-black text-zinc-900">No venues have been published yet.</h3>
          <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
            {search ? 'No venues matched your search criteria.' : 'Create a venue to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-4">Venue & Business</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Location Status</th>
                  <th className="p-4">WSNexa Ordering</th>
                  <th className="p-4">Publication</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-semibold text-zinc-900">
                {venues.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-4 space-y-0.5">
                      <div className="font-black text-zinc-950 text-sm">{v.displayName}</div>
                      <div className="text-[11px] text-zinc-500">Business: {v.businessName}</div>
                      <div className="text-[11px] text-amber-600 font-mono">/{v.slug}</div>
                    </td>
                    <td className="p-4">
                      <div>{v.city}, {v.country}</div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        {v.latitude != null && v.longitude != null ? `${v.latitude}, ${v.longitude}` : 'No coordinates'}
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
                      {v.isPublished ? (
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
                        disabled={togglingId === v.id}
                        className="text-[11px] font-extrabold"
                      >
                        {togglingId === v.id
                          ? 'Updating...'
                          : v.isPublished
                          ? 'Unpublish'
                          : 'Publish Live'}
                      </Button>

                      <a
                        href={`/venues/${v.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-[11px] font-extrabold text-amber-600 hover:text-amber-700 underline"
                      >
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (320px–768px) */}
          <div className="md:hidden space-y-4">
            {venues.map((v) => (
              <div key={v.id} className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-zinc-950 text-base">{v.displayName}</h4>
                    <p className="text-xs font-semibold text-zinc-500">Business: {v.businessName}</p>
                    <p className="text-xs font-bold text-amber-600 font-mono">/{v.slug}</p>
                  </div>
                  {v.isPublished ? (
                    <Badge className="bg-emerald-600 text-white font-black text-[10px]">LIVE</Badge>
                  ) : (
                    <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">DRAFT</Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {v.isLocationComplete ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                      ✓ Location configured
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                      ⚠ Location setup incomplete
                    </Badge>
                  )}

                  {v.hasWsnexaOrdering ? (
                    <Badge className="bg-emerald-500 text-white font-extrabold text-[10px]">
                      ✓ Ordering Active
                    </Badge>
                  ) : (
                    <Badge className="bg-zinc-100 text-zinc-700 font-bold text-[10px]">
                      View Venue Only
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

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={v.isPublished ? 'outline' : 'primary'}
                    onClick={() => handleTogglePublish(v)}
                    disabled={togglingId === v.id}
                    className="text-xs font-extrabold flex-1 min-h-[44px]"
                  >
                    {togglingId === v.id
                      ? 'Updating...'
                      : v.isPublished
                      ? 'Unpublish to Draft'
                      : 'Publish Live'}
                  </Button>

                  <a
                    href={`/venues/${v.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-extrabold text-xs px-4 py-2.5 rounded-xl text-center min-h-[44px] flex items-center justify-center"
                  >
                    View ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
