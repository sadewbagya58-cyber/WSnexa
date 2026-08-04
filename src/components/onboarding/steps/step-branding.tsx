'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { BrandingInput } from '@/lib/validation/onboarding';

interface StepBrandingProps {
  initialData?: Partial<BrandingInput>;
  onBack: () => void;
  onNext: (data: BrandingInput) => void;
}

export const StepBranding: React.FC<StepBrandingProps> = ({ initialData, onBack, onNext }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData?.logoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    // Validate MIME type (PNG, JPG, WEBP)
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Invalid file format. Please upload a PNG, JPG, or WEBP image.');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('File size exceeds 2MB limit.');
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg('User session expired. Please sign in again.');
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `logos/${user.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setErrorMsg(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      setLogoUrl(publicUrl);
    } catch {
      setErrorMsg('An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext({ logoUrl });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-zinc-950">4. Branding & Logo</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Upload your official business logo for digital menus, receipts, and headers.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo Preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-zinc-400">No Logo</span>
            )}
          </div>

          <div>
            <label
              htmlFor="logo-upload"
              className="inline-flex cursor-pointer items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </label>
            <input
              id="logo-upload"
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
            <p className="mt-2 text-[11px] text-zinc-500">
              Accepted: PNG, JPG, WEBP. Max size: 2MB.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" type="button" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={uploading}>
          Continue to Review & Submit →
        </Button>
      </div>
    </form>
  );
};
