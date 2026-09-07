/**
 * Utility functions for validating and sanitizing external URLs.
 */

/**
 * Sanitizes and validates an external URL safely.
 * Prepends https:// if protocol is missing.
 * Rejects non-HTTP(S) protocols (e.g. javascript:, data:, vbscript:, file:).
 * Returns null if URL is empty, invalid, or malformed.
 */
export function sanitizeExternalUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  try {
    const validUrlStr = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(validUrlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || parsed.hostname.length === 0) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
