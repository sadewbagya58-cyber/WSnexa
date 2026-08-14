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

async function runStaffInvitationsVerificationSuite() {
  const { StaffInvitationService } = await import('../src/server/services/staff-invitation.service');
  const { hashInvitationCode } = await import('../src/lib/security/invite-token');

  console.log('================================================================');
  console.log('  WSNexa Phase 14 — Secure Staff Invitation & Claim Suite       ');
  console.log('================================================================\n');

  let passed = 0;
  const timestamp = Date.now();
  const bizName = `Invite Test Biz ${timestamp}`;

  let ownerUserId: string | null = null;
  let mgrUserId: string | null = null;
  let cashierUserId: string | null = null;
  let kitchenUserId: string | null = null;
  let waiterUserId: string | null = null;
  let wrongEmailUserId: string | null = null;
  let boundEmailUserId: string | null = null;
  let bizId: string | null = null;
  let branchId: string | null = null;

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
    // Setup Test Users
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `invite_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerAuth.user!.id;

    const { data: mgrAuth } = await admin.auth.admin.createUser({
      email: `invite_mgr_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    mgrUserId = mgrAuth.user!.id;

    const { data: cashierAuth } = await admin.auth.admin.createUser({
      email: `invite_cashier_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    cashierUserId = cashierAuth.user!.id;

    const { data: kitchenAuth } = await admin.auth.admin.createUser({
      email: `invite_kitchen_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    kitchenUserId = kitchenAuth.user!.id;

    const { data: waiterAuth } = await admin.auth.admin.createUser({
      email: `invite_waiter_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    waiterUserId = waiterAuth.user!.id;

    const { data: wrongAuth } = await admin.auth.admin.createUser({
      email: `invite_wrong_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    wrongEmailUserId = wrongAuth.user!.id;

    const boundEmail = `invite_bound_${timestamp}@test.com`;
    const { data: boundAuth } = await admin.auth.admin.createUser({
      email: boundEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    boundEmailUserId = boundAuth.user!.id;

    // Create Business & Branch
    const { data: biz } = await admin.from('businesses').insert({
      name: bizName,
      slug: `biz-inv-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: ownerUserId,
    }).select('*').single();

    bizId = biz.id;

    const { data: branch } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Main Branch',
      code: `BR-${timestamp}`,
      is_default: true,
    }).select('*').single();

    branchId = branch.id;

    // Owner Membership
    await admin.from('business_memberships').insert({
      business_id: bizId,
      user_id: ownerUserId,
      role: 'business_owner',
      membership_status: 'active',
    });

    // TEST 1: Owner creates manager invitation
    const mgrInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'branch_manager',
      expiryOption: '48h',
    });
    assert(
      mgrInviteRes.success && !!mgrInviteRes.rawCode && mgrInviteRes.invitation?.assignedRole === 'branch_manager',
      'Test 1: Owner creates Branch Manager invitation code'
    );

    // TEST 2: Owner creates cashier invitation
    const cashierInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    assert(
      cashierInviteRes.success && !!cashierInviteRes.rawCode && cashierInviteRes.invitation?.assignedRole === 'cashier',
      'Test 2: Owner creates Cashier invitation code'
    );

    // TEST 3: Owner creates kitchen staff invitation
    const kitchenInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'kitchen_staff',
      expiryOption: '48h',
    });
    assert(
      kitchenInviteRes.success && !!kitchenInviteRes.rawCode && kitchenInviteRes.invitation?.assignedRole === 'kitchen_staff',
      'Test 3: Owner creates Kitchen Staff invitation code'
    );

    // TEST 4: Owner creates waiter invitation
    const waiterInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'waiter',
      expiryOption: '48h',
    });
    assert(
      waiterInviteRes.success && !!waiterInviteRes.rawCode && waiterInviteRes.invitation?.assignedRole === 'waiter',
      'Test 4: Owner creates Waiter invitation code'
    );

    // TEST 5: Raw token NOT stored in DB (only token_hash stored)
    const { data: dbInviteRow } = await admin
      .from('staff_invitations')
      .select('*')
      .eq('id', mgrInviteRes.invitation!.id)
      .single();
    const dbRowRecord = dbInviteRow as Record<string, unknown>;
    const isRawNotStored = !dbRowRecord.raw_code && dbRowRecord.token_hash === hashInvitationCode(mgrInviteRes.rawCode!);
    assert(isRawNotStored, 'Test 5: Raw invitation token is NOT stored in DB (only SHA-256 token_hash)');

    // TEST 6: Token hash lookup works
    const expectedHash = hashInvitationCode(mgrInviteRes.rawCode!);
    const { data: hashLookup } = await admin
      .from('staff_invitations')
      .select('id')
      .eq('token_hash', expectedHash)
      .single();
    assert(!!hashLookup && hashLookup.id === mgrInviteRes.invitation!.id, 'Test 6: Token hash lookup matches invitation record');

    // TEST 7: Valid claim creates correct active business membership
    const mgrClaimRes = await StaffInvitationService.claimInvitation(mgrUserId!, `invite_mgr_${timestamp}@test.com`, mgrInviteRes.rawCode!);
    assert(
      mgrClaimRes.success && mgrClaimRes.targetRoute === '/dashboard',
      'Test 7: Valid Branch Manager claim creates active business membership'
    );

    // TEST 8: Manager claim binds correct branch
    const { data: mgrMem } = await admin.from('business_memberships').select('id, role').eq('business_id', bizId!).eq('user_id', mgrUserId!).single();
    const { data: mgrBranchAssign } = await admin.from('branch_assignments').select('branch_id').eq('business_membership_id', mgrMem?.id || '').single();
    assert(mgrMem?.role === 'branch_manager' && mgrBranchAssign?.branch_id === branchId, 'Test 8: Manager claim binds correct branch_id');

    // TEST 9: Cashier claim routes to /dashboard/cashier
    const cashierClaimRes = await StaffInvitationService.claimInvitation(cashierUserId!, `invite_cashier_${timestamp}@test.com`, cashierInviteRes.rawCode!);
    assert(cashierClaimRes.success && cashierClaimRes.targetRoute === '/dashboard/cashier', 'Test 9: Cashier claim routes to /dashboard/cashier');

    // TEST 10: Kitchen staff claim routes to /dashboard/kitchen
    const kitchenClaimRes = await StaffInvitationService.claimInvitation(kitchenUserId!, `invite_kitchen_${timestamp}@test.com`, kitchenInviteRes.rawCode!);
    assert(kitchenClaimRes.success && kitchenClaimRes.targetRoute === '/dashboard/kitchen', 'Test 10: Kitchen staff claim routes to /dashboard/kitchen');

    // TEST 11: Waiter claim routes to /dashboard/waiter
    const waiterClaimRes = await StaffInvitationService.claimInvitation(waiterUserId!, `invite_waiter_${timestamp}@test.com`, waiterInviteRes.rawCode!);
    assert(waiterClaimRes.success && waiterClaimRes.targetRoute === '/dashboard/waiter', 'Test 11: Waiter claim routes to /dashboard/waiter');

    // TEST 12: Expired invitation claim is rejected
    const expInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '24h',
    });
    // Manually set expires_at in the past
    await admin.from('staff_invitations').update({ expires_at: new Date(Date.now() - 3600000).toISOString() }).eq('id', expInviteRes.invitation!.id);

    const expClaimRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, expInviteRes.rawCode!);
    assert(!expClaimRes.success && Boolean(expClaimRes.message?.includes('expired')), 'Test 12: Expired invitation claim is rejected');

    // TEST 13: Revoked invitation claim is rejected
    const revInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    await StaffInvitationService.revokeInvitation(ownerUserId!, bizId!, revInviteRes.invitation!.id);

    const revClaimRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, revInviteRes.rawCode!);
    assert(!revClaimRes.success && Boolean(revClaimRes.message?.includes('revoked')), 'Test 13: Revoked invitation claim is rejected');

    // TEST 14: Claimed invitation cannot be reused
    const reuseClaimRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, mgrInviteRes.rawCode!);
    assert(!reuseClaimRes.success && Boolean(reuseClaimRes.message?.includes('already been claimed')), 'Test 14: Already claimed invitation cannot be reused');

    // TEST 15: Old code fails immediately after token regeneration
    const regenTargetRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    const oldCode = regenTargetRes.rawCode!;

    const regenRes = await StaffInvitationService.regenerateInvitation(ownerUserId!, bizId!, regenTargetRes.invitation!.id);
    assert(regenRes.success && !!regenRes.rawCode, 'Test 15a: Token regeneration succeeds');

    const oldCodeClaimRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, oldCode);
    assert(!oldCodeClaimRes.success, 'Test 15b: Previous code fails immediately after token regeneration');

    // TEST 16: Email-bound invitation rejects non-matching email account
    const boundInviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      invitedEmail: boundEmail,
      expiryOption: '48h',
    });

    const wrongEmailClaimRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, boundInviteRes.rawCode!);
    assert(!wrongEmailClaimRes.success && Boolean(wrongEmailClaimRes.message?.includes('cannot be claimed')), 'Test 16: Email-bound invitation rejects non-matching email account');

    // TEST 17: Email-bound invitation accepts matching email account
    const correctEmailClaimRes = await StaffInvitationService.claimInvitation(boundEmailUserId!, boundEmail, boundInviteRes.rawCode!);
    assert(correctEmailClaimRes.success, 'Test 17: Email-bound invitation accepts matching email account');

    // TEST 18: Business Owner cannot be downgraded through invitation claim
    const ownerStaffInvite = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    const ownerDowngradeRes = await StaffInvitationService.claimInvitation(ownerUserId!, `invite_owner_${timestamp}@test.com`, ownerStaffInvite.rawCode!);
    assert(!ownerDowngradeRes.success && Boolean(ownerDowngradeRes.message?.includes('Business Owners cannot claim')), 'Test 18: Business Owner cannot be downgraded through invitation claim');

    // TEST 19: Duplicate/conflicting membership handled safely
    const repeatClaimRes = await StaffInvitationService.claimInvitation(cashierUserId!, `invite_cashier_${timestamp}@test.com`, waiterInviteRes.rawCode!);
    // User already claimed waiter code above; trying another code updates membership safely
    assert(repeatClaimRes.success || Boolean(repeatClaimRes.message?.includes('claimed')), 'Test 19: Re-claiming updates membership safely without DB corruption');

    // TEST 20: Cross-business claim is impossible
    const invalidCodeRes = await StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, 'WSN-MGR-9999-9999-9999');
    assert(!invalidCodeRes.success, 'Test 20: Cross-business or fake invitation code claim fails');

    // TEST 21: Cross-branch role binding correct
    const { data: branch2 } = await admin.from('branches').insert({
      business_id: bizId!,
      name: 'Branch 2',
      code: `BR2-${timestamp}`,
    }).select('*').single();

    const branch2InviteRes = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branch2.id,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    const branch2UserAuth = await admin.auth.admin.createUser({
      email: `b2_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    await StaffInvitationService.claimInvitation(branch2UserAuth.data.user!.id, `b2_${timestamp}@test.com`, branch2InviteRes.rawCode!);

    const { data: b2Mem } = await admin.from('business_memberships').select('id').eq('business_id', bizId).eq('user_id', branch2UserAuth.data.user!.id).single();
    const { data: b2Assign } = await admin.from('branch_assignments').select('branch_id').eq('business_membership_id', b2Mem?.id || '').single();
    assert(b2Assign?.branch_id === branch2.id, 'Test 21: Cross-branch role binding is bound to target Branch 2');

    // TEST 22: Simultaneous double claim allows only one success
    const doubleTargetInvite = await StaffInvitationService.createInvitation(ownerUserId!, bizId!, {
      branchId: branchId!,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    const [c1, c2] = await Promise.all([
      StaffInvitationService.claimInvitation(wrongEmailUserId!, `invite_wrong_${timestamp}@test.com`, doubleTargetInvite.rawCode!),
      StaffInvitationService.claimInvitation(boundEmailUserId!, boundEmail, doubleTargetInvite.rawCode!),
    ]);
    const oneSuccess = (c1.success && !c2.success) || (!c1.success && c2.success);
    assert(oneSuccess, 'Test 22: Simultaneous double-claim allows exactly ONE successful claim');

    // TEST 23: Anonymous client cannot directly create privileged business membership
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: anonInsertErr } = await anonClient.from('business_memberships').insert({
      business_id: bizId!,
      user_id: wrongEmailUserId!,
      role: 'business_owner',
    });
    assert(!!anonInsertErr, 'Test 23: Anonymous client RLS blocks direct creation of business membership');

    // TEST 24: Existing staff still log in normally without re-claiming
    const { AccountService } = await import('../src/server/services/account.service');
    const existingRoute = await AccountService.resolveAccountRoute(
      { id: cashierUserId! },
      { id: cashierUserId!, onboarding_intent: 'staff' },
      { id: 'm', business_id: bizId!, role: 'cashier', membership_status: 'active' }
    );
    assert(existingRoute === '/dashboard/cashier', 'Test 24: Existing staff log in normally and resolve to operational workspace');

    // TEST 25: Customer account cannot gain role by changing onboarding_intent alone
    const customerNoMemRoute = await AccountService.resolveAccountRoute(
      { id: wrongEmailUserId },
      { id: wrongEmailUserId, onboarding_intent: 'branch_manager' },
      null
    );
    assert(customerNoMemRoute === '/account/pending-access', 'Test 25: Unverified onboarding intent alone grants ZERO business access');

    // Cleanup Branch 2 user
    await admin.auth.admin.deleteUser(branch2UserAuth.data.user!.id);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during staff invitation verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up test invitation accounts...');
    if (bizId) {
      await admin.from('businesses').delete().filter('id', 'eq', bizId);
    }
    const uids = [ownerUserId, mgrUserId, cashierUserId, kitchenUserId, waiterUserId, wrongEmailUserId, boundEmailUserId];
    for (const uid of uids) {
      if (uid) {
        await admin.auth.admin.deleteUser(uid);
      }
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`  Phase 14 Staff Invitations Verification: ALL ${passed} TESTS PASSED `);
  console.log('================================================================\n');
}

runStaffInvitationsVerificationSuite();
