'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createAdminVenueAction } from '@/server/actions/super-admin';
import { normalizeVenueSlug, VenueType } from '@/lib/validation/venue';
import { VenueLocationPickerModal } from '@/components/maps/venue-location-picker-modal';

interface AdminCreateVenueClientProps {
  existingBusinesses: Array<{ id: string; name: string }>;
}

export function AdminCreateVenueClient({ existingBusinesses }: AdminCreateVenueClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    businessId: '',
    newBusinessName: '',
    displayName: '',
    slug: '',
    venueType: 'restaurant' as VenueType,
    shortDescription: '',
    description: '',
    logoUrl: '',
    coverImageUrl: '',
    phonePublic: '',
    emailPublic: '',
    websiteUrl: '',
    addressPublic: '',
    city: '',
    country: 'LK',
    latitude: '' as number | string,
    longitude: '' as number | string,
    priceLevel: 2,
    bookingUrl: '',
    agodaUrl: '',
    externalBookingUrl: '',
    isPilotDemo: false,
  });

  const [isSlugEdited, setIsSlugEdited] = useState(false);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ success: false, text: 'Invalid logo format. Please upload JPG, PNG, or WEBP.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ success: false, text: 'Logo image size exceeds 5 MB limit.' });
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage({ success: false, text: 'Invalid cover image format. Please upload JPG, PNG, or WEBP.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage({ success: false, text: 'Cover image size exceeds 8 MB limit.' });
      return;
    }
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleRemoveCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

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

  const handleNameChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      displayName: val,
      slug: !isSlugEdited ? normalizeVenueSlug(val) : prev.slug,
    }));
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
        setMessage({ success: true, text: '📍 Device coordinates captured successfully!' });
      },
      (err) => {
        setGeoLoading(false);
        setMessage({ success: false, text: `Geolocation failed: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLocationConfirm = (coords: { lat: number; lng: number }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: coords.lat,
      longitude: coords.lng,
    }));
    setMessage({
      success: true,
      text: `📍 Venue coordinates set: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
    });
  };

  const handleSubmit = async (shouldPublish: boolean) => {
    setLoading(true);
    setMessage(null);

    const latVal = formData.latitude !== '' && formData.latitude != null ? Number(formData.latitude) : undefined;
    const lngVal = formData.longitude !== '' && formData.longitude != null ? Number(formData.longitude) : undefined;

    const fd = new FormData();
    if (formData.businessId) fd.append('businessId', formData.businessId);
    if (formData.newBusinessName) fd.append('newBusinessName', formData.newBusinessName);
    fd.append('displayName', formData.displayName);
    fd.append('slug', normalizeVenueSlug(formData.slug || formData.displayName));
    fd.append('venueType', formData.venueType);
    if (formData.shortDescription) fd.append('shortDescription', formData.shortDescription);
    if (formData.description) fd.append('description', formData.description);
    if (formData.phonePublic) fd.append('phonePublic', formData.phonePublic);
    if (formData.emailPublic) fd.append('emailPublic', formData.emailPublic);
    if (formData.websiteUrl) fd.append('websiteUrl', formData.websiteUrl);
    if (formData.addressPublic) fd.append('addressPublic', formData.addressPublic);
    fd.append('city', formData.city);
    fd.append('country', formData.country);
    if (latVal != null && !isNaN(latVal)) fd.append('latitude', String(latVal));
    if (lngVal != null && !isNaN(lngVal)) fd.append('longitude', String(lngVal));
    fd.append('priceLevel', String(formData.priceLevel));
    if (formData.bookingUrl) fd.append('bookingUrl', formData.bookingUrl);
    if (formData.agodaUrl) fd.append('agodaUrl', formData.agodaUrl);
    if (formData.externalBookingUrl) fd.append('externalBookingUrl', formData.externalBookingUrl);
    fd.append('isPilotDemo', String(formData.isPilotDemo));
    fd.append('isPublished', String(shouldPublish));
    if (logoFile) fd.append('logoFile', logoFile);
    if (coverFile) fd.append('coverFile', coverFile);

    const res = await createAdminVenueAction(fd);
    setLoading(false);

    if (res.success) {
      router.push('/admin/venues');
    } else {
      setMessage({ success: false, text: res.message || 'Failed to create venue.' });
    }
  };

  return (
    <div className="space-y-6 bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-xs max-w-3xl">
      {/* Wizard Steps */}
      <div className="grid grid-cols-5 gap-2 border-b border-zinc-100 pb-4 text-center">
        {[
          { num: 1, label: 'Business' },
          { num: 2, label: 'Venue Info' },
          { num: 3, label: 'Location' },
          { num: 4, label: 'Links' },
          { num: 5, label: 'Review' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`py-2 rounded-xl text-xs font-black transition-all active:scale-[0.97] cursor-pointer touch-manipulation ${
              step === s.num
                ? 'bg-amber-500 text-black shadow-2xs'
                : step > s.num
                ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
                : 'text-zinc-400 bg-zinc-50 hover:bg-zinc-100'
            }`}
          >
            {s.num}. {s.label}
          </button>
        ))}
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold ${
            message.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* STEP 1: BUSINESS */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-black text-zinc-950">Step 1 — Business Identity</h2>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Attach venue to an existing tenant business or initialize a brand new business.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Select Existing Business</label>
            <select
              value={formData.businessId}
              onChange={(e) => setFormData({ ...formData, businessId: e.target.value, newBusinessName: '' })}
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            >
              <option value="">-- Choose Existing Business --</option>
              {existingBusinesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-200"></div>
            <span className="shrink mx-4 text-[10px] font-black text-zinc-400 uppercase">OR CREATE NEW TENANT</span>
            <div className="flex-grow border-t border-zinc-200"></div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">New Business Name</label>
            <input
              type="text"
              value={formData.newBusinessName}
              onChange={(e) => setFormData({ ...formData, newBusinessName: e.target.value, businessId: '' })}
              placeholder="e.g. Sapphire Horizon Hospitality Ltd"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pilotToggle"
              checked={formData.isPilotDemo}
              onChange={(e) => setFormData({ ...formData, isPilotDemo: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-300 text-zinc-950 accent-zinc-950 cursor-pointer"
            />
            <label htmlFor="pilotToggle" className="text-xs font-bold text-zinc-700 cursor-pointer">
              Mark as Pilot / Demo Business (isolated testing)
            </label>
          </div>

          <Button
            type="button"
            onClick={() => setStep(2)}
            disabled={!formData.businessId && !formData.newBusinessName}
            className="w-full bg-zinc-950 text-white font-extrabold text-xs py-3 rounded-2xl min-h-[44px]"
          >
            Next: Venue Profile →
          </Button>
        </div>
      )}

      {/* STEP 2: VENUE PROFILE */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-black text-zinc-950">Step 2 — Public Venue Profile</h2>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Public display name, venue category, URL slug, and summary.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Venue Display Name *</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Ocean Blue Resort & Spa"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Venue Type *</label>
              <select
                value={formData.venueType}
                onChange={(e) => setFormData({ ...formData, venueType: e.target.value as VenueType })}
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              >
                <option value="hotel">Hotel</option>
                <option value="resort">Resort</option>
                <option value="villa">Villa</option>
                <option value="guest_house">Guest House</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe</option>
                <option value="food_court">Food Court</option>
                <option value="cloud_kitchen">Cloud Kitchen</option>
                <option value="other">Other Hospitality</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Price Tier</label>
              <select
                value={formData.priceLevel}
                onChange={(e) => setFormData({ ...formData, priceLevel: parseInt(e.target.value, 10) || 2 })}
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              >
                <option value="1">$ — Budget</option>
                <option value="2">$$ — Moderate</option>
                <option value="3">$$$ — Fine Dining / Premium</option>
                <option value="4">$$$$ — Luxury</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">URL Slug *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                setIsSlugEdited(true);
                const cleaned = e.target.value
                  .toLowerCase()
                  .replace(/[\s_]+/g, '-')
                  .replace(/[^a-z0-9-]/g, '')
                  .replace(/-+/g, '-');
                setFormData({ ...formData, slug: cleaned });
              }}
              placeholder="ocean-blue-resort"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Short Tagline (Discovery Cards)</label>
            <textarea
              rows={2}
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="Luxury beachfront sanctuary with digital ordering..."
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          {/* Logo & Cover Image Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
            {/* Logo Upload */}
            <div className="space-y-2 p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-800">Venue Logo</label>
                <span className="text-[10px] font-semibold text-zinc-400">Max 5MB (JPG/PNG/WEBP)</span>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange}
                className="hidden"
                id="admin-venue-logo-input"
              />
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl border border-zinc-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Logo Preview"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-zinc-300 text-2xl font-black">🏢</span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs font-bold py-1.5 px-3 min-h-[36px] bg-white border-zinc-200 hover:bg-zinc-100 cursor-pointer"
                    >
                      {logoFile ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {logoFile && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        className="text-xs font-bold py-1.5 px-2.5 min-h-[36px] text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                      >
                        ✕ Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {logoFile ? logoFile.name : 'No logo selected'}
                  </p>
                </div>
              </div>
            </div>

            {/* Cover Photo Upload */}
            <div className="space-y-2 p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50/50">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-800">Cover Photo</label>
                <span className="text-[10px] font-semibold text-zinc-400">Max 8MB (JPG/PNG/WEBP)</span>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverChange}
                className="hidden"
                id="admin-venue-cover-input"
              />
              <div className="flex items-center gap-3">
                <div className="w-20 h-16 rounded-2xl border border-zinc-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                  {coverPreview ? (
                    <Image
                      src={coverPreview}
                      alt="Cover Preview"
                      width={80}
                      height={64}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-zinc-300 text-2xl font-black">🖼️</span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => coverInputRef.current?.click()}
                      className="text-xs font-bold py-1.5 px-3 min-h-[36px] bg-white border-zinc-200 hover:bg-zinc-100 cursor-pointer"
                    >
                      {coverFile ? 'Change Cover' : 'Upload Cover'}
                    </Button>
                    {coverFile && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveCover}
                        className="text-xs font-bold py-1.5 px-2.5 min-h-[36px] text-red-600 border-red-200 hover:bg-red-50 cursor-pointer"
                      >
                        ✕ Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {coverFile ? coverFile.name : 'No cover photo selected'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 text-xs font-bold min-h-[44px]">
              ← Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={!formData.displayName || !formData.slug}
              className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]"
            >
              Next: Location →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: LOCATION & COORDINATES */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-zinc-950">Step 3 — Location & Geolocation</h2>
              <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                Physical address and latitude/longitude coordinates required for discovery.
              </p>
            </div>
            {isLocComplete ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px]">
                ✓ Valid Coords
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                ⚠ Required for Live
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Street Address *</label>
            <input
              type="text"
              value={formData.addressPublic}
              onChange={(e) => setFormData({ ...formData, addressPublic: e.target.value })}
              placeholder="120 Galle Road, Kollupitiya"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">City *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Colombo"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Country Code *</label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              >
                <option value="LK">Sri Lanka (LK)</option>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
                <option value="AE">United Arab Emirates (AE)</option>
                <option value="SG">Singapore (SG)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Latitude (-90 to 90) *</label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                placeholder="6.9271"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Longitude (-180 to 180) *</label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                placeholder="79.8612"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleUseCurrentLocation}
              disabled={geoLoading}
              className="w-full text-xs font-extrabold border-zinc-200 min-h-[44px]"
            >
              {geoLoading ? 'Detecting Coordinates...' : '📍 Capture Device Location'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMapPicker(true)}
              className="w-full text-xs font-extrabold border-zinc-200 min-h-[44px] hover:bg-zinc-50"
            >
              🗺️ Select on Map
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 text-xs font-bold min-h-[44px]">
              ← Back
            </Button>
            <Button type="button" onClick={() => setStep(4)} className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]">
              Next: Links & Contact →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: CONTACT & EXTERNAL LINKS */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-black text-zinc-950">Step 4 — Contact & Booking Links</h2>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Public contact information and OTA integration booking URLs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Public Phone</label>
              <input
                type="text"
                value={formData.phonePublic}
                onChange={(e) => setFormData({ ...formData, phonePublic: e.target.value })}
                placeholder="+94 11 234 5678"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Public Email</label>
              <input
                type="email"
                value={formData.emailPublic}
                onChange={(e) => setFormData({ ...formData, emailPublic: e.target.value })}
                placeholder="contact@venue.com"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Booking.com Hotel URL</label>
            <input
              type="text"
              value={formData.bookingUrl}
              onChange={(e) => setFormData({ ...formData, bookingUrl: e.target.value })}
              placeholder="https://www.booking.com/hotel/..."
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Agoda URL</label>
            <input
              type="text"
              value={formData.agodaUrl}
              onChange={(e) => setFormData({ ...formData, agodaUrl: e.target.value })}
              placeholder="https://www.agoda.com/..."
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Direct Booking Website URL</label>
            <input
              type="text"
              value={formData.externalBookingUrl}
              onChange={(e) => setFormData({ ...formData, externalBookingUrl: e.target.value })}
              placeholder="https://book.venue.com"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1 text-xs font-bold min-h-[44px]">
              ← Back
            </Button>
            <Button type="button" onClick={() => setStep(5)} className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]">
              Next: Review & Save →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & SAVE */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-black text-zinc-950">Step 5 — Review & Confirmation</h2>
            <p className="text-xs font-semibold text-zinc-500 mt-0.5">
              Verify parameters before saving to platform database.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4 space-y-2 text-xs bg-zinc-50 font-semibold text-zinc-800">
            <div><span className="font-bold text-zinc-500">Name:</span> {formData.displayName}</div>
            <div><span className="font-bold text-zinc-500">Type:</span> {formData.venueType}</div>
            <div><span className="font-bold text-zinc-500">Slug:</span> /{formData.slug}</div>
            <div><span className="font-bold text-zinc-500">City:</span> {formData.city}, {formData.country}</div>
            <div><span className="font-bold text-zinc-500">Address:</span> {formData.addressPublic || 'Not set'}</div>
            <div><span className="font-bold text-zinc-500">Contact Phone:</span> {formData.phonePublic || 'Not set'}</div>
            <div><span className="font-bold text-zinc-500">Contact Email:</span> {formData.emailPublic || 'Not set'}</div>
            <div>
              <span className="font-bold text-zinc-500">Coordinates:</span>{' '}
              {formData.latitude !== '' && formData.longitude !== ''
                ? `${formData.latitude}, ${formData.longitude}`
                : '⚠ Missing coordinates'}
            </div>
            <div className="flex items-center gap-4 pt-1 border-t border-zinc-200/60">
              <div>
                <span className="font-bold text-zinc-500 block mb-1">Logo:</span>
                {logoPreview ? (
                  <div className="w-12 h-12 rounded-xl border border-zinc-200 overflow-hidden bg-white">
                    <Image src={logoPreview} alt="Logo" width={48} height={48} className="w-full h-full object-cover" unoptimized />
                  </div>
                ) : (
                  <span className="text-zinc-400">None</span>
                )}
              </div>
              <div>
                <span className="font-bold text-zinc-500 block mb-1">Cover:</span>
                {coverPreview ? (
                  <div className="w-16 h-12 rounded-xl border border-zinc-200 overflow-hidden bg-white">
                    <Image src={coverPreview} alt="Cover" width={64} height={48} className="w-full h-full object-cover" unoptimized />
                  </div>
                ) : (
                  <span className="text-zinc-400">None</span>
                )}
              </div>
            </div>
            {formData.isPilotDemo && (
              <div className="text-purple-700 font-extrabold pt-1">🧪 Marked as Pilot / Demo Venue</div>
            )}
          </div>

          {!isLocComplete && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
              ⚠ Location coordinates are incomplete. You can save as a Draft now, but Live Publishing requires valid address, city, and coordinates.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              variant="outline"
              className="flex-1 text-xs font-extrabold py-3 min-h-[44px] active:scale-[0.97] transition-all cursor-pointer"
            >
              {loading ? 'Saving Draft...' : '💾 Save as Draft'}
            </Button>

            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading || !isLocComplete}
              className="flex-1 bg-amber-500 hover:bg-amber-600 active:scale-[0.97] text-black font-black text-xs py-3 min-h-[44px] disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Publishing Live...' : '🚀 Save & Publish Live'}
            </Button>
          </div>
        </div>
      )}

      {/* Map Location Picker Modal */}
      <VenueLocationPickerModal
        isOpen={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLat={formData.latitude !== '' && formData.latitude != null ? Number(formData.latitude) : null}
        initialLng={formData.longitude !== '' && formData.longitude != null ? Number(formData.longitude) : null}
        venueName={formData.displayName}
        onConfirm={handleLocationConfirm}
      />
    </div>
  );
}
