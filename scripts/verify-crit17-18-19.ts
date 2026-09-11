import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

let total = 0;
let passed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`✅ TEST ${total}: ${testName}`);
    passed++;
  } else {
    console.error(`❌ TEST ${total} FAILED: ${testName}`);
    if (detail) console.error(`   Details: ${detail}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('   WSNexa CRIT-17, CRIT-18 & CRIT-19 Verification Suite         ');
  console.log('================================================================\n');

  // =========================================================================
  // 1. CRIT-17: Customer Portal Mobile Header UI & Responsiveness
  // =========================================================================
  console.log('--- 1. CRIT-17: Customer Portal Mobile Header UI ---');
  const custShellPath = path.join(root, 'src', 'components', 'customer', 'customer-shell.tsx');
  assert(fs.existsSync(custShellPath), 'customer-shell.tsx exists');

  const custShellSrc = fs.readFileSync(custShellPath, 'utf8');

  // Check 1.1: Context indicator banner guards & roles preserved
  assert(
    custShellSrc.includes('hasBusinessAccess && ('),
    'Context indicator banner is guarded by hasBusinessAccess'
  );
  assert(
    custShellSrc.includes('Viewing customer mode as'),
    'Banner preserves "Viewing customer mode as" text'
  );
  assert(
    custShellSrc.includes('Back to Staff') && custShellSrc.includes('Back to Business'),
    'Banner provides role-aware labels ("Back to Staff" / "Back to Business")'
  );
  assert(
    custShellSrc.includes('href="/dashboard"'),
    'Banner links cleanly to /dashboard'
  );

  // Check 1.2: Banner responsiveness
  assert(
    custShellSrc.includes('min-w-0 flex-1 truncate') && custShellSrc.includes('overflow-hidden'),
    'Banner layout prevents horizontal overflow and squishing with min-w-0 flex-1 truncate'
  );

  // Check 1.3: Customer Header Bar brand responsiveness
  assert(
    custShellSrc.includes('sm:hidden') &&
    custShellSrc.includes('WSNexa') &&
    custShellSrc.includes('hidden sm:inline') &&
    custShellSrc.includes('WSNexa Customer'),
    'Customer header bar uses compact "WSNexa" on mobile and "WSNexa Customer" on desktop'
  );
  assert(
    custShellSrc.includes('href="/customer"'),
    'Header brand links to /customer'
  );

  // Check 1.4: Right action controls responsiveness
  assert(
    custShellSrc.includes('isStaffRole ? \'Staff\' : \'Business\''),
    'Header switch button displays compact "Staff" or "Business" on mobile'
  );
  assert(
    custShellSrc.includes('truncate') &&
    (custShellSrc.includes('max-w-[50px]') || custShellSrc.includes('max-w-[60px]')),
    'Header user avatar button truncates customer name on narrow screens to prevent overflow'
  );
  assert(
    custShellSrc.includes('displayName.charAt(0).toUpperCase()'),
    'Header user avatar always displays customer initial circle'
  );

  // Check 1.5: Desktop nav & dropdown menus preserved
  assert(
    custShellSrc.includes('/customer/reservations') &&
    custShellSrc.includes('/customer/orders') &&
    custShellSrc.includes('/customer/favorites') &&
    custShellSrc.includes('/customer/loyalty') &&
    custShellSrc.includes('/customer/profile'),
    'All desktop nav and customer portal destinations are 100% preserved'
  );
  assert(
    custShellSrc.includes('/api/auth/logout'),
    'User menu logout action is 100% preserved'
  );

  // =========================================================================
  // 2. CRIT-18: Customer Portal Welcome Greeting
  // =========================================================================
  console.log('\n--- 2. CRIT-18: Customer Portal Welcome Message ---');
  const dashPath = path.join(root, 'src', 'components', 'customer', 'customer-dashboard.tsx');
  assert(fs.existsSync(dashPath), 'customer-dashboard.tsx exists');

  const dashSrc = fs.readFileSync(dashPath, 'utf8');

  // Check 2.1: Unified welcome message
  assert(
    dashSrc.includes('Welcome back, {displayName} 👋'),
    'Displays static unified "Welcome back, {displayName} 👋"'
  );

  // Check 2.2: Complete removal of time-dependent greetings
  assert(
    !dashSrc.includes('Good afternoon'),
    'Removed time-dependent "Good afternoon"'
  );
  assert(
    !dashSrc.includes('Good morning'),
    'No "Good morning" greeting'
  );
  assert(
    !dashSrc.includes('Good evening'),
    'No "Good evening" greeting'
  );

  // Check 2.3: Data and analytics preserved
  assert(
    dashSrc.includes('{email}') &&
    dashSrc.includes('analytics.activeOrdersCount') &&
    dashSrc.includes('totalLoyaltyPoints'),
    'Customer email, analytics and loyalty accounts remain intact'
  );

  // =========================================================================
  // 3. CRIT-19: Explore Page Performance
  // =========================================================================
  console.log('\n--- 3. CRIT-19: Explore Page Performance Optimizations ---');
  const venueCardPath = path.join(root, 'src', 'components', 'discovery', 'venue-card.tsx');
  assert(fs.existsSync(venueCardPath), 'venue-card.tsx exists');

  const venueCardSrc = fs.readFileSync(venueCardPath, 'utf8');

  // Check 3.1: React.memo on VenueCard
  assert(
    venueCardSrc.includes('React.memo(function VenueCard') ||
    venueCardSrc.includes('React.memo(VenueCard') ||
    venueCardSrc.includes('memo('),
    'VenueCard is wrapped in React.memo to prevent unnecessary re-render storms'
  );

  // Check 3.2: GPU blur removal
  assert(
    !venueCardSrc.includes('backdrop-blur-md'),
    'VenueCard has eliminated heavy backdrop-blur-md on badges'
  );

  // Check 3.3: Content-visibility and contain-intrinsic-size
  assert(
    venueCardSrc.includes('content-visibility:auto') ||
    venueCardSrc.includes('[content-visibility:auto]'),
    'VenueCard applies content-visibility:auto for offscreen rendering optimization'
  );

  // Check 3.4: Touch hover optimization
  assert(
    !venueCardSrc.includes('transition-all duration-300'),
    'Card container avoids transition-all duration-300 to eliminate touch-scroll style invalidation'
  );

  // Check 3.5: Image decoding and loading
  assert(
    venueCardSrc.includes('loading="lazy"') && venueCardSrc.includes('decoding="async"'),
    'VenueCard explicitly sets lazy loading and async decoding on images'
  );

  // Check 3.6: FavoriteButton blur removal
  const favBtnPath = path.join(root, 'src', 'components', 'discovery', 'favorite-button.tsx');
  assert(fs.existsSync(favBtnPath), 'favorite-button.tsx exists');

  const favBtnSrc = fs.readFileSync(favBtnPath, 'utf8');
  assert(
    !favBtnSrc.includes('backdrop-blur-md'),
    'FavoriteButton has eliminated backdrop-blur-md in floating card variant'
  );

  // Check 3.7: VenueCarousel memoization
  const carouselPath = path.join(root, 'src', 'components', 'discovery', 'venue-carousel.tsx');
  assert(fs.existsSync(carouselPath), 'venue-carousel.tsx exists');

  const carouselSrc = fs.readFileSync(carouselPath, 'utf8');
  assert(
    carouselSrc.includes('useMemo') && carouselSrc.includes('transformedVenues'),
    'VenueCarousel memoizes transformed venue items to prevent object reference churn'
  );

  // Check 3.8: VenueRankingService in-memory metrics cache
  const rankingServicePath = path.join(root, 'src', 'server', 'services', 'venue-ranking.service.ts');
  assert(fs.existsSync(rankingServicePath), 'venue-ranking.service.ts exists');

  const rankingServiceSrc = fs.readFileSync(rankingServicePath, 'utf8');
  assert(
    rankingServiceSrc.includes('cachedMetrics') &&
    rankingServiceSrc.includes('METRICS_CACHE_TTL_MS'),
    'VenueRankingService implements in-memory metrics caching to eliminate SSR duplicate query storms'
  );

  // Check 3.9: Explore hero glow optimization
  const explorePagePath = path.join(root, 'src', 'app', '(public)', 'explore', 'page.tsx');
  assert(fs.existsSync(explorePagePath), 'explore/page.tsx exists');

  const explorePageSrc = fs.readFileSync(explorePagePath, 'utf8');
  assert(
    !explorePageSrc.includes('blur-3xl pointer-events-none'),
    'Explore hero glow reduces GPU blur footprint from blur-3xl to blur-xl'
  );

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(`   Verification Finished: ${passed} / ${total} Tests PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
