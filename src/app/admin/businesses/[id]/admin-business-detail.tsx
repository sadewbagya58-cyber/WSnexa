'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toggleAdminBusinessStatusAction } from '@/server/actions/super-admin';

interface BranchItem {
  id: string;
  name: string;
  code: string;
  city: string | null;
  status: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
}

interface MembershipItem {
  id: string;
  role: string;
  membership_status: string;
  user_profiles?: {
    id: string;
    first_name: string;
    last_name: string | null;
    account_status: string;
  } | null;
}

interface BusinessDetailProps {
  business: {
    id: string;
    name: string;
    slug: string;
    business_type: string;
    country_code: string;
    default_currency: string;
    timezone: string;
    status: 'active' | 'suspended' | 'archived';
    is_pilot_demo: boolean;
    created_at: string;
    ownerName: string;
    branches: BranchItem[];
    memberships: MembershipItem[];
    venueProfile?: {
      id: string;
      display_name: string;
      slug: string;
      is_published: boolean;
    } | null;
  };
}

export function AdminBusinessDetailClient({ business }: BusinessDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState(business.status);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [reason, setReason] = useState('');

  const handleToggleStatus = async (targetStatus: 'active' | 'suspended' | 'archived') => {
    setLoading(true);
    setFeedback(null);

    const res = await toggleAdminBusinessStatusAction(business.id, targetStatus, reason);
    setLoading(false);

    if (res.success) {
      setStatus(targetStatus);
      setShowSuspendModal(false);
      setFeedback({ success: true, text: `Business status updated to ${targetStatus}.` });
      router.refresh();
    } else {
      setFeedback({ success: false, text: res.message || 'Failed to update business status.' });
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold ${
            feedback.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Header Info Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-400">ID: {business.id}</span>
              {business.is_pilot_demo && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-extrabold text-[10px]">
                  PILOT DEMO
                </Badge>
              )}
              {status === 'active' && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                  ACTIVE
                </Badge>
              )}
              {status === 'suspended' && (
                <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>
              )}
            </div>

            <h1 className="text-2xl font-black text-zinc-950 mt-2">{business.name}</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Owner: <span className="font-bold text-zinc-800">{business.ownerName}</span> • Slug:{' '}
              <span className="font-mono text-zinc-700 font-bold">{business.slug}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {status !== 'suspended' ? (
              <Button
                type="button"
                onClick={() => setShowSuspendModal(true)}
                className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-extrabold text-xs min-h-[44px]"
              >
                ⛔ Suspend Business
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => handleToggleStatus('active')}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs min-h-[44px]"
              >
                {loading ? 'Reactivating...' : '✓ Reactivate Business'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Details & Associated Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Business Information & Branches */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Metadata */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Business Information</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Type</span>
                <p className="font-bold text-zinc-950 capitalize mt-0.5">{business.business_type}</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Country</span>
                <p className="font-bold text-zinc-950 mt-0.5">{business.country_code}</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Currency</span>
                <p className="font-bold text-zinc-950 mt-0.5">{business.default_currency}</p>
              </div>
              <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Timezone</span>
                <p className="font-bold text-zinc-950 mt-0.5">{business.timezone}</p>
              </div>
            </div>
          </div>

          {/* Branches */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Branches ({business.branches.length})</h2>
            <div className="divide-y divide-zinc-100 text-xs">
              {business.branches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-bold text-zinc-950">
                      {b.name} {b.is_default && <Badge variant="neutral" className="text-[9px]">DEFAULT</Badge>}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">Code: {b.code} • 📍 {b.city || 'Location'}</div>
                  </div>
                  <Badge
                    className={
                      b.status === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]'
                        : 'bg-zinc-100 text-zinc-600 font-bold text-[10px]'
                    }
                  >
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Memberships */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Memberships ({business.memberships.length})</h2>
            <div className="divide-y divide-zinc-100 text-xs">
              {business.memberships.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-bold text-zinc-950">
                      {m.user_profiles ? [m.user_profiles.first_name, m.user_profiles.last_name].filter(Boolean).join(' ') : 'User'}
                    </div>
                    <div className="text-[11px] text-zinc-500 capitalize">{m.role.replace(/_/g, ' ')}</div>
                  </div>
                  <Badge variant="neutral" className="capitalize text-[10px]">
                    {m.membership_status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Public Venue Presence */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Public Venue Presence</h2>
            {business.venueProfile ? (
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                  <span className="font-bold text-zinc-400 text-[10px] uppercase">Venue Name</span>
                  <p className="font-black text-zinc-950 text-sm">{business.venueProfile.display_name}</p>
                  <p className="font-mono text-[11px] text-amber-600">/{business.venueProfile.slug}</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-600">Discovery Status:</span>
                  {business.venueProfile.is_published ? (
                    <Badge className="bg-emerald-600 text-white font-black text-[10px]">LIVE</Badge>
                  ) : (
                    <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">DRAFT</Badge>
                  )}
                </div>

                <Link
                  href={`/admin/venues/${business.venueProfile.id}`}
                  className="w-full min-h-[44px] inline-flex items-center justify-center rounded-2xl bg-zinc-950 text-white font-extrabold text-xs"
                >
                  Manage Venue Profile ⚙️
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 space-y-2 text-xs text-zinc-500">
                <p>No public venue profile registered yet for this business.</p>
                <Link
                  href="/admin/venues/new"
                  className="inline-block text-xs font-black text-amber-600 underline"
                >
                  + Create Venue for this Business
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl font-black shrink-0">
                ⛔
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950">Suspend Business</h3>
                <p className="text-xs font-semibold text-zinc-500">Suspends all operational branches & public profiles.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Reason for Suspension *</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Account overdue, fraud investigation, policy violation..."
                  className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSuspendModal(false)}
                  className="flex-1 text-xs font-bold min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleToggleStatus('suspended')}
                  disabled={loading || !reason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs min-h-[44px]"
                >
                  {loading ? 'Suspending...' : 'Confirm Suspension'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
