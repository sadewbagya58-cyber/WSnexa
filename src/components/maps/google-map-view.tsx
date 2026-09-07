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

function singleVenueToProfileRecord(
  sv: NonNullable<GoogleMapViewProps['singleVenue']>
): VenuePublicProfileRecord {
  return {
    id: sv.id || 'single',
    business_id: '',
    slug: sv.slug || '',
    display_name: sv.displayName,
    short_description: null,
    description: null,
    venue_type: sv.venueType || 'venue',
    logo_url: null,
    cover_image_url: null,
    phone_public: null,
    email_public: null,
    website_url: null,
    address_public: sv.address || null,
    city: sv.city || '',
    country: 'LK',
    latitude: sv.lat,
    longitude: sv.lng,
    price_level: 2,
    is_published: true,
    is_accepting_orders: sv.isAcceptingOrders ?? false,
    featured_branch_id: null,
    created_at: '',
    updated_at: '',
    average_rating: 0,
    review_count: 0,
  };
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
  const venueMarkersRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);

  // Ref tracking last route calculation key to prevent duplicate calls or infinite loops
  const lastRouteRequestKeyRef = useRef<string | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Selected venue state for in-app bottom sheet & routing
  // Immediately initialize from singleVenue if present so modal bottom sheet shows instantly
  const [selectedVenue, setSelectedVenue] = useState<VenuePublicProfileRecord | null>(() => {
    if (singleVenue && singleVenue.lat != null && singleVenue.lng != null) {
      return singleVenueToProfileRecord(singleVenue);
    }
    return null;
  });

  const [routeInfo, setRouteInfo] = useState<RouteResultState | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const apiKey = getBrowserGoogleMapsApiKey();

  // Keep selectedVenue in sync with singleVenue changes
  useEffect(() => {
    if (singleVenue && singleVenue.lat != null && singleVenue.lng != null) {
      setSelectedVenue(singleVenueToProfileRecord(singleVenue));
    }
  }, [singleVenue?.id, singleVenue?.lat, singleVenue?.lng, singleVenue?.displayName]);

  // Extract valid marker items with stable memoization
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
  }, [venues, singleVenue?.id, singleVenue?.lat, singleVenue?.lng, singleVenue?.displayName]);

  // Client Directions Calculation (Decoupled from map creation)
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

      const requestKey = `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}->${destLat.toFixed(5)},${destLng.toFixed(5)}:${mode}`;
      if (lastRouteRequestKeyRef.current === requestKey) {
        return; // Skip duplicate execution
      }

      const win = window as unknown as { google?: GoogleMapsGlobal };
      if (!win.google?.maps) return;

      const googleMaps = win.google.maps;
      setIsRouting(true);
      setRoutingError(null);
      lastRouteRequestKeyRef.current = requestKey;

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
            setRoutingError('Route preview unavailable for this location. You can still open external Google Maps.');
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
    lastRouteRequestKeyRef.current = null;
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

  // ── Step 1: Initialize Google Maps Canvas exactly ONCE ─────────────────────
  useEffect(() => {
    if (!apiKey || !mapRef.current) return;

    let isMounted = true;
    const existingScript = document.getElementById('google-maps-js-sdk');

    const initMap = () => {
      if (!isMounted || !mapRef.current) return;
      const win = window as unknown as { google?: GoogleMapsGlobal };
      if (!win.google?.maps) return;

      // If map is already initialized, do not re-instantiate (prevents flickering)
      if (mapInstanceRef.current) return;

      try {
        const googleMaps = win.google.maps;
        const initialCenter = userLocation || {
          lat: markers[0]?.lat || 6.9271,
          lng: markers[0]?.lng || 79.8612,
        };

        const map = new googleMaps.Map(mapRef.current, {
          center: initialCenter,
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

        // Setup persistent Directions Renderer attached to this map
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
  }, [apiKey]); // Run once when apiKey / mount is ready

  // ── Step 2: Render & Update Markers whenever markers array updates ─────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const win = window as unknown as { google?: GoogleMapsGlobal };
    if (!map || !win.google?.maps) return;

    const googleMaps = win.google.maps;

    // Clean up previous venue markers
    venueMarkersRef.current.forEach((m) => m.setMap(null));
    venueMarkersRef.current = [];

    const bounds = new googleMaps.LatLngBounds();

    if (userLocation) {
      bounds.extend(userLocation);
    }

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
        map.panTo(position);
        const matchedVenue =
          m.rawVenue ||
          (singleVenue ? singleVenueToProfileRecord(singleVenue) : null);
        if (matchedVenue) {
          setSelectedVenue(matchedVenue);
          if (onVenueSelect) onVenueSelect(matchedVenue);
        }
      });

      venueMarkersRef.current.push(marker);
    });

    if (markers.length > 1 || (markers.length === 1 && userLocation)) {
      map.fitBounds(bounds);
    }
  }, [markers, mapLoaded, singleVenue, onVenueSelect]);

  // ── Step 3: Update User Location Marker smoothly when user coordinates update ─
  useEffect(() => {
    const map = mapInstanceRef.current;
    const win = window as unknown as { google?: GoogleMapsGlobal };
    if (!map || !win.google?.maps) return;

    const googleMaps = win.google.maps;

    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setPosition(userLocation);
      } else {
        userMarkerRef.current = new googleMaps.Marker({
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
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }
  }, [userLocation, mapLoaded]);

  // ── Step 4: Auto-Calculate Route when single venue & userLocation are available ──
  useEffect(() => {
    if (
      initialRouteToVenue &&
      userLocation &&
      markers[0] &&
      mapLoaded &&
      directionsRendererRef.current
    ) {
      calculateRoute(markers[0].lat, markers[0].lng, 'DRIVING');
    }
  }, [initialRouteToVenue, userLocation, markers, mapLoaded, calculateRoute]);

  // Graceful degradation fallback
  if (!apiKey || loadError || (markers.length === 0 && !userLocation)) {
    const mainMarker = markers[0];
    const fallbackDirectionsUrl = mainMarker
      ? getGoogleMapsDirectionsUrl(
          mainMarker.lat,
          mainMarker.lng,
          mainMarker.address || mainMarker.city
        )
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
              calculateRoute(
                Number(selectedVenue.latitude),
                Number(selectedVenue.longitude),
                mode
              );
            }
          }}
          routeInfo={routeInfo}
          isRouting={isRouting}
          routingError={routingError}
          onClearRoute={handleClearRoute}
          onTravelModeChange={(mode) => {
            if (selectedVenue.latitude != null && selectedVenue.longitude != null) {
              calculateRoute(
                Number(selectedVenue.latitude),
                Number(selectedVenue.longitude),
                mode
              );
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
