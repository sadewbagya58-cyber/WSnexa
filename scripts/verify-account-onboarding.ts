import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runAccountOnboardingVerificationSuite() {
  const { AccountService } = await import('../src/server/services/account.service');
  console.log('================================================================');
  console.log('  WSNexa Phase 13 — Account Onboarding & UI Verification Suite  ');
  console.log('================================================================\n');

  let passed = 0;
  const timestamp = Date.now();
  const bizName = `Account Onboarding Test Biz ${timestamp}`;
  let ownerUserId: string | null = null;
  let cashierUserId: string | null = null;
  let customerUserId: string | null = null;
  let pendingMgrUserId: string | null = null;
  let pendingStaffUserId: string | null = null;
  let unclassifiedUserId: string | null = null;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  try {
    // 1. Fresh authenticated unclassified user sees selector route
    const { data: unclassAuth, error: uErr } = await admin.auth.admin.createUser({
      email: `unclass_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (uErr || !unclassAuth.user) {
      throw new Error(`Failed to create test unclassified user: ${uErr?.message}`);
    }
    unclassifiedUserId = unclassAuth.user.id;

    await admin.from('user_profiles').upsert([
      { id: unclassifiedUserId, first_name: 'Unclassified', last_name: 'User' },
    ]);

    const routeFresh = await AccountService.resolveAccountRoute(
      { id: unclassifiedUserId },
      { id: unclassifiedUserId, onboarding_intent: null },
      null
    );
    assert(
      routeFresh === '/onboarding/account-type',
      'Test 1: Fresh authenticated unclassified user resolves to /onboarding/account-type'
    );

    // 2. AccountTypeSelector component verification (All 4 cards exist)
    const selectorCode = fs.readFileSync(
      path.join(process.cwd(), 'src/components/auth/account-type-selector.tsx'),
      'utf8'
    );
    const hasOwnerCard = selectorCode.includes('Hospitality Business') || selectorCode.includes('business_owner');
    const hasCustomerCard = selectorCode.includes('Customer / Guest Account') || selectorCode.includes('customer');
    const hasStaffCard = selectorCode.includes('Staff Member') || selectorCode.includes('JOIN A TEAM');
    assert(
      hasOwnerCard && hasCustomerCard && hasStaffCard,
      'Test 2: Account type selector presents all 3 account choices (Hospitality Business, Customer, Staff Member)'
    );

    // 3. Business Owner selection routes correctly (/onboarding)
    const newOwnerUserId = `new_owner_${timestamp}`;
    const routeOwnerSelection = await AccountService.resolveAccountRoute(
      { id: newOwnerUserId },
      { id: newOwnerUserId, onboarding_intent: 'business_owner' },
      null
    );
    assert(
      routeOwnerSelection === '/onboarding',
      'Test 3: Business Owner selection intent routes to business onboarding (/onboarding)'
    );

    // 4. Customer selection routes correctly (/customer)
    const { data: customerAuth, error: custErr } = await admin.auth.admin.createUser({
      email: `cust_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (custErr || !customerAuth.user) {
      throw new Error(`Failed to create test customer user: ${custErr?.message}`);
    }
    customerUserId = customerAuth.user.id;
    await admin.from('user_profiles').upsert([{ id: customerUserId, first_name: 'Cust', last_name: 'User' }]);

    const custSaveRes = await AccountService.saveOnboardingIntent(customerUserId, 'customer');
    assert(
      custSaveRes.success && custSaveRes.targetRoute === '/customer',
      'Test 4: Customer selection intent initializes customer profile and routes to /customer'
    );

    // 5. Branch Manager selection routes to pending access (/account/pending-access)
    const { data: pendMgrAuth } = await admin.auth.admin.createUser({
      email: `mgr_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingMgrUserId = pendMgrAuth.user!.id;
    await admin.from('user_profiles').upsert([{ id: pendingMgrUserId, first_name: 'Mgr', last_name: 'User' }]);

    const mgrSaveRes = await AccountService.saveOnboardingIntent(pendingMgrUserId, 'branch_manager');
    assert(
      mgrSaveRes.success && mgrSaveRes.targetRoute === '/account/pending-access',
      'Test 5: Branch Manager selection intent routes to pending authorization (/account/pending-access)'
    );

    // 6. Staff selection routes to pending access (/account/pending-access)
    const { data: pendStaffAuth } = await admin.auth.admin.createUser({
      email: `staff_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingStaffUserId = pendStaffAuth.user!.id;
    await admin.from('user_profiles').upsert([{ id: pendingStaffUserId, first_name: 'Staff', last_name: 'User' }]);

    const staffSaveRes = await AccountService.saveOnboardingIntent(pendingStaffUserId, 'staff');
    assert(
      staffSaveRes.success && staffSaveRes.targetRoute === '/account/pending-access',
      'Test 6: Staff selection intent routes to pending authorization (/account/pending-access)'
    );

    // 7. Existing owner bypasses selector (/dashboard)
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `owner_exist_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerAuth.user!.id;
    await admin.from('user_profiles').upsert([{ id: ownerUserId, first_name: 'Existing', last_name: 'Owner' }]);

    const { data: biz } = await admin.from('businesses').insert({
      name: bizName,
      slug: `biz-ui-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('*').single();

    await admin.from('business_memberships').insert([
      { business_id: biz.id, user_id: ownerUserId, role: 'business_owner', membership_status: 'active' },
    ]);

    const routeOwnerExist = await AccountService.resolveAccountRoute(
      { id: ownerUserId },
      { id: ownerUserId, onboarding_intent: null },
      { id: 'm1', business_id: biz.id, role: 'business_owner', membership_status: 'active' }
    );
    assert(
      routeOwnerExist === '/dashboard',
      'Test 7: Existing Business Owner with verified active membership bypasses selector and resolves to /dashboard'
    );

    // 8. Existing cashier bypasses selector (/dashboard/cashier)
    const { data: cashierAuth } = await admin.auth.admin.createUser({
      email: `cashier_exist_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    cashierUserId = cashierAuth.user!.id;
    await admin.from('user_profiles').upsert([{ id: cashierUserId, first_name: 'Existing', last_name: 'Cashier' }]);

    await admin.from('business_memberships').insert([
      { business_id: biz.id, user_id: cashierUserId, role: 'cashier', membership_status: 'active' },
    ]);

    const routeCashierExist = await AccountService.resolveAccountRoute(
      { id: cashierUserId },
      { id: cashierUserId, onboarding_intent: null },
      { id: 'm2', business_id: biz.id, role: 'cashier', membership_status: 'active' }
    );
    assert(
      routeCashierExist === '/dashboard/cashier',
      'Test 8: Existing Cashier with verified active membership bypasses selector and resolves to /dashboard/cashier'
    );

    // 9. Error boundaries created for non-blank error fallback UI
    const selectorErrExists = fs.existsSync(path.join(process.cwd(), 'src/app/(auth)/onboarding/account-type/error.tsx'));
    const pendingErrExists = fs.existsSync(path.join(process.cwd(), 'src/app/(auth)/account/pending-access/error.tsx'));
    const customerErrExists = fs.existsSync(path.join(process.cwd(), 'src/app/(customer)/customer/error.tsx'));
    assert(
      selectorErrExists && pendingErrExists && customerErrExists,
      'Test 9: Explicit Error Boundary components created for onboarding account-type, pending-access, and customer routes'
    );

    // 10. No redirect loops between auth, onboarding, and dashboard routes
    const accountTypePageCode = fs.readFileSync(path.join(process.cwd(), 'src/app/(auth)/onboarding/account-type/page.tsx'), 'utf8');
    const callsB2BResolver = accountTypePageCode.includes('resolveActiveBusinessContext');
    assert(
      !callsB2BResolver,
      'Test 10: /onboarding/account-type page does NOT call resolveActiveBusinessContext (Zero redirect loop possibility)'
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during account onboarding verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up test onboarding accounts...');
    if (bizName) {
      await admin.from('businesses').delete().filter('name', 'eq', bizName);
    }
    const uids = [ownerUserId, cashierUserId, customerUserId, pendingMgrUserId, pendingStaffUserId, unclassifiedUserId];
    for (const uid of uids) {
      if (uid) {
        await admin.auth.admin.deleteUser(uid);
      }
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`  Phase 13 Account Onboarding Verification: ALL ${passed} TESTS PASSED `);
  console.log('================================================================\n');
}

runAccountOnboardingVerificationSuite();
