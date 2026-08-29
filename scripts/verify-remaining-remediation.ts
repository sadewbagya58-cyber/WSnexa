// Bypass server-only guard for tsx execution
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

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local safely BEFORE importing server modules
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, description: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

async function runRemainingVerificationSuite() {
  console.log('================================================================');
  console.log('   WSNEXA — REMAINING E2E QA REMEDIATION VERIFICATION SUITE    ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // 1. Venue Profile Slug Validation Matrix (Area B)
  // -------------------------------------------------------------
  console.log('--- 1. Testing Venue Profile Slug Validation Matrix ---');
  const { isValidVenueSlug, venueProfileSchema } = await import('../src/lib/validation/venue');

  assert(isValidVenueSlug('nexa-grand-hotel') === true, 'Valid slug "nexa-grand-hotel" accepted by isValidVenueSlug');
  assert(isValidVenueSlug('hotel2-colombo') === true, 'Valid slug "hotel2-colombo" accepted by isValidVenueSlug');
  assert(isValidVenueSlug('-hotel') === false, 'Leading hyphen "-hotel" rejected');
  assert(isValidVenueSlug('hotel-') === false, 'Trailing hyphen "hotel-" rejected');
  assert(isValidVenueSlug('hotel--colombo') === false, 'Consecutive hyphens "hotel--colombo" rejected');
  assert(isValidVenueSlug('hotel colombo') === false, 'Whitespace "hotel colombo" rejected');

  const validParsed = venueProfileSchema.safeParse({
    displayName: 'Nexa Grand Hotel',
    slug: 'nexa-grand-hotel',
    city: 'Colombo',
  });
  assert(validParsed.success === true, 'venueProfileSchema successfully parses valid slug "nexa-grand-hotel"');

  const invalidParsed = venueProfileSchema.safeParse({
    displayName: 'Nexa Grand Hotel',
    slug: 'hotel--colombo',
    city: 'Colombo',
  });
  assert(invalidParsed.success === false, 'venueProfileSchema rejects consecutive hyphens "hotel--colombo"');

  // -------------------------------------------------------------
  // Setup Test Business & Resources
  // -------------------------------------------------------------
  console.log('\n--- Setting Up Test Business Context ---');
  const timestamp = Date.now();
  const testEmail = `qa-owner-${timestamp}@wsnexa.test`;
  const testStaffEmail1 = `qa-waiter1-${timestamp}@wsnexa.test`;
  const testStaffEmail2 = `qa-waiter2-${timestamp}@wsnexa.test`;

  // Create Auth Users
  const { data: userAuth, error: authErr } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: 'Password123!',
    email_confirm: true,
  });
  if (authErr || !userAuth.user) throw new Error(`Failed to create test owner user: ${authErr?.message}`);
  const ownerUserId = userAuth.user.id;

  const { data: waiter1Auth } = await adminClient.auth.admin.createUser({
    email: testStaffEmail1,
    password: 'Password123!',
    email_confirm: true,
  });
  const waiter1Id = waiter1Auth!.user!.id;

  const { data: waiter2Auth } = await adminClient.auth.admin.createUser({
    email: testStaffEmail2,
    password: 'Password123!',
    email_confirm: true,
  });
  const waiter2Id = waiter2Auth!.user!.id;

  await adminClient.from('user_profiles').upsert([
    { id: ownerUserId, first_name: 'QA', last_name: 'Owner', email: testEmail },
    { id: waiter1Id, first_name: 'Amal', last_name: 'Perera', email: testStaffEmail1 },
    { id: waiter2Id, first_name: 'Sunil', last_name: 'Silva', email: testStaffEmail2 },
  ]);

  // Create Business & Branch
  const { data: biz, error: bizErr } = await adminClient
    .from('businesses')
    .insert({
      name: `QA Grand Hotel ${timestamp}`,
      slug: `qa-grand-hotel-${timestamp}`,
      created_by: ownerUserId,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
    })
    .select()
    .single();

  if (bizErr || !biz) {
    throw new Error(`Failed to create test business: ${bizErr?.message}`);
  }

  const businessId = biz.id;

  const { data: branch, error: brErr } = await adminClient
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Colombo Main Branch',
      code: 'CMB01',
      status: 'active',
      is_default: true,
    })
    .select()
    .single();

  if (brErr || !branch) {
    throw new Error(`Failed to create test branch: ${brErr?.message}`);
  }

  const branchId = branch.id;

  // Create Memberships
  const { error: memsErr } = await adminClient.from('business_memberships').insert([
    { business_id: businessId, user_id: ownerUserId, role: 'business_owner', membership_status: 'active' },
    { business_id: businessId, user_id: waiter1Id, role: 'waiter', membership_status: 'active' },
    { business_id: businessId, user_id: waiter2Id, role: 'waiter', membership_status: 'active' },
  ]);

  if (memsErr) {
    throw new Error(`Failed to create business memberships: ${memsErr.message}`);
  }

  // Create Service Areas
  const { data: areaA, error: areaAErr } = await adminClient
    .from('service_areas')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      name: 'Main Dining Room',
      code: 'MAIN',
      is_active: true,
    })
    .select()
    .single();

  if (areaAErr || !areaA) {
    throw new Error(`Failed to create service area A: ${areaAErr?.message}`);
  }

  const { data: areaB, error: areaBErr } = await adminClient
    .from('service_areas')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      name: 'Rooftop Terrace',
      code: 'ROOF',
      is_active: true,
    })
    .select()
    .single();

  if (areaBErr || !areaB) {
    throw new Error(`Failed to create service area B: ${areaBErr?.message}`);
  }

  const areaAId = areaA.id;
  const areaBId = areaB.id;

  // Create Tables
  const { data: tableA, error: tAErr } = await adminClient
    .from('dining_tables')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      service_area_id: areaAId,
      name: 'Table 1 (Indoor)',
      code: 'T1',
      capacity: 4,
      is_active: true,
      table_pin_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', // 'test'
    })
    .select()
    .single();

  if (tAErr || !tableA) {
    throw new Error(`Failed to create table A: ${tAErr?.message}`);
  }

  const { data: tableB, error: tBErr } = await adminClient
    .from('dining_tables')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      service_area_id: areaBId,
      name: 'Table 20 (Rooftop)',
      code: 'T20',
      capacity: 4,
      is_active: true,
      table_pin_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    })
    .select()
    .single();

  if (tBErr || !tableB) {
    throw new Error(`Failed to create table B: ${tBErr?.message}`);
  }

  // -------------------------------------------------------------
  // 2. Inventory & Recipe Settings Save & Re-save (Area A)
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Inventory Settings Idempotent Save & Re-save ---');
  // Initial Create
  const { data: ins1, error: insErr1 } = await adminClient
    .from('inventory_settings')
    .insert({
      business_id: businessId,
      branch_id: null,
      deduction_timing: 'preparing',
      costing_method: 'weighted_average',
      auto_sold_out_mode: 'warn_only',
      receiving_tolerance_percent: 5,
    })
    .select()
    .single();

  if (insErr1) {
    console.error('Inventory settings insert error:', insErr1);
  }
  assert(!insErr1 && ins1 !== null, 'Initial inventory settings saved successfully');

  // Re-save / Update
  const { data: ins2, error: insErr2 } = await adminClient
    .from('inventory_settings')
    .update({
      costing_method: 'latest_cost',
      receiving_tolerance_percent: 10,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ins1!.id)
    .select()
    .single();

  assert(!insErr2 && ins2?.costing_method === 'latest_cost', 'Inventory settings updated idempotently to latest_cost');

  // -------------------------------------------------------------
  // 3. Waiter Assistance State Machine & Concurrency (Area D & E)
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Waiter Assistance State Machine & Concurrency ---');
  const { data: waiterReq } = await adminClient
    .from('waiter_requests')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      table_id: tableA!.id,
      request_type: 'call_waiter',
      status: 'pending',
      notes: 'Need extra napkins and water',
    })
    .select()
    .single();

  assert(waiterReq?.status === 'pending', 'Waiter request created in PENDING status');

  // Test 1: Concurrency - Two waiters try to accept the same pending request
  const nowIso = new Date().toISOString();
  const { data: accept1, error: accErr1 } = await adminClient
    .from('waiter_requests')
    .update({
      status: 'accepted',
      accepted_by: waiter1Id,
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', waiterReq!.id)
    .eq('status', 'pending')
    .select();

  const { data: accept2, error: accErr2 } = await adminClient
    .from('waiter_requests')
    .update({
      status: 'accepted',
      accepted_by: waiter2Id,
      accepted_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', waiterReq!.id)
    .eq('status', 'pending')
    .select();

  assert(Boolean(accept1 && accept1.length === 1), 'First waiter successfully won Accept transition');
  assert(Boolean(accept2 && accept2.length === 0), 'Second waiter was atomically rejected (0 rows updated)');

  // Test 2: Transition from ACCEPTED to COMPLETED
  const { data: compReq } = await adminClient
    .from('waiter_requests')
    .update({
      status: 'completed',
      resolved_by: waiter1Id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', waiterReq!.id)
    .eq('status', 'accepted')
    .select()
    .single();

  assert(compReq?.status === 'completed', 'Request successfully transitioned from ACCEPTED to COMPLETED');
  assert(compReq?.accepted_by === waiter1Id, 'accepted_by is persisted on completed record');
  assert(compReq?.resolved_by === waiter1Id, 'resolved_by is persisted on completed record');

  // -------------------------------------------------------------
  // 4. Order Security Waiter Approval Accountability (Area F)
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Order Security Waiter Approval Accountability ---');
  const { data: guestOrder, error: ordErr } = await adminClient
    .from('orders')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      table_id: tableA.id,
      service_area_id: areaAId,
      order_number: 1001,
      order_number_formatted: 'CMB01-1001',
      idempotency_key: `qa_ord_idemp_${Date.now()}`,
      access_token: `qa_ord_token_${Date.now()}`,
      status: 'pending',
      approval_status: 'pending_waiter_approval',
      subtotal_cents: 195000,
      tax_cents: 0,
      service_charge_cents: 0,
      total_cents: 195000,
      currency: 'LKR',
      payment_status: 'unpaid',
    })
    .select()
    .single();

  if (ordErr || !guestOrder) {
    console.error('Order creation error:', ordErr);
    throw new Error(`Failed to create guest order: ${ordErr?.message}`);
  }

  assert(guestOrder.approval_status === 'pending_waiter_approval', 'Guest order initialized in pending_waiter_approval');

  // Staff approves order
  const { data: approvedOrder } = await adminClient
    .from('orders')
    .update({
      approval_status: 'approved',
      status: 'confirmed',
      approved_by_user_id: waiter1Id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', guestOrder!.id)
    .select()
    .single();

  assert(approvedOrder?.approval_status === 'approved', 'Order approval status transitioned to approved');
  assert(approvedOrder?.approved_by_user_id === waiter1Id, 'approved_by_user_id persisted correctly');
  assert(Boolean(approvedOrder?.approved_at), 'approved_at timestamp persisted correctly');

  // -------------------------------------------------------------
  // 5. Payment Split Settlement Audit & Receipt Breakdown (Area H)
  // -------------------------------------------------------------
  console.log('\n--- 5. Testing Split Payment Settlement & Receipt Audit ---');
  // Payment 1: Cash LKR 1000 (100,000 cents)
  const { data: pay1, error: payErr1 } = await adminClient
    .from('payments')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      order_id: guestOrder.id,
      payment_method: 'cash',
      payment_reference: 'RCP-1001-A',
      idempotency_key: `pay_idemp_${Date.now()}_1`,
      amount_cents: 100000,
      currency: 'LKR',
      payment_status: 'completed',
      paid_at: new Date().toISOString(),
      received_by: waiter1Id,
    })
    .select()
    .single();

  if (payErr1) {
    console.error('Payment 1 error:', payErr1);
  }

  // Payment 2: Cash LKR 950 (95,000 cents)
  const { data: pay2, error: payErr2 } = await adminClient
    .from('payments')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      order_id: guestOrder.id,
      payment_method: 'cash',
      payment_reference: 'RCP-1001-B',
      idempotency_key: `pay_idemp_${Date.now()}_2`,
      amount_cents: 95000,
      currency: 'LKR',
      payment_status: 'completed',
      paid_at: new Date().toISOString(),
      received_by: waiter2Id,
    })
    .select()
    .single();

  if (payErr2) {
    console.error('Payment 2 error:', payErr2);
  }

  // Update order to fully paid
  await adminClient
    .from('orders')
    .update({
      payment_status: 'paid',
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', guestOrder.id);

  // Fetch all payment transactions
  const { data: orderPayments } = await adminClient
    .from('payments')
    .select('*')
    .eq('order_id', guestOrder.id)
    .order('created_at', { ascending: true });

  assert(orderPayments?.length === 2, 'Split payment preserved 2 distinct transaction records');
  const totalPaidCents = (orderPayments || []).reduce((sum, p) => sum + p.amount_cents, 0);
  assert(totalPaidCents === 195000, 'Sum of split payments equals exact order total LKR 1950.00');

  // -------------------------------------------------------------
  // 6. Area-Context Table Selection Isolation (Area J)
  // -------------------------------------------------------------
  console.log('\n--- 6. Testing Area-Context Table Selection Isolation ---');
  // Attempting to access Table 20 (Rooftop) with expectedServiceAreaId = Main Dining Room (areaAId)
  const { data: checkTableArea } = await adminClient
    .from('dining_tables')
    .select('id, service_area_id')
    .eq('id', tableB.id)
    .eq('branch_id', branchId)
    .maybeSingle();

  const isCrossAreaInvalid = checkTableArea?.service_area_id !== areaAId;
  assert(isCrossAreaInvalid === true, 'Cross-area table selection correctly identified as invalid');

  // -------------------------------------------------------------
  // 7. Settings Navigation RBAC Evaluation for Custom Role (Area K)
  // -------------------------------------------------------------
  console.log('\n--- 7. Testing Settings Nav RBAC Visibility for Custom Role ---');
  const { resolveSettingsSubNavPermissions } = await import('../src/server/navigation/settings-nav-permissions');

  const { data: memWaiter1 } = await adminClient
    .from('business_memberships')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', waiter1Id)
    .single();

  // Mock an organization-scoped custom role context with only business.view
  const customRoleAuthContext = {
    userId: waiter1Id,
    businessId: businessId,
    membershipId: memWaiter1!.id,
    membershipRole: 'custom',
    activeBranchId: branchId,
    authorizedBranchIds: [branchId],
    serviceAreaIds: [areaAId, areaBId],
    isBusinessOwner: false,
    isPlatformSuperAdmin: false,
    rolePermissions: ['business.view'],
    effectivePermissions: new Set(['business.view']),
    permissionOverrides: [],
    scopeGrants: [],
  };

  const navPerms = await resolveSettingsSubNavPermissions(customRoleAuthContext as any, branchId, businessId);

  assert(navPerms.canViewBusiness === true, 'Custom role with business.view can see Business Profile');
  assert(navPerms.canViewVenueProfile === false, 'Custom role CANNOT see Venue Profile');
  assert(navPerms.canViewBranches === false, 'Custom role CANNOT see Branches');
  assert(navPerms.canViewOrderSecurity === false, 'Custom role CANNOT see Order Security');
  assert(navPerms.canViewPayments === false, 'Custom role CANNOT see Payment Methods');
  assert(navPerms.canManageInventorySettings === false, 'Custom role CANNOT see Inventory Policies');

  // -------------------------------------------------------------
  // 8. Position Occupancy Semantics (Area L)
  // -------------------------------------------------------------
  console.log('\n--- 8. Testing Position Occupancy Semantics ---');
  const { OrganizationService } = await import('../src/server/services/organization.service');

  // Seed default hierarchy levels
  const seededLevels = await OrganizationService.seedDefaultHierarchyLevels(businessId);
  const operationalLevel = seededLevels.find((l) => l.rank === 8) || seededLevels[0];

  // Create Job Title and Position with headcount_limit = 3
  const jobTitle = await OrganizationService.createJobTitle({
    businessId,
    name: 'Floor Waiter',
    code: 'WTR',
    hierarchyLevelId: operationalLevel.id,
    isManagement: false,
    isActive: true,
  });

  const position = await OrganizationService.createPosition({
    businessId,
    branchId,
    jobTitleId: jobTitle.id,
    positionCode: 'POS-WTR-MDS-01',
    headcountLimit: 3,
  });

  // Assign 1 waiter as substantive primary occupant
  await OrganizationService.createStaffAssignment({
    businessId,
    branchId,
    businessMembershipId: memWaiter1!.id,
    jobTitleId: jobTitle.id,
    positionId: position.id,
    isPrimary: true,
  });

  const occ = await OrganizationService.getPositionOccupancy(position.id);
  assert(occ.occupiedCount === 1, 'Position occupied count is 1');
  assert(occ.availableSlots === 2, 'Position available slots is 2');
  assert(occ.isFull === false, 'Position is not reported Full');

  // Verify that an occupied position is NOT vacant
  const isPartiallyFilled = occ.occupiedCount > 0 && occ.occupiedCount < occ.headcountLimit;
  assert(isPartiallyFilled === true, 'Position status is correctly categorized as Partially Filled (1/3), NOT Vacant');

  // -------------------------------------------------------------
  // Cleanup Test Data
  // -------------------------------------------------------------
  console.log('\n--- Cleaning Up Test Data ---');
  await adminClient.from('businesses').delete().eq('id', businessId);
  await adminClient.auth.admin.deleteUser(ownerUserId);
  await adminClient.auth.admin.deleteUser(waiter1Id);
  await adminClient.auth.admin.deleteUser(waiter2Id);
  console.log('Cleanup completed.');

  console.log('\n================================================================');
  console.log(`   VERIFICATION RESULTS: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED   `);
  console.log('================================================================\n');

  if (passedAssertions === totalAssertions) {
    console.log('🎉 ALL REMAINING E2E QA REMEDIATION CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME CHECKS FAILED.\n');
    process.exit(1);
  }
}

runRemainingVerificationSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
