'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminVenueDetail } from '@/server/services/super-admin.service';
import {
  updateAdminVenueAction,
  toggleAdminPublishAction,
  suspendAdminVenueAction,
  reactivateAdminVenueAction,
} from '@/server/actions/super-admin';
import { VenueType } from '@/lib/validation/venue';

interface AdminVenueDetailProps {
  venue: AdminVenueDetail;
}

export function AdminVenueDetailClient({ venue: initialVenue }: AdminVenueDetailProps) {
  const router = useRouter();
  const [venue, setVenue] = useState<AdminVenueDetail>(initialVenue);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);

  // Suspension modal state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    displayName: venue.displayName,
    slug: venue.slug,
    venueType: venue.venueType as VenueType,
    shortDescription: venue.shortDescription || '',
    description: venue.description || '',
    addressPublic: venue.addressPublic || '',
    city: venue.city,
    country: venue.country,
    latitude: venue.latitude != null ? String(venue.latitude) : '',
    longitude: venue.longitude != null ? String(venue.longitude) : '',
    priceLevel: venue.priceLevel,
    phonePublic: venue.phonePublic || '',
    emailPublic: venue.emailPublic || '',
    websiteUrl: venue.websiteUrl || '',
    bookingUrl: venue.bookingUrl || '',
    agodaUrl: venue.agodaUrl || '',
    externalBookingUrl: venue.externalBookingUrl || '',
    isAcceptingOrders: venue.isAcceptingOrders,
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    const latVal = formData.latitude !== '' ? Number(formData.latitude) : undefined;
    const lngVal = formData.longitude !== '' ? Number(formData.longitude) : undefined;

    const res = await updateAdminVenueAction(venue.id, {
      ...formData,
      latitude: latVal,
      longitude: lngVal,
    });

    setLoading(false);
    if (res.success) {
      setFeedback({ success: true, text: 'Venue updated successfully.' });
      setIsEditing(false);
      router.refresh();
    } else {
      setFeedback({ success: false, text: res.message || 'Failed to update venue.' });
    }
  };

  const handleTogglePublish = async () => {
    setLoading(true);
    setFeedback(null);
    const nextStatus = !venue.isPublished;

    const res = await toggleAdminPublishAction(venue.id, nextStatus);
    setLoading(false);

    if (res.success) {
      setFeedback({ success: true, text: res.message });
      setVenue((prev) => ({ ...prev, isPublished: nextStatus }));
    } else {
      setFeedback({ success: false, text: res.message });
    }
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuspendLoading(true);
    setFeedback(null);

    const res = await suspendAdminVenueAction(venue.id, suspendReason);
    setSuspendLoading(false);

    if (res.success) {
      setShowSuspendModal(false);
      setVenue((prev) => ({
        ...prev,
        isSuspended: true,
        suspensionReason: suspendReason,
        suspendedAt: new Date().toISOString(),
      }));
      setFeedback({ success: true, text: 'Venue suspended successfully.' });
    } else {
      setFeedback({ success: false, text: res.message });
    }
  };

  const handleReactivate = async () => {
    setLoading(true);
    setFeedback(null);

    const res = await reactivateAdminVenueAction(venue.id);
    setLoading(false);

    if (res.success) {
      setVenue((prev) => ({
        ...prev,
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
      }));
      setFeedback({ success: true, text: 'Venue reactivated successfully.' });
    } else {
      setFeedback({ success: false, text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
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

      {/* Top Controls Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-zinc-400">ID: {venue.id}</span>
              {venue.isPilotDemo && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-extrabold text-[10px]">
                  PILOT DEMO
                </Badge>
              )}
              {venue.isSuspended ? (
                <Badge className="bg-red-600 text-white font-black text-[10px]">SUSPENDED</Badge>
              ) : venue.isPublished ? (
                <Badge className="bg-emerald-600 text-white font-black text-[10px]">LIVE PUBLISHED</Badge>
              ) : (
                <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">DRAFT</Badge>
              )}
            </div>

            <h1 className="text-2xl font-black text-zinc-950 mt-2">{venue.displayName}</h1>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Parent Business:{' '}
              <Link href={`/admin/businesses/${venue.businessId}`} className="text-amber-600 font-bold hover:underline">
                {venue.businessName}
              </Link>{' '}
              • Public URL: <span className="font-mono text-zinc-700 font-bold">/venues/{venue.slug}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!venue.isSuspended ? (
              <>
                <Button
                  type="button"
                  variant={venue.isPublished ? 'outline' : 'primary'}
                  onClick={handleTogglePublish}
                  disabled={loading}
                  className="text-xs font-extrabold min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
                >
                  {loading
                    ? venue.isPublished
                      ? 'Unpublishing...'
                      : 'Publishing Live...'
                    : venue.isPublished
                    ? 'Unpublish to Draft'
                    : 'Publish Live'}
                </Button>

                <Button
                  type="button"
                  onClick={() => setShowSuspendModal(true)}
                  className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-extrabold text-xs min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
                >
                  ⛔ Suspend Venue
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={handleReactivate}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
              >
                {loading ? 'Reactivating...' : '✓ Reactivate Venue'}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-extrabold min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
            >
              {isEditing ? 'Cancel Edit' : '✏️ Edit Details'}
            </Button>

            {venue.isPublished && !venue.isSuspended && (
              <a
                href={`/venues/${venue.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-zinc-100 hover:bg-zinc-200 active:scale-[0.97] px-4 py-2 text-xs font-extrabold text-zinc-900 transition-all cursor-pointer"
              >
                View Public Profile ↗
              </a>
            )}
          </div>
        </div>

        {venue.isSuspended && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs space-y-1 text-red-900 font-semibold">
            <div className="font-black text-red-950 flex items-center gap-1.5">
              <span>⛔ This venue is currently SUSPENDED</span>
            </div>
            <div>Reason: {venue.suspensionReason || 'No reason specified'}</div>
            {venue.suspendedAt && <div>Suspended At: {new Date(venue.suspendedAt).toLocaleString()}</div>}
          </div>
        )}
      </div>

      {/* Main Grid: Details / Edit & Sidebar Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form or Read-only Details */}
        <div className="lg:col-span-2 space-y-6">
          {isEditing ? (
            <form onSubmit={handleUpdate} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-5">
              <h2 className="text-base font-black text-zinc-950">Edit Venue Configuration</h2>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Slug</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Venue Type</label>
                  <select
                    value={formData.venueType}
                    onChange={(e) => setFormData({ ...formData, venueType: e.target.value as VenueType })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  >
                    <option value="hotel">Hotel</option>
                    <option value="resort">Resort</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="cafe">Cafe</option>
                    <option value="villa">Villa</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Short Description</label>
                <textarea
                  rows={2}
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Public Address</label>
                <input
                  type="text"
                  value={formData.addressPublic}
                  onChange={(e) => setFormData({ ...formData, addressPublic: e.target.value })}
                  className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Country Code</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Latitude (-90 to 90)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Longitude (-180 to 180)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Booking.com URL</label>
                  <input
                    type="text"
                    value={formData.bookingUrl}
                    onChange={(e) => setFormData({ ...formData, bookingUrl: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700">Agoda URL</label>
                  <input
                    type="text"
                    value={formData.agodaUrl}
                    onChange={(e) => setFormData({ ...formData, agodaUrl: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 text-xs font-bold min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]"
                >
                  {loading ? 'Saving...' : '💾 Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
              <div>
                <h2 className="text-base font-black text-zinc-950">Venue Details</h2>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-zinc-700">
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <span className="font-bold text-zinc-400 uppercase text-[10px]">Category</span>
                    <p className="font-bold text-zinc-950 capitalize">{venue.venueType}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <span className="font-bold text-zinc-400 uppercase text-[10px]">Price Tier</span>
                    <p className="font-bold text-zinc-950">Level {venue.priceLevel}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <span className="font-bold text-zinc-400 uppercase text-[10px]">Location</span>
                    <p className="font-bold text-zinc-950">{venue.city}, {venue.country}</p>
                    <p className="text-[11px] text-zinc-500">{venue.addressPublic || 'No street address'}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-1">
                    <span className="font-bold text-zinc-400 uppercase text-[10px]">Coordinates</span>
                    <p className="font-mono text-zinc-950 font-bold">
                      {venue.latitude != null && venue.longitude != null
                        ? `${venue.latitude}, ${venue.longitude}`
                        : '⚠ Not configured'}
                    </p>
                  </div>
                </div>
              </div>

              {venue.shortDescription && (
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Short Summary</h3>
                  <p className="text-xs text-zinc-700 leading-relaxed font-semibold">{venue.shortDescription}</p>
                </div>
              )}

              {/* Booking & OTA Links */}
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">External OTA & Booking Links</h3>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="font-bold text-zinc-500">Booking.com:</span>{' '}
                    {venue.bookingUrl ? (
                      <a href={venue.bookingUrl} target="_blank" rel="noreferrer" className="text-amber-600 underline font-mono">
                        {venue.bookingUrl}
                      </a>
                    ) : (
                      <span className="text-zinc-400">None</span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-zinc-500">Agoda:</span>{' '}
                    {venue.agodaUrl ? (
                      <a href={venue.agodaUrl} target="_blank" rel="noreferrer" className="text-amber-600 underline font-mono">
                        {venue.agodaUrl}
                      </a>
                    ) : (
                      <span className="text-zinc-400">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Associated Branches Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-zinc-950">Associated Branches ({venue.branches.length})</h2>
            </div>

            <div className="divide-y divide-zinc-100 text-xs">
              {venue.branches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="font-bold text-zinc-950">
                      {b.name} {b.isDefault && <Badge variant="neutral" className="text-[9px]">DEFAULT</Badge>}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono">Code: {b.code} • 📍 {b.city || 'City'}</div>
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
        </div>

        {/* Right 1 Col: Status Diagnostics & Audit Trail */}
        <div className="space-y-6">
          {/* Readiness & Gate Status Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Discovery Gate Status</h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-600">Location Coords:</span>
                {venue.isLocationComplete ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                    ✓ Complete
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                    ⚠ Incomplete
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-600">Digital Ordering:</span>
                {venue.hasWsnexaOrdering ? (
                  <Badge className="bg-emerald-500 text-white font-extrabold text-[10px]">
                    ✓ Active
                  </Badge>
                ) : (
                  <Badge className="bg-zinc-100 text-zinc-700 font-bold text-[10px]">
                    View Only
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-600">Publication State:</span>
                {venue.isPublished ? (
                  <Badge className="bg-emerald-600 text-white font-black text-[10px]">LIVE</Badge>
                ) : (
                  <Badge className="bg-zinc-200 text-zinc-800 font-bold text-[10px]">DRAFT</Badge>
                )}
              </div>
            </div>
          </div>

          {/* Recent Audit Trail Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4">
            <h2 className="text-base font-black text-zinc-950">Venue Audit Trail</h2>
            <div className="divide-y divide-zinc-100">
              {venue.recentAuditLogs.length === 0 ? (
                <p className="text-xs font-semibold text-zinc-400 py-4 text-center">No audit logs recorded yet.</p>
              ) : (
                venue.recentAuditLogs.map((l) => (
                  <div key={l.id} className="py-2.5 space-y-0.5 first:pt-0 last:pb-0 text-xs">
                    <div className="font-mono font-bold text-zinc-900">{l.action}</div>
                    <div className="text-[10px] text-zinc-400">
                      {new Date(l.createdAt).toLocaleString()} by {l.actorEmail}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl font-black shrink-0">
                ⛔
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-950">Suspend Venue Platform Presence</h3>
                <p className="text-xs font-semibold text-zinc-500">Restricts public discovery and digital ordering.</p>
              </div>
            </div>

            <form onSubmit={handleSuspend} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700">Reason for Suspension *</label>
                <textarea
                  rows={3}
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Incomplete verification documents, billing failure, or policy violation..."
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
                  type="submit"
                  disabled={suspendLoading || !suspendReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs min-h-[44px]"
                >
                  {suspendLoading ? 'Suspending...' : 'Confirm Suspension'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
