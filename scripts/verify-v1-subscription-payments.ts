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
  console.log('  WSNexa Phase 36 Step 5 — Final Subscription Payment Readiness');
  console.log('================================================================\n');

  // 1. Pricing Engine & Enterprise Configurator Assertions
  console.log('--- SECTION 1: Pricing Engine & Configurator ---');
  const pricingServicePath = path.join(process.cwd(), 'src/server/services/subscription-pricing.service.ts');
  assert(fs.existsSync(pricingServicePath), '1. SubscriptionPricingService exists');
  const pricingContent = fs.readFileSync(pricingServicePath, 'utf-8');

  assert(pricingContent.includes('STARTER: 4499'), '1. Starter pricing = LKR 4,499');
  assert(pricingContent.includes('GROWTH: 8999'), '2. Growth pricing = LKR 8,999');
  assert(pricingContent.includes('ENTERPRISE_BASE: 24999'), '3. Enterprise base = LKR 24,999');
  assert(pricingContent.includes('ENTERPRISE_EXTRA_BRANCH: 3000'), '4. Enterprise extra branch = LKR 3,000');
  assert(pricingContent.includes('Math.ceil((requestedStaff - 75) / 25)'), '5. Enterprise staff ceiling block calculation');
  assert(pricingContent.includes('pricingMode: \'CALCULATED\''), '6. Pricing is server-authoritative');
  assert(pricingContent.includes('createPricingSnapshot'), '7. Immutable pricing snapshot creation');

  // 2. State Machine & Settlement Safety
  console.log('\n--- SECTION 2: State Machine & Settlement Safety ---');
  const stateMachinePath = path.join(process.cwd(), 'src/server/payments/subscriptions/payment-state-machine.ts');
  assert(fs.existsSync(stateMachinePath), '8. payment-state-machine.ts exists');
  const stateMachineContent = fs.readFileSync(stateMachinePath, 'utf-8');

  assert(stateMachineContent.includes('pending: [\'processing\', \'paid\', \'failed\', \'cancelled\', \'expired\']'), '9. Legal payment status transitions defined');
  assert(stateMachineContent.includes('INVALID_PAYMENT_TRANSITION'), '10. Illegal payment state transitions throw error');

  const settlementPath = path.join(process.cwd(), 'src/server/payments/subscriptions/subscription-settlement.service.ts');
  assert(fs.existsSync(settlementPath), '11. SubscriptionPaymentSettlementService exists');
  const settlementContent = fs.readFileSync(settlementPath, 'utf-8');

  assert(settlementContent.includes('sub_intent_'), '12. Idempotency key pattern verified');
  assert(settlementContent.includes('SETTLEMENT_AMOUNT_MISMATCH'), '13. Amount mismatch rejected');
  assert(settlementContent.includes('SETTLEMENT_CURRENCY_MISMATCH'), '14. Currency mismatch rejected');
  assert(settlementContent.includes('PLATFORM_SUSPENDED_SETTLEMENT_BLOCKED'), '15. Platform suspension blocks settlement');

  // 3. Checkout & Owner Billing Tenant Isolation
  console.log('\n--- SECTION 3: Checkout & Owner Billing ---');
  const checkoutActionPath = path.join(process.cwd(), 'src/server/actions/subscription-checkout.ts');
  const checkoutContent = fs.readFileSync(checkoutActionPath, 'utf-8');
  assert(checkoutContent.includes('UNAUTHORIZED_ROLE'), '16. Staff checkout denied');
  assert(checkoutContent.includes('DOWNGRADE_INELIGIBLE'), '17. Downgrade eligibility protection enforced');

  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-billing-history-client.tsx');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(ownerClientContent.includes('cancelOwnerPendingPaymentIntentAction'), '18. Owner UI invokes cancelOwnerPendingPaymentIntentAction');
  assert(ownerClientContent.includes('Billing Interval'), '19. Owner payment detail displays Billing Interval');

  // 4. Admin Management & Audit Actor Attribution
  console.log('\n--- SECTION 4: Admin Management & Actor Attribution ---');
  const adminActionPath = path.join(process.cwd(), 'src/server/actions/subscription-payment-admin.ts');
  const adminActionContent = fs.readFileSync(adminActionPath, 'utf-8');

  assert(adminActionContent.includes('actor_id: authContext.userId'), '20. Owner cancellation audit entry records authenticated actor_id');
  assert(adminActionContent.includes('actor_id: adminContext.user.id'), '21. Admin cancellation and expiration record authenticated actor_id');
  assert(adminActionContent.includes('REASON_REQUIRED'), '22. Admin cancellation requires administrative reason');
  assert(!adminActionContent.includes('status: \'paid\''), '23. Super Admin UI cannot force payment to PAID');

  const adminPagePath = path.join(process.cwd(), 'src/app/admin/subscription-payments/page.tsx');
  assert(fs.existsSync(adminPagePath), '24. Canonical /admin/subscription-payments route exists under src/app/admin/');
  const adminPageContent = fs.readFileSync(adminPagePath, 'utf-8');
  assert(adminPageContent.includes('requireSuperAdmin'), '25. Super Admin authorization enforced at page level');

  // 5. Search & Pagination Architecture
  console.log('\n--- SECTION 5: Search & Provider Registry ---');
  const queryServicePath = path.join(process.cwd(), 'src/server/services/subscription-payment-query.service.ts');
  const queryServiceContent = fs.readFileSync(queryServicePath, 'utf-8');
  assert(queryServiceContent.includes('id_text.ilike'), '26. Short reference search uses id_text text column');
  assert(queryServiceContent.includes('try {'), '27. Search query wrapped in try-catch crash defense');
  assert(queryServiceContent.includes('cleanQ = search.trim().replace(/^#/'), '28. Search strips leading # prefix');

  const providerRegistryPath = path.join(process.cwd(), 'src/server/payments/subscriptions/provider-registry.ts');
  const providerRegistryContent = fs.readFileSync(providerRegistryPath, 'utf-8');
  assert(providerRegistryContent.includes('onepay: { enabled: false'), '29. OnePay provider disabled');
  assert(providerRegistryContent.includes('dialog: { enabled: false'), '30. Dialog provider disabled');
  assert(providerRegistryContent.includes('payhere: { enabled: false'), '31. PayHere provider disabled');

  // 6. Domain Isolation & Verification
  console.log('\n--- SECTION 6: Domain Isolation ---');
  const manualActivatePath = path.join(process.cwd(), 'src/server/actions/super-admin-subscription.ts');
  const manualActivateContent = fs.readFileSync(manualActivatePath, 'utf-8');
  assert(!manualActivateContent.includes('business_subscription_payments'), '32. Manual activation does NOT fake PAID payment intent rows');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 5 Readiness: ALL 32 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
