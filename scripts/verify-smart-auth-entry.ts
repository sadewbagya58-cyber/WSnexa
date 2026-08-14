import * as path from 'path';
import * as fs from 'fs';

// Bypass server-only guard
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
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function runSmartAuthEntryVerification() {
  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { AccountService } = await import('../src/server/services/account.service');

  console.log('================================================================');
  console.log('  WSNexa Smart Auth Entry & Landing Page Verification Suite  ');
  console.log('================================================================\n');

  const admin = createAdminClient();
  const timestamp = Date.now();
  const emailDomain = `auth_entry_${timestamp}@test.com`;

  let passed = 0;
  let total = 0;

  function assertTest(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      process.exitCode = 1;
    }
  }

  let ownerUserId: string | null = null;
  let managerUserId: string | null = null;
  let waiterUserId: string | null = null;
  let kitchenUserId: string | null = null;
  let cashierUserId: string | null = null;
  let customUserId: string | null = null;
  let suspendedUserId: string | null = null;

    let bizId: string | null = null;
    let customRoleId: string | null = null;

  try {
    // Helper to create auth user
    async function createTestUser(emailPrefix: string) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `${emailPrefix}.${emailDomain}`,
        password: 'TestPassword123!',
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
      return data.user.id;
    }

    ownerUserId = await createTestUser('owner');
    managerUserId = await createTestUser('manager');
    waiterUserId = await createTestUser('waiter');
    kitchenUserId = await createTestUser('kitchen');
    cashierUserId = await createTestUser('cashier');
    customUserId = await createTestUser('custom');
    suspendedUserId = await createTestUser('suspended');

    // Create Business & Branch
    const { data: biz, error: bizErr } = await admin.from('businesses').insert({
      name: `Auth Entry Test Biz ${timestamp}`,
      slug: `auth-entry-biz-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('id').single();

    if (bizErr || !biz) throw new Error(`Failed to create test business: ${bizErr?.message}`);
    bizId = biz.id;

    const { data: branch, error: brErr } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Main Branch',
      code: 'MAIN',
      is_default: true,
    }).select('id').single();

    if (brErr || !branch) throw new Error(`Failed to create test branch: ${brErr?.message}`);

    // Create Custom Role with Reports view permission
    const { data: cRole } = await admin.from('custom_roles').insert({
      business_id: bizId,
      name: 'Auditor Role',
      permissions: ['reports.view', 'reports.financial.view'],
      created_by: ownerUserId,
    }).select('id').single();
    customRoleId = cRole?.id || null;

    // Create Business Memberships
    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: ownerUserId,
      role: 'business_owner',
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: managerUserId,
      role: 'branch_manager',
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: waiterUserId,
      role: 'waiter',
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: kitchenUserId,
      role: 'kitchen_staff',
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: cashierUserId,
      role: 'cashier',
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: customUserId,
      role: 'branch_manager',
      custom_role_id: customRoleId,
      membership_status: 'active',
    });

    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: suspendedUserId,
      role: 'waiter',
      membership_status: 'suspended',
    });

    console.log('--- 1. BUSINESS OWNER SMART REDIRECT ---');
    const ownerRoute = await AccountService.resolveAccountRoute(
      { id: ownerUserId! },
      null,
      { id: 'mem-owner', business_id: bizId!, role: 'business_owner', membership_status: 'active' }
    );
    assertTest(ownerRoute === '/dashboard', 'Business Owner redirects to /dashboard', `Got: ${ownerRoute}`);

    console.log('\n--- 2. BRANCH MANAGER SMART REDIRECT ---');
    const managerRoute = await AccountService.resolveAccountRoute(
      { id: managerUserId! },
      null,
      { id: 'mem-mgr', business_id: bizId!, role: 'branch_manager', membership_status: 'active' }
    );
    assertTest(managerRoute === '/dashboard', 'Branch Manager redirects to /dashboard', `Got: ${managerRoute}`);

    console.log('\n--- 3. WAITER WORKSPACE SMART REDIRECT ---');
    const waiterRoute = await AccountService.resolveAccountRoute(
      { id: waiterUserId! },
      null,
      { id: 'mem-waiter', business_id: bizId!, role: 'waiter', membership_status: 'active' }
    );
    assertTest(waiterRoute === '/dashboard/waiter', 'Waiter redirects to /dashboard/waiter', `Got: ${waiterRoute}`);

    console.log('\n--- 4. KITCHEN STAFF SMART REDIRECT ---');
    const kitchenRoute = await AccountService.resolveAccountRoute(
      { id: kitchenUserId! },
      null,
      { id: 'mem-kitchen', business_id: bizId!, role: 'kitchen_staff', membership_status: 'active' }
    );
    assertTest(kitchenRoute === '/dashboard/kitchen', 'Kitchen staff redirects to /dashboard/kitchen', `Got: ${kitchenRoute}`);

    console.log('\n--- 5. CASHIER POS SMART REDIRECT ---');
    const cashierRoute = await AccountService.resolveAccountRoute(
      { id: cashierUserId! },
      null,
      { id: 'mem-cashier', business_id: bizId!, role: 'cashier', membership_status: 'active' }
    );
    assertTest(cashierRoute === '/dashboard/cashier', 'Cashier redirects to /dashboard/cashier', `Got: ${cashierRoute}`);

    console.log('\n--- 6. CUSTOM ROLE / PERMISSION HIERARCHY REDIRECT ---');
    const customRouteReports = await AccountService.resolveAccountRoute(
      { id: customUserId! },
      null,
      { id: 'mem-custom', business_id: bizId!, role: 'branch_manager', custom_role_id: customRoleId, membership_status: 'active' },
      ['reports.view', 'reports.financial.view']
    );
    assertTest(customRouteReports === '/dashboard/reports', 'Custom role with reports.view redirects to /dashboard/reports', `Got: ${customRouteReports}`);

    const customRouteMenu = await AccountService.resolveAccountRoute(
      { id: customUserId! },
      null,
      { id: 'mem-custom', business_id: bizId!, role: 'branch_manager', custom_role_id: customRoleId, membership_status: 'active' },
      ['menu.view', 'menu.items.edit']
    );
    assertTest(customRouteMenu === '/dashboard/menu', 'Custom role with menu.view redirects to /dashboard/menu', `Got: ${customRouteMenu}`);

    const customRouteTables = await AccountService.resolveAccountRoute(
      { id: customUserId! },
      null,
      { id: 'mem-custom', business_id: bizId!, role: 'branch_manager', custom_role_id: customRoleId, membership_status: 'active' },
      ['tables.view', 'tables.status.update']
    );
    assertTest(customRouteTables === '/dashboard/tables', 'Custom role with tables.view redirects to /dashboard/tables', `Got: ${customRouteTables}`);

    console.log('\n--- 7. SUSPENDED STAFF SAFETY ---');
    const suspendedRoute = await AccountService.resolveAccountRoute(
      { id: suspendedUserId! },
      null,
      { id: 'mem-suspended', business_id: bizId!, role: 'waiter', membership_status: 'suspended' }
    );
    assertTest(suspendedRoute === '/account/pending-access', 'Suspended staff member is redirected to /account/pending-access', `Got: ${suspendedRoute}`);

    console.log('\n--- 8. UNMUTATED INTENT & UNAUTHENTICATED STATES ---');
    const customerRoute = await AccountService.resolveAccountRoute(
      { id: 'cust-1' },
      { id: 'cust-1', onboarding_intent: 'customer' },
      null
    );
    assertTest(customerRoute === '/customer', 'Customer intent user routes to /customer', `Got: ${customerRoute}`);

    const ownerIntentRoute = await AccountService.resolveAccountRoute(
      { id: 'owner-2' },
      { id: 'owner-2', onboarding_intent: 'business_owner' },
      null
    );
    assertTest(ownerIntentRoute === '/onboarding', 'Business Owner intent without membership routes to /onboarding', `Got: ${ownerIntentRoute}`);

    const unclassifiedRoute = await AccountService.resolveAccountRoute(
      { id: 'new-1' },
      null,
      null
    );
    assertTest(unclassifiedRoute === '/onboarding/account-type', 'Unclassified user without membership routes to /onboarding/account-type', `Got: ${unclassifiedRoute}`);

  } catch (err) {
    console.error('❌ Verification suite execution error:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup Test Data
    console.log('\n🧹 Cleaning up test data...');
    if (bizId) {
      await admin.from('businesses').delete().eq('id', bizId);
    }
    const testUsers = [
      ownerUserId,
      managerUserId,
      waiterUserId,
      kitchenUserId,
      cashierUserId,
      customUserId,
      suspendedUserId,
    ].filter(Boolean) as string[];

    for (const uid of testUsers) {
      await admin.auth.admin.deleteUser(uid);
    }
    console.log('✓ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`  Smart Auth Entry Suite Complete: ${passed} / ${total} Passed (${total - passed} Failed)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exitCode = 1;
  }
}

runSmartAuthEntryVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
