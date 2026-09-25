import * as path from 'path';
import * as fs from 'fs';
import { NextRequest } from 'next/server';

// Bypass server-only guard for CLI testing
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

const rootDir = process.cwd();

// Load .env.local
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('  WSNexa Production Auth Domain Migration Verification Suite  ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  // ── SUITE 1: Canonical URL Resolver ───────────────────────────────────────
  console.log('Suite 1: Canonical URL Resolver (src/lib/utils/canonical-url.ts)');
  const {
    getCanonicalAppUrl,
    getCanonicalAuthCallbackUrl,
    PRODUCTION_CANONICAL_URL,
    PRODUCTION_CANONICAL_DOMAIN,
    LEGACY_VERCEL_DOMAIN,
  } = await import('../src/lib/utils/canonical-url');

  assert(
    PRODUCTION_CANONICAL_URL === 'https://wsnexa.app',
    'Test 1.1: PRODUCTION_CANONICAL_URL is https://wsnexa.app'
  );
  assert(
    PRODUCTION_CANONICAL_DOMAIN === 'wsnexa.app',
    'Test 1.2: PRODUCTION_CANONICAL_DOMAIN is wsnexa.app'
  );
  assert(
    LEGACY_VERCEL_DOMAIN === 'w-snexa.vercel.app',
    'Test 1.3: LEGACY_VERCEL_DOMAIN is w-snexa.vercel.app'
  );

  // Resolution rules
  assert(
    getCanonicalAppUrl('w-snexa.vercel.app') === 'https://wsnexa.app',
    'Test 1.4: Legacy Vercel host resolves to https://wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('https://w-snexa.vercel.app/login') === 'https://wsnexa.app',
    'Test 1.5: Legacy Vercel full URL resolves to https://wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('wsnexa.app') === 'https://wsnexa.app',
    'Test 1.6: Production host wsnexa.app resolves to https://wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('www.wsnexa.app') === 'https://wsnexa.app',
    'Test 1.7: Production www.wsnexa.app resolves to canonical https://wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('localhost:3000') === 'http://localhost:3000',
    'Test 1.8: Localhost host preserves http://localhost:3000'
  );
  assert(
    getCanonicalAppUrl('http://127.0.0.1:3000') === 'http://127.0.0.1:3000',
    'Test 1.9: Local development IP preserves http://127.0.0.1:3000'
  );
  assert(
    getCanonicalAppUrl('wsnexa-git-feat-branch.vercel.app') ===
      'https://wsnexa-git-feat-branch.vercel.app',
    'Test 1.10: Legitimate Vercel preview deployment URL is preserved'
  );
  assert(
    getCanonicalAuthCallbackUrl('w-snexa.vercel.app') ===
      'https://wsnexa.app/auth/callback',
    'Test 1.11: Callback URL for legacy host resolves to https://wsnexa.app/auth/callback'
  );
  assert(
    getCanonicalAuthCallbackUrl('wsnexa.app') ===
      'https://wsnexa.app/auth/callback',
    'Test 1.12: Callback URL for production host resolves to https://wsnexa.app/auth/callback'
  );
  assert(
    getCanonicalAuthCallbackUrl('localhost:3000') ===
      'http://localhost:3000/auth/callback',
    'Test 1.13: Callback URL for localhost resolves to http://localhost:3000/auth/callback'
  );

  // ── SUITE 2: Server Actions Auth URL Generation ──────────────────────────
  console.log('\nSuite 2: Server Actions Canonical Auth URL Handling');
  const authActionsPath = path.join(rootDir, 'src/server/actions/auth.ts');
  const authActionsContent = fs.readFileSync(authActionsPath, 'utf8');

  assert(
    authActionsContent.includes('getCanonicalAppUrl'),
    'Test 2.1: src/server/actions/auth.ts imports and uses getCanonicalAppUrl'
  );
  assert(
    authActionsContent.includes('redirectTo: `${canonicalOrigin}/auth/callback`'),
    'Test 2.2: signInWithGoogleAction passes canonicalOrigin to redirectTo'
  );
  assert(
    authActionsContent.includes('emailRedirectTo: `${canonicalOrigin}/auth/callback?next=/onboarding/account-type`'),
    'Test 2.3: signUpAction passes canonicalOrigin to emailRedirectTo'
  );
  assert(
    authActionsContent.includes('redirectTo: `${canonicalOrigin}/auth/callback?next=/reset-password`'),
    'Test 2.4: forgotPasswordAction passes canonicalOrigin to redirectTo'
  );

  // ── SUITE 3: Auth Callback Route Canonical Handling ──────────────────────
  console.log('\nSuite 3: Auth Callback Route & Logout Route Canonical Handling');
  const callbackRoutePath = path.join(rootDir, 'src/app/auth/callback/route.ts');
  const callbackRouteContent = fs.readFileSync(callbackRoutePath, 'utf8');

  assert(
    callbackRouteContent.includes('getCanonicalAppUrl'),
    'Test 3.1: src/app/auth/callback/route.ts imports and uses getCanonicalAppUrl'
  );
  assert(
    callbackRouteContent.includes('getSafeRedirectUrl(next, targetRoute, canonicalOrigin)'),
    'Test 3.2: Callback route redirects to targetRoute using canonicalOrigin'
  );
  assert(
    callbackRouteContent.includes('`${canonicalOrigin}/login?error=Invalid+or+expired+auth+link`'),
    'Test 3.3: Callback route error redirect uses canonicalOrigin'
  );

  const logoutRoutePath = path.join(rootDir, 'src/app/api/auth/logout/route.ts');
  const logoutRouteContent = fs.readFileSync(logoutRoutePath, 'utf8');
  assert(
    logoutRouteContent.includes('getCanonicalAppUrl') &&
      logoutRouteContent.includes('`${canonicalOrigin}/login`'),
    'Test 3.4: src/app/api/auth/logout/route.ts redirects to canonicalOrigin/login'
  );

  // ── SUITE 4: Next.js Proxy Canonical Protection & OAuth Fallback ─────────
  console.log('\nSuite 4: Next.js Proxy Canonical Protection & OAuth Fallback');
  const proxyPath = path.join(rootDir, 'src/proxy.ts');
  const proxyContent = fs.readFileSync(proxyPath, 'utf8');

  assert(
    proxyContent.includes('LEGACY_VERCEL_DOMAIN') &&
      proxyContent.includes('PRODUCTION_CANONICAL_DOMAIN'),
    'Test 4.1: src/proxy.ts imports canonical constants'
  );
  assert(
    proxyContent.includes('status: 308'),
    'Test 4.2: src/proxy.ts issues HTTP 308 permanent redirect for legacy domains'
  );
  assert(
    proxyContent.includes("pathname === '/' && request.nextUrl.searchParams.has('code')"),
    'Test 4.3: src/proxy.ts intercepts OAuth code on root and redirects to /auth/callback'
  );

  // Test Proxy behavior via NextRequest simulation
  const { proxy } = await import('../src/proxy');

  // Test 4.4: Visiting legacy Vercel domain triggers 308 to wsnexa.app
  const legacyReq = new NextRequest('https://w-snexa.vercel.app/login', {
    headers: { host: 'w-snexa.vercel.app' },
  });
  const legacyRes = await proxy(legacyReq);
  assert(
    legacyRes.status === 308 &&
      legacyRes.headers.get('location') === 'https://wsnexa.app/login',
    'Test 4.4: Request to https://w-snexa.vercel.app/login redirects 308 to https://wsnexa.app/login'
  );

  // Test 4.5: Visiting legacy Vercel with query param preserves path and query
  const legacyQueryReq = new NextRequest(
    'https://w-snexa.vercel.app/?code=sample_oauth_code_123',
    { headers: { host: 'w-snexa.vercel.app' } }
  );
  const legacyQueryRes = await proxy(legacyQueryReq);
  assert(
    legacyQueryRes.status === 308 &&
      legacyQueryRes.headers.get('location') ===
        'https://wsnexa.app/?code=sample_oauth_code_123',
    'Test 4.5: Request to https://w-snexa.vercel.app/?code=... preserves query to https://wsnexa.app/?code=...'
  );

  // Test 4.6: Visiting root with ?code= on wsnexa.app forwards to /auth/callback?code=...
  const oauthRootReq = new NextRequest(
    'https://wsnexa.app/?code=google_auth_code_xyz',
    { headers: { host: 'wsnexa.app' } }
  );
  const oauthRootRes = await proxy(oauthRootReq);
  assert(
    oauthRootRes.status === 307 &&
      Boolean(oauthRootRes.headers.get('location')?.includes('/auth/callback?code=google_auth_code_xyz')),
    'Test 4.6: Request to https://wsnexa.app/?code=... forwards 307 to /auth/callback?code=...'
  );

  // ── SUITE 5: Capacitor Mobile Configuration ──────────────────────────────
  console.log('\nSuite 5: Mobile App Configuration & Safe AllowNavigation');
  const capConfigPath = path.join(rootDir, 'capacitor.config.ts');
  const capConfigContent = fs.readFileSync(capConfigPath, 'utf8');

  assert(
    capConfigContent.includes("'wsnexa.app'") &&
      capConfigContent.includes("'*.wsnexa.app'") &&
      capConfigContent.includes("'accounts.google.com'"),
    'Test 5.1: capacitor.config.ts allowNavigation contains wsnexa.app and accounts.google.com'
  );
  assert(
    capConfigContent.includes("url: 'https://w-snexa.vercel.app'"),
    'Test 5.2: capacitor.config.ts retains server URL compatibility for existing mobile tests'
  );

  // ── SUITE 6: UI & Environment Validation ─────────────────────────────────
  console.log('\nSuite 6: UI & Environment Validation');
  const venueFormPath = path.join(
    rootDir,
    'src/components/dashboard/venue-profile-form.tsx'
  );
  const venueFormContent = fs.readFileSync(venueFormPath, 'utf8');
  assert(
    venueFormContent.includes('wsnexa.app/venues/'),
    'Test 6.1: Venue profile web address displays canonical domain wsnexa.app/venues/'
  );

  const envValidationPath = path.join(rootDir, 'src/lib/validation/env.ts');
  const envValidationContent = fs.readFileSync(envValidationPath, 'utf8');
  assert(
    envValidationContent.includes('NEXT_PUBLIC_SITE_URL'),
    'Test 6.2: src/lib/validation/env.ts supports NEXT_PUBLIC_SITE_URL'
  );

  console.log(`\n================================================================`);
  console.log(`  VERIFICATION RESULTS: ${passed} / ${total} Checks Passed (${total - passed} Failed)  `);
  console.log(`================================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled error in verification suite:', err);
  process.exit(1);
});
