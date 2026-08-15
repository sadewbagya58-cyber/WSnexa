'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { initializePilotVenueAction } from '@/server/actions/super-admin';
import { VenueType } from '@/lib/validation/venue';

interface PilotVenueItem {
  businessId: string;
  businessName: string;
  slug: string;
  status: string;
  branchCount: number;
  venueId: string | null;
  venueDisplayName: string;
  venueSlug: string | null;
  isPublished: boolean;
  isLocationComplete: boolean;
  createdAt: string;
}

interface AdminPilotClientProps {
  initialPilots: PilotVenueItem[];
}

export function AdminPilotClient({ initialPilots }: AdminPilotClientProps) {
  const router = useRouter();
  const [pilots] = useState<PilotVenueItem[]>(initialPilots);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [formData, setFormData] = useState({
    businessName: 'Royal Palm Beach Resort',
    venueDisplayName: 'Royal Palm Resort',
    venueType: 'resort' as VenueType,
    city: 'Bentota',
    country: 'LK',
    latitude: 6.4251,
    longitude: 79.9982,
    template: 'resort' as 'resort' | 'restaurant' | 'cafe',
    isPublished: false,
  });

  const handleCreatePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await initializePilotVenueAction(formData);
    setLoading(false);

    if (res.success) {
      setMessage({ success: true, text: res.message || 'Pilot venue initialized successfully!' });
      setShowModal(false);
      router.refresh();
    } else {
      setMessage({ success: false, text: res.message || 'Failed to initialize pilot venue.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold ${
            message.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Header & Init CTA Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-zinc-950">Pilot & Demonstration Venues</h2>
          <p className="text-xs font-semibold text-zinc-500 mt-0.5">
            Isolated tenant venues pre-configured with sample menus, tables, and QR codes for onboarding and testing.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-6 rounded-2xl min-h-[44px] shrink-0"
        >
          🧪 Initialize Pilot Template
        </Button>
      </div>

      {/* Pilot Venues List */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-zinc-950">Pilot Venues Directory ({pilots.length})</h3>
            <p className="text-xs font-semibold text-zinc-500">
              Pilots default to unpublished drafts to protect public discovery safety.
            </p>
          </div>
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-extrabold text-[10px]">
            {pilots.length} Active Pilots
          </Badge>
        </div>

        {pilots.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-3xl">🧪</div>
            <h4 className="text-sm font-black text-zinc-900">No pilot venues initialized.</h4>
            <p className="text-xs font-semibold text-zinc-500 max-w-sm mx-auto">
              Initialize a pilot venue template with one click to test digital ordering, menu layouts, and waiter flows.
            </p>
            <Button
              type="button"
              onClick={() => setShowModal(true)}
              className="bg-zinc-950 text-white font-extrabold text-xs px-6 rounded-2xl min-h-[44px]"
            >
              + Create First Pilot
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {pilots.map((p) => (
              <div key={p.businessId} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-950 text-base">{p.venueDisplayName}</span>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-extrabold text-[9px]">
                      PILOT
                    </Badge>
                    {p.isPublished ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[9px]">
                        LIVE
                      </Badge>
                    ) : (
                      <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[9px]">DRAFT</Badge>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-zinc-500">
                    Business: {p.businessName} • {p.branchCount} Branch • Created {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                  {p.venueSlug && (
                    <div className="text-xs font-mono text-amber-600 font-bold">/{p.venueSlug}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {p.venueId && (
                    <Link
                      href={`/admin/venues/${p.venueId}`}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 px-4 py-2 text-xs font-extrabold text-zinc-900"
                    >
                      Manage Venue ⚙️
                    </Link>
                  )}
                  <Link
                    href={`/admin/businesses/${p.businessId}`}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-zinc-950 text-white px-4 py-2 text-xs font-extrabold"
                  >
                    Inspect Tenant 🏢
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Initialize Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h3 className="text-base font-black text-zinc-950">Initialize Pilot Venue</h3>
                <p className="text-xs font-semibold text-zinc-500">
                  Instantly creates a business, branch, menu categories, items, tables, and QR tokens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-700 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePilot} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-700">Business Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-700">Public Display Name *</label>
                <input
                  type="text"
                  required
                  value={formData.venueDisplayName}
                  onChange={(e) => setFormData({ ...formData, venueDisplayName: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700">Venue Type</label>
                  <select
                    value={formData.venueType}
                    onChange={(e) => setFormData({ ...formData, venueType: e.target.value as VenueType })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  >
                    <option value="resort">Resort</option>
                    <option value="hotel">Hotel</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="cafe">Cafe</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Template</label>
                  <select
                    value={formData.template}
                    onChange={(e) => setFormData({ ...formData, template: e.target.value as 'resort' | 'restaurant' | 'cafe' })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  >
                    <option value="resort">Resort & Spa (Full)</option>
                    <option value="restaurant">Restaurant (Standard)</option>
                    <option value="cafe">Cafe / Quick Service</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Country Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-700">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                    className="w-full rounded-2xl border border-zinc-200 p-2.5 text-xs font-semibold text-zinc-950 mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="pilotPublishToggle"
                  checked={formData.isPublished}
                  onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-950 accent-zinc-950 cursor-pointer"
                />
                <label htmlFor="pilotPublishToggle" className="text-xs font-bold text-zinc-700 cursor-pointer">
                  Publish Immediately (Default: False / Draft for safety)
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="text-xs font-extrabold min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="text-xs font-extrabold bg-zinc-950 text-white min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
                >
                  {loading ? 'Initializing Pilot Sandbox...' : 'Initialize Pilot Venue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
