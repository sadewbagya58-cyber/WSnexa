'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ImageUploadDropzoneProps {
  label: string;
  recommendedText: string;
  currentUrl?: string | null;
  imageType: 'logo' | 'cover';
  onUploadSuccess: (url: string) => void;
  onRemoveSuccess: () => void;
  uploadAction: (formData: FormData) => Promise<{ success: boolean; message?: string; publicUrl?: string }>;
  removeAction: (imageType: 'logo' | 'cover') => Promise<{ success: boolean; message: string }>;
}

export function ImageUploadDropzone({
  label,
  recommendedText,
  currentUrl,
  imageType,
  onUploadSuccess,
  onRemoveSuccess,
  uploadAction,
  removeAction,
}: ImageUploadDropzoneProps) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isLogo = imageType === 'logo';

  const handleFileSelect = async (file: File) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate MIME type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setErrorMsg('Please select a JPG, PNG, or WEBP photo.');
      return;
    }

    // Validate size limit (5MB logo, 8MB cover)
    const maxMb = isLogo ? 5 : 8;
    if (file.size > maxMb * 1024 * 1024) {
      setErrorMsg(`Photo size exceeds the ${maxMb} MB maximum limit.`);
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('imageType', imageType);

    const res = await uploadAction(formData);
    setLoading(false);

    if (res.success && res.publicUrl) {
      setSuccessMsg(res.message || 'Photo uploaded successfully!');
      onUploadSuccess(res.publicUrl);
    } else {
      setErrorMsg(res.message || 'Failed to upload photo. Please try again.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = async () => {
    if (!currentUrl) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await removeAction(imageType);
    setLoading(false);

    if (res.success) {
      setSuccessMsg(res.message || 'Photo removed successfully.');
      onRemoveSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to remove photo.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{label}</h4>
          <p className="text-[11px] text-zinc-500 font-medium">{recommendedText}</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900">
          ✓ {successMsg}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
        }}
      />

      {/* Upload Dropzone Container */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-3xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center text-center ${
          dragActive
            ? 'border-amber-500 bg-amber-500/10'
            : currentUrl
            ? 'border-zinc-200 bg-zinc-50/50'
            : 'border-zinc-300 bg-white hover:border-amber-400 hover:bg-amber-50/30'
        }`}
      >
        {/* Preview Section */}
        {currentUrl ? (
          <div className="w-full space-y-4 flex flex-col items-center">
            {isLogo ? (
              <div className="relative h-24 w-24 rounded-2xl border-2 border-zinc-200 bg-white shadow-sm overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentUrl} alt="Venue Logo" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="relative w-full h-40 rounded-2xl border-2 border-zinc-200 bg-zinc-950 shadow-sm overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentUrl} alt="Cover Photo" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                variant="outline"
                className="text-xs font-bold py-1.5 border-zinc-300 text-zinc-800 bg-white"
              >
                {loading ? 'Uploading...' : '📷 Change Photo'}
              </Button>
              <Button
                type="button"
                onClick={handleRemove}
                disabled={loading}
                variant="destructive"
                className="text-xs font-bold py-1.5"
              >
                {loading ? 'Removing...' : '🗑️ Remove'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 space-y-3 flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xl font-bold">
              {isLogo ? '🖼️' : '🏞️'}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-zinc-900">
                Drag & drop your {isLogo ? 'logo' : 'cover photo'} here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-amber-600 underline font-extrabold cursor-pointer"
                >
                  browse
                </button>
              </p>
              <p className="text-[11px] text-zinc-400 font-medium">PNG, JPG, or WEBP files supported</p>
            </div>

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              variant="outline"
              className="text-xs font-extrabold py-1.5 mt-2 bg-white border-zinc-300 text-zinc-900"
            >
              {loading ? 'Uploading...' : `Upload ${isLogo ? 'Logo' : 'Cover Photo'}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
