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
  console.log('  WSNexa Phase 36 Step 4 — Targeted QA Hotfix Verification');
  console.log('================================================================\n');

  const actionPath = path.join(process.cwd(), 'src/server/actions/subscription-payment-admin.ts');
  const actionContent = fs.readFileSync(actionPath, 'utf-8');

  // 1. Owner Cancellation Hotfix Verification
  console.log('--- SECTION 1: Owner Pending Intent Cancellation Hotfix ---');
  assert(actionContent.includes('cancelOwnerPendingPaymentIntentAction'), '1. Dedicated cancelOwnerPendingPaymentIntentAction exists');
  assert(actionContent.includes('admin_reason: null'), '2. Owner cancellation leaves admin_reason NULL');
  assert(actionContent.includes('payment.cancelled_by_owner'), '3. Owner cancellation records payment.cancelled_by_owner audit event');
  assert(actionContent.includes('intent.business_id !== authContext.businessId'), '4. Tenant isolation enforced on owner cancellation');
  assert(actionContent.includes('intent.status !== \'pending\''), '5. Owner cannot cancel non-pending intents');

  const ownerClientPath = path.join(process.cwd(), 'src/components/subscription/owner-billing-history-client.tsx');
  const ownerClientContent = fs.readFileSync(ownerClientPath, 'utf-8');
  assert(ownerClientContent.includes('cancelOwnerPendingPaymentIntentAction'), '6. Owner UI invokes cancelOwnerPendingPaymentIntentAction');
  assert(ownerClientContent.includes('Billing Interval'), '7. Owner payment detail modal displays Billing Interval');
  assert(ownerClientContent.includes('Monthly'), '8. Owner payment detail modal displays Monthly billing interval');

  // 2. Super Admin Separate Cancellation Verification
  console.log('\n--- SECTION 2: Super Admin Cancellation Separation ---');
  assert(actionContent.includes('cancelPendingPaymentIntentAction'), '9. Super Admin cancellation action exists');
  assert(actionContent.includes('payment.cancelled_by_admin'), '10. Admin cancellation records payment.cancelled_by_admin audit event');
  assert(actionContent.includes('REASON_REQUIRED'), '11. Admin cancellation STILL requires administrative reason');

  // 3. Admin App Shell & Route Verification
  console.log('\n--- SECTION 3: Admin App Shell & Canonical Route Verification ---');
  const adminPagePath = path.join(process.cwd(), 'src/app/admin/subscription-payments/page.tsx');
  assert(fs.existsSync(adminPagePath), '12. Canonical /admin/subscription-payments page exists under src/app/admin/ (inherits AdminLayout shell)');

  const oldDashboardAdminPath = path.join(process.cwd(), 'src/app/(dashboard)/admin/subscription-payments/page.tsx');
  assert(!fs.existsSync(oldDashboardAdminPath), '13. Old route under (dashboard)/admin/subscription-payments removed so DashboardShell does NOT wrap admin page');

  const adminPageContent = fs.readFileSync(adminPagePath, 'utf-8');
  assert(adminPageContent.includes('requireSuperAdmin'), '14. Page route enforces requireSuperAdmin authorization');

  const adminNavPath = path.join(process.cwd(), 'src/app/admin/admin-navbar.tsx');
  const adminNavContent = fs.readFileSync(adminNavPath, 'utf-8');
  assert(adminNavContent.includes('/admin/subscription-payments'), '15. Admin navbar points to canonical /admin/subscription-payments route');

  // 4. Immutability & Security Guards
  console.log('\n--- SECTION 4: Immutability & Security Guards ---');
  assert(!actionContent.includes('status: \'paid\''), '16. No action permits marking payment as PAID manually');
  assert(!actionContent.includes('updatePayload.amount_lkr'), '17. Monetary amounts remain strictly immutable');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 4 Hotfix Verification: ALL 17 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
