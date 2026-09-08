'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  getBrowserGoogleMapsApiKey,
  requestBrowserLocation,
  type GeolocationCoords,
} from '@/lib/maps/google-maps-config';

export interface VenueLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  venueName?: string;
  onConfirm: (coords: { lat: number; lng: number }) => void;
}

interface GoogleMapsGlobal {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => {
      setCenter: (pos: { lat: number; lng: number }) => void;
      setZoom: (zoom: number) => void;
      panTo: (pos: { lat: number; lng: number }) => void;
      addListener: (event: string, handler: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void;
    };
    Marker: new (options: unknown) => {
      setPosition: (pos: { lat: number; lng: number }) => void;
      getPosition: () => { lat: () => number; lng: () => number } | null;
      setMap: (map: unknown) => void;
      addListener: (event: string, handler: () => void) => void;
    };
    Animation: {
      DROP: unknown;
    };
  };
}

const DEFAULT_CENTER: GeolocationCoords = {
  lat: 6.9271, // Colombo, Sri Lanka
  lng: 79.8612,
};

export const VenueLocationPickerModal: React.FC<VenueLocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  venueName,
  onConfirm,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{
    setCenter: (pos: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
    panTo: (pos: { lat: number; lng: number }) => void;
    addListener: (event: string, handler: (e: { latLng: { lat: () => number; lng: () => number } }) => void) => void;
  } | null>(null);
  const markerInstanceRef = useRef<{
    setPosition: (pos: { lat: number; lng: number }) => void;
    getPosition: () => { lat: () => number; lng: () => number } | null;
    setMap: (map: unknown) => void;
    addListener: (event: string, handler: () => void) => void;
  } | null>(null);

  const hasValidInitialCoords =
    initialLat != null &&
    initialLng != null &&
    !isNaN(Number(initialLat)) &&
    !isNaN(Number(initialLng)) &&
    Number(initialLat) >= -90 &&
    Number(initialLat) <= 90 &&
    Number(initialLng) >= -180 &&
    Number(initialLng) <= 180;

  const [selectedCoords, setSelectedCoords] = useState<GeolocationCoords>(() => {
    if (hasValidInitialCoords) {
      return { lat: Number(initialLat), lng: Number(initialLng) };
    }
    return DEFAULT_CENTER;
  });

  const [hasPin, setHasPin] = useState<boolean>(hasValidInitialCoords);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const apiKey = getBrowserGoogleMapsApiKey();

  // Keep state synced when modal reopens or props change
  useEffect(() => {
    if (isOpen) {
      if (hasValidInitialCoords) {
        setSelectedCoords({ lat: Number(initialLat), lng: Number(initialLng) });
        setHasPin(true);
      } else {
        setSelectedCoords(DEFAULT_CENTER);
        setHasPin(false);
      }
      setGeoNotice(null);
    }
  }, [isOpen, initialLat, initialLng, hasValidInitialCoords]);

  // Handle marker repositioning
  const updateMarkerPosition = useCallback((coords: GeolocationCoords) => {
    setSelectedCoords(coords);
    setHasPin(true);
    setGeoNotice(null);

    if (markerInstanceRef.current) {
      markerInstanceRef.current.setPosition(coords);
    }
  }, []);

  // Center on current device location using existing WSNexa geolocation helper
  const handleDetectDeviceLocation = () => {
    setGeoLoading(true);
    setGeoNotice(null);

    requestBrowserLocation(
      (coords) => {
        setGeoLoading(false);
        updateMarkerPosition(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(coords);
          mapInstanceRef.current.setZoom(16);
        }
        setGeoNotice('📍 Centered on your current GPS location. Tap or drag to adjust.');
      },
      (errInfo) => {
        setGeoLoading(false);
        setGeoNotice(`⚠️ ${errInfo.message}`);
      },
      { bypassCache: true }
    );
  };

  // Reset to initial coordinates or default
  const handleResetLocation = () => {
    const resetTarget = hasValidInitialCoords
      ? { lat: Number(initialLat), lng: Number(initialLng) }
      : DEFAULT_CENTER;

    updateMarkerPosition(resetTarget);
    setHasPin(hasValidInitialCoords);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(resetTarget);
      mapInstanceRef.current.setZoom(hasValidInitialCoords ? 16 : 13);
    }
    setGeoNotice(null);
  };

  // Initialize Google Maps Canvas inside modal
  useEffect(() => {
    if (!isOpen || !apiKey) return;

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const initMap = () => {
      if (!isMounted || !mapContainerRef.current) return;
      const win = window as unknown as { google?: GoogleMapsGlobal };
      if (!win.google?.maps) return;

      try {
        const googleMaps = win.google.maps;
        const centerPos = hasValidInitialCoords
          ? { lat: Number(initialLat), lng: Number(initialLng) }
          : DEFAULT_CENTER;

        // Cleanup existing marker if any
        if (markerInstanceRef.current) {
          markerInstanceRef.current.setMap(null);
          markerInstanceRef.current = null;
        }

        const map = new googleMaps.Map(mapContainerRef.current, {
          center: centerPos,
          zoom: hasValidInitialCoords ? 16 : 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy', // Enables smooth touch pinch/pan on mobile
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'on' }],
            },
          ],
        });

        mapInstanceRef.current = map;

        // Create draggable location pin
        const marker = new googleMaps.Marker({
          position: centerPos,
          map: map,
          draggable: true,
          animation: googleMaps.Animation.DROP,
          title: venueName || 'Venue Location',
        });

        markerInstanceRef.current = marker;

        // On marker dragend: update selected coordinates
        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) {
            updateMarkerPosition({
              lat: Number(pos.lat().toFixed(6)),
              lng: Number(pos.lng().toFixed(6)),
            });
          }
        });

        // On map click: move marker to tapped point
        map.addListener('click', (e) => {
          if (e.latLng) {
            const newCoords = {
              lat: Number(e.latLng.lat().toFixed(6)),
              lng: Number(e.latLng.lng().toFixed(6)),
            };
            updateMarkerPosition(newCoords);
          }
        });

        setMapLoaded(true);
        setLoadError(false);
      } catch (err) {
        console.error('[VenueLocationPickerModal] Initialization error:', err);
        setLoadError(true);
      }
    };

    const win = window as unknown as { google?: GoogleMapsGlobal };
    const existingScript = document.getElementById('google-maps-js-sdk');

    if (win.google?.maps) {
      // Delay slightly so modal DOM container has finished rendering dimensions
      const timer = setTimeout(initMap, 60);
      return () => clearTimeout(timer);
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => setTimeout(initMap, 60);
      script.onerror = () => {
        if (isMounted) setLoadError(true);
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setTimeout(initMap, 60));
      // Fallback polling in case script was already loaded
      pollInterval = setInterval(() => {
        if (win.google?.maps) {
          if (pollInterval) clearInterval(pollInterval);
          initMap();
        }
      }, 200);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen, apiKey, hasValidInitialCoords, initialLat, initialLng, venueName, updateMarkerPosition]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150 touch-manipulation"
    >
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3 bg-zinc-50/70">
          <div>
            <h2 id="map-picker-title" className="text-base font-black text-zinc-950 flex items-center gap-2">
              <span>🗺️</span>
              <span>Select Venue Location on Map</span>
            </h2>
            <p className="text-xs text-zinc-500 font-medium">
              Pan, zoom, or drag the pin to position your venue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-sm font-bold"
            aria-label="Close map picker"
          >
            ✕
          </button>
        </div>

        {/* Toolbar & Coordinate Pill */}
        <div className="px-5 py-2.5 bg-zinc-100/60 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-zinc-900 bg-white px-3 py-1 rounded-lg border border-zinc-200 shadow-2xs">
              Lat: {selectedCoords.lat.toFixed(6)}, Lng: {selectedCoords.lng.toFixed(6)}
            </span>
            {hasPin && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                ✓ Pin Placed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDetectDeviceLocation}
              disabled={geoLoading}
              className="flex min-h-[38px] items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 transition-colors shadow-2xs disabled:opacity-50"
            >
              {geoLoading ? 'Detecting GPS…' : '📍 My Device Location'}
            </button>

            <button
              type="button"
              onClick={handleResetLocation}
              className="flex min-h-[38px] items-center px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {geoNotice && (
          <div className="px-5 py-2 text-xs font-semibold text-zinc-700 bg-amber-50 border-b border-amber-200">
            {geoNotice}
          </div>
        )}

        {/* Map Canvas Area */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[440px] bg-zinc-100 w-full overflow-hidden">
          {!apiKey ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-2 bg-zinc-50">
              <span className="text-3xl">🗺️</span>
              <p className="text-xs font-bold text-zinc-700">Google Maps API key not configured.</p>
              <p className="text-[11px] text-zinc-500 max-w-sm">
                NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required for the visual map picker. You can still enter latitude and longitude manually.
              </p>
            </div>
          ) : loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-rose-700 space-y-2 bg-rose-50">
              <span className="text-3xl">⚠️</span>
              <p className="text-xs font-bold">Failed to load Google Maps SDK.</p>
              <p className="text-[11px] text-zinc-600 max-w-sm">
                Please check your network connection or verify Google Cloud project billing and allowed domains.
              </p>
            </div>
          ) : !mapLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 space-y-2 bg-zinc-50 animate-pulse">
              <span className="text-2xl">⏳</span>
              <p className="text-xs font-semibold">Loading interactive map…</p>
            </div>
          ) : null}

          <div
            ref={mapContainerRef}
            className="w-full h-full min-h-[340px] sm:min-h-[440px]"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Guidance Prompt & Modal Footer */}
        <div className="px-5 py-4 border-t border-zinc-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500 font-medium text-center sm:text-left">
            ℹ️ Coordinates only will be saved. Your address, city, and country will remain unchanged.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[44px] px-4 font-bold text-xs border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => {
                onConfirm({
                  lat: Number(selectedCoords.lat.toFixed(6)),
                  lng: Number(selectedCoords.lng.toFixed(6)),
                });
                onClose();
              }}
              className="flex-1 sm:flex-none min-h-[44px] px-5 font-black text-xs bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl shadow-xs"
            >
              📍 Confirm Venue Location
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
