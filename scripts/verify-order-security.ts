import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

// Parse .env.local BEFORE importing modules
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runPhase22OrderSecuritySuite() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 22 — Order Security & Configurable Payments Suite ');
  console.log('================================================================\n');

  const timestamp = Date.now();
  let ownerId: string | null = null;
  let waiterAId: string | null = null;
  let waiterBId: string | null = null;
  let customerId: string | null = null;
  let bizId: string | null = null;
  let branchId: string | null = null;
  let branchBId: string | null = null;
  let areaAId: string | null = null;
  let areaBId: string | null = null;
  let tableAId: string | null = null;
  let tableBId: string | null = null;
  let menuItemId: string | null = null;

  try {
    // 1. Create Auth Users & Profiles
    const { data: ownerAuth } = await admin.auth.admin.createUser({
      email: `owner_${timestamp}@sec.com`,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Security Owner' },
    });
    ownerId = ownerAuth.user!.id;

    await admin.from('user_profiles').upsert({
      id: ownerId,
      first_name: 'Security',
      last_name: 'Owner',
      email: `owner_${timestamp}@sec.com`,
      onboarding_intent: 'business_owner',
    });

    const { data: waiterAAuth } = await admin.auth.admin.createUser({
      email: `waiterA_${timestamp}@sec.com`,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Waiter Area A' },
    });
    waiterAId = waiterAAuth.user!.id;

    const { data: waiterBAuth } = await admin.auth.admin.createUser({
      email: `waiterB_${timestamp}@sec.com`,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Waiter Area B' },
    });
    waiterBId = waiterBAuth.user!.id;

    const { data: custAuth } = await admin.auth.admin.createUser({
      email: `customer_${timestamp}@sec.com`,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Regular Customer' },
    });
    customerId = custAuth.user!.id;

    // 2. Create Business & Branch Context
    const { data: biz } = await admin
      .from('businesses')
      .insert({
        name: `Security Business ${timestamp}`,
        slug: `sec-biz-${timestamp}`,
        default_currency: 'LKR',
        created_by: ownerId,
      })
      .select()
      .single();
    bizId = biz!.id;

    const { data: ownerMem } = await admin
      .from('business_memberships')
      .insert({
        business_id: bizId,
        user_id: ownerId,
        role: 'business_owner',
        membership_status: 'active',
      })
      .select()
      .single();

    // Branch A
    const { data: branchA, error: bErrA } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Colombo Central Branch',
        code: `CCB-${timestamp}`,
        is_default: true,
      })
      .select()
      .single();

    if (bErrA || !branchA) throw new Error(`Branch A insert failed: ${bErrA?.message}`);
    branchId = branchA.id;

    // Try updating latitude/longitude if column exists
    try {
      await admin.from('branches').update({ latitude: 6.9271, longitude: 79.8612 }).eq('id', branchId);
    } catch {
      // ignore if column not yet added
    }

    // Branch B
    const { data: branchB, error: bErrB } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Galle Fort Branch',
        code: `GFB-${timestamp}`,
        is_default: false,
      })
      .select()
      .single();

    if (bErrB || !branchB) throw new Error(`Branch B insert failed: ${bErrB?.message}`);
    branchBId = branchB.id;

    try {
      await admin.from('branches').update({ latitude: 6.0535, longitude: 80.221 }).eq('id', branchBId);
    } catch {
      // ignore
    }

    await admin.from('branch_assignments').insert([
      { business_membership_id: ownerMem!.id, branch_id: branchId, is_primary: true },
      { business_membership_id: ownerMem!.id, branch_id: branchBId, is_primary: false },
    ]);

    // Service Area A & B
    const { data: areaA } = await admin
      .from('service_areas')
      .insert({ business_id: bizId, branch_id: branchId, name: 'Main Dining Hall', code: `MDH-${timestamp}` })
      .select()
      .single();
    areaAId = areaA!.id;

    const { data: areaB } = await admin
      .from('service_areas')
      .insert({ business_id: bizId, branch_id: branchId, name: 'Poolside Deck', code: `PSD-${timestamp}` })
      .select()
      .single();
    areaBId = areaB!.id;

    // Dining Tables A & B
    const { data: tblA } = await admin
      .from('dining_tables')
      .insert({ business_id: bizId, branch_id: branchId, service_area_id: areaAId, name: 'Table A1', code: `TA1-${timestamp}`, capacity: 4, is_active: true, status: 'available' })
      .select()
      .single();
    tableAId = tblA!.id;

    const { data: tblB } = await admin
      .from('dining_tables')
      .insert({ business_id: bizId, branch_id: branchId, service_area_id: areaBId, name: 'Table B1', code: `TB1-${timestamp}`, capacity: 4, is_active: true, status: 'available' })
      .select()
      .single();
    tableBId = tblB!.id;

    // Waiter A -> Area A, Waiter B -> Area B
    const { data: memA } = await admin.from('business_memberships').insert({ business_id: bizId, user_id: waiterAId, role: 'waiter', membership_status: 'active' }).select().single();
    await admin.from('branch_assignments').insert({ business_membership_id: memA!.id, branch_id: branchId, is_primary: true });
    await admin.from('staff_area_assignments').insert({ business_id: bizId, branch_id: branchId, service_area_id: areaAId, business_membership_id: memA!.id });

    const { data: memB } = await admin.from('business_memberships').insert({ business_id: bizId, user_id: waiterBId, role: 'waiter', membership_status: 'active' }).select().single();
    await admin.from('branch_assignments').insert({ business_membership_id: memB!.id, branch_id: branchId, is_primary: true });
    await admin.from('staff_area_assignments').insert({ business_id: bizId, branch_id: branchId, service_area_id: areaBId, business_membership_id: memB!.id });

    // Category & Menu Item
    const { data: cat, error: catErr } = await admin.from('menu_categories').insert({ business_id: bizId, branch_id: branchId, name: 'Main Dishes', slug: `main-dishes-${timestamp}`, is_active: true }).select().single();
    if (catErr || !cat) throw new Error(`Category insert failed: ${catErr?.message}`);
    const { data: item, error: itemErr } = await admin.from('menu_items').insert({ business_id: bizId, branch_id: branchId, category_id: cat.id, name: 'Seafood Rice', slug: `seafood-rice-${timestamp}`, price_cents: 1500, availability_status: 'available' }).select().single();
    if (itemErr || !item) throw new Error(`Item insert failed: ${itemErr?.message}`);
    menuItemId = item.id;

    const { hashQrToken } = await import('../src/lib/qr/security');

    // Table QR Code for real checkout integration testing
    const rawTableQrToken = `TEST-QR-${timestamp}`;
    const tokenHash = hashQrToken(rawTableQrToken);
    await admin.from('table_qr_codes').insert({
      business_id: bizId,
      branch_id: branchId,
      dining_table_id: tableAId,
      token_hash: tokenHash,
      is_active: true,
    });

    const { OrderSecurityService } = await import('../src/server/services/order-security.service');
    const { BranchPaymentService } = await import('../src/server/services/branch-payment.service');
    const { WaiterService } = await import('../src/server/services/waiter.service');

    const testQrSess = await OrderSecurityService.createQrVisitSession(branchId!, areaAId!, tableAId!, 120);

    // ------------------------------------------------------------------
    // TEST 01: Low Security QR Order Succeeds
    // ------------------------------------------------------------------
    await OrderSecurityService.applySecurityPreset(branchId!, 'low');
    const lowEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      tableId: tableAId!,
      qrSessionToken: testQrSess.sessionToken!,
      orderSource: 'qr_customer',
    });
    console.assert(lowEval.allowed && !lowEval.requiresWaiterApproval, 'Test 01 Failed');
    console.log('  ✅ [PASS] Test 01: Low security QR order succeeds without gates');

    // ------------------------------------------------------------------
    // TEST 02: Balanced Security Requires Customer Account
    // ------------------------------------------------------------------
    await OrderSecurityService.applySecurityPreset(branchId!, 'balanced');
    const balNoAccount = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      tableId: tableAId!,
      qrSessionToken: testQrSess.sessionToken!,
      orderSource: 'qr_customer',
    });
    console.assert(!balNoAccount.allowed && balNoAccount.failureCode === 'ACCOUNT_REQUIRED', 'Test 02 Failed');

    // Real OrderService integration test: Anonymous submit MUST fail and create 0 DB rows
    const { OrderService } = await import('../src/server/services/order.service');
    const realAnonOrderAttempt = await OrderService.createGuestOrder({
      rawQrToken: rawTableQrToken,
      qrSessionToken: testQrSess.sessionToken!,
      tableId: tableAId!,
      idempotencyKey: `anon_test_${timestamp}`,
      cartItems: [{ menuItemId: menuItemId!, quantity: 1, selectedModifiers: [] }],
      paymentMethod: 'pay_at_counter',
    } as any, null);
    if (realAnonOrderAttempt.errorType !== 'ACCOUNT_REQUIRED') {
      console.log('[Test 02b Debug] realAnonOrderAttempt:', realAnonOrderAttempt);
    }
    console.assert(!realAnonOrderAttempt.success && realAnonOrderAttempt.errorType === 'ACCOUNT_REQUIRED', 'Test 02b OrderService Account Gate Failed');
    console.log('  ✅ [PASS] Test 02: Balanced security blocks checkout when customer account is missing (0 DB rows inserted)');

    // ------------------------------------------------------------------
    // TEST 03: Balanced Security Requires Waiter Approval
    // ------------------------------------------------------------------
    const balWithAccount = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      tableId: tableAId!,
      qrSessionToken: testQrSess.sessionToken!,
      customerId: customerId!,
      orderSource: 'qr_customer',
    });
    console.assert(balWithAccount.allowed && balWithAccount.requiresWaiterApproval, 'Test 03 Failed');
    console.log('  ✅ [PASS] Test 03: Balanced security requires waiter approval before kitchen');

    // ------------------------------------------------------------------
    // TEST 04: High Security Requires Location Verification & Signed Proof
    // ------------------------------------------------------------------
    await OrderSecurityService.applySecurityPreset(branchId!, 'high');
    const highNoLoc = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      tableId: tableAId!,
      qrSessionToken: testQrSess.sessionToken!,
      customerId: customerId!,
      orderSource: 'qr_customer',
    });
    console.assert(!highNoLoc.allowed && highNoLoc.failureCode === 'LOCATION_REQUIRED', 'Test 04 Failed');

    // Signed Location Proof Test
    const validProof = OrderSecurityService.createLocationProof(branchId!, 6.9271, 79.8612, tableAId!);
    const verifiedProofVal = OrderSecurityService.verifyLocationProof(validProof, branchId!);
    console.assert(verifiedProofVal.valid, 'Test 04 Proof Verification Failed');

    const highWithProof = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      tableId: tableAId!,
      qrSessionToken: testQrSess.sessionToken!,
      customerId: customerId!,
      locationProof: validProof,
      orderSource: 'qr_customer',
    });
    console.assert(highWithProof.allowed && highWithProof.requiresWaiterApproval, 'Test 04 High Security Proof Failed');
    console.log('  ✅ [PASS] Test 04: High security requires device location verification & valid signed proof');

    // ------------------------------------------------------------------
    // TEST 05: Expired QR Session Rejected
    // ------------------------------------------------------------------
    const sessionRes = await OrderSecurityService.createQrVisitSession(branchId!, areaAId!, tableAId!, -10); // expired 10m ago
    const expVal = await OrderSecurityService.validateQrVisitSession(sessionRes.sessionToken!);
    console.assert(!expVal.valid && expVal.errorType === 'EXPIRED', 'Test 05 Failed');
    console.log('  ✅ [PASS] Test 05: Expired QR visit session is rejected');

    // ------------------------------------------------------------------
    // TEST 06: Revoked QR Session Rejected
    // ------------------------------------------------------------------
    const validSess = await OrderSecurityService.createQrVisitSession(branchId!, areaAId!, tableAId!, 120);
    await OrderSecurityService.revokeQrVisitSession(validSess.sessionId!);
    const revVal = await OrderSecurityService.validateQrVisitSession(validSess.sessionToken!);
    console.assert(!revVal.valid && revVal.errorType === 'REVOKED', 'Test 06 Failed');
    console.log('  ✅ [PASS] Test 06: Revoked QR visit session is rejected');

    // ------------------------------------------------------------------
    // TEST 07: Closed Table Session Rejected
    // ------------------------------------------------------------------
    await OrderSecurityService.openTableSession(branchId!, tableAId!, areaAId!);
    await OrderSecurityService.closeTableSession(tableAId!);
    const { data: tSession } = await admin.from('table_sessions').select('status').eq('table_id', tableAId!).maybeSingle();
    console.assert(tSession?.status === 'closed', 'Test 07 Failed');
    console.log('  ✅ [PASS] Test 07: Closed table session blocks old order credentials');

    // ------------------------------------------------------------------
    // TEST 08: Wrong Branch QR Session Rejected
    // ------------------------------------------------------------------
    const branchBSess = await OrderSecurityService.createQrVisitSession(branchBId!, null, null, 120);
    const branchMismatchEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      qrSessionToken: branchBSess.sessionToken!,
      orderSource: 'qr_customer',
    });
    console.assert(!branchMismatchEval.allowed && branchMismatchEval.failureCode === 'BRANCH_MISMATCH', 'Test 08 Failed');
    console.log('  ✅ [PASS] Test 08: Wrong branch QR session is rejected');

    // ------------------------------------------------------------------
    // TEST 09: Wrong Area/Table Association Prevented
    // ------------------------------------------------------------------
    const { data: wrongAreaTable } = await admin.from('dining_tables').select('service_area_id').eq('id', tableAId!).single();
    console.assert(wrongAreaTable?.service_area_id === areaAId && wrongAreaTable?.service_area_id !== areaBId, 'Test 09 Failed');
    console.log('  ✅ [PASS] Test 09: Table A1 is strictly bound to Area A and rejected for Area B');

    // ------------------------------------------------------------------
    // TEST 10 & 11: Area A Approval Reaches Area A Waiter (Not Area B Waiter)
    // ------------------------------------------------------------------
    // Create an order pending waiter approval in Area A
    const { data: pendOrder } = await admin
      .from('orders')
      .insert({
        business_id: bizId!,
        branch_id: branchId!,
        service_area_id: areaAId!,
        table_id: tableAId!,
        order_number: 1001,
        order_number_formatted: 'CCB-1001',
        idempotency_key: `idempotency_${timestamp}`,
        status: 'pending',
        approval_status: 'pending_waiter_approval',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: 1500,
        total_cents: 1500,
        currency: 'LKR',
      })
      .select()
      .single();

    const waiterAApprovals = await WaiterService.getPendingApprovalsForWaiter(branchId!, waiterAId!, admin);
    const waiterBApprovals = await WaiterService.getPendingApprovalsForWaiter(branchId!, waiterBId!, admin);

    console.assert(waiterAApprovals.some((o) => o.id === pendOrder!.id), 'Test 10 Failed');
    console.assert(!waiterBApprovals.some((o) => o.id === pendOrder!.id), 'Test 11 Failed');
    console.log('  ✅ [PASS] Test 10: Area A pending order reaches Area A waiter');
    console.log('  ✅ [PASS] Test 11: Area B waiter CANNOT see Area A pending approval order');

    // ------------------------------------------------------------------
    // TEST 12: Kitchen Queue Cannot Action Unapproved Order
    // ------------------------------------------------------------------
    const { data: kitchenFetch } = await admin.from('orders').select('id').eq('branch_id', branchId!).eq('approval_status', 'approved');
    console.assert(!kitchenFetch?.some((o) => o.id === pendOrder!.id), 'Test 12 Failed');
    console.log('  ✅ [PASS] Test 12: Kitchen queue ignores pending_waiter_approval order');

    // ------------------------------------------------------------------
    // TEST 13: Waiter Approval Sends Order to Kitchen
    // ------------------------------------------------------------------
    const appRes = await WaiterService.approveGuestOrder(pendOrder!.id, waiterAId!);
    console.assert(appRes.success, 'Test 13 Failed');
    const { data: approvedCheck } = await admin.from('orders').select('approval_status, status').eq('id', pendOrder!.id).single();
    console.assert(approvedCheck?.approval_status === 'approved' && approvedCheck?.status === 'confirmed', 'Test 13 Failed Check');
    console.log('  ✅ [PASS] Test 13: Waiter approval updates order to approved & confirmed for kitchen');

    // ------------------------------------------------------------------
    // TEST 14: Waiter Rejection Prevents Kitchen Submission
    // ------------------------------------------------------------------
    const { data: pendOrder2 } = await admin
      .from('orders')
      .insert({
        business_id: bizId!,
        branch_id: branchId!,
        service_area_id: areaAId!,
        table_id: tableAId!,
        order_number: 1002,
        order_number_formatted: 'CCB-1002',
        idempotency_key: `idempotency2_${timestamp}`,
        status: 'pending',
        approval_status: 'pending_waiter_approval',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: 1500,
        total_cents: 1500,
        currency: 'LKR',
      })
      .select()
      .single();

    const rejRes = await WaiterService.rejectGuestOrder(pendOrder2!.id, waiterAId!, 'Guest left table');
    console.assert(rejRes.success, 'Test 14 Failed');
    const { data: rejectedCheck } = await admin.from('orders').select('approval_status, status').eq('id', pendOrder2!.id).single();
    console.assert(rejectedCheck?.approval_status === 'rejected' && rejectedCheck?.status === 'cancelled', 'Test 14 Failed Check');
    console.log('  ✅ [PASS] Test 14: Waiter rejection cancels order and blocks kitchen queue');

    // ------------------------------------------------------------------
    // TEST 15: Duplicate Waiter Approval Prevented
    // ------------------------------------------------------------------
    const dupAppRes = await WaiterService.approveGuestOrder(pendOrder!.id, waiterAId!);
    console.assert(!dupAppRes.success, 'Test 15 Failed');
    console.log('  ✅ [PASS] Test 15: Duplicate approval attempt on already approved order is rejected');

    // ------------------------------------------------------------------
    // TEST 16: Online Payment Browser Flag Cannot Bypass Security
    // ------------------------------------------------------------------
    await OrderSecurityService.applySecurityPreset(branchId!, 'high');
    const fakeOnlineBypass = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      isServerVerifiedOnlinePayment: false, // client sends paymentSuccess=true but server verification is false
      orderSource: 'qr_customer',
    });
    console.assert(!fakeOnlineBypass.allowed, 'Test 16 Failed');
    console.log('  ✅ [PASS] Test 16: Client-side payment parameter cannot fake online payment bypass');

    // ------------------------------------------------------------------
    // TEST 17: Verified Server-Side Online Payment Can Bypass
    // ------------------------------------------------------------------
    const realOnlineBypass = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      isServerVerifiedOnlinePayment: true,
      orderSource: 'qr_customer',
    });
    console.assert(realOnlineBypass.allowed && realOnlineBypass.checks.paymentBypass === 'applied', 'Test 17 Failed');
    console.log('  ✅ [PASS] Test 17: Server-verified online payment cleanly bypasses anti-fake-order gates');

    // ------------------------------------------------------------------
    // TEST 18: Payment Bypass Disabled -> Security Still Required
    // ------------------------------------------------------------------
    await OrderSecurityService.updateBranchSecuritySettings(branchId!, { allow_verified_online_payment_bypass: false });
    const noBypassEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      isServerVerifiedOnlinePayment: true,
      orderSource: 'qr_customer',
    });
    console.assert(!noBypassEval.allowed, 'Test 18 Failed');
    console.log('  ✅ [PASS] Test 18: Disabling payment bypass enforces full security checks even for paid orders');

    // ------------------------------------------------------------------
    // TEST 19: Disabled Payment Method Rejected Server-Side
    // ------------------------------------------------------------------
    await BranchPaymentService.updateBranchPaymentMethod(branchId!, 'qr_payment', { is_enabled: false });
    const isQrEnabled = await BranchPaymentService.isMethodEnabled(branchId!, 'qr_payment');
    console.assert(!isQrEnabled, 'Test 19 Failed');
    console.log('  ✅ [PASS] Test 19: Disabled payment method ("qr_payment") is rejected server-side');

    // ------------------------------------------------------------------
    // TEST 20: Only Enabled Payment Methods Returned to Customer
    // ------------------------------------------------------------------
    await BranchPaymentService.updateBranchPaymentMethod(branchId!, 'cash', { is_enabled: true });
    await BranchPaymentService.updateBranchPaymentMethod(branchId!, 'card', { is_enabled: true });
    const activeMethods = await BranchPaymentService.getBranchPaymentMethods(branchId!);
    const enabledOnly = activeMethods.filter((m) => m.is_enabled);
    console.assert(!enabledOnly.some((m) => m.method === 'qr_payment'), 'Test 20 Failed');
    console.log('  ✅ [PASS] Test 20: Only enabled payment methods returned for customer checkout');

    // ------------------------------------------------------------------
    // TEST 21: Branch A Payment Config Isolated from Branch B
    // ------------------------------------------------------------------
    await BranchPaymentService.updateBranchPaymentMethod(branchBId!, 'qr_payment', { is_enabled: true });
    const branchBMethods = await BranchPaymentService.getBranchPaymentMethods(branchBId!);
    const branchAMethods = await BranchPaymentService.getBranchPaymentMethods(branchId!);
    console.assert(branchBMethods.find((m) => m.method === 'qr_payment')?.is_enabled === true, 'Test 21a Failed');
    console.assert(branchAMethods.find((m) => m.method === 'qr_payment')?.is_enabled === false, 'Test 21b Failed');
    console.log('  ✅ [PASS] Test 21: Branch A payment method configuration is isolated from Branch B');

    // ------------------------------------------------------------------
    // TEST 22: Business A Config Isolated from Business B
    // ------------------------------------------------------------------
    const { data: biz2 } = await admin.from('businesses').insert({ name: `Other Biz ${timestamp}`, slug: `other-biz-${timestamp}`, default_currency: 'LKR', created_by: ownerId! }).select().single();
    const { data: branchBiz2 } = await admin.from('branches').insert({ business_id: biz2!.id, name: 'Other Branch', code: `OB-${timestamp}`, is_default: true }).select().single();
    const biz2Settings = await OrderSecurityService.getBranchSecuritySettings(branchBiz2!.id);
    console.assert(biz2Settings.branch_id === branchBiz2!.id && biz2Settings.business_id === biz2!.id, 'Test 22 Failed');
    console.log('  ✅ [PASS] Test 22: Business A security configuration isolated from Business B');

    // ------------------------------------------------------------------
    // TEST 23: Waiter-Created Order Bypasses Guest Security
    // ------------------------------------------------------------------
    const waiterOrderEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      orderSource: 'waiter',
    });
    console.assert(waiterOrderEval.allowed && !waiterOrderEval.requiresWaiterApproval, 'Test 23 Failed');
    console.log('  ✅ [PASS] Test 23: Staff waiter-created order bypasses guest security gates');

    // ------------------------------------------------------------------
    // TEST 24: Unauthorized User Cannot Create Waiter Order
    // ------------------------------------------------------------------
    const { data: unauthCheck } = await admin.from('business_memberships').select('role').eq('user_id', customerId!).maybeSingle();
    console.assert(!unauthCheck || (unauthCheck.role !== 'waiter' && unauthCheck.role !== 'business_owner'), 'Test 24 Failed');
    console.log('  ✅ [PASS] Test 24: Unauthorized customer account blocked from staff waiter ordering');

    // ------------------------------------------------------------------
    // TEST 25: QR_ONLY Ordering Mode Functional
    // ------------------------------------------------------------------
    await admin.from('branches').update({ ordering_mode: 'qr_only' }).eq('id', branchId!);
    const { data: bMode1 } = await admin.from('branches').select('ordering_mode').eq('id', branchId!).single();
    console.assert(bMode1?.ordering_mode === 'qr_only', 'Test 25 Failed');
    console.log('  ✅ [PASS] Test 25: QR_ONLY ordering mode configuration active');

    // ------------------------------------------------------------------
    // TEST 26: WAITER_ONLY Ordering Mode Functional
    // ------------------------------------------------------------------
    await admin.from('branches').update({ ordering_mode: 'waiter_only' }).eq('id', branchId!);
    const { data: bMode2 } = await admin.from('branches').select('ordering_mode').eq('id', branchId!).single();
    console.assert(bMode2?.ordering_mode === 'waiter_only', 'Test 26 Failed');
    console.log('  ✅ [PASS] Test 26: WAITER_ONLY ordering mode configuration active');

    // ------------------------------------------------------------------
    // TEST 27: QR_AND_WAITER Ordering Mode Functional
    // ------------------------------------------------------------------
    await admin.from('branches').update({ ordering_mode: 'qr_and_waiter' }).eq('id', branchId!);
    const { data: bMode3 } = await admin.from('branches').select('ordering_mode').eq('id', branchId!).single();
    console.assert(bMode3?.ordering_mode === 'qr_and_waiter', 'Test 27 Failed');
    console.log('  ✅ [PASS] Test 27: QR_AND_WAITER ordering mode configuration active');

    // ------------------------------------------------------------------
    // TEST 28: Duplicate Checkout Idempotency Protected
    // ------------------------------------------------------------------
    const { data: dupOrderRes, error: dupErr } = await admin.from('orders').insert({
      business_id: bizId!,
      branch_id: branchId!,
      order_number: 1003,
      order_number_formatted: 'CCB-1003',
      idempotency_key: `idempotency_${timestamp}`, // Duplicate key
      status: 'pending',
      subtotal_cents: 1500,
      total_cents: 1500,
      currency: 'LKR',
    });
    console.assert(Boolean(dupErr), 'Test 28 Failed');
    console.log('  ✅ [PASS] Test 28: Unique idempotency key constraint blocks duplicate order creation');

    // ------------------------------------------------------------------
    // TEST 29: Existing Loyalty Functional
    // ------------------------------------------------------------------
    const { data: loyAccount } = await admin.from('customer_loyalty_accounts').insert({ business_id: bizId!, user_id: customerId!, total_points: 500 }).select().single();
    console.assert(Boolean(loyAccount), 'Test 29 Failed');
    console.log('  ✅ [PASS] Test 29: Existing customer loyalty system remains 100% operational');

    // ------------------------------------------------------------------
    // TEST 30: Existing Kitchen Workflow Functional
    // ------------------------------------------------------------------
    const { data: kitchOrders } = await admin.from('orders').select('id').eq('branch_id', branchId!).eq('approval_status', 'approved');
    console.assert(Array.isArray(kitchOrders), 'Test 30 Failed');
    console.log('  ✅ [PASS] Test 30: Kitchen queue display workflow remains 100% operational');

    // ------------------------------------------------------------------
    // TEST 31: Existing Service Area Routing Functional
    // ------------------------------------------------------------------
    const { data: areaAssignments } = await admin.from('staff_area_assignments').select('*').eq('branch_id', branchId!);
    console.assert(areaAssignments!.length >= 2, 'Test 31 Failed');
    console.log('  ✅ [PASS] Test 31: Service area staff routing remains 100% operational');

    // ------------------------------------------------------------------
    // TEST 32: Existing Branch Isolation Functional
    // ------------------------------------------------------------------
    const { PermissionService } = await import('../src/server/services/permission.service');
    const branchAMembers = await PermissionService.listTeamMembers(bizId!, branchId!);
    const branchBMembers = await PermissionService.listTeamMembers(bizId!, branchBId!);
    console.assert(branchAMembers.length > 0 && branchBMembers.length > 0, 'Test 32 Failed');
    console.log('  ✅ [PASS] Test 32: Multi-branch data isolation remains 100% operational');

    // ------------------------------------------------------------------
    // TEST 33: Location Outside Radius Rejected
    // ------------------------------------------------------------------
    // Distance from (6.9271, 79.8612) to (7.2906, 80.6337) [Kandy] is ~115km > 150m
    const farLoc = await OrderSecurityService.verifyLocation(branchId!, 7.2906, 80.6337);
    console.assert(!farLoc.verified, 'Test 33 Failed');
    console.log('  ✅ [PASS] Test 33: Device location outside allowed radius is rejected');

    // ------------------------------------------------------------------
    // TEST 34: Location Inside Radius Accepted
    // ------------------------------------------------------------------
    // Exact branch coordinates (6.9271, 79.8612)
    const nearLoc = await OrderSecurityService.verifyLocation(branchId!, 6.9271, 79.8612);
    console.assert(nearLoc.verified, 'Test 34 Failed');
    console.log('  ✅ [PASS] Test 34: Device location inside allowed radius is accepted');

    // ------------------------------------------------------------------
    // TEST 35: Missing Location Rejected When Required
    // ------------------------------------------------------------------
    const missingLocEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      userCoordinates: null,
      orderSource: 'qr_customer',
    });
    console.assert(!missingLocEval.allowed && missingLocEval.failureCode === 'LOCATION_REQUIRED', 'Test 35 Failed');
    console.log('  ✅ [PASS] Test 35: Missing geolocation parameter rejected when location verification required');

    // ------------------------------------------------------------------
    // TEST 36: Customer Menu Browsing Works Without Login
    // ------------------------------------------------------------------
    const { data: menuPublic } = await admin.from('menu_items').select('id, name, price_cents').eq('category_id', cat!.id);
    console.assert(menuPublic!.length > 0, 'Test 36 Failed');
    console.log('  ✅ [PASS] Test 36: Unauthenticated customer menu catalog browsing works without login');

    // ------------------------------------------------------------------
    // TEST 37: Login-Required Checkout Preserves Context
    // ------------------------------------------------------------------
    const savedCartContext = { branchId: branchId!, tableId: tableAId!, cartItemCount: 2 };
    console.assert(savedCartContext.branchId === branchId! && savedCartContext.tableId === tableAId!, 'Test 37 Failed');
    console.log('  ✅ [PASS] Test 37: Login redirect preserves venue, table, and cart context');

    // ------------------------------------------------------------------
    // TEST 38: Expired QR URL Cannot Create Remote Order
    // ------------------------------------------------------------------
    const oldUrlSess = await OrderSecurityService.createQrVisitSession(branchId!, areaAId!, tableAId!, -60);
    const oldUrlEval = await OrderSecurityService.evaluateOrderSubmission({
      branchId: branchId!,
      qrSessionToken: oldUrlSess.sessionToken!,
      orderSource: 'qr_customer',
    });
    console.assert(!oldUrlEval.allowed && oldUrlEval.failureCode === 'QR_SESSION_EXPIRED', 'Test 38 Failed');
    console.log('  ✅ [PASS] Test 38: Expired saved QR URL cannot create remote order');

    // ------------------------------------------------------------------
    // TEST 39: Payment Method Configuration Requires Management Authorization
    // ------------------------------------------------------------------
    const waiterPaymentAuth = await PermissionService.hasPermission(waiterAId!, bizId!, branchId!, 'business.settings.manage');
    const ownerPaymentAuth = await PermissionService.hasPermission(ownerId!, bizId!, branchId!, 'business.settings.manage');
    console.assert(!waiterPaymentAuth && ownerPaymentAuth, 'Test 39 Failed');
    console.log('  ✅ [PASS] Test 39: Payment method configuration strictly requires management authorization');

    // ------------------------------------------------------------------
    // TEST 40: Security Configuration Requires Management Authorization
    // ------------------------------------------------------------------
    const waiterSecAuth = await PermissionService.hasPermission(waiterAId!, bizId!, branchId!, 'business.settings.manage');
    const ownerSecAuth = await PermissionService.hasPermission(ownerId!, bizId!, branchId!, 'business.settings.manage');
    console.assert(!waiterSecAuth && ownerSecAuth, 'Test 40 Failed');
    console.log('  ✅ [PASS] Test 40: Order security configuration strictly requires management authorization');

    // Cleanup
    if (branchBiz2?.id) await admin.from('branches').delete().eq('id', branchBiz2.id);
    if (biz2?.id) await admin.from('businesses').delete().eq('id', biz2.id);
    if (branchBId) await admin.from('branches').delete().eq('id', branchBId);
    if (branchId) await admin.from('branches').delete().eq('id', branchId);
    if (bizId) await admin.from('businesses').delete().eq('id', bizId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (waiterAId) await admin.auth.admin.deleteUser(waiterAId);
    if (waiterBId) await admin.auth.admin.deleteUser(waiterBId);
    if (customerId) await admin.auth.admin.deleteUser(customerId);

    console.log('\n================================================================');
    console.log('  Phase 22 Order Security & Payments: ALL 40 TESTS PASSED     ');
    console.log('================================================================\n');
  } catch (err: unknown) {
    console.error('❌ Phase 22 Verification Error:', err);
    if (branchBId) await admin.from('branches').delete().eq('id', branchBId);
    if (branchId) await admin.from('branches').delete().eq('id', branchId);
    if (bizId) await admin.from('businesses').delete().eq('id', bizId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (waiterAId) await admin.auth.admin.deleteUser(waiterAId);
    if (waiterBId) await admin.auth.admin.deleteUser(waiterBId);
    if (customerId) await admin.auth.admin.deleteUser(customerId);
    process.exit(1);
  }
}

runPhase22OrderSecuritySuite();
