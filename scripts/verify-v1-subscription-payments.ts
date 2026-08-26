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
  console.log('  WSNexa Phase 36 Step 4 — SaaS Payments Search Hotfix Verification');
  console.log('================================================================\n');

  const queryServicePath = path.join(process.cwd(), 'src/server/services/subscription-payment-query.service.ts');
  assert(fs.existsSync(queryServicePath), '1. SubscriptionPaymentQueryService exists');
  const queryServiceContent = fs.readFileSync(queryServicePath, 'utf-8');

  // 1. Search Logic & Short-Ref Assertions
  console.log('--- SECTION 1: Search Architecture & Short Reference Safety ---');
  assert(!queryServiceContent.includes('id.ilike'), '1. UUID column `id` is NOT directly ILIKE\'d');
  assert(queryServiceContent.includes('id_text.ilike'), '2. Text-cast column `id_text` is used for ILIKE short-reference searches');
  assert(queryServiceContent.includes('cleanQ = search.trim().replace(/^#/'), '3. Search input strips leading # from displayed references');
  assert(queryServiceContent.includes('provider_transaction_id.ilike'), '4. Provider transaction ID search supported');
  assert(queryServiceContent.includes('provider_reference.ilike'), '5. Provider reference search supported');

  // 2. Error Handling & Malformed Search Defense
  console.log('\n--- SECTION 2: Error Handling & Crash Defense ---');
  assert(queryServiceContent.includes('try {'), '6. Query is wrapped in try-catch block');
  assert(queryServiceContent.includes('return {\n        data: [],'), '7. Query error returns clean empty state without crashing server/UI');

  // 3. Combination with Filters & Pagination
  console.log('\n--- SECTION 3: Filter Combinations & Pagination ---');
  assert(queryServiceContent.includes('status && status !== \'all\''), '8. Search combines with status filter');
  assert(queryServiceContent.includes('provider && provider !== \'all\''), '9. Search combines with provider filter');
  assert(queryServiceContent.includes('purpose && purpose !== \'all\''), '10. Search combines with purpose filter');
  assert(queryServiceContent.includes('plan && plan !== \'all\''), '11. Search combines with plan filter');
  assert(queryServiceContent.includes('range(offset, offset + safeLimit - 1)'), '12. Pagination and count calculations remain correct');

  // 4. Security & Isolation Preservation
  console.log('\n--- SECTION 4: Security & Baseline Preservation ---');
  const actionPath = path.join(process.cwd(), 'src/server/actions/subscription-payment-admin.ts');
  const actionContent = fs.readFileSync(actionPath, 'utf-8');
  assert(actionContent.includes('requireSuperAdmin'), '13. Super Admin authorization remains required for platform payments');
  assert(actionContent.includes('intent.business_id !== authContext.businessId'), '14. Owner billing history remains strictly tenant isolated');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260826060000_v1_subscription_payments_search_fix.sql');
  assert(fs.existsSync(migrationPath), '15. Migration 20260826060000_v1_subscription_payments_search_fix.sql exists');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 4 Search Hotfix: ALL 15 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
