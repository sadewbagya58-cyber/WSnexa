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
    country: initialProfile?.country || 'US',
    priceLevel: initialProfile?.price_level || 2,
    isPublished: initialProfile?.is_published || false,
    isAcceptingOrders: initialProfile?.is_accepting_orders ?? true,
    featuredBranchId: initialProfile?.featured_branch_id || '',
  });

  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(Boolean(initialProfile?.slug));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

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
    setFormData((prev) => ({
      ...prev,
      slug: normalizeVenueSlug(val),
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

  const handleSave = async (shouldPublish?: boolean) => {
    setLoading(true);
    setMessage(null);

    const payload = {
      ...formData,
      slug: normalizeVenueSlug(formData.slug || formData.displayName),
      venueType: formData.venueType as 'restaurant' | 'hotel' | 'cafe' | 'resort' | 'villa' | 'guest_house' | 'food_court' | 'cloud_kitchen' | 'other',
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
      setMessage({ success: false, text: res.message || 'Failed to save profile.' });
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
            <span className="text-xs font-mono">/venues/{formData.slug || 'your-slug'}</span>
          </div>
          <p className="text-xs font-medium leading-relaxed">
            {formData.isPublished
              ? 'Your venue profile is live and searchable on WSNexa Explore.'
              : 'Your venue profile is currently private and hidden from public venue discovery.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            <p className="text-[11px] text-zinc-500 font-medium">
              Web Address: <span className="font-mono text-amber-700 font-bold">w-snexa.vercel.app/venues/{formData.slug || 'your-slug'}</span>
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

        {/* Public Location & Contact */}
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
            <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Public Phone</label>
            <input
              name="phonePublic"
              type="text"
              value={formData.phonePublic}
              onChange={handleChange}
              placeholder="+94 11 234 5678"
              className="w-full rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
            />
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
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
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
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs py-3 px-6 shadow-2xs"
          >
            {loading ? 'Saving...' : '🚀 Save & Publish Live'}
          </Button>
        </div>
      </div>
    </div>
  );
}
