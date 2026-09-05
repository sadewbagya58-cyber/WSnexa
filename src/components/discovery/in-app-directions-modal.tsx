'use client';

import React, { useEffect, useState } from 'react';
import { GoogleMapView } from '@/components/maps/google-map-view';
import { getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';

interface InAppDirectionsModalProps {
  venue: {
    id?: string;
    displayName: string;
    venueType: string;
    address?: string | null;
    city?: string | null;
    lat: number | null;
    lng: number | null;
    isAcceptingOrders?: boolean;
    slug?: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function InAppDirectionsModal({
  venue,
  isOpen,
  onClose,
}: InAppDirectionsModalProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your device browser.');
      return;
    }

    setLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setLocating(false);
        console.warn('[InAppDirectionsModal] Geolocation error:', err);
        setLocError('Location access was denied or timed out. External map link is available below.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  const fallbackUrl = getGoogleMapsDirectionsUrl(venue.lat, venue.lng, venue.address || venue.city);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directions-modal-title"
      >
        {/* ── Modal Header ───────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-zinc-100 bg-white">
          <div className="space-y-0.5">
            <h3 id="directions-modal-title" className="text-base font-black text-zinc-950 flex items-center gap-2">
              <span>🧭</span> In-App Directions &amp; Route Preview
            </h3>
            <p className="text-xs font-bold text-zinc-500 truncate max-w-sm">
              To {venue.displayName} • {venue.address || venue.city || 'Destination'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center font-black text-sm transition-colors touch-manipulation"
            aria-label="Close directions"
          >
            ✕
          </button>
        </div>

        {/* ── Geolocation Notice / Status ────────────────────────────── */}
        {locating && (
          <div className="px-4 py-2 bg-amber-50 text-amber-900 text-xs font-bold flex items-center gap-2 animate-pulse">
            <span>📍</span> Acquiring your current location for live route preview...
          </div>
        )}

        {locError && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-950 text-xs font-semibold flex items-center justify-between gap-2">
            <span>⚠️ {locError}</span>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-black text-amber-900 underline shrink-0"
            >
              Open Google Maps ↗
            </a>
          </div>
        )}

        {/* ── Interactive Map Canvas ─────────────────────────────────── */}
        <div className="relative flex-1 min-h-[360px] sm:min-h-[440px]">
          <GoogleMapView
            singleVenue={venue}
            userLocation={userLocation}
            initialRouteToVenue={Boolean(userLocation && venue.lat != null && venue.lng != null)}
            height="100%"
            className="rounded-none border-none"
          />
        </div>

        {/* ── Modal Footer ───────────────────────────────────────────── */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-bold text-zinc-600">
            📍 {venue.address || venue.city || 'Venue Location'}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all text-center min-h-[40px] flex items-center justify-center"
            >
              Open in Google Maps App ↗
            </a>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 text-white text-xs font-extrabold transition-all min-h-[40px] flex items-center justify-center"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
