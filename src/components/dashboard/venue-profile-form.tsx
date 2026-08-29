'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';
import {
  upsertVenueProfileAction,
  toggleVenuePublishedStatusAction,
  uploadVenueImageAction,
  removeVenueImageAction,
} from '@/server/actions/venue-discovery';
import { normalizeVenueSlug } from '@/lib/validation/venue';
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone';

interface VenueProfileFormProps {
  businessId: string;
  initialProfile: VenuePublicProfileRecord | null;
  branches: Array<{ id: string; name: string }>;
}

export function VenueProfileForm({ initialProfile, branches }: VenueProfileFormProps) {
  const [formData, setFormData] = useState({
    displayName: initialProfile?.display_name || '',
    slug: initialProfile?.slug || '',
    venueType: initialProfile?.venue_type || 'restaurant',
    shortDescription: initialProfile?.short_description || '',
    description: initialProfile?.description || '',
    logoUrl: initialProfile?.logo_url || '',
    coverImageUrl: initialProfile?.cover_image_url || '',
    phonePublic: initialProfile?.phone_public || '',
    emailPublic: initialProfile?.email_public || '',
    websiteUrl: initialProfile?.website_url || '',
    addressPublic: initialProfile?.address_public || '',
    city: initialProfile?.city || '',
    country: initialProfile?.country || 'LK',
    latitude: initialProfile?.latitude != null ? Number(initialProfile.latitude) : ('' as number | string),
    longitude: initialProfile?.longitude != null ? Number(initialProfile.longitude) : ('' as number | string),
    priceLevel: initialProfile?.price_level || 2,
    isPublished: initialProfile?.is_published || false,
    isAcceptingOrders: initialProfile?.is_accepting_orders ?? true,
    publicReservationsEnabled: initialProfile?.public_reservations_enabled ?? true,
    publicMenuEnabled: initialProfile?.public_menu_enabled ?? true,
    featuredBranchId: initialProfile?.featured_branch_id || '',
    bookingUrl: initialProfile?.booking_url || '',
    agodaUrl: initialProfile?.agoda_url || '',
    externalBookingUrl: initialProfile?.external_booking_url || '',
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(initialProfile?.slug));
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showMapPreview, setShowMapPreview] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const isLocComplete = Boolean(
    formData.addressPublic &&
      formData.addressPublic.trim().length >= 1 &&
      formData.city &&
      formData.city.trim().length >= 1 &&
      formData.country &&
      formData.latitude !== '' &&
      formData.latitude != null &&
      !isNaN(Number(formData.latitude)) &&
      Number(formData.latitude) >= -90 &&
      Number(formData.latitude) <= 90 &&
      formData.longitude !== '' &&
      formData.longitude != null &&
      !isNaN(Number(formData.longitude)) &&
      Number(formData.longitude) >= -180 &&
      Number(formData.longitude) <= 180
  );

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      displayName: val,
      slug: !isSlugManuallyEdited ? normalizeVenueSlug(val) : prev.slug,
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    const val = e.target.value;
    const cleaned = val
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
    setFormData((prev) => ({
      ...prev,
      slug: cleaned,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ success: false, text: 'Geolocation is not supported by your browser.' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setShowMapPreview(true);
        setMessage({ success: true, text: '📍 Coordinates detected from current location!' });
      },
      (err) => {
        setGeoLoading(false);
        setMessage({ success: false, text: `Location access error: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const scrollToLocationSection = () => {
    const el = document.getElementById('venue-location-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSave = async (shouldPublish?: boolean) => {
    setLoading(true);
    setMessage(null);

    const latVal = formData.latitude !== '' && formData.latitude != null ? Number(formData.latitude) : null;
    const lngVal = formData.longitude !== '' && formData.longitude != null ? Number(formData.longitude) : null;

    const payload = {
      ...formData,
      slug: normalizeVenueSlug(formData.slug || formData.displayName),
      venueType: formData.venueType as 'restaurant' | 'hotel' | 'cafe' | 'resort' | 'villa' | 'guest_house' | 'food_court' | 'cloud_kitchen' | 'other',
      latitude: latVal,
      longitude: lngVal,
      isPublished: shouldPublish !== undefined ? shouldPublish : formData.isPublished,
      priceLevel: Number(formData.priceLevel),
    };

    const res = await upsertVenueProfileAction(payload);
    setLoading(false);

    if (res.success) {
      setMessage({ success: true, text: res.message || 'Profile saved successfully.' });
      setFormData((prev) => ({
        ...prev,
        slug: payload.slug,
        isPublished: payload.isPublished,
      }));
    } else {
      setMessage({ success: false, text: res.message || 'Failed to update profile.' });
    }
  };

  const handleToggleStatus = async () => {
    setLoading(true);
    setMessage(null);
    const nextStatus = !formData.isPublished;
    const res = await toggleVenuePublishedStatusAction(nextStatus);
    setLoading(false);

    if (res.success) {
      setMessage({ success: true, text: res.message || 'Status updated.' });
      setFormData((prev) => ({ ...prev, isPublished: nextStatus }));
    } else {
      setMessage({ success: false, text: res.message || 'Status update failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Publication Status Card Banner */}
      <div
        className={`rounded-3xl p-6 border shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          formData.isPublished
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={formData.isPublished ? 'success' : 'warning'} className="font-extrabold text-xs">
              {formData.isPublished ? '• LIVE & PUBLISHED' : '• UNPUBLISHED DRAFT'}
            </Badge>
            <span className="text-xs font-mono break-all">/venues/{formData.slug || 'your-slug'}</span>
          </div>
          <p className="text-xs font-medium leading-relaxed">
            {formData.isPublished
              ? 'Your venue profile is live and searchable on WSNexa Explore.'
              : 'Your venue profile is currently private and hidden from public venue discovery.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {formData.slug && (
            <Link
              href={`/venues/${formData.slug}`}
              target="_blank"
              className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-950 font-extrabold text-xs hover:bg-zinc-100 transition-colors"
            >
              👁️ Preview Profile
            </Link>
          )}

          <Button
            type="button"
            onClick={handleToggleStatus}
            disabled={loading}
            variant={formData.isPublished ? 'outline' : 'primary'}
            className="text-xs font-black py-2"
          >
            {formData.isPublished ? 'Unpublish Profile' : '🚀 Publish Live'}
          </Button>
        </div>
      </div>

      {/* Main Profile Form Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        {message && (
          <div
            className={`p-4 rounded-2xl text-xs font-bold ${
              message.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Display Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Display Name *</label>
            <input
              name="displayName"
              type="text"
              value={formData.displayName}
              onChange={handleDisplayNameChange}
              placeholder="e.g. Aura Boutique Hotel & Cafe"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              required
            />
          </div>

          {/* URL Slug */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Venue Web Address (Slug) *</label>
            <input
              name="slug"
              type="text"
              value={formData.slug}
              onChange={handleSlugChange}
              placeholder="e.g. aura-boutique-hotel"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-mono font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              required
            />
            <p className="text-[11px] text-zinc-500 font-medium break-all">
              Web Address: <span className="font-mono text-amber-700 font-bold break-all">w-snexa.vercel.app/venues/{formData.slug || 'your-slug'}</span>
            </p>
          </div>

          {/* Venue Type */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Venue Category *</label>
            <select
              name="venueType"
              value={formData.venueType}
              onChange={handleChange}
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
            >
              <option value="restaurant">Restaurant</option>
              <option value="hotel">Hotel</option>
              <option value="cafe">Cafe</option>
              <option value="resort">Resort</option>
              <option value="villa">Villa</option>
              <option value="guest_house">Guest House</option>
              <option value="food_court">Food Court</option>
              <option value="cloud_kitchen">Cloud Kitchen</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Price Level */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Price Level</label>
            <select
              name="priceLevel"
              value={formData.priceLevel}
              onChange={handleChange}
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
            >
              <option value={1}>$ (Inexpensive)</option>
              <option value={2}>$$ (Moderate)</option>
              <option value={3}>$$$ (Expensive)</option>
              <option value={4}>$$$$ (Very Expensive / Luxury)</option>
            </select>
          </div>
        </div>

        {/* Media Upload Section */}
        <div className="border-t border-b border-zinc-100 py-6 space-y-6">
          <h3 className="text-sm font-black text-zinc-950 uppercase tracking-wider">Venue Photos & Media</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Dropzone */}
            <ImageUploadDropzone
              label="Venue Logo"
              recommendedText="Square photo • PNG, JPG, or WEBP • Max 5 MB"
              currentUrl={formData.logoUrl}
              imageType="logo"
              uploadAction={uploadVenueImageAction}
              removeAction={removeVenueImageAction}
              onUploadSuccess={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
              onRemoveSuccess={() => setFormData((prev) => ({ ...prev, logoUrl: '' }))}
            />

            {/* Cover Photo Dropzone */}
            <ImageUploadDropzone
              label="Cover Photo"
              recommendedText="Landscape banner photo (16:9) • PNG, JPG, or WEBP • Max 8 MB"
              currentUrl={formData.coverImageUrl}
              imageType="cover"
              uploadAction={uploadVenueImageAction}
              removeAction={removeVenueImageAction}
              onUploadSuccess={(url) => setFormData((prev) => ({ ...prev, coverImageUrl: url }))}
              onRemoveSuccess={() => setFormData((prev) => ({ ...prev, coverImageUrl: '' }))}
            />
          </div>
        </div>

        {/* Descriptions */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Short Description (Summary)</label>
            <textarea
              name="shortDescription"
              rows={2}
              value={formData.shortDescription}
              onChange={handleChange}
              placeholder="Brief 1-2 sentence tagline for discovery venue cards."
              maxLength={300}
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-medium text-zinc-950 focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Full About Description</label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of your venue, cuisine, atmosphere, and services."
              maxLength={2000}
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-medium text-zinc-950 focus:border-amber-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Public Location & Coordinates Section */}
        <div id="venue-location-section" className="border-t border-zinc-100 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-950 flex items-center gap-2">
              <span>📍 Venue Location & Map Setup</span>
              {isLocComplete ? (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                  ✓ Location configured
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px]">
                  ⚠ Location setup incomplete
                </Badge>
              )}
            </h3>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseCurrentLocation}
                disabled={geoLoading}
                className="text-xs font-bold border-zinc-200 text-zinc-800"
              >
                {geoLoading ? 'Detecting...' : '📍 Use Current Location'}
              </Button>

              {formData.latitude !== '' && formData.longitude !== '' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMapPreview(!showMapPreview)}
                  className="text-xs font-bold border-zinc-200 text-zinc-800"
                >
                  {showMapPreview ? 'Hide Map' : '🗺 Preview on Map'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Public Address *</label>
              <input
                name="addressPublic"
                type="text"
                value={formData.addressPublic}
                onChange={handleChange}
                placeholder="123 Ocean Avenue"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">City *</label>
              <input
                name="city"
                type="text"
                value={formData.city}
                onChange={handleChange}
                placeholder="Colombo"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Country *</label>
              <select
                name="country"
                value={formData.country}
                onChange={handleChange}
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              >
                <option value="LK">Sri Lanka (LK)</option>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="AE">United Arab Emirates (AE)</option>
                <option value="SG">Singapore (SG)</option>
                <option value="TH">Thailand (TH)</option>
                <option value="IN">India (IN)</option>
                <option value="AU">Australia (AU)</option>
              </select>
            </div>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Latitude (-90 to 90) *</label>
              <input
                name="latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="e.g. 6.927079"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Longitude (-180 to 180) *</label>
              <input
                name="longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="e.g. 79.861244"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Map Preview Box */}
          {showMapPreview && formData.latitude !== '' && formData.longitude !== '' && (
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-zinc-50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
                <span>Location Preview: ({formData.latitude}, {formData.longitude})</span>
                <a
                  href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-600 underline font-extrabold"
                >
                  Open in Google Maps ↗
                </a>
              </div>
              <div className="h-48 rounded-xl bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-600 border border-zinc-300">
                <span>📍 Map Pin at [{formData.latitude}, {formData.longitude}]</span>
              </div>
            </div>
          )}
        </div>

        {/* External Links & Booking Section */}
        <div className="border-t border-zinc-100 pt-4 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Website & External Hotel Booking Links</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Official Website</label>
              <input
                name="websiteUrl"
                type="text"
                value={formData.websiteUrl}
                onChange={handleChange}
                placeholder="https://aurahotel.com"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Booking.com Listing URL</label>
              <input
                name="bookingUrl"
                type="text"
                value={formData.bookingUrl}
                onChange={handleChange}
                placeholder="https://www.booking.com/hotel/..."
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Agoda Listing URL</label>
              <input
                name="agodaUrl"
                type="text"
                value={formData.agodaUrl}
                onChange={handleChange}
                placeholder="https://www.agoda.com/..."
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Direct Reservation Engine URL</label>
              <input
                name="externalBookingUrl"
                type="text"
                value={formData.externalBookingUrl}
                onChange={handleChange}
                placeholder="https://reserve.aurahotel.com"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Public Features Section */}
        <div className="border-t border-zinc-100 pt-4 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Public Features</h3>
          <p className="text-xs text-zinc-500">
            Choose which guest-facing features appear on your public venue profile. Neither setting is required to publish your venue profile.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-start gap-3 p-3 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/50 cursor-pointer">
              <input
                type="checkbox"
                name="publicReservationsEnabled"
                checked={formData.publicReservationsEnabled}
                onChange={handleChange}
                className="w-4 h-4 text-amber-600 rounded mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-zinc-900 block">Allow guests to reserve a table</span>
                <span className="text-[11px] text-zinc-500">Exposes the &quot;Reserve Table&quot; CTA and public booking flow on your profile.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/50 cursor-pointer">
              <input
                type="checkbox"
                name="publicMenuEnabled"
                checked={formData.publicMenuEnabled}
                onChange={handleChange}
                className="w-4 h-4 text-amber-600 rounded mt-0.5"
              />
              <div>
                <span className="text-xs font-bold text-zinc-900 block">Show menu on public venue</span>
                <span className="text-[11px] text-zinc-500">Exposes published active menu items and ordering CTAs on your profile.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Featured Branch Selector */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Featured Menu Branch</label>
          <select
            name="featuredBranchId"
            value={formData.featuredBranchId}
            onChange={handleChange}
            className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
          >
            <option value="">Default Branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!isLocComplete ? (
            <div className="text-xs font-bold text-amber-700 flex items-center gap-2">
              <span>⚠ Complete your venue location before publishing.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={scrollToLocationSection}
                className="text-amber-800 underline font-black text-xs hover:bg-amber-100 p-1"
              >
                Set Venue Location
              </Button>
            </div>
          ) : (
            <div className="text-xs font-bold text-emerald-700">
              ✓ Venue location complete & ready to publish live.
            </div>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              onClick={() => handleSave(false)}
              disabled={loading}
              variant="outline"
              className="text-xs font-extrabold py-3"
            >
              {loading ? 'Saving...' : '💾 Save Draft'}
            </Button>

            <Button
              type="button"
              onClick={() => handleSave(true)}
              disabled={loading || !isLocComplete}
              title={!isLocComplete ? 'Complete your venue location before publishing.' : 'Publish venue live'}
              className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs py-3 px-6 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : '🚀 Save & Publish Live'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
