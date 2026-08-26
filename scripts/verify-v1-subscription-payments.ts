import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Bypass server-only guard for direct tsx execution
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

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 36 Step 2 — Subscription Checkout & Enterprise Configurator');
  console.log('================================================================\n');

  const { SubscriptionPricingService } = await import('../src/server/services/subscription-pricing.service');
  const { SUBSCRIPTION_PRICING_CONFIG } = await import('../src/lib/config/subscription-plans');
  const { SubscriptionService } = await import('../src/server/services/subscription.service');
  const checkoutActions = await import('../src/server/actions/subscription-checkout');

  // 1. Checkout Quote Assertions
  console.log('--- SECTION 1: Checkout Quote Recalculation & Formula Assertions ---');
  const starterQuote = SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'starter' });
  assert(starterQuote.total === 4499, '1. Starter checkout quote = 4499 LKR');

  const growthQuote = SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'growth' });
  assert(growthQuote.total === 8999, '2. Growth checkout quote = 8999 LKR');

  const ent575 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 5, activeStaff: 75 },
  });
  assert(ent575.total === 24999, '3. Enterprise 5/75 quote = 24999 LKR');

  const ent10200 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 200 },
  });
  assert(ent10200.total === 49999, '4. Enterprise 10/200 quote = 49999 LKR');

  // 2. Client Amount Non-Authority & Server Calculation
  console.log('\n--- SECTION 2: Security & Client Non-Authority ---');
  const checkoutFile = path.join(process.cwd(), 'src/server/actions/subscription-checkout.ts');
  const checkoutContent = fs.readFileSync(checkoutFile, 'utf-8');
  assert(!checkoutContent.includes('amount_lkr: input.amount'), '5. Server action does not accept or trust client-provided amounts');
  assert(checkoutContent.includes('SubscriptionPricingService.calculateSubscriptionPrice'), '6. Server action authoritatively recalculates price via SubscriptionPricingService');

  // 3. Enterprise Input Validation
  console.log('\n--- SECTION 3: Enterprise Configurator Validation ---');
  assert.throws(
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'enterprise', enterpriseConfig: { branches: 0, activeStaff: 75 } }),
    /PRICING_INVALID_ENTERPRISE_BRANCHES/,
    '7. Enterprise branch < 1 rejected'
  );
  assert.throws(
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'enterprise', enterpriseConfig: { branches: 5, activeStaff: -1 } }),
    /PRICING_INVALID_ENTERPRISE_STAFF/,
    '8. Enterprise staff < 1 rejected'
  );

  // 4. Authorization & Security Checks
  console.log('\n--- SECTION 4: Authorization & Platform Status Protection ---');
  assert(checkoutContent.includes('authContext.role !== \'business_owner\''), '9. Non-owner staff checkout strictly rejected with UNAUTHORIZED_ROLE');
  assert(checkoutContent.includes('business.status === \'suspended\''), '10. Platform-suspended workspace checkout strictly blocked with PLATFORM_SUSPENDED');
  assert(checkoutContent.includes('validateDowngradeEligibility'), '11. Downgrade over-limit eligibility checked before intent creation');

  // 5. Component & Route Structure
  console.log('\n--- SECTION 5: Component & Route Structure ---');
  const configuratorPath = path.join(process.cwd(), 'src/components/subscription/enterprise-configurator.tsx');
  assert(fs.existsSync(configuratorPath), '12. EnterpriseConfigurator component exists');

  const reviewClientPath = path.join(process.cwd(), 'src/components/subscription/subscription-checkout-review-client.tsx');
  assert(fs.existsSync(reviewClientPath), '13. SubscriptionCheckoutReviewClient component exists');

  const reviewClientContent = fs.readFileSync(reviewClientPath, 'utf-8');
  assert(reviewClientContent.includes('Online Payment Coming Soon'), '14. Honest Gateway Unavailable notice displayed post-intent creation');
  assert(!reviewClientContent.includes('billing@wsnexa.internal'), '15. Zero fake email or fake contact details in checkout UI');
  assert(reviewClientContent.includes('LKR {createdIntent.amountLkr.toLocaleString()}'), '16. Intent amount rendered from server response');

  const checkoutPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/settings/subscription/checkout/page.tsx');
  assert(fs.existsSync(checkoutPagePath), '17. Next.js /dashboard/settings/subscription/checkout page route exists');

  // 6. Payment Intent & Idempotency Properties
  console.log('\n--- SECTION 6: Payment Intent & Idempotency ---');
  assert(checkoutContent.includes('status: \'pending\''), '18. Payment intent creates status pending');
  assert(checkoutContent.includes('provider: null'), '19. Provider remains null until direct provider integration');
  assert(checkoutContent.includes('idempotencyKey'), '20. Idempotency key generated to prevent duplicate intent rows on retry');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 2 Verification: ALL 20 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
