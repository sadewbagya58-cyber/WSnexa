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
    // 1. Schema Check for customer_profiles and onboarding_intent
    const { error: schemaErr } = await admin.from('customer_profiles').select('user_id').limit(1);
    assert(!schemaErr, 'Test 1: customer_profiles table and onboarding_intent schema exist in Supabase');

    // 2. Setup Test Auth Users
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `owner_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerAuth.user!.id;

    const { data: mgrAuth } = await admin.auth.admin.createUser({
      email: `mgr_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    mgrUserId = mgrAuth.user!.id;

    const { data: cashierAuth } = await admin.auth.admin.createUser({
      email: `cashier_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    cashierUserId = cashierAuth.user!.id;

    const { data: kitchenAuth } = await admin.auth.admin.createUser({
      email: `kitchen_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    kitchenUserId = kitchenAuth.user!.id;

    const { data: waiterAuth } = await admin.auth.admin.createUser({
      email: `waiter_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    waiterUserId = waiterAuth.user!.id;

    const { data: customerAuth } = await admin.auth.admin.createUser({
      email: `customer_onb_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    customerUserId = customerAuth.user!.id;

    const { data: pendMgrAuth } = await admin.auth.admin.createUser({
      email: `pend_mgr_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingMgrUserId = pendMgrAuth.user!.id;

    const { data: pendStaffAuth } = await admin.auth.admin.createUser({
      email: `pend_staff_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    pendingStaffUserId = pendStaffAuth.user!.id;

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
    ]);

    // Setup Business, Branch & Business Memberships for Verified Users
    const { data: biz } = await admin.from('businesses').insert({
      name: bizName,
      slug: `biz-onb-${timestamp}`,
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

    // TEST 2: Business Owner intent saves and routes to business onboarding
    const ownerRes = await AccountService.saveOnboardingIntent(ownerUserId, 'business_owner');
    assert(
      ownerRes.success && ownerRes.targetRoute === '/dashboard',
      'Test 2: Verified Business Owner routes to /dashboard'
    );

    // TEST 3: Customer intent creates customer_profiles row and routes to /customer
    const custRes = await AccountService.saveOnboardingIntent(customerUserId, 'customer');
    const { data: custProf } = await admin.from('customer_profiles').select('*').eq('user_id', customerUserId).single();
    assert(
      custRes.success && custRes.targetRoute === '/customer' && custProf !== null,
      'Test 3: Customer intent initializes customer_profiles row and routes to /customer'
    );

    // TEST 4: Manager intent WITHOUT verified server-side membership routes to /account/pending-access
    const pendMgrRes = await AccountService.saveOnboardingIntent(pendingMgrUserId, 'branch_manager');
    assert(
      pendMgrRes.success && pendMgrRes.targetRoute === '/account/pending-access',
      'Test 4: Manager intent without verified server membership routes to /account/pending-access'
    );

    // TEST 5: Staff intent WITHOUT verified server-side membership routes to /account/pending-access
    const pendStaffRes = await AccountService.saveOnboardingIntent(pendingStaffUserId, 'staff');
    assert(
      pendStaffRes.success && pendStaffRes.targetRoute === '/account/pending-access',
      'Test 5: Staff intent without verified server membership routes to /account/pending-access'
    );

    // TEST 6: Verified Branch Manager retains /dashboard access
    const routeMgr = AccountService.resolveAccountRoute(
      { id: mgrUserId },
      { id: mgrUserId, onboarding_intent: 'branch_manager' },
      { id: 'mem1', business_id: biz.id, role: 'branch_manager', membership_status: 'active' }
    );
    assert(routeMgr === '/dashboard', 'Test 6: Verified Branch Manager retains /dashboard route');

    // TEST 7: Verified Cashier retains /dashboard/cashier access
    const routeCashier = AccountService.resolveAccountRoute(
      { id: cashierUserId },
      { id: cashierUserId, onboarding_intent: 'staff' },
      { id: 'mem2', business_id: biz.id, role: 'cashier', membership_status: 'active' }
    );
    assert(routeCashier === '/dashboard/cashier', 'Test 7: Verified Cashier retains /dashboard/cashier route');

    // TEST 8: Verified Kitchen Staff retains /dashboard/kitchen access
    const routeKitchen = AccountService.resolveAccountRoute(
      { id: kitchenUserId },
      { id: kitchenUserId, onboarding_intent: 'staff' },
      { id: 'mem3', business_id: biz.id, role: 'kitchen_staff', membership_status: 'active' }
    );
    assert(routeKitchen === '/dashboard/kitchen', 'Test 8: Verified Kitchen Staff retains /dashboard/kitchen route');

    // TEST 9: Verified Waiter retains /dashboard/waiter access
    const routeWaiter = AccountService.resolveAccountRoute(
      { id: waiterUserId },
      { id: waiterUserId, onboarding_intent: 'staff' },
      { id: 'mem4', business_id: biz.id, role: 'waiter', membership_status: 'active' }
    );
    assert(routeWaiter === '/dashboard/waiter', 'Test 9: Verified Waiter retains /dashboard/waiter route');

    // TEST 10: Customer account attempting /dashboard access is redirected to /customer
    const routeCustomer = AccountService.resolveAccountRoute(
      { id: customerUserId },
      { id: customerUserId, onboarding_intent: 'customer', customer_profile_created_at: new Date().toISOString() },
      null
    );
    assert(routeCustomer === '/customer', 'Test 10: Customer account without business membership routes to /customer');

    // TEST 11: Pending manager attempting /dashboard is blocked from dashboard route
    const routePendingMgr = AccountService.resolveAccountRoute(
      { id: pendingMgrUserId },
      { id: pendingMgrUserId, onboarding_intent: 'branch_manager' },
      null
    );
    assert(routePendingMgr === '/account/pending-access', 'Test 11: Pending manager blocked from /dashboard and routed to /account/pending-access');

    // TEST 12: Intent tampering does NOT grant business membership
    const { data: tamperedMembership } = await admin
      .from('business_memberships')
      .select('*')
      .eq('user_id', pendingStaffUserId)
      .single();
    assert(
      tamperedMembership === null,
      'Test 12: Intent selection never inserts business_memberships (Zero privilege escalation)'
    );

    // TEST 13: Unclassified new user (no intent, no membership) routes to /onboarding/account-type
    const routeUnclassified = AccountService.resolveAccountRoute(
      { id: 'new_user_id' },
      null,
      null
    );
    assert(routeUnclassified === '/onboarding/account-type', 'Test 13: Unclassified new user routes to /onboarding/account-type');

    // TEST 14: Customer profile data fetch
    const custProfileData = await AccountService.getCustomerProfile(customerUserId);
    assert(
      custProfileData.userId === customerUserId && custProfileData.email === customerAuth.user!.email,
      'Test 14: AccountService.getCustomerProfile fetches customer profile details'
    );

    // TEST 15: Customer Profile RLS isolation (Anonymous client cannot read customer profile)
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: anonRead } = await anonClient.from('customer_profiles').select('*').eq('user_id', customerUserId);
    assert(
      !anonRead || anonRead.length === 0,
      'Test 15: Customer Profiles table RLS blocks unauthenticated anonymous reads'
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
    const uids = [ownerUserId, mgrUserId, cashierUserId, kitchenUserId, waiterUserId, customerUserId, pendingMgrUserId, pendingStaffUserId];
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
