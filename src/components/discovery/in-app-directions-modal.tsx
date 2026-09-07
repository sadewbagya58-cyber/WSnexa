'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { GoogleMapView } from '@/components/maps/google-map-view';
import { getGoogleMapsDirectionsUrl, requestBrowserLocation, getCachedBrowserLocation } from '@/lib/maps/google-maps-config';

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
    coverImageUrl?: string | null;
    logoUrl?: string | null;
  };
  isOpen: boolean;
  initialUserLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
}

export function InAppDirectionsModal({
  venue,
  isOpen,
  initialUserLocation = null,
  onClose,
}: InAppDirectionsModalProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    initialUserLocation || getCachedBrowserLocation()
  );
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  // Sync if initialUserLocation becomes available
  useEffect(() => {
    if (initialUserLocation) {
      setUserLocation(initialUserLocation);
      setLocError(null);
    }
  }, [initialUserLocation]);

  const requestLocation = useCallback((bypassCache = false) => {
    setLocating(true);
    setLocError(null);

    requestBrowserLocation(
      (coords) => {
        setLocating(false);
        setUserLocation(coords);
      },
      (errInfo) => {
        setLocating(false);
        console.warn('[InAppDirectionsModal] Geolocation error:', errInfo.code, errInfo.message);
        setLocError(errInfo.message);
      },
      { bypassCache }
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!userLocation && !initialUserLocation) {
      const cached = getCachedBrowserLocation();
      if (cached) {
        setUserLocation(cached);
      } else {
        requestLocation();
      }
    }
  }, [isOpen, userLocation, initialUserLocation, requestLocation]);

  if (!isOpen) return null;

  const fallbackUrl = getGoogleMapsDirectionsUrl(venue.lat, venue.lng, venue.address || venue.city);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col sm:justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full h-full sm:max-w-3xl sm:h-[85vh] sm:max-h-[750px] sm:rounded-3xl shadow-2xl sm:border sm:border-zinc-200/80 overflow-hidden relative flex flex-col bg-zinc-950"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directions-modal-title"
      >
        {/* ── Interactive Map Canvas (Primary Full-Screen Visual Layer) ── */}
        <div className="absolute inset-0 w-full h-full">
          <GoogleMapView
            singleVenue={venue}
            userLocation={userLocation}
            onUserLocationChange={setUserLocation}
            initialRouteToVenue={Boolean(userLocation && venue.lat != null && venue.lng != null)}
            height="100%"
            className="rounded-none border-none h-full"
            onCloseDirections={onClose}
          />
        </div>

        {/* ── Floating Translucent Top Bar Overlay ─────────────────────── */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none gap-2">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-md shadow-md border border-zinc-200/80 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl flex items-center gap-2 max-w-[calc(100%-52px)]">
            <span className="text-sm shrink-0">🧭</span>
            <div className="min-w-0">
              <h3 id="directions-modal-title" className="text-xs sm:text-sm font-black text-zinc-950 truncate leading-tight">
                {venue.displayName}
              </h3>
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 truncate leading-tight">
                {venue.address || venue.city || 'Venue Location'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-white/95 backdrop-blur-md shadow-md border border-zinc-200/80 text-zinc-800 flex items-center justify-center font-black text-sm hover:bg-zinc-100 active:scale-95 transition-all touch-manipulation shrink-0"
            aria-label="Close directions"
          >
            ✕
          </button>
        </div>

        {/* ── Geolocation Notice / Status ────────────────────────────── */}
        {locating && (
          <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-16 sm:max-w-md z-30 px-3.5 py-2 bg-amber-50/95 backdrop-blur-md border border-amber-200 text-amber-950 text-xs font-bold rounded-2xl shadow-md flex items-center gap-2 animate-pulse pointer-events-auto">
            <span>📍</span> Acquiring your current location for live route preview...
          </div>
        )}

        {locError && (
          <div className="absolute top-16 left-3 right-3 sm:left-auto sm:right-16 sm:max-w-md z-30 p-3 bg-amber-50/95 backdrop-blur-md border border-amber-300 text-amber-950 text-xs font-semibold rounded-2xl shadow-lg flex items-center justify-between gap-2 flex-wrap pointer-events-auto">
            <span>⚠️ {locError}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => requestLocation(true)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition-all touch-manipulation active:scale-95"
              >
                🔄 Retry
              </button>
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-black text-amber-900 underline"
              >
                Open Google Maps ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
