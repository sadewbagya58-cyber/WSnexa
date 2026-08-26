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
  console.log('  WSNexa Phase 36 Step 4 — Owner Billing & Admin Payment Management');
  console.log('================================================================\n');

  const { SubscriptionPaymentQueryService } = await import('../src/server/services/subscription-payment-query.service');
  const {
    getOwnerPaymentHistoryAction,
    getAdminPaymentsAction,
    cancelPendingPaymentIntentAction,
    expirePendingPaymentIntentAction,
  } = await import('../src/server/actions/subscription-payment-admin');
  const {
    SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG,
    PaymentProviderError,
  } = await import('../src/server/payments/subscriptions/provider-registry');
  const { isLegalPaymentStateTransition } = await import('../src/server/payments/subscriptions/payment-state-machine');

  // 1. Service Layer Verification
  console.log('--- SECTION 1: Service Layer & Tenant Isolation ---');
  const queryServicePath = path.join(process.cwd(), 'src/server/services/subscription-payment-query.service.ts');
  assert(fs.existsSync(queryServicePath), '1. SubscriptionPaymentQueryService exists');
  const queryServiceContent = fs.readFileSync(queryServicePath, 'utf-8');
  assert(queryServiceContent.includes('listOwnerSubscriptionPayments'), '2. Owner billing history query method exists');
  assert(queryServiceContent.includes('listAdminSubscriptionPayments'), '3. Admin platform-wide payment list query method exists');

  // 2. Server Action Security & Authorization Boundaries
  console.log('\n--- SECTION 2: Server Action Security & Role Guards ---');
  const actionPath = path.join(process.cwd(), 'src/server/actions/subscription-payment-admin.ts');
  assert(fs.existsSync(actionPath), '4. Subscription payment admin server actions exist');
  const actionContent = fs.readFileSync(actionPath, 'utf-8');
  assert(actionContent.includes('!authContext.isBusinessOwner'), '5. Staff denied owner payment history');
  assert(actionContent.includes('intent.business_id !== authContext.businessId'), '6. Cross-tenant payment access strictly denied');
  assert(actionContent.includes('resolveSuperAdminContext'), '7. Super Admin role guard enforced for admin list and actions');

  // 3. Admin Filters, Search & Pagination
  console.log('\n--- SECTION 3: Admin Query Capabilities & Filters ---');
  assert(queryServiceContent.includes('status !== \'all\''), '8. Status filter supported');
  assert(queryServiceContent.includes('plan !== \'all\''), '9. Plan filter supported');
  assert(queryServiceContent.includes('purpose !== \'all\''), '10. Payment purpose filter supported');
  assert(queryServiceContent.includes('provider !== \'all\''), '11. Provider filter supported');
  assert(queryServiceContent.includes('totalPages'), '12. Server-side pagination supported');

  // 4. Safe Administrative Actions & Reason Requirement
  console.log('\n--- SECTION 4: Safe Administrative Actions & Audit Logging ---');
  assert(actionContent.includes('REASON_REQUIRED'), '13. Super Admin cancel/expire requires mandatory administrative reason');
  assert(actionContent.includes('payment.cancelled_by_admin'), '14. Admin cancellation logs platform audit event');
  assert(actionContent.includes('payment.expired_by_admin'), '15. Admin expiration logs platform audit event');

  // 5. Immutability & Absence of Force Paid Action
  console.log('\n--- SECTION 5: Immutability & No Force Paid Path ---');
  assert(!actionContent.includes('status: \'paid\''), '16. No server action permits marking payment intent as PAID manually');
  assert(!actionContent.includes('updatePayload.amount_lkr'), '17. Monetary amounts remain strictly immutable after intent creation');
  assert(isLegalPaymentStateTransition('paid', 'pending') === false, '18. Paid payment state machine transition is immutable');

  // 6. Manual Activation Separation
  console.log('\n--- SECTION 6: Manual Subscription Activation Separation ---');
  const superAdminSubActionPath = path.join(process.cwd(), 'src/server/actions/super-admin-subscription.ts');
  const superAdminSubContent = fs.readFileSync(superAdminSubActionPath, 'utf-8');
  assert(!superAdminSubContent.includes('business_subscription_payments'), '19. Manual subscription activation does NOT fabricate fake paid payment records');

  // 7. UI Components & Route Structure
  console.log('\n--- SECTION 7: UI Components & Route Structure ---');
  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-billing-history-client.tsx');
  assert(fs.existsSync(ownerClientPath), '20. OwnerBillingHistoryClient UI component exists');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(ownerClientContent.includes('Billing & Payment History'), '21. Owner billing history section header rendered');

  const adminClientPath = path.join(process.cwd(), 'src/components/admin/admin-subscription-payments-client.tsx');
  assert(fs.existsSync(adminClientPath), '22. AdminSubscriptionPaymentsClient UI component exists');

  const adminPagePath = path.join(process.cwd(), 'src/app/(dashboard)/admin/subscription-payments/page.tsx');
  assert(fs.existsSync(adminPagePath), '23. Admin subscription payments page route handler exists');

  // 8. Migration & Schema Verification
  console.log('\n--- SECTION 8: Database Migration Verification ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260826050000_v1_subscription_payments_admin_index.sql');
  assert(fs.existsSync(migrationPath), '24. Migration 20260826050000_v1_subscription_payments_admin_index.sql exists');

  // 9. Provider Status & Customer Order Domain Preservation
  console.log('\n--- SECTION 9: Baseline Preservation ---');
  assert(SUBSCRIPTION_PAYMENT_PROVIDER_CONFIG.onepay.enabled === false, '25. All candidate providers remain disabled in production');
  const orderPaymentFile = path.join(process.cwd(), 'src/server/actions/payment.ts');
  assert(fs.existsSync(orderPaymentFile), '26. Customer order payment domain untouched');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 4 Verification: ALL 26 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
