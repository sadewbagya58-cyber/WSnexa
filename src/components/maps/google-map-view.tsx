'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getBrowserGoogleMapsApiKey, getGoogleMapsDirectionsUrl } from '@/lib/maps/google-maps-config';
import { VenuePublicProfileRecord } from '@/server/services/venue-discovery.service';
import { VenueMapBottomSheet } from './venue-map-bottom-sheet';

export interface MapMarkerItem {
  id: string;
  displayName: string;
  venueType: string;
  address?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  slug?: string;
  isAcceptingOrders?: boolean;
  coverImageUrl?: string | null;
  logoUrl?: string | null;
  priceLevel?: number;
  averageRating?: number;
  reviewCount?: number;
  distanceKm?: number | null;
  distanceText?: string | null;
  rawVenue?: VenuePublicProfileRecord;
}

export interface RouteResultState {
  distanceText: string;
  durationText: string;
  steps: string[];
  travelMode: 'DRIVING' | 'WALKING';
}

interface GoogleMapViewProps {
  venues?: VenuePublicProfileRecord[];
  singleVenue?: {
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
  userLocation?: { lat: number; lng: number } | null;
  initialRouteToVenue?: boolean;
  onVenueSelect?: (venue: VenuePublicProfileRecord) => void;
  height?: string;
  className?: string;
}

interface GoogleMapsGlobal {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => {
      setCenter: (pos: { lat: number; lng: number }) => void;
      setZoom: (zoom: number) => void;
      panTo: (pos: { lat: number; lng: number }) => void;
      fitBounds: (bounds: unknown) => void;
    };
    LatLngBounds: new () => { extend: (pos: { lat: number; lng: number }) => void };
    InfoWindow: new () => { setContent: (html: string) => void; open: (map: unknown, marker: unknown) => void; close: () => void };
    Marker: new (options: unknown) => {
      addListener: (event: string, handler: () => void) => void;
      setPosition: (pos: { lat: number; lng: number }) => void;
      setMap: (map: unknown) => void;
    };
    DirectionsService: new () => {
      route: (
        request: {
          origin: { lat: number; lng: number };
          destination: { lat: number; lng: number };
          travelMode: string;
        },
        callback: (result: GoogleDirectionsResult | null, status: string) => void
      ) => void;
    };
    DirectionsRenderer: new (options: unknown) => {
      setMap: (map: unknown) => void;
      setDirections: (result: unknown) => void;
    };
    TravelMode: {
      DRIVING: string;
      WALKING: string;
    };
    SymbolPath: { CIRCLE: unknown };
  };
}

interface GoogleDirectionsResult {
  routes: Array<{
    legs: Array<{
      distance?: { text: string; value: number };
      duration?: { text: string; value: number };
      steps?: Array<{ instructions: string }>;
    }>;
  }>;
}

