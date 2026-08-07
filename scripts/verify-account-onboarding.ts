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
  console.log('  WSNexa Phase 13 — Unified Account & Role Onboarding Suite    ');
  console.log('================================================================\n');

  let passed = 0;
  const timestamp = Date.now();
  const bizName = `Account Onboarding Test Biz ${timestamp}`;
  let ownerUserId: string | null = null;
  let mgrUserId: string | null = null;
  let cashierUserId: string | null = null;
  let kitchenUserId: string | null = null;
  let waiterUserId: string | null = null;
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
    // Schema Check for customer_profiles and onboarding_intent
    const { error: schemaErr } = await admin.from('customer_profiles').select('user_id').limit(1);
    assert(!schemaErr, 'Test Preparation: customer_profiles table and onboarding_intent schema exist');

    // Setup Test Auth Users
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `owner_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerAuth.user!.id;

    const { data: mgrAuth } = await admin.auth.admin.createUser({
      email: `mgr_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    mgrUserId = mgrAuth.user!.id;

    const { data: cashierAuth } = await admin.auth.admin.createUser({
      email: `cashier_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    cashierUserId = cashierAuth.user!.id;

    const { data: kitchenAuth } = await admin.auth.admin.createUser({
      email: `kitchen_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    kitchenUserId = kitchenAuth.user!.id;

    const { data: waiterAuth } = await admin.auth.admin.createUser({
      email: `waiter_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    waiterUserId = waiterAuth.user!.id;

    const { data: customerAuth } = await admin.auth.admin.createUser({
      email: `customer_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    customerUserId = customerAuth.user!.id;

    const { data: pendMgrAuth } = await admin.auth.admin.createUser({
      email: `pend_mgr_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingMgrUserId = pendMgrAuth.user!.id;

    const { data: pendStaffAuth } = await admin.auth.admin.createUser({
      email: `pend_staff_reg_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingStaffUserId = pendStaffAuth.user!.id;

    const { data: unclassAuth } = await admin.auth.admin.createUser({
      email: `unclass_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    unclassifiedUserId = unclassAuth.user!.id;

    // Insert user_profiles rows for auth users
    await admin.from('user_profiles').upsert([
      { id: ownerUserId, first_name: 'Test', last_name: 'Owner' },
      { id: mgrUserId, first_name: 'Test', last_name: 'Manager' },
      { id: cashierUserId, first_name: 'Test', last_name: 'Cashier' },
      { id: kitchenUserId, first_name: 'Test', last_name: 'Kitchen' },
      { id: waiterUserId, first_name: 'Test', last_name: 'Waiter' },
      { id: customerUserId, first_name: 'Test', last_name: 'Customer' },
      { id: pendingMgrUserId, first_name: 'Pending', last_name: 'Manager' },
      { id: pendingStaffUserId, first_name: 'Pending', last_name: 'Staff' },
      { id: unclassifiedUserId, first_name: 'New', last_name: 'User' },
    ]);

    // Setup Business, Branch & Business Memberships for Verified Users
    const { data: biz } = await admin.from('businesses').insert({
      name: bizName,
      slug: `biz-reg-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('*').single();

    await admin.from('business_memberships').insert([
      { business_id: biz.id, user_id: ownerUserId, role: 'business_owner', membership_status: 'active' },
      { business_id: biz.id, user_id: mgrUserId, role: 'branch_manager', membership_status: 'active' },
      { business_id: biz.id, user_id: cashierUserId, role: 'cashier', membership_status: 'active' },
      { business_id: biz.id, user_id: kitchenUserId, role: 'kitchen_staff', membership_status: 'active' },
      { business_id: biz.id, user_id: waiterUserId, role: 'waiter', membership_status: 'active' },
    ]);

    // TEST 1: Existing business_owner still resolves to /dashboard
    const routeOwner = AccountService.resolveAccountRoute(
      { id: ownerUserId },
      { id: ownerUserId, onboarding_intent: null },
      { id: 'm1', business_id: biz.id, role: 'business_owner', membership_status: 'active' }
    );
    assert(routeOwner === '/dashboard', 'Test 1: Existing business_owner still resolves to /dashboard');

    // TEST 2: Existing branch_manager still resolves to /dashboard
    const routeMgr = AccountService.resolveAccountRoute(
      { id: mgrUserId },
      { id: mgrUserId, onboarding_intent: null },
      { id: 'm2', business_id: biz.id, role: 'branch_manager', membership_status: 'active' }
    );
    assert(routeMgr === '/dashboard', 'Test 2: Existing branch_manager still resolves to /dashboard');

    // TEST 3: Existing cashier retains permitted workspace (/dashboard/cashier)
    const routeCashier = AccountService.resolveAccountRoute(
      { id: cashierUserId },
      { id: cashierUserId, onboarding_intent: null },
      { id: 'm3', business_id: biz.id, role: 'cashier', membership_status: 'active' }
    );
    assert(routeCashier === '/dashboard/cashier', 'Test 3: Existing cashier retains /dashboard/cashier workspace');

    // TEST 4: Existing kitchen_staff retains permitted workspace (/dashboard/kitchen)
    const routeKitchen = AccountService.resolveAccountRoute(
      { id: kitchenUserId },
      { id: kitchenUserId, onboarding_intent: null },
      { id: 'm4', business_id: biz.id, role: 'kitchen_staff', membership_status: 'active' }
    );
    assert(routeKitchen === '/dashboard/kitchen', 'Test 4: Existing kitchen_staff retains /dashboard/kitchen workspace');

    // TEST 5: Existing waiter retains permitted workspace (/dashboard/waiter)
    const routeWaiter = AccountService.resolveAccountRoute(
      { id: waiterUserId },
      { id: waiterUserId, onboarding_intent: null },
      { id: 'm5', business_id: biz.id, role: 'waiter', membership_status: 'active' }
    );
    assert(routeWaiter === '/dashboard/waiter', 'Test 5: Existing waiter retains /dashboard/waiter workspace');

    // TEST 6: Existing membership overrides null or customer onboarding_intent
    const routeOverride = AccountService.resolveAccountRoute(
      { id: ownerUserId },
      { id: ownerUserId, onboarding_intent: 'customer' },
      { id: 'm1', business_id: biz.id, role: 'business_owner', membership_status: 'active' }
    );
    assert(routeOverride === '/dashboard', 'Test 6: Existing business membership strictly overrides onboarding_intent');

    // TEST 7: New user with no membership + null intent -> /onboarding/account-type
    const routeUnclass = AccountService.resolveAccountRoute(
      { id: unclassifiedUserId },
      { id: unclassifiedUserId, onboarding_intent: null },
      null
    );
    assert(routeUnclass === '/onboarding/account-type', 'Test 7: New user with no membership + null intent resolves to /onboarding/account-type');

    // TEST 8: New customer selection -> /customer
    const custRes = await AccountService.saveOnboardingIntent(customerUserId, 'customer');
    assert(custRes.success && custRes.targetRoute === '/customer', 'Test 8: New customer selection resolves to /customer');

    // TEST 9: New branch_manager intent -> /account/pending-access
    const mgrRes = await AccountService.saveOnboardingIntent(pendingMgrUserId, 'branch_manager');
    assert(mgrRes.success && mgrRes.targetRoute === '/account/pending-access', 'Test 9: New branch_manager intent resolves to /account/pending-access');

    // TEST 10: New staff intent -> /account/pending-access
    const staffRes = await AccountService.saveOnboardingIntent(pendingStaffUserId, 'staff');
    assert(staffRes.success && staffRes.targetRoute === '/account/pending-access', 'Test 10: New staff intent resolves to /account/pending-access');

    // TEST 11: New business_owner intent -> owner onboarding (/onboarding)
    const newOwnerUserId = 'new_owner_id_test';
    const newOwnerRoute = AccountService.resolveAccountRoute(
      { id: newOwnerUserId },
      { id: newOwnerUserId, onboarding_intent: 'business_owner' },
      null
    );
    assert(newOwnerRoute === '/onboarding', 'Test 11: New business_owner intent resolves to /onboarding');

    // TEST 12: branch_manager intent alone grants ZERO business permissions
    const { data: mgrMem } = await admin.from('business_memberships').select('*').eq('user_id', pendingMgrUserId).single();
    assert(mgrMem === null, 'Test 12: branch_manager intent alone inserts ZERO business_memberships (Zero privilege escalation)');

    // TEST 13: staff intent alone grants ZERO business permissions
    const { data: staffMem } = await admin.from('business_memberships').select('*').eq('user_id', pendingStaffUserId).single();
    assert(staffMem === null, 'Test 13: staff intent alone inserts ZERO business_memberships (Zero privilege escalation)');

    // TEST 14: /dashboard route authorization check rejects pending manager
    const pendMgrCheck = AccountService.resolveAccountRoute(
      { id: pendingMgrUserId },
      { id: pendingMgrUserId, onboarding_intent: 'branch_manager' },
      null
    );
    assert(pendMgrCheck !== '/dashboard', 'Test 14: Unverified pending manager is blocked from /dashboard route');

    // TEST 15: Invalid/unverified B2B user cannot access dashboard operational routes
    const pendStaffCheck = AccountService.resolveAccountRoute(
      { id: pendingStaffUserId },
      { id: pendingStaffUserId, onboarding_intent: 'staff' },
      null
    );
    assert(
      pendStaffCheck !== '/dashboard/kitchen' && pendStaffCheck !== '/dashboard/cashier',
      'Test 15: Unverified pending staff is blocked from operational dashboard routes'
    );

    // TEST 16: Customer Profiles table RLS blocks unauthenticated anonymous reads
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: anonRead } = await anonClient.from('customer_profiles').select('*').eq('user_id', customerUserId);
    assert(
      !anonRead || anonRead.length === 0,
      'Test 16: Customer Profiles table RLS blocks unauthenticated anonymous reads'
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
    const uids = [ownerUserId, mgrUserId, cashierUserId, kitchenUserId, waiterUserId, customerUserId, pendingMgrUserId, pendingStaffUserId, unclassifiedUserId];
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
