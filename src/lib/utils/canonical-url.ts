/**
 * Canonical Application URLs and Environment-Aware Resolver for WSNexa.
 *
 * Ensures https://wsnexa.app is the authoritative production application URL,
 * preventing authentication from binding to the legacy w-snexa.vercel.app deployment.
 */

export const PRODUCTION_CANONICAL_DOMAIN = 'wsnexa.app';
export const PRODUCTION_CANONICAL_URL = 'https://wsnexa.app';
export const LEGACY_VERCEL_DOMAIN = 'w-snexa.vercel.app';
export const SUPABASE_CUSTOM_DOMAIN = 'auth.wsnexa.app';

/**
 * Resolves the environment-aware canonical base URL for the application.
 *
 * Rules:
 * 1. Localhost / Local Development:
 *    - Resolves to http://localhost:3000 (or the explicit local host provided).
 * 2. Legacy Vercel Deployment (w-snexa.vercel.app):
 *    - MUST ALWAYS resolve to https://wsnexa.app in production authentication flows.
 * 3. Production Canonical Domain (wsnexa.app / www.wsnexa.app):
 *    - Resolves to https://wsnexa.app.
 * 4. Legitimate Vercel Preview Deployments:
 *    - Preserves https://<preview-host> so PR review/preview deployments function properly.
 * 5. Environment variable fallbacks:
 *    - VERCEL_ENV === 'production' or NODE_ENV === 'production' -> https://wsnexa.app
 *    - NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL if configured and non-legacy.
 *    - Fallback: http://localhost:3000
 */
export function getCanonicalAppUrl(requestOrHost?: Request | string | null): string {
  let incomingHost: string | null = null;
  let incomingProtocol = 'https:';

  if (requestOrHost) {
    if (typeof requestOrHost === 'string') {
      try {
        const trimmed = requestOrHost.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          const parsed = new URL(trimmed);
          incomingHost = parsed.host;
          incomingProtocol = parsed.protocol;
        } else {
          incomingHost = trimmed.split('/')[0];
        }
      } catch {
        incomingHost = requestOrHost.split('/')[0];
      }
    } else if ('url' in requestOrHost) {
      try {
        const parsed = new URL(requestOrHost.url);
        incomingHost = parsed.host;
        incomingProtocol = parsed.protocol;
      } catch {}
    }
  }

  // 1. Localhost / Development IP
  if (
    incomingHost &&
    (incomingHost.startsWith('localhost') ||
      incomingHost.startsWith('127.0.0.1') ||
      incomingHost.startsWith('[::1]'))
  ) {
    const isExplicitHttps =
      (typeof requestOrHost === 'string' && requestOrHost.startsWith('https://')) ||
      (typeof requestOrHost === 'object' && requestOrHost !== null && 'url' in requestOrHost && requestOrHost.url.startsWith('https://'));
    const protocol = isExplicitHttps ? 'https:' : 'http:';
    return `${protocol}//${incomingHost}`;
  }

  // 2. Legacy Vercel Host: Always map to production canonical URL
  if (incomingHost === LEGACY_VERCEL_DOMAIN || incomingHost === `www.${LEGACY_VERCEL_DOMAIN}`) {
    return PRODUCTION_CANONICAL_URL;
  }

  // 3. Production Domain
  if (
    incomingHost === PRODUCTION_CANONICAL_DOMAIN ||
    incomingHost === `www.${PRODUCTION_CANONICAL_DOMAIN}`
  ) {
    return PRODUCTION_CANONICAL_URL;
  }

  // 4. Vercel Preview Deployments (e.g. wsnexa-pr-12.vercel.app or branch previews)
  if (
    incomingHost &&
    incomingHost.endsWith('.vercel.app') &&
    incomingHost !== LEGACY_VERCEL_DOMAIN
  ) {
    return `https://${incomingHost}`;
  }

  // 5. Environment check: Vercel Preview
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 6. Environment check: Production
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    return PRODUCTION_CANONICAL_URL;
  }

  // 7. Configured App URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (appUrl) {
    const trimmed = appUrl.trim().replace(/\/+$/, '');
    if (
      trimmed.includes(LEGACY_VERCEL_DOMAIN) ||
      trimmed.includes(PRODUCTION_CANONICAL_DOMAIN)
    ) {
      return PRODUCTION_CANONICAL_URL;
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // Default fallback for development
  return 'http://localhost:3000';
}

/**
 * Returns the canonical redirect URL for the OAuth callback endpoint.
 */
export function getCanonicalAuthCallbackUrl(requestOrHost?: Request | string | null): string {
  const base = getCanonicalAppUrl(requestOrHost);
  return `${base}/auth/callback`;
}