export function GoogleMapView({
  venues = [],
  singleVenue,
  userLocation,
  initialRouteToVenue = false,
  onVenueSelect,
  height = '400px',
  className = '',
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<{
    setCenter: (pos: { lat: number; lng: number }) => void;
    setZoom: (zoom: number) => void;
    panTo: (pos: { lat: number; lng: number }) => void;
    fitBounds: (bounds: unknown) => void;
  } | null>(null);
  const directionsRendererRef = useRef<{
    setMap: (map: unknown) => void;
    setDirections: (result: unknown) => void;
  } | null>(null);
  const userMarkerRef = useRef<{
    setPosition: (pos: { lat: number; lng: number }) => void;
    setMap: (map: unknown) => void;
  } | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Selected venue state for in-app bottom sheet & routing
  const [selectedVenue, setSelectedVenue] = useState<VenuePublicProfileRecord | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteResultState | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const apiKey = getBrowserGoogleMapsApiKey();

  // Extract valid marker items
  const markers: MapMarkerItem[] = useMemo(() => {
    const list: MapMarkerItem[] = [];

    if (singleVenue && singleVenue.lat != null && singleVenue.lng != null) {
      list.push({
        id: singleVenue.id || 'single',
        displayName: singleVenue.displayName,
        venueType: singleVenue.venueType,
        address: singleVenue.address,
        city: singleVenue.city,
        lat: singleVenue.lat,
        lng: singleVenue.lng,
        isAcceptingOrders: singleVenue.isAcceptingOrders,
        slug: singleVenue.slug,
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
            coverImageUrl: v.cover_image_url,
            logoUrl: v.logo_url,
            priceLevel: v.price_level,
            averageRating: v.average_rating,
            reviewCount: v.review_count,
            distanceKm: v.distance_km,
            distanceText: v.distance_text,
            rawVenue: v,
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
              coverImageUrl: v.cover_image_url,
              logoUrl: v.logo_url,
              priceLevel: v.price_level,
              averageRating: v.average_rating,
              reviewCount: v.review_count,
              distanceKm: v.distance_km,
              distanceText: v.distance_text,
              rawVenue: v,
            });
          }
        });
      });
    }

    return list;
  }, [venues, singleVenue]);

  // Client Directions Calculation
  const calculateRoute = useCallback(
    (
      destLat: number,
      destLng: number,
      mode: 'DRIVING' | 'WALKING' = 'DRIVING'
    ) => {
      if (!userLocation) {
        setRoutingError('Please enable your device location to preview the route.');
        return;
      }

      const win = window as unknown as { google?: GoogleMapsGlobal };
      if (!win.google?.maps) return;

      const googleMaps = win.google.maps;
      setIsRouting(true);
      setRoutingError(null);

      const directionsService = new googleMaps.DirectionsService();

      directionsService.route(
        {
          origin: { lat: userLocation.lat, lng: userLocation.lng },
          destination: { lat: destLat, lng: destLng },
          travelMode:
            mode === 'WALKING'
              ? googleMaps.TravelMode.WALKING
              : googleMaps.TravelMode.DRIVING,
        },
        (result: GoogleDirectionsResult | null, status: string) => {
          setIsRouting(false);

          if (status === 'OK' && result && result.routes && result.routes[0]?.legs[0]) {
            const leg = result.routes[0].legs[0];
            const steps = (leg.steps || []).map((s) => s.instructions);

            setRouteInfo({
              distanceText: leg.distance?.text || 'Nearby',
              durationText: leg.duration?.text || 'A few mins',
              steps,
              travelMode: mode,
            });

            if (directionsRendererRef.current) {
              directionsRendererRef.current.setDirections(result);
            }
          } else {
            console.warn('[GoogleMapView] Directions failed with status:', status);
            setRoutingError('Driving route unavailable for this location. You can still open external Google Maps.');
            if (directionsRendererRef.current) {
              directionsRendererRef.current.setDirections({ routes: [] });
            }
          }
        }
      );
    },
    [userLocation]
  );

  // Clear route
  const handleClearRoute = () => {
    setRouteInfo(null);
    setRoutingError(null);
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
  };

  // Re-center on user GPS
  const handleRecenterUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.panTo(userLocation);
      mapInstanceRef.current.setZoom(15);
    }
  };

  useEffect(() => {
    if (!apiKey || (markers.length === 0 && !userLocation) || !mapRef.current) {
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
        const defaultCenter = userLocation || {
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

        mapInstanceRef.current = map;

        // Setup Directions Renderer with custom stroke
        const directionsRenderer = new googleMaps.DirectionsRenderer({
          map,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#09090b',
            strokeWeight: 5,
            strokeOpacity: 0.85,
          },
        });
        directionsRendererRef.current = directionsRenderer;

        const bounds = new googleMaps.LatLngBounds();

        // 1. Render User Location Radar Marker if available
        if (userLocation) {
          bounds.extend(userLocation);

          const userMarker = new googleMaps.Marker({
            position: userLocation,
            map,
            title: 'Your Location',
            icon: {
              path: googleMaps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeWeight: 3,
              strokeColor: '#ffffff',
            },
          });
          userMarkerRef.current = userMarker;
        }

        // 2. Render Venue Markers
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
              strokeWeight: 2.5,
              strokeColor: '#09090b',
            },
          });

          marker.addListener('click', () => {
            // Center map smoothly on tapped venue
            map.panTo(position);

            const matchedVenue = m.rawVenue || (singleVenue ? (singleVenue as unknown as VenuePublicProfileRecord) : null);
            if (matchedVenue) {
              setSelectedVenue(matchedVenue);
              if (onVenueSelect) onVenueSelect(matchedVenue);
            }
          });
        });

        if (markers.length > 1 || (markers.length === 1 && userLocation)) {
          map.fitBounds(bounds);
        }

        setMapLoaded(true);

        // Auto calculate route for single venue if requested
        if (initialRouteToVenue && userLocation && markers[0]) {
          calculateRoute(markers[0].lat, markers[0].lng, 'DRIVING');
        }
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
  }, [apiKey, markers, userLocation, initialRouteToVenue, calculateRoute, onVenueSelect]);

  // Graceful degradation fallback
  if (!apiKey || loadError || (markers.length === 0 && !userLocation)) {
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
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-colors min-h-[44px] touch-manipulation"
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

      {/* ── GPS Locate Me Button ────────────────────────────────────── */}
      {userLocation && (
        <button
          type="button"
          onClick={handleRecenterUser}
          className="absolute top-4 right-4 z-20 h-10 w-10 bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-zinc-200 text-zinc-900 flex items-center justify-center text-base font-bold hover:bg-white active:scale-95 transition-all touch-manipulation"
          title="Re-center on my location"
          aria-label="Re-center on my location"
        >
          📍
        </button>
      )}

      {/* ── Mobile & In-Map Bottom Sheet ────────────────────────────── */}
      {selectedVenue && (
        <VenueMapBottomSheet
          venue={selectedVenue}
          userLocation={userLocation}
          onClose={() => {
            setSelectedVenue(null);
            handleClearRoute();
          }}
          onGetDirections={(mode) => {
            if (selectedVenue.latitude != null && selectedVenue.longitude != null) {
              calculateRoute(Number(selectedVenue.latitude), Number(selectedVenue.longitude), mode);
            }
          }}
          routeInfo={routeInfo}
          isRouting={isRouting}
          routingError={routingError}
          onClearRoute={handleClearRoute}
          onTravelModeChange={(mode) => {
            if (selectedVenue.latitude != null && selectedVenue.longitude != null) {
              calculateRoute(Number(selectedVenue.latitude), Number(selectedVenue.longitude), mode);
            }
          }}
        />
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 animate-pulse">
          Loading interactive map &amp; routes...
        </div>
      )}
    </div>
  );
}
