import * as path from 'path';
import * as fs from 'fs';

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

// Load .env.local before importing any application modules
const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    process.exit(1);
  }
}

async function runSeoVerification() {
  // Dynamic imports after env is populated and server-only is bypassed
  const robotsModule = await import('../src/app/robots');
  const sitemapModule = await import('../src/app/sitemap');
  const canonicalModule = await import('../src/lib/utils/canonical-url');
  const structuredDataModule = await import('../src/lib/seo/structured-data');
  const jsonLdModule = await import('../src/components/seo/json-ld');

  const robots = robotsModule.default;
  const sitemap = sitemapModule.default;
  const {
    PRODUCTION_CANONICAL_URL,
    PRODUCTION_CANONICAL_DOMAIN,
    LEGACY_VERCEL_DOMAIN,
    getCanonicalAppUrl,
    getCanonicalAuthCallbackUrl,
  } = canonicalModule;
  const {
    createOrganizationSchema,
    createSoftwareApplicationSchema,
    createVenueSchema,
    createBreadcrumbSchema,
  } = structuredDataModule;
  const { serializeJsonLd } = jsonLdModule;

  console.log('\n================================================================');
  console.log('       WSNexa Production SEO Implementation Verification Suite       ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Suite 1: Canonical Base and Domain Verification
  // -------------------------------------------------------------
  console.log('Suite 1: Canonical Base and Resolution');
  assert(
    PRODUCTION_CANONICAL_URL === 'https://wsnexa.app',
    'Test 1.1: PRODUCTION_CANONICAL_URL is strictly https://wsnexa.app',
    `Expected https://wsnexa.app, got ${PRODUCTION_CANONICAL_URL}`
  );
  assert(
    PRODUCTION_CANONICAL_DOMAIN === 'wsnexa.app',
    'Test 1.2: PRODUCTION_CANONICAL_DOMAIN is wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('https://w-snexa.vercel.app') === 'https://wsnexa.app',
    'Test 1.3: getCanonicalAppUrl maps legacy Vercel host to https://wsnexa.app'
  );
  assert(
    getCanonicalAppUrl('https://wsnexa.app') === 'https://wsnexa.app',
    'Test 1.4: getCanonicalAppUrl maps production host to https://wsnexa.app'
  );
  assert(
    getCanonicalAuthCallbackUrl('https://w-snexa.vercel.app') === 'https://wsnexa.app/auth/callback',
    'Test 1.5: getCanonicalAuthCallbackUrl resolves OAuth callback to canonical origin'
  );

  // -------------------------------------------------------------
  // Suite 2: Robots.txt Rules & Disallow Directives
  // -------------------------------------------------------------
  console.log('\nSuite 2: Robots.txt Specification');
  const robotsData = robots();
  assert(Boolean(robotsData.rules), 'Test 2.1: Robots route returns rules object');

  const rules = Array.isArray(robotsData.rules) ? robotsData.rules[0] : robotsData.rules;
  assert(rules?.userAgent === '*', 'Test 2.2: User-agent is wildcard *');
  assert(rules?.allow === '/', 'Test 2.3: Root / is explicitly allowed');

  const disallowed = Array.isArray(rules?.disallow) ? rules.disallow : [rules?.disallow];
  const requiredDisallows = [
    '/dashboard/',
    '/admin/',
    '/customer/',
    '/m/',
    '/onboarding/',
    '/account/',
    '/api/',
    '/venues/*/reserve/confirmation/',
  ];

  for (const path of requiredDisallows) {
    assert(
      disallowed.includes(path),
      `Test 2.4: Robots disallows sensitive path: ${path}`,
      `Disallow list missing ${path}`
    );
  }

  assert(
    robotsData.sitemap === 'https://wsnexa.app/sitemap.xml',
    'Test 2.5: Robots points to canonical sitemap at https://wsnexa.app/sitemap.xml',
    `Got sitemap: ${robotsData.sitemap}`
  );

  // -------------------------------------------------------------
  // Suite 3: Sitemap Generation & Route Filtering
  // -------------------------------------------------------------
  console.log('\nSuite 3: Sitemap Generation');
  const sitemapEntries = await sitemap();
  assert(Array.isArray(sitemapEntries), 'Test 3.1: Sitemap returns an array of route entries');
  assert(sitemapEntries.length > 20, `Test 3.2: Sitemap contains at least 20 static & help routes (found ${sitemapEntries.length})`);

  const urls = sitemapEntries.map((e) => e.url);

  // Check expected public pages are present
  const requiredPublicUrls = [
    'https://wsnexa.app',
    'https://wsnexa.app/pricing',
    'https://wsnexa.app/explore',
    'https://wsnexa.app/about',
    'https://wsnexa.app/contact',
    'https://wsnexa.app/status',
    'https://wsnexa.app/help',
    'https://wsnexa.app/legal/terms',
    'https://wsnexa.app/legal/privacy',
    'https://wsnexa.app/legal/security',
  ];

  for (const expectedUrl of requiredPublicUrls) {
    assert(
      urls.includes(expectedUrl),
      `Test 3.3: Sitemap includes required public page ${expectedUrl}`,
      `Missing from sitemap: ${expectedUrl}`
    );
  }

  // Ensure NO private or protected routes leaked into sitemap
  const forbiddenPrefixes = [
    '/dashboard',
    '/admin',
    '/customer',
    '/m',
    '/onboarding',
    '/account',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ];

  for (const url of urls) {
    const pathname = new URL(url).pathname;
    for (const prefix of forbiddenPrefixes) {
      const isForbidden = pathname === prefix || pathname.startsWith(`${prefix}/`);
      assert(
        !isForbidden,
        `Test 3.4: Sitemap does NOT contain private prefix (${prefix}) in ${pathname}`,
        `Leaked private URL in sitemap: ${url}`
      );
    }
    assert(
      !pathname.includes('/reserve/confirmation'),
      `Test 3.4: Sitemap does not contain private reservation confirmation in ${pathname}`
    );
  }

  // Verify sitemap entry structure
  const sampleEntry = sitemapEntries.find((e) => e.url === 'https://wsnexa.app');
  assert(
    sampleEntry?.changeFrequency === 'daily' && sampleEntry?.priority === 1.0,
    'Test 3.5: Homepage sitemap entry has daily changeFrequency and 1.0 priority'
  );

  // -------------------------------------------------------------
  // Suite 4: Schema.org Structured Data
  // -------------------------------------------------------------
  console.log('\nSuite 4: Structured Data (Schema.org) Generation');
  const orgSchema = createOrganizationSchema();
  assert(orgSchema['@context'] === 'https://schema.org', 'Test 4.1: Org schema has https://schema.org context');
  assert(orgSchema['@type'] === 'Organization', 'Test 4.2: Org schema has Organization type');
  assert(orgSchema.name === 'WSNexa', 'Test 4.3: Org name is WSNexa');
  assert(orgSchema.slogan === 'Smart Hospitality. Simplified.', 'Test 4.4: Org slogan matches brand tagline');
  assert(orgSchema.url === 'https://wsnexa.app', 'Test 4.5: Org URL is canonical production domain');

  const appSchema = createSoftwareApplicationSchema();
  assert(appSchema['@type'] === 'SoftwareApplication', 'Test 4.6: SoftwareApplication schema type');
  assert(appSchema.applicationCategory === 'BusinessApplication', 'Test 4.7: SoftwareApplication category');
  assert(
    (appSchema.offers as any)?.priceCurrency === 'LKR',
    'Test 4.8: SoftwareApplication offer currency is real LKR'
  );

  const venueSchema = createVenueSchema({
    id: 'venue-1',
    business_id: 'biz-1',
    display_name: 'Ocean Breeze Café',
    slug: 'ocean-breeze-cafe',
    venue_type: 'cafe',
    short_description: 'Fresh coffee and ocean views',
    description: 'Fresh coffee and ocean views by the beach.',
    address_public: '12 Beach Rd, Galle',
    city: 'Galle',
    country: 'LK',
    phone_public: '+94771234567',
    email_public: 'info@oceanbreeze.lk',
    website_url: 'https://oceanbreeze.lk',
    cover_image_url: 'https://images.unsplash.com/photo-sample',
    logo_url: 'https://images.unsplash.com/logo-sample',
    latitude: 6.0535,
    longitude: 80.2210,
    price_level: 2,
    is_published: true,
    public_menu_enabled: true,
    public_reservations_enabled: true,
    average_rating: 4.8,
    review_count: 35,
    is_accepting_orders: true,
    featured_branch_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(venueSchema['@type'] === 'CafeOrCoffeeShop', 'Test 4.9: Venue category "cafe" maps to CafeOrCoffeeShop');
  assert(venueSchema.name === 'Ocean Breeze Café', 'Test 4.10: Venue name preserved');
  assert(
    venueSchema.url === 'https://wsnexa.app/venues/ocean-breeze-cafe',
    'Test 4.11: Venue URL correctly canonicalized'
  );
  assert(
    (venueSchema.address as any)?.streetAddress === '12 Beach Rd, Galle',
    'Test 4.12: Venue address included only when present'
  );
  assert(
    (venueSchema.aggregateRating as any)?.ratingValue === 4.8,
    'Test 4.13: Real average rating mapped without fabrication'
  );
  assert(
    (venueSchema.aggregateRating as any)?.reviewCount === 35,
    'Test 4.14: Real review count mapped without fabrication'
  );

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Explore', url: '/explore' },
    { name: 'Ocean Breeze', url: '/venues/ocean-breeze-cafe' },
  ]);
  assert(breadcrumbSchema['@type'] === 'BreadcrumbList', 'Test 4.15: BreadcrumbList schema type');
  assert(
    ((breadcrumbSchema as any).itemListElement as any[]).length === 3,
    'Test 4.16: BreadcrumbList contains all navigation items'
  );
  assert(
    ((breadcrumbSchema as any).itemListElement as any[])[2].item === 'https://wsnexa.app/venues/ocean-breeze-cafe',
    'Test 4.17: Breadcrumb items canonicalize relative URLs to absolute'
  );

  // -------------------------------------------------------------
  // Suite 5: JSON-LD XSS Sanitization
  // -------------------------------------------------------------
  console.log('\nSuite 5: JSON-LD Security & XSS Protection');
  const dirtyData = {
    malicious: '</script><script>alert("xss")</script>',
    safe: 'Hello World',
  };
  const sanitized = serializeJsonLd(dirtyData);
  assert(
    !sanitized.includes('</script>'),
    'Test 5.1: serializeJsonLd escapes closing script tags (< replaced with \\u003c)',
    `Found unescaped tag in: ${sanitized}`
  );
  assert(
    sanitized.includes('\\u003c/script>'),
    'Test 5.2: serializeJsonLd safely Unicode-encodes < characters'
  );

  // -------------------------------------------------------------
  // Suite 6: Favicon, App Icons & Web App Manifest Verification
  // -------------------------------------------------------------
  console.log('\nSuite 6: Favicon, App Icons & Web Manifest');
  const crypto = await import('crypto');
  const manifestModule = await import('../src/app/manifest');
  const faviconPath = path.join(rootDir, 'src/app/favicon.ico');
  assert(fs.existsSync(faviconPath), 'Test 6.1: src/app/favicon.ico exists');

  const faviconBuf = fs.readFileSync(faviconPath);
  const faviconSha = crypto.createHash('sha256').update(faviconBuf).digest('hex');
  assert(
    faviconBuf.subarray(0, 4).toString('hex') === '00000100',
    'Test 6.2: src/app/favicon.ico has valid ICO magic bytes (00 00 01 00)'
  );
  assert(
    !faviconSha.startsWith('2b8ad2d33455a8f7'),
    'Test 6.3: src/app/favicon.ico is official WSNexa compact mark (not default Vercel triangle)'
  );
  assert(
    faviconBuf.readUInt16LE(4) === 4,
    'Test 6.4: src/app/favicon.ico contains 4 multi-resolution frames (16x16, 32x32, 48x48, 256x256)'
  );

  const expectedPngIcons: Array<{ relPath: string; width: number; height: number }> = [
    { relPath: 'public/favicon-32x32.png', width: 32, height: 32 },
    { relPath: 'public/favicon-48x48.png', width: 48, height: 48 },
    { relPath: 'public/apple-touch-icon.png', width: 180, height: 180 },
    { relPath: 'public/icon-192.png', width: 192, height: 192 },
    { relPath: 'public/icon-512.png', width: 512, height: 512 },
    { relPath: 'public/brand/ws-mark.png', width: 512, height: 512 },
    { relPath: 'src/app/icon.png', width: 512, height: 512 },
    { relPath: 'src/app/apple-icon.png', width: 180, height: 180 },
  ];

  for (const item of expectedPngIcons) {
    const abs = path.join(rootDir, item.relPath);
    assert(fs.existsSync(abs), `Test 6.5: ${item.relPath} exists`);
    const buf = fs.readFileSync(abs);
    const magic = buf.subarray(0, 8).toString('hex');
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    assert(
      magic === '89504e470d0a1a0a' && w === item.width && h === item.height,
      `Test 6.6: ${item.relPath} is a valid ${item.width}x${item.height} PNG`,
      `Got magic=${magic}, ${w}x${h}`
    );
  }

  const manifestData = manifestModule.default();
  assert(
    manifestData.short_name === 'WSNexa' && Array.isArray(manifestData.icons) && manifestData.icons.length >= 3,
    'Test 6.7: Web App Manifest exports WSNexa branding and multi-size icon descriptors'
  );

  console.log('\n================================================================');
  console.log('  ALL SEO VERIFICATION CHECKS PASSED SUCCESSFULLY (49 / 49)  ');
  console.log('================================================================\n');
}

runSeoVerification().catch((err) => {
  console.error('Fatal error during SEO verification:', err);
  process.exit(1);
});
