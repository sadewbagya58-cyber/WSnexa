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

/**
 * Robust Browser Geolocation Request with automatic network/cache fallback.
 * Prevents mobile GPS timeout errors by attempting high accuracy with a sensible timeout,
 * then falling back to cell/WiFi triangulation before raising a timeout error.
 */
export function requestBrowserLocation(
  onSuccess: (coords: GeolocationCoords) => void,
  onError: (errInfo: GeolocationErrorInfo) => void
): void {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    onError({
      code: 2,
      title: 'Geolocation Unsupported',
      message: 'Your browser does not support GPS location. Please search by city or cuisine instead.',
    });
    return;
  }

  const handlePositionSuccess = (pos: GeolocationPosition) => {
    onSuccess({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    });
  };

  const handlePositionError = (err: GeolocationPositionError, isFallback = false) => {
    if (err.code === err.PERMISSION_DENIED) {
      if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((perm) => {
            if (perm.state === 'denied') {
              onError({
                code: 1,
                title: 'Location Permission Blocked',
                message:
                  'Location permission is blocked for WSNexa. Please enable location permission for this site in your browser settings (tap the lock icon in the address bar), then tap Retry.',
                isBlocked: true,
              });
            } else {
              onError({
                code: 1,
                title: 'Location Access Needed',
                message: 'Allow location access for WSNexa in your browser to find venues near you.',
                isBlocked: false,
              });
            }
          })
          .catch(() => {
            onError({
              code: 1,
              title: 'Location Access Needed',
              message: 'Allow location access for WSNexa in your browser to find venues near you.',
              isBlocked: false,
            });
          });
      } else {
        onError({
          code: 1,
          title: 'Location Access Needed',
          message: 'Allow location access for WSNexa in your browser to find venues near you.',
          isBlocked: false,
        });
      }
      return;
    }

    if (err.code === err.POSITION_UNAVAILABLE) {
      onError({
        code: 2,
        title: 'Device Location Unavailable',
        message:
          'Unable to detect your device location. Please ensure your device GPS or Location Services are turned on in your device settings and try again.',
      });
      return;
    }

    if (err.code === err.TIMEOUT) {
      // If accurate GPS timed out and we haven't tried fast network/cache fallback yet, try it now!
      if (!isFallback) {
        navigator.geolocation.getCurrentPosition(
          handlePositionSuccess,
          (fallbackErr) => handlePositionError(fallbackErr, true),
          { timeout: 10000, enableHighAccuracy: false, maximumAge: 300000 }
        );
        return;
      }

      onError({
        code: 3,
        title: 'Location Request Timed Out',
        message: 'Acquiring your location timed out. Please check your signal and tap Retry.',
      });
      return;
    }

    onError({
      code: err.code || 0,
      title: 'Location Error',
      message: 'Unable to determine your current position. You can search by city or cuisine.',
    });
  };

  // Primary attempt: Request with reasonable cache age so if device already has a recent fix, it returns in ~50ms
  navigator.geolocation.getCurrentPosition(
    handlePositionSuccess,
    (err) => handlePositionError(err, false),
    { timeout: 8000, enableHighAccuracy: true, maximumAge: 120000 }
  );
}
