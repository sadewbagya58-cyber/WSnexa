import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('============================================================');
  console.log('WSNexa — Payment Gateway Readiness & Provider Neutrality Verification');
  console.log('============================================================\n');

  // 1. PUBLIC PRICING PAGE
  console.log('--- 1. Public Pricing Page & Disclosures ---');
  const pricingPath = path.join(process.cwd(), 'src/app/(public)/pricing/page.tsx');
  assert(fs.existsSync(pricingPath), 'Public pricing page exists at /pricing');

  const pricingContent = fs.readFileSync(pricingPath, 'utf8');
  const { SUBSCRIPTION_PRICING_CONFIG } = await import('../src/lib/config/subscription-plans');
  assert(
    pricingContent.includes('starterMonthlyLkr') || pricingContent.includes(String(SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr)),
    'Pricing page references Starter tier price'
  );
  assert(
    pricingContent.includes('growthMonthlyLkr') || pricingContent.includes(String(SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr)),
    'Pricing page references Growth tier price'
  );
  assert(
    pricingContent.includes('enterpriseBaseMonthlyLkr') || pricingContent.includes(String(SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr)),
    'Pricing page references Enterprise tier base price'
  );
  assert(pricingContent.includes('LKR'), 'Pricing page explicitly quotes in Sri Lankan Rupees (LKR)');
  assert(pricingContent.includes('14-day') && pricingContent.includes('free trial'), 'Pricing page discloses 14-day free trial terms');
  assert(pricingContent.includes('7-day grace period') || pricingContent.includes('grace period'), 'Pricing page discloses post-trial grace period');
  assert(pricingContent.includes('/legal/subscription-billing'), 'Pricing page links to Subscription & Billing Policy');
  assert(pricingContent.includes('/legal/refund-cancellation'), 'Pricing page links to Refund & Cancellation Policy');
  assert(pricingContent.includes('/legal/privacy'), 'Pricing page links to Privacy Policy');

  // 2. NAVBAR PRICING LINKS
  console.log('\n--- 2. Public Navigation Links ---');
  const navbarPath = path.join(process.cwd(), 'src/components/layout/public-navbar.tsx');
  assert(fs.existsSync(navbarPath), 'Public navbar component exists');

  const navbarContent = fs.readFileSync(navbarPath, 'utf8');
  assert(navbarContent.includes('href="/pricing"'), 'Navbar contains link to /pricing');
  const pricingMatches = (navbarContent.match(/href="\/pricing"/g) || []).length;
  assert(pricingMatches >= 2, 'Pricing link present in both desktop and mobile drawer', `Found ${pricingMatches}`);

  // 3. PUBLIC HELP CENTER ACCESSIBILITY
  console.log('\n--- 3. Public Help Center Direct Accessibility ---');
  const publicHelpSlugPath = path.join(process.cwd(), 'src/app/(public)/help/[slug]/page.tsx');
  const publicHelpCatPath = path.join(process.cwd(), 'src/app/(public)/help/category/[category]/page.tsx');
  const publicHelpIndexPath = path.join(process.cwd(), 'src/app/(public)/help/page.tsx');

  assert(fs.existsSync(publicHelpSlugPath), 'Public help article route exists at /help/[slug]');
  assert(fs.existsSync(publicHelpCatPath), 'Public help category route exists at /help/category/[category]');

  const helpIndexContent = fs.readFileSync(publicHelpIndexPath, 'utf8');
  assert(!helpIndexContent.includes('/dashboard/help/'), 'Public help index does NOT link to authenticated /dashboard/help/');
  assert(helpIndexContent.includes('/help/'), 'Public help index links directly to public /help/ routes');

  const helpSlugContent = fs.readFileSync(publicHelpSlugPath, 'utf8');
  assert(helpSlugContent.includes('basePath="/help"'), 'Help article view receives basePath="/help" for public routing');

  // 4. PROVIDER NEUTRALITY AUDIT
  console.log('\n--- 4. Provider Neutrality Audit ---');
  const checkoutClientPath = path.join(process.cwd(), 'src/components/subscription/subscription-checkout-review-client.tsx');
  const checkoutContent = fs.readFileSync(checkoutClientPath, 'utf8');
  assert(!checkoutContent.includes('Dialog Gateway connection is not yet available'), 'Subscription checkout does NOT hardcode "Dialog Gateway" in user message');
  assert(checkoutContent.includes('pre-commercial staging'), 'Subscription checkout states gateway integrations are in pre-commercial staging');
  assert(checkoutContent.includes('/legal/subscription-billing'), 'Subscription checkout links to Subscription & Billing Policy');
  assert(checkoutContent.includes('/legal/refund-cancellation'), 'Subscription checkout links to Refund & Cancellation Policy');

  const pricingServicePath = path.join(process.cwd(), 'src/server/services/subscription-pricing.service.ts');
  const pricingServiceContent = fs.readFileSync(pricingServicePath, 'utf8');
  assert(!pricingServiceContent.includes("export type SubscriptionPaymentProvider = 'dialog' | string | null;"), 'Pricing service type does not single out Dialog exclusively');

  const registryPath = path.join(process.cwd(), 'src/content/legal/registry.ts');
  const registryContent = fs.readFileSync(registryPath, 'utf8');
  assert(!registryContent.includes('Dialog Genie / eZ Cash'), 'Legal registry does not mention Dialog Genie / eZ Cash in future gateway text');
  assert(registryContent.includes('Central Bank of Sri Lanka'), 'Legal registry references CBSL-approved payment channels');

  // 5. GUEST DINING CHECKOUT POLICY DISCLOSURES
  console.log('\n--- 5. Guest Dining Checkout Disclosures ---');
  const guestCheckoutPath = path.join(process.cwd(), 'src/components/guest/checkout-preview.tsx');
  const guestCheckoutContent = fs.readFileSync(guestCheckoutPath, 'utf8');
  assert(guestCheckoutContent.includes('/legal/terms'), 'Guest dining checkout links to Terms');
  assert(guestCheckoutContent.includes('/legal/privacy'), 'Guest dining checkout links to Privacy');
  assert(guestCheckoutContent.includes('/legal/refund-cancellation'), 'Guest dining checkout links to Refund Policy');

  // 6. BUSINESS & LEGAL REGISTRY INVARIANTS
  console.log('\n--- 6. Business Information & Invariant Protection ---');
  const { getAllLegalDocuments, OFFICIAL_BUSINESS_INFO } = await import('../src/content/legal/registry');
  assert(OFFICIAL_BUSINESS_INFO.brand === 'WSNexa', 'Brand is WSNexa');
  assert(OFFICIAL_BUSINESS_INFO.supportEmail === 'wsnexaofficial@gmail.com', 'Support email is wsnexaofficial@gmail.com');
  assert(OFFICIAL_BUSINESS_INFO.phone === '0761434289', 'Phone number is 0761434289');
  assert(OFFICIAL_BUSINESS_INFO.address === 'Panawewa, Bingiriya, Sri Lanka', 'Address is Panawewa, Bingiriya, Sri Lanka');

  const docs = getAllLegalDocuments();
  assert(docs.length === 8, '8 legal documents remain active');
  for (const doc of docs) {
    assert(doc.status === 'under_review', `Document ${doc.slug} is marked under_review`);
    assert(doc.requiresLegalReview === true, `Document ${doc.slug} requires legal review`);
  }

  console.log('\n============================================================');
  console.log('Results: All Gateway Readiness & Neutrality Checks PASS!');
  console.log('============================================================\n');
}

run().catch((err) => {
  console.error('Fatal error during gateway readiness verification:', err);
  process.exit(1);
});
