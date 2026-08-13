'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createAdminVenueAction } from '@/server/actions/super-admin-venue';
import { normalizeVenueSlug, VenueType } from '@/lib/validation/venue';

interface AdminCreateVenueClientProps {
  existingBusinesses: Array<{ id: string; name: string }>;
}

export function AdminCreateVenueClient({ existingBusinesses }: AdminCreateVenueClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const [formData, setFormData] = useState({
    businessId: '',
    newBusinessName: '',
    displayName: '',
    slug: '',
    venueType: 'hotel' as VenueType,
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
  });

  const [isSlugEdited, setIsSlugEdited] = useState(false);

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
        setMessage({ success: true, text: '📍 Current coordinates captured!' });
      },
      (err) => {
        setGeoLoading(false);
        setMessage({ success: false, text: `Geolocation failed: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (shouldPublish: boolean) => {
    setLoading(true);
    setMessage(null);

    const latVal = formData.latitude !== '' && formData.latitude != null ? Number(formData.latitude) : undefined;
    const lngVal = formData.longitude !== '' && formData.longitude != null ? Number(formData.longitude) : undefined;

    const payload = {
      ...formData,
      slug: normalizeVenueSlug(formData.slug || formData.displayName),
      venueType: formData.venueType as VenueType,
      latitude: latVal,
      longitude: lngVal,
      isPublished: shouldPublish,
    };

    const res = await createAdminVenueAction(payload);
    setLoading(false);

    if (res.success) {
      router.push('/admin/venues');
    } else {
      setMessage({ success: false, text: res.message || 'Failed to create venue.' });
    }
  };

  return (
    <div className="space-y-6 bg-white rounded-3xl border border-zinc-200 p-6 sm:p-8 shadow-xs">
      {/* Wizard Progress Steps */}
      <div className="grid grid-cols-6 gap-2 border-b border-zinc-100 pb-4 text-center">
        {[
          { num: 1, label: 'Business' },
          { num: 2, label: 'Venue Info' },
          { num: 3, label: 'Branch' },
          { num: 4, label: 'Location' },
          { num: 5, label: 'Details' },
          { num: 6, label: 'Review' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setStep(s.num)}
            className={`py-2 rounded-xl text-xs font-black transition-colors ${
              step === s.num
                ? 'bg-amber-500 text-black shadow-2xs'
                : step > s.num
                ? 'bg-zinc-100 text-zinc-900'
                : 'text-zinc-400 bg-zinc-50'
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
        <div className="space-y-4 max-w-xl">
          <h2 className="text-base font-black text-zinc-950">Step 1 — Select or Create Business</h2>

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
            <span className="shrink mx-4 text-xs font-black text-zinc-400 uppercase">OR CREATE NEW</span>
            <div className="flex-grow border-t border-zinc-200"></div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">New Business Name</label>
            <input
              type="text"
              value={formData.newBusinessName}
              onChange={(e) => setFormData({ ...formData, newBusinessName: e.target.value, businessId: '' })}
              placeholder="e.g. Sapphire Horizon Resorts"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <Button
            type="button"
            onClick={() => setStep(2)}
            disabled={!formData.businessId && !formData.newBusinessName}
            className="w-full bg-zinc-950 text-white font-extrabold text-xs py-3 rounded-2xl min-h-[44px]"
          >
            Next: Venue Info →
          </Button>
        </div>
      )}

      {/* STEP 2: VENUE DETAILS */}
      {step === 2 && (
        <div className="space-y-4 max-w-xl">
          <h2 className="text-base font-black text-zinc-950">Step 2 — Venue Information</h2>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Venue Display Name *</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Grand Ocean Resort & Spa"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

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
              <option value="other">Other Hospitality Venue</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">URL Slug *</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => {
                setIsSlugEdited(true);
                setFormData({ ...formData, slug: normalizeVenueSlug(e.target.value) });
              }}
              placeholder="grand-ocean-resort"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Short Description</label>
            <textarea
              rows={2}
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="Tagline for venue discovery cards..."
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 text-xs font-bold">
              ← Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={!formData.displayName || !formData.slug}
              className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]"
            >
              Next: Branch →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: BRANCH */}
      {step === 3 && (
        <div className="space-y-4 max-w-xl">
          <h2 className="text-base font-black text-zinc-950">Step 3 — Branch Assignment</h2>
          <p className="text-xs text-zinc-600 font-semibold">
            When creating a new business, a &quot;Main Branch&quot; is automatically initialized. You can proceed to configure location details.
          </p>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1 text-xs font-bold">
              ← Back
            </Button>
            <Button type="button" onClick={() => setStep(4)} className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]">
              Next: Location →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: LOCATION */}
      {step === 4 && (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-zinc-950">Step 4 — Location & Map Setup</h2>
            {isLocComplete ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                ✓ Location complete
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]">
                ⚠ Mandatory for Live Publish
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Public Address *</label>
            <input
              type="text"
              value={formData.addressPublic}
              onChange={(e) => setFormData({ ...formData, addressPublic: e.target.value })}
              placeholder="100 Beach Road"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <label className="text-xs font-bold text-zinc-700">Country *</label>
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

          <div className="grid grid-cols-2 gap-4">
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

          <Button
            type="button"
            variant="outline"
            onClick={handleUseCurrentLocation}
            disabled={geoLoading}
            className="w-full text-xs font-extrabold border-zinc-200"
          >
            {geoLoading ? 'Detecting Coordinates...' : '📍 Use Current Device Location'}
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(3)} className="flex-1 text-xs font-bold">
              ← Back
            </Button>
            <Button type="button" onClick={() => setStep(5)} className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]">
              Next: Details →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: PUBLIC DETAILS */}
      {step === 5 && (
        <div className="space-y-4 max-w-xl">
          <h2 className="text-base font-black text-zinc-950">Step 5 — Public Contact & Hotel Booking Links</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Phone</label>
              <input
                type="text"
                value={formData.phonePublic}
                onChange={(e) => setFormData({ ...formData, phonePublic: e.target.value })}
                placeholder="+94 11 234 5678"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700">Email</label>
              <input
                type="email"
                value={formData.emailPublic}
                onChange={(e) => setFormData({ ...formData, emailPublic: e.target.value })}
                placeholder="info@venue.com"
                className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700">Booking.com URL</label>
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

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(4)} className="flex-1 text-xs font-bold">
              ← Back
            </Button>
            <Button type="button" onClick={() => setStep(6)} className="flex-1 bg-zinc-950 text-white font-extrabold text-xs min-h-[44px]">
              Next: Review & Save →
            </Button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW & SAVE */}
      {step === 6 && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-base font-black text-zinc-950">Step 6 — Review & Save Venue</h2>

          <div className="rounded-2xl border border-zinc-200 p-4 space-y-2 text-xs bg-zinc-50 font-semibold text-zinc-800">
            <div><span className="font-bold text-zinc-500">Name:</span> {formData.displayName}</div>
            <div><span className="font-bold text-zinc-500">Type:</span> {formData.venueType}</div>
            <div><span className="font-bold text-zinc-500">Slug:</span> /{formData.slug}</div>
            <div><span className="font-bold text-zinc-500">City:</span> {formData.city}, {formData.country}</div>
            <div><span className="font-bold text-zinc-500">Address:</span> {formData.addressPublic || 'Not set'}</div>
            <div>
              <span className="font-bold text-zinc-500">Coordinates:</span>{' '}
              {formData.latitude !== '' && formData.longitude !== ''
                ? `${formData.latitude}, ${formData.longitude}`
                : '⚠ Missing coordinates'}
            </div>
          </div>

          {!isLocComplete && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
              ⚠ Location setup is incomplete. You can save as a Draft now, but Live Publishing requires valid address, city, and coordinates.
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={loading}
              variant="outline"
              className="flex-1 text-xs font-extrabold py-3 min-h-[44px]"
            >
              {loading ? 'Saving...' : '💾 Save as Draft'}
            </Button>

            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={loading || !isLocComplete}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs py-3 min-h-[44px] disabled:opacity-50"
            >
              {loading ? 'Publishing...' : '🚀 Save & Publish Live'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
