/**
 * Centralized Google Maps Configuration Helper.
 * Handles client and server keys safely without leaking secret credentials.
 */

export function getBrowserGoogleMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || key.trim().length === 0 || key === 'undefined' || key.includes('YOUR_')) {
    return null;
  }
  return key.trim();
}

export function getServerGoogleMapsApiKey(): string | null {
  // Never prefix server key with NEXT_PUBLIC_
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || key.trim().length === 0 || key === 'undefined' || key.includes('YOUR_')) {
    return null;
  }
  return key.trim();
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(getBrowserGoogleMapsApiKey());
}

/**
 * Safe external directions URL fallback generator using raw coordinates or address.
 */
export function getGoogleMapsDirectionsUrl(
  lat?: number | null,
  lng?: number | null,
  address?: string | null
): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (address && address.trim().length > 0) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
  }
  return 'https://maps.google.com';
}

export interface GeolocationCoords {
  lat: number;
  lng: number;
}

export interface GeolocationErrorInfo {
  code: number;
  title: string;
  message: string;
  isBlocked?: boolean;
}

const CACHE_STORAGE_KEY = 'wsnexa_cached_coords';
const CACHE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

let inMemoryLocation: { lat: number; lng: number; timestamp: number } | null = null;
let activeCallbacks: Array<{
  onSuccess: (coords: GeolocationCoords) => void;
  onError: (errInfo: GeolocationErrorInfo) => void;
}> | null = null;

export function getCachedBrowserLocation(): GeolocationCoords | null {
  if (typeof window === 'undefined') return null;
  if (inMemoryLocation && Date.now() - inMemoryLocation.timestamp < CACHE_MAX_AGE_MS) {
    return { lat: inMemoryLocation.lat, lng: inMemoryLocation.lng };
  }
  try {
    const stored = sessionStorage.getItem(CACHE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        typeof parsed.lat === 'number' &&
        typeof parsed.lng === 'number' &&
        isFinite(parsed.lat) &&
        isFinite(parsed.lng) &&
        Date.now() - parsed.timestamp < CACHE_MAX_AGE_MS
      ) {
        inMemoryLocation = parsed;
        return { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}

export function setCachedBrowserLocation(coords: GeolocationCoords): void {
  if (typeof window === 'undefined') return;
  if (!isFinite(coords.lat) || !isFinite(coords.lng)) return;
  inMemoryLocation = { lat: coords.lat, lng: coords.lng, timestamp: Date.now() };
  try {
    sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(inMemoryLocation));
  } catch {
    // Ignore storage write error
  }
}

/**
 * Robust Browser Geolocation Request with automatic network/cache fallback.
 * Prevents mobile GPS timeout errors by checking session cache, avoiding concurrent
 * hardware locks, attempting high accuracy with fallback to network positioning,
 * and handling PERMISSION_DENIED, POSITION_UNAVAILABLE, and TIMEOUT separately.
 */
export function requestBrowserLocation(
  onSuccess: (coords: GeolocationCoords) => void,
  onError: (errInfo: GeolocationErrorInfo) => void,
  options?: { bypassCache?: boolean }
): void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    onError({
      code: 2,
      title: 'Geolocation Unsupported',
      message: 'Your browser does not support GPS location. Please search by city or cuisine instead.',
    });
    return;
  }

  // Check valid recent cached coordinates unless explicitly bypassed (e.g. user tapped Retry)
  if (!options?.bypassCache) {
    const cached = getCachedBrowserLocation();
    if (cached) {
      onSuccess(cached);
      return;
    }
  }

  // If a hardware location request is already in-flight, queue listeners to avoid concurrent conflicts
  if (activeCallbacks) {
    activeCallbacks.push({ onSuccess, onError });
    return;
  }

  activeCallbacks = [{ onSuccess, onError }];

  const notifySuccess = (coords: GeolocationCoords) => {
    setCachedBrowserLocation(coords);
    const callbacks = activeCallbacks || [];
    activeCallbacks = null;
    callbacks.forEach((cb) => cb.onSuccess(coords));
  };

  const notifyError = (errInfo: GeolocationErrorInfo) => {
    // If we have a slightly older cached coordinate, use it as an emergency fallback on timeout/unavailable
    if (errInfo.code === 3 || errInfo.code === 2) {
      const fallbackCached = getCachedBrowserLocation();
      if (fallbackCached) {
        notifySuccess(fallbackCached);
        return;
      }
    }

    const callbacks = activeCallbacks || [];
    activeCallbacks = null;
    callbacks.forEach((cb) => cb.onError(errInfo));
  };

  const handlePositionSuccess = (pos: GeolocationPosition) => {
    notifySuccess({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
  };

  const handlePositionError = (err: GeolocationPositionError, isFallback = false) => {
    if (err.code === err.PERMISSION_DENIED) {
      console.warn('[Geolocation] PERMISSION_DENIED:', err.message);
      notifyError({
        code: 1,
        title: 'Location Permission Blocked',
        message:
          'Location permission is denied for WSNexa. Please enable location permission for this site in your browser settings (tap the lock icon in the address bar), then tap Retry.',
        isBlocked: true,
      });
      return;
    }

    if (err.code === err.POSITION_UNAVAILABLE) {
      console.warn('[Geolocation] POSITION_UNAVAILABLE:', err.message);
      // If primary high accuracy failed with position unavailable, try low accuracy cell/Wi-Fi
      if (!isFallback) {
        navigator.geolocation.getCurrentPosition(
          handlePositionSuccess,
          (fallbackErr) => handlePositionError(fallbackErr, true),
          { timeout: 7000, enableHighAccuracy: false, maximumAge: 600000 }
        );
        return;
      }

      notifyError({
        code: 2,
        title: 'Device Location Unavailable',
        message:
          'Unable to detect your device location. Please ensure your device GPS or Location Services are turned on in your device settings and tap Retry.',
      });
      return;
    }

    if (err.code === err.TIMEOUT) {
      console.warn('[Geolocation] TIMEOUT (isFallback:', isFallback, '):', err.message);
      // Primary GPS timed out (common indoors); immediately try fast network/cell triangulation
      if (!isFallback) {
        navigator.geolocation.getCurrentPosition(
          handlePositionSuccess,
          (fallbackErr) => handlePositionError(fallbackErr, true),
          { timeout: 7000, enableHighAccuracy: false, maximumAge: 600000 }
        );
        return;
      }

      notifyError({
        code: 3,
        title: 'Location Request Timed Out',
        message: 'Acquiring your location timed out. Please check your device location settings and tap Retry.',
      });
      return;
    }

    console.warn('[Geolocation] Unexpected error code:', err.code, err.message);
    notifyError({
      code: err.code || 0,
      title: 'Location Error',
      message: 'Unable to determine your current position. You can search by city or cuisine.',
    });
  };

  // Primary attempt: Request GPS with 6s timeout and accept cached fix up to 5 mins
  try {
    navigator.geolocation.getCurrentPosition(
      handlePositionSuccess,
      (err) => handlePositionError(err, false),
      { timeout: 6000, enableHighAccuracy: true, maximumAge: 300000 }
    );
  } catch (syncErr) {
    console.error('[Geolocation] Synchronous invocation failure:', syncErr);
    notifyError({
      code: 0,
      title: 'Location Error',
      message: 'Failed to initiate location request. Please try again.',
    });
  }
}
