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
