'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserGoogleMapsApiKey, getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';

interface MapMarkerItem {
  id: string;
  displayName: string;
  venueType: string;
  address?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  slug?: string;
  isAcceptingOrders?: boolean;
}

interface GoogleMapViewProps {
  venues?: VenuePublicProfileRecord[];
  singleVenue?: {
    displayName: string;
    venueType: string;
    address?: string | null;
    city?: string | null;
    lat: number | null;
    lng: number | null;
    isAcceptingOrders?: boolean;
  };
  height?: string;
  className?: string;
}

interface GoogleMapsGlobal {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => unknown;
    LatLngBounds: new () => { extend: (pos: { lat: number; lng: number }) => void };
    InfoWindow: new () => { setContent: (html: string) => void; open: (map: unknown, marker: unknown) => void };
    Marker: new (options: unknown) => { addListener: (event: string, handler: () => void) => void };
    SymbolPath: { CIRCLE: unknown };
  };
}

export function GoogleMapView({
  venues = [],
  singleVenue,
  height = '400px',
  className = '',
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const apiKey = getBrowserGoogleMapsApiKey();

  // Extract valid marker items with useMemo
  const markers: MapMarkerItem[] = useMemo(() => {
    const list: MapMarkerItem[] = [];

    if (singleVenue && singleVenue.lat != null && singleVenue.lng != null) {
      list.push({
        id: 'single',
        displayName: singleVenue.displayName,
        venueType: singleVenue.venueType,
        address: singleVenue.address,
        city: singleVenue.city,
        lat: singleVenue.lat,
        lng: singleVenue.lng,
        isAcceptingOrders: singleVenue.isAcceptingOrders,
      });
    } else if (venues.length > 0) {
      venues.forEach((v) => {
        if (v.latitude != null && v.longitude != null) {
          list.push({
            id: v.id,
            displayName: v.display_name,
            venueType: v.venue_type,
            address: v.address_public,
            city: v.city,
            lat: Number(v.latitude),
            lng: Number(v.longitude),
            slug: v.slug,
            isAcceptingOrders: v.has_wsnexa_ordering ?? v.is_accepting_orders,
          });
        }

        (v.branches || []).forEach((b) => {
          if (b.latitude != null && b.longitude != null) {
            list.push({
              id: `${v.id}_branch_${b.id}`,
              displayName: `${v.display_name} (${b.name})`,
              venueType: v.venue_type,
              address: b.address_line_1 || v.address_public,
              city: b.city || v.city,
              lat: b.latitude,
              lng: b.longitude,
              slug: v.slug,
              isAcceptingOrders: v.has_wsnexa_ordering ?? v.is_accepting_orders,
            });
          }
        });
      });
    }

    return list;
  }, [venues, singleVenue]);

  useEffect(() => {
    if (!apiKey || markers.length === 0 || !mapRef.current) {
      return;
    }

    let isMounted = true;
    const existingScript = document.getElementById('google-maps-js-sdk');

    const initMap = () => {
      if (!isMounted || !mapRef.current) return;
      const win = window as unknown as { google?: GoogleMapsGlobal };
      if (!win.google?.maps) return;

      try {
        const googleMaps = win.google.maps;
        const defaultCenter = {
          lat: markers[0]?.lat || 6.9271,
          lng: markers[0]?.lng || 79.8612,
        };

        const map = new googleMaps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: markers.length === 1 ? 14 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        const bounds = new googleMaps.LatLngBounds();
        const infoWindow = new googleMaps.InfoWindow();

        markers.forEach((m) => {
          const position = { lat: m.lat, lng: m.lng };
          bounds.extend(position);

          const marker = new googleMaps.Marker({
            position,
            map,
            title: m.displayName,
            icon: {
              path: googleMaps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: m.isAcceptingOrders ? '#10b981' : '#f59e0b',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#000000',
            },
          });

          const directionsUrl = getGoogleMapsDirectionsUrl(m.lat, m.lng, m.address || m.city);
          const badgeText = m.isAcceptingOrders ? '✓ WSNexa Ordering Available' : 'View Venue Only';

          const contentString = `
            <div style="padding: 6px; max-width: 220px; font-family: sans-serif;">
              <div style="font-weight: 800; font-size: 13px; color: #09090b; margin-bottom: 2px;">${m.displayName}</div>
              <div style="font-size: 11px; color: #71717a; margin-bottom: 6px;">📍 ${m.address || m.city || ''}</div>
              <div style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 6px; margin-bottom: 8px; background-color: ${m.isAcceptingOrders ? '#d1fae5' : '#f4f4f5'}; color: ${m.isAcceptingOrders ? '#065f46' : '#27272a'};">
                ${badgeText}
              </div>
              <div>
                <a href="${directionsUrl}" target="_blank" rel="noreferrer" style="font-size: 11px; font-weight: 700; color: #d97706; text-decoration: none;">
                  🧭 Get Directions →
                </a>
              </div>
            </div>
          `;

          marker.addListener('click', () => {
            infoWindow.setContent(contentString);
            infoWindow.open(map, marker);
          });
        });

        if (markers.length > 1) {
          (map as { fitBounds: (bounds: unknown) => void }).fitBounds(bounds);
        }

        setMapLoaded(true);
      } catch (err) {
        console.error('[GoogleMapView] Map initialization error:', err);
        setLoadError(true);
      }
    };

    const win = window as unknown as { google?: GoogleMapsGlobal };
    if (win.google?.maps) {
      initMap();
    } else if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initMap();
      script.onerror = () => {
        if (isMounted) setLoadError(true);
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', initMap);
    }

    return () => {
      isMounted = false;
    };
  }, [apiKey, markers]);

  // Graceful degradation fallback when API key is missing or load fails
  if (!apiKey || loadError || markers.length === 0) {
    const mainMarker = markers[0];
    const fallbackDirectionsUrl = mainMarker
      ? getGoogleMapsDirectionsUrl(mainMarker.lat, mainMarker.lng, mainMarker.address || mainMarker.city)
      : 'https://maps.google.com';

    return (
      <div
        className={`w-full rounded-3xl border border-zinc-200 bg-zinc-900 text-white p-6 flex flex-col items-center justify-center text-center space-y-4 shadow-sm overflow-hidden ${className}`}
        style={{ minHeight: height }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-3xl">
          🗺️
        </div>
        <div className="space-y-1 max-w-sm">
          <h4 className="text-sm font-extrabold text-white">Map View Unavailable</h4>
          <p className="text-xs text-zinc-400 font-medium leading-relaxed">
            {!apiKey
              ? 'Map view is unavailable right now. Browse venues in list view.'
              : 'Map coordinates are not set for this venue yet.'}
          </p>
        </div>

        {mainMarker && (
          <div className="pt-2 flex flex-col items-center gap-2">
            <span className="text-xs font-bold text-zinc-300">
              📍 {mainMarker.address || mainMarker.city || 'Address Available'}
            </span>
            <a
              href={fallbackDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-colors"
            >
              🧭 Open Directions in Google Maps
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-3xl border border-zinc-200 overflow-hidden shadow-sm relative ${className}`}
      style={{ height }}
    >
      <div ref={mapRef} className="w-full h-full" />
      {!mapLoaded && (
        <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 animate-pulse">
          Loading interactive map...
        </div>
      )}
    </div>
  );
}
