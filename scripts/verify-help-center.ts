import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local BEFORE importing modules that validate env variables
const envPath = path.join(process.cwd(), '.env.local');
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

import {
  getAllCategories,
  getCategoryById,
  getAllArticles,
  getArticleBySlug,
  getArticlesByCategory,
  getPopularArticles,
  getTroubleshootingArticles,
  getComingSoonArticles,
  getRecommendedArticles,
  getArticlesForRoute,
  searchHelpArticles,
} from '../src/content/help/registry';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runHelpCenterVerification() {
  const { QuickStartService } = await import('../src/server/services/quick-start.service');
  const { FEATURES } = await import('../src/lib/config/features');

  console.log('\n======================================================');
  console.log('  WSNexa Phase 26 — Help Center Verification Suite');
  console.log('======================================================\n');

  // 1. Categories Integrity
  console.log('--- 1. Canonical Categories Integrity ---');
  const categories = getAllCategories();
  assert(categories.length === 15, `Expected 15 categories, found ${categories.length}`);

  const requiredCatIds = [
    'getting-started',
    'business-branches',
    'menu-management',
    'service-areas-tables-qr',
    'orders',
    'inventory-management',
    'staff-roles-permissions',
    'waiter-operations',
    'kitchen-operations',
    'cashier-payments',
    'order-security',
    'venue-profile-discovery',
    'account-settings',
    'troubleshooting',
    'coming-soon',
  ];

  for (const catId of requiredCatIds) {
    const cat = getCategoryById(catId);
    assert(Boolean(cat && cat.title && cat.icon), `Category '${catId}' is properly defined with title and icon`);
    const catArticles = getArticlesByCategory(catId);
    assert(catArticles.length >= 1, `Category '${catId}' contains at least 1 article (${catArticles.length} found)`);
  }

  const popularArticles = getPopularArticles();
  assert(popularArticles.length >= 5, `Expected at least 5 popular articles, found ${popularArticles.length}`);

  const troubleArticles = getTroubleshootingArticles();
  assert(troubleArticles.length >= 5, `Expected at least 5 troubleshooting articles, found ${troubleArticles.length}`);

  // 2. Article Slugs & Uniqueness
  console.log('\n--- 2. Article Slug Uniqueness & Schema Validity ---');
  const allArticles = getAllArticles();
  assert(allArticles.length >= 20, `Expected at least 20 comprehensive articles, found ${allArticles.length}`);

  const slugSet = new Set<string>();
  let hasDuplicateSlug = false;
  for (const art of allArticles) {
    if (slugSet.has(art.slug)) {
      hasDuplicateSlug = true;
      console.error(`Duplicate slug detected: ${art.slug}`);
    }
    slugSet.add(art.slug);

    // Validate URL safety
    assert(/^[a-z0-9-]+$/.test(art.slug), `Article slug '${art.slug}' is lower-case and URL-safe`);
    assert(art.title.length > 5, `Article '${art.slug}' has descriptive title`);
    assert(art.description.length > 15, `Article '${art.slug}' has comprehensive description`);
    assert(Boolean(getCategoryById(art.category)), `Article '${art.slug}' references valid category '${art.category}'`);
    assert(art.steps.length >= 1, `Article '${art.slug}' contains structured steps`);
    assert(art.keywords.length >= 2, `Article '${art.slug}' contains search keywords`);
  }
  assert(!hasDuplicateSlug, 'All article slugs are 100% unique');

  // 3. Bidirectional Related Links Integrity
  console.log('\n--- 3. Related Article Reference Integrity ---');
  let invalidRelatedCount = 0;
  for (const art of allArticles) {
    if (art.relatedArticles) {
      for (const relSlug of art.relatedArticles) {
        const target = getArticleBySlug(relSlug);
        if (!target) {
          console.error(`Broken related link in '${art.slug}': '${relSlug}' does not exist`);
          invalidRelatedCount++;
        }
      }
    }
  }
  assert(invalidRelatedCount === 0, 'All related article references resolve to existing articles');

  // 4. Context Route Resolution
  console.log('\n--- 4. Contextual Route Resolution ---');
  const menuArticles = getArticlesForRoute('/dashboard/menu');
  assert(menuArticles.length > 0, `Route '/dashboard/menu' resolves ${menuArticles.length} contextual article(s)`);

  const waiterArticles = getArticlesForRoute('/dashboard/waiter');
  assert(waiterArticles.length > 0, `Route '/dashboard/waiter' resolves ${waiterArticles.length} contextual article(s)`);

  const kitchenArticles = getArticlesForRoute('/dashboard/kitchen');
  assert(kitchenArticles.length > 0, `Route '/dashboard/kitchen' resolves ${kitchenArticles.length} contextual article(s)`);

  const securityArticles = getArticlesForRoute('/dashboard/settings/order-security');
  assert(securityArticles.length > 0, `Route '/dashboard/settings/order-security' resolves ${securityArticles.length} contextual article(s)`);

  // 5. Search Engine Scoring & Precision
  console.log('\n--- 5. Search Engine Scoring & Precision ---');
  const qrSearch = searchHelpArticles('QR code');
  assert(qrSearch.length > 0, 'Searching for "QR code" returns results');
  assert(qrSearch[0].article.slug === 'generating-and-printing-qr-codes' || qrSearch[0].article.slug === 'troubleshooting-qr-code-issues', 'Top QR search result is highly relevant');

  const kitchenSearch = searchHelpArticles('order not reaching kitchen');
  assert(kitchenSearch.length > 0, 'Searching for "order not reaching kitchen" returns results');
  assert(kitchenSearch[0].article.slug === 'troubleshooting-order-not-reaching-kitchen', 'Finds specific troubleshooting guide for kitchen order flow');

  const waiterSearch = searchHelpArticles('take table order');
  assert(waiterSearch.length > 0, 'Searching for "take table order" returns results');
  assert(waiterSearch.some(r => r.article.slug === 'taking-table-orders-as-a-waiter'), 'Finds waiter table order guide');

  // 6. Role-Aware Recommendations
  console.log('\n--- 6. Role-Aware Recommendations ---');
  const waiterRecs = getRecommendedArticles('waiter');
  assert(waiterRecs.length > 0, 'Waiter role receives recommendations');
  assert(waiterRecs.every(a => a.category === 'waiter-operations' || a.slug.includes('waiter') || a.slug === 'order-processing-lifecycle'), 'Waiter recommendations are role-aligned');

  const kitchenRecs = getRecommendedArticles('kitchen_staff');
  assert(kitchenRecs.length > 0, 'Kitchen staff role receives recommendations');
  assert(kitchenRecs.some(a => a.category === 'kitchen-operations'), 'Kitchen recommendations include kitchen queue guides');

  const cashierRecs = getRecommendedArticles('cashier');
  assert(cashierRecs.length > 0, 'Cashier role receives recommendations');
  assert(cashierRecs.some(a => a.category === 'cashier-payments'), 'Cashier recommendations include payment settlement guides');

  const ownerRecs = getRecommendedArticles('business_owner');
  assert(ownerRecs.length > 0, 'Business owner role receives recommendations');
  assert(ownerRecs.some(a => a.slug === 'welcome-to-wsnexa' || a.slug === 'setting-up-your-business'), 'Owner recommendations include setup and business guides');

  // 7. Quick Start Service Evaluation
  console.log('\n--- 7. Quick Start Service Contract ---');
  try {
    const dummyProgress = await QuickStartService.getReadinessProgress('00000000-0000-0000-0000-000000000000');
    assert(dummyProgress.totalSteps === 11, `Quick start evaluates 11 canonical steps, found ${dummyProgress.totalSteps}`);
    assert(typeof dummyProgress.percentage === 'number', 'Calculates percentage as number');
    assert(dummyProgress.steps.length === 11, 'Returns 11 structured step objects');
  } catch (err) {
    console.error('QuickStartService threw unexpected error:', err);
    assert(false, 'QuickStartService runs without throwing unhandled exceptions');
  }

  // 8. Loyalty Feature Gate & Coming Soon Guide
  console.log('\n--- 8. Coming Soon / Feature Gate Consistency ---');
  assert(FEATURES.LOYALTY_REWARDS_ENABLED === false, 'FEATURES.LOYALTY_REWARDS_ENABLED remains strictly false for V1');
  const comingSoonArts = getComingSoonArticles();
  assert(comingSoonArts.length > 0, 'Help Center includes Coming Soon roadmap guides');
  const loyaltyGuide = getArticleBySlug('loyalty-and-rewards-coming-soon');
  assert(Boolean(loyaltyGuide && loyaltyGuide.comingSoon), 'Loyalty guide is accurately tagged as comingSoon');

  // 9. Security & Secret Exposure Audit
  console.log('\n--- 9. Security & Privacy Audit ---');
  let secretLeaked = false;
  for (const art of allArticles) {
    const fullText = JSON.stringify(art).toLowerCase();
    if (
      fullText.includes('service_role_key') ||
      fullText.includes('supabase_service_role') ||
      fullText.includes('secret_key') ||
      fullText.includes('/admin/platform') ||
      fullText.includes('/admin/diagnostics')
    ) {
      console.error(`Article '${art.slug}' contains internal platform secret or super-admin route!`);
      secretLeaked = true;
    }
  }
  assert(!secretLeaked, 'Zero internal secrets or Super Admin credentials in Help Center content');

  // Summary
  console.log('\n======================================================');
  console.log(`  RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runHelpCenterVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
