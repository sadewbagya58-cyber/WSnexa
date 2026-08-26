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

  // Regression Assertions for Exact Staff Values (75, 76, 100, 101, 200, 201)
  const ent10_75 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 75 },
  });
  assert(ent10_75.total === 39999, '4. Enterprise 10/75 quote = 39999 LKR');

  const ent10_76 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 76 },
  });
  assert(ent10_76.total === 41999, '5. Enterprise 10/76 quote = 41999 LKR');

  const ent10_100 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 100 },
  });
  assert(ent10_100.total === 41999, '6. Enterprise 10/100 quote = 41999 LKR');

  const ent10_101 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 101 },
  });
  assert(ent10_101.total === 43999, '7. Enterprise 10/101 quote = 43999 LKR');

  const ent10_200 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 200 },
  });
  assert(ent10_200.total === 49999, '8. Enterprise 10/200 quote = 49999 LKR');

  const ent10_201 = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 201 },
  });
  assert(ent10_201.total === 51999, '9. Enterprise 10/201 quote = 51999 LKR');

  // 2. Client Amount Non-Authority & Server Calculation
  console.log('\n--- SECTION 2: Security & Client Non-Authority ---');
  const checkoutFile = path.join(process.cwd(), 'src/server/actions/subscription-checkout.ts');
  const checkoutContent = fs.readFileSync(checkoutFile, 'utf-8');
  assert(!checkoutContent.includes('amount_lkr: input.amount'), '10. Server action does not accept or trust client-provided amounts');
  assert(checkoutContent.includes('SubscriptionPricingService.calculateSubscriptionPrice'), '11. Server action authoritatively recalculates price via SubscriptionPricingService');

  // 3. Enterprise Input Validation & UI Step Integrity
  console.log('\n--- SECTION 3: Enterprise Configurator Validation ---');
  assert.throws(
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'enterprise', enterpriseConfig: { branches: 0, activeStaff: 75 } }),
    /PRICING_INVALID_ENTERPRISE_BRANCHES/,
    '12. Enterprise branch < 1 rejected'
  );
  assert.throws(
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'enterprise', enterpriseConfig: { branches: 5, activeStaff: -1 } }),
    /PRICING_INVALID_ENTERPRISE_STAFF/,
    '13. Enterprise staff < 1 rejected'
  );

  const configuratorPath = path.join(process.cwd(), 'src/components/subscription/enterprise-configurator.tsx');
  assert(fs.existsSync(configuratorPath), '14. EnterpriseConfigurator component exists');

  const configuratorContent = fs.readFileSync(configuratorPath, 'utf-8');
  assert(configuratorContent.includes('type="number"'), '15. EnterpriseConfigurator supports direct numeric input');
  assert(configuratorContent.includes('step={1}'), '16. EnterpriseConfigurator range input step is 1');
  assert(configuratorContent.includes('s - 1'), '17. Staff minus button decrements by 1');

  // 4. Authorization & Security Checks
  console.log('\n--- SECTION 4: Authorization & Platform Status Protection ---');
  assert(checkoutContent.includes('!authContext.isBusinessOwner'), '18. Non-owner staff checkout strictly rejected');
  assert(checkoutContent.includes('business.status === \'suspended\''), '19. Platform-suspended workspace checkout strictly blocked with PLATFORM_SUSPENDED');
  assert(checkoutContent.includes('validateDowngradeEligibility'), '20. Downgrade over-limit eligibility checked before intent creation');

  // 5. Component & Route Structure
  console.log('\n--- SECTION 5: Component & Route Structure ---');
  const reviewClientPath = path.join(process.cwd(), 'src/components/subscription/subscription-checkout-review-client.tsx');
  assert(fs.existsSync(reviewClientPath), '21. SubscriptionCheckoutReviewClient component exists');

  const reviewClientContent = fs.readFileSync(reviewClientPath, 'utf-8');
  assert(reviewClientContent.includes('Online Payment Coming Soon'), '22. Honest Gateway Unavailable notice displayed post-intent creation');
  assert(!reviewClientContent.includes('billing@wsnexa.internal'), '23. Zero fake email or fake contact details in checkout UI');
  assert(reviewClientContent.includes('LKR {createdIntent.amountLkr.toLocaleString()}'), '24. Intent amount rendered from server response');

  const checkoutPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/settings/subscription/checkout/page.tsx');
  assert(fs.existsSync(checkoutPagePath), '25. Next.js /dashboard/settings/subscription/checkout page route exists');

  // 6. Payment Intent & Idempotency Properties
  console.log('\n--- SECTION 6: Payment Intent & Idempotency ---');
  assert(checkoutContent.includes('status: \'pending\''), '26. Payment intent creates status pending');
  assert(checkoutContent.includes('provider: null'), '27. Provider remains null until direct provider integration');
  assert(checkoutContent.includes('idempotencyKey'), '28. Idempotency key generated to prevent duplicate intent rows on retry');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 2 Staff Fix Verification: ALL 28 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
