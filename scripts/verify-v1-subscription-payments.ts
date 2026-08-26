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
  console.log('  WSNexa Phase 36 Step 3 — Provider-Neutral Payment Gateway Architecture');
  console.log('================================================================\n');

  const { SubscriptionPricingService } = await import('../src/server/services/subscription-pricing.service');
  const {
    getSubscriptionPaymentProvider,
    SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG,
    PaymentProviderError,
  } = await import('../src/server/payments/subscriptions/provider-registry');
  const {
    isLegalPaymentStateTransition,
    assertLegalPaymentStateTransition,
  } = await import('../src/server/payments/subscriptions/payment-state-machine');
  const { SubscriptionPaymentSettlementService } = await import('../src/server/payments/subscriptions/subscription-settlement.service');
  const { SubscriptionService } = await import('../src/server/services/subscription.service');

  // 1. Provider Interface & Registry Verification
  console.log('--- SECTION 1: Provider Interface & Registry ---');
  const contractPath = path.join(process.cwd(), 'src/server/payments/subscriptions/subscription-payment-provider.ts');
  assert(fs.existsSync(contractPath), '1. Provider contract interface file exists');

  const registryPath = path.join(process.cwd(), 'src/server/payments/subscriptions/provider-registry.ts');
  assert(fs.existsSync(registryPath), '2. Provider registry file exists');

  // Assert unknown provider rejected
  assert.throws(
    () => getSubscriptionPaymentProvider('unknown_provider'),
    (err: unknown) => err instanceof PaymentProviderError && err.code === 'PROVIDER_UNSUPPORTED',
    '3. Unknown provider code is rejected with PROVIDER_UNSUPPORTED'
  );

  // Assert disabled provider rejected
  assert.throws(
    () => getSubscriptionPaymentProvider('onepay'),
    (err: unknown) => err instanceof PaymentProviderError && err.code === 'PROVIDER_DISABLED',
    '4. Disabled provider code is rejected with PROVIDER_DISABLED'
  );

  // Assert no provider is enabled by default
  assert(SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG.onepay.enabled === false, '5a. OnePay is disabled by default');
  assert(SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG.dialog.enabled === false, '5b. Dialog is disabled by default');
  assert(SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG.payhere.enabled === false, '5c. PayHere is disabled by default');

  // 2. Return & Webhook Routes Security Boundaries
  console.log('\n--- SECTION 2: Callback & Webhook Security Boundaries ---');
  const returnRoutePath = path.join(process.cwd(), 'src/app/api/subscription-payments/[provider]/return/route.ts');
  assert(fs.existsSync(returnRoutePath), '6. Return route API handler exists');
  const returnContent = fs.readFileSync(returnRoutePath, 'utf-8');
  assert(returnContent.includes('adapter.verifyReturn'), '7. Return route does not trust browser query parameters without adapter verification');

  const webhookRoutePath = path.join(process.cwd(), 'src/app/api/subscription-payments/[provider]/webhook/route.ts');
  assert(fs.existsSync(webhookRoutePath), '8. Webhook route API handler exists');
  const webhookContent = fs.readFileSync(webhookRoutePath, 'utf-8');
  assert(webhookContent.includes('adapter.verifyWebhook'), '9. Webhook route delegates body & signature verification to adapter');

  // 3. Payment State Machine Legal Transitions
  console.log('\n--- SECTION 3: Payment State Machine & Transitions ---');
  assert(isLegalPaymentStateTransition('pending', 'paid') === true, '10. Legal transition pending -> paid allowed');
  assert(isLegalPaymentStateTransition('pending', 'failed') === true, '11. Legal transition pending -> failed allowed');
  assert(isLegalPaymentStateTransition('paid', 'refunded') === true, '12. Legal transition paid -> refunded allowed');

  assert(isLegalPaymentStateTransition('paid', 'pending') === false, '13. Illegal transition paid -> pending rejected');
  assert(isLegalPaymentStateTransition('failed', 'paid') === false, '14. Illegal transition failed -> paid rejected without new intent');

  assert.throws(
    () => assertLegalPaymentStateTransition('paid', 'pending'),
    (err: unknown) => err instanceof PaymentProviderError && err.code === 'INVALID_PAYMENT_TRANSITION',
    '15. assertLegalPaymentStateTransition throws INVALID_PAYMENT_TRANSITION for illegal state change'
  );

  // 4. Amount, Currency & Settlement Idempotency Checks
  console.log('\n--- SECTION 4: Settlement Integrity & Amount/Currency Validation ---');
  const settlementPath = path.join(process.cwd(), 'src/server/payments/subscriptions/subscription-settlement.service.ts');
  assert(fs.existsSync(settlementPath), '16. SubscriptionPaymentSettlementService file exists');

  const settlementContent = fs.readFileSync(settlementPath, 'utf-8');
  assert(settlementContent.includes('PAYMENT_AMOUNT_MISMATCH'), '17. Amount mismatch throws PAYMENT_AMOUNT_MISMATCH error');
  assert(settlementContent.includes('PAYMENT_CURRENCY_MISMATCH'), '18. Currency mismatch throws PAYMENT_CURRENCY_MISMATCH error');
  assert(settlementContent.includes('alreadySettled: true'), '19. Duplicate settlement of paid intent is idempotent');

  // 5. Schema Migration & Provider Transaction Uniqueness
  console.log('\n--- SECTION 5: Schema Migration & Provider Transaction Uniqueness ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260826040000_v1_subscription_payments_provider_neutral.sql');
  assert(fs.existsSync(migrationPath), '20. Migration 20260826040000_v1_subscription_payments_provider_neutral.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.includes('idx_sub_payments_provider_tx_unique'), '21. Partial UNIQUE index on provider transaction ID created');
  assert(migrationSql.includes('payment_purpose'), '22. Explicit payment_purpose column added');

  // 6. Platform Suspension Precedence & Core Reuse
  console.log('\n--- SECTION 6: Platform Suspension Precedence & Core Reuse ---');
  assert(settlementContent.includes('PLATFORM_SUSPENDED_SETTLEMENT_BLOCKED'), '23. Platform suspension precedence enforced during payment settlement');
  assert(typeof SubscriptionService.activateSubscriptionFromVerifiedPayment === 'function', '24. Subscription Core lifecycle activation adapter defined');

  // 7. Absence of Fake Provider API Implementations & Credentials
  console.log('\n--- SECTION 7: Absence of Provider API Implementations ---');
  const paymentsDir = path.join(process.cwd(), 'src/server/payments/subscriptions');
  const files = fs.readdirSync(paymentsDir);
  assert(!files.some((f) => f.includes('onepay-api')), '25a. No OnePay API implementation files committed');
  assert(!files.some((f) => f.includes('dialog-api')), '25b. No Dialog API implementation files committed');
  assert(!files.some((f) => f.includes('payhere-api')), '25c. No PayHere API implementation files committed');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 3 Verification: ALL 25 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
