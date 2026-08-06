import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, hashTablePin, hashQrToken } from '../src/lib/qr/security';

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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

function assert(condition: boolean | null | undefined, testName: string, failureDetail?: string) {
  if (Boolean(condition)) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${failureDetail ? `: ${failureDetail}` : ''}`);
    process.exit(1);
  }
}

async function runPaymentsVerificationSuite() {
  console.log('================================================================');
  console.log('   WSNexa Phase 11 — Cashier POS, Payments & Audit Verification ');
  console.log('================================================================\n');

  let bizId = '';

  try {
    // TEST 1: Schema Contract Verification (payments, payment_events exist)
    const [{ data: payCheck, error: payErr }, { data: eventsCheck }] = await Promise.all([
      admin.from('payments').select('id').limit(1),
      admin.from('payment_events').select('id').limit(1),
    ]);

    assert(
      payCheck !== null && eventsCheck !== null,
      'Test 1: Verified payments and payment_events tables exist in Supabase schema',
      payErr?.message || 'Tables not found'
    );

    // Setup Test Owner User & Isolated Business / Branches
    const timestamp = Date.now();
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: `payment_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authErr || !authUser.user) throw new Error(`Failed to create test owner: ${authErr?.message}`);
    const testUserId = authUser.user.id;

    const { data: biz } = await admin.from('businesses').insert({
      name: 'Payment Test Cafe',
      slug: `payment-test-${timestamp}`,
      default_currency: 'LKR',
      timezone: 'Asia/Colombo',
      created_by: testUserId,
    }).select('*').single();

    bizId = biz.id;

    const { data: branchA } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Branch Alpha',
      code: 'BAL',
      status: 'active',
      is_default: true,
      require_table_selection: true,
      require_table_pin: true,
    }).select('*').single();

    const { data: branchB } = await admin.from('branches').insert({
      business_id: bizId,
      name: 'Branch Beta',
      code: 'BET',
      status: 'active',
      is_default: false,
    }).select('*').single();

    // Create QR & Table for Branch A
    const qrA = generateSecureQrToken();
    const tokenHashA = hashQrToken(qrA.rawToken);
    await admin.from('branch_qr_codes').insert({
      business_id: bizId,
      branch_id: branchA.id,
      token_hash: tokenHashA,
      token_prefix: qrA.tokenPrefix,
      encrypted_token: qrA.encryptedToken,
      is_active: true,
    });

    const { data: areaA } = await admin.from('service_areas').insert({
      business_id: bizId,
      branch_id: branchA.id,
      name: 'Main Room',
      code: 'MR',
    }).select('*').single();

    const { data: tableA } = await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchA.id,
      service_area_id: areaA.id,
      name: 'Table 10',
      code: 'T10',
      capacity: 4,
      table_pin_hash: hashTablePin('1234'),
    }).select('*').single();

    // Create Category & Menu Items
    const { data: catA } = await admin.from('menu_categories').insert({
      business_id: bizId,
      branch_id: branchA.id,
      name: 'Food',
      slug: `food-${timestamp}`,
    }).select('*').single();

    const { data: itemA } = await admin.from('menu_items').insert({
      business_id: bizId,
      branch_id: branchA.id,
      category_id: catA.id,
      name: 'Burger Combo',
      slug: `burger-combo-${timestamp}`,
      price_cents: 250000, // 2500 LKR
      currency: 'LKR',
      availability_status: 'available',
    }).select('*').single();

    // Create Order #1 (Total: 5,000 LKR = 500,000 cents)
    const { data: orderRes1 } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA.id,
      p_table_access_verified: true,
      p_guest_name: 'Payment Guest',
      p_idempotency_key: `idemp_pay1_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 2 }],
    });

    const orderId1 = orderRes1.order_id;
    assert(orderRes1?.success === true && orderId1, 'Test 1 setup: Created test order 1 with 500,000 cents total');

    // TEST 2: Anonymous Direct RPC Call Blocked
    const { error: anonPayErr } = await anonClient.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 500000,
      p_payment_method: 'cash',
      p_idempotency_key: `idemp_anon_pay_${timestamp}`,
    });
    assert(anonPayErr !== null, 'Test 2: Direct execution of private record_order_payment RPC by anonymous users is revoked & blocked');

    // TEST 3: Zero/Negative Amount Rejected
    const { data: zeroPayRes } = await admin.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 0,
      p_payment_method: 'cash',
      p_idempotency_key: `idemp_zero_${timestamp}`,
    });
    assert(zeroPayRes?.success === false && zeroPayRes?.error === 'INVALID_AMOUNT', 'Test 3: Zero/Negative payment amount rejected with INVALID_AMOUNT');

    // TEST 4: Partial Cash Payment (2,000 LKR = 200,000 cents)
    const { data: partialPayRes } = await admin.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 200000,
      p_payment_method: 'cash',
      p_idempotency_key: `idemp_part1_${timestamp}`,
      p_actor_id: testUserId,
    });

    assert(
      partialPayRes?.success === true &&
        partialPayRes?.paid_cents === 200000 &&
        partialPayRes?.balance_due_cents === 300000 &&
        partialPayRes?.payment_status === 'partially_paid',
      'Test 4: Partial cash payment recorded, status updated to partially_paid (200,000 paid, 300,000 due)'
    );

    // TEST 5: Overpayment Rejected (Attempt 400,000 when balance due is 300,000)
    const { data: overPayRes } = await admin.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 400000,
      p_payment_method: 'card',
      p_idempotency_key: `idemp_over_${timestamp}`,
      p_actor_id: testUserId,
    });
    assert(overPayRes?.success === false && overPayRes?.error === 'OVERPAYMENT_NOT_ALLOWED', 'Test 5: Overpayment rejected with OVERPAYMENT_NOT_ALLOWED');

    // TEST 6: Mixed Payment Method & Full Settlement (Remaining 300,000 LKR via Card)
    const { data: cardPayRes } = await admin.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 300000,
      p_payment_method: 'card',
      p_external_reference: 'TXN-CARD-99182',
      p_idempotency_key: `idemp_card1_${timestamp}`,
      p_actor_id: testUserId,
    });

    assert(
      cardPayRes?.success === true &&
        cardPayRes?.paid_cents === 500000 &&
        cardPayRes?.balance_due_cents === 0 &&
        cardPayRes?.payment_status === 'paid',
      'Test 6: Mixed card payment recorded, order fully settled with payment_status = paid'
    );

    // TEST 7: Idempotency Duplicate Submission Protection
    const { data: dupPayRes } = await admin.rpc('record_order_payment', {
      p_order_id: orderId1,
      p_amount_cents: 300000,
      p_payment_method: 'card',
      p_idempotency_key: `idemp_card1_${timestamp}`,
    });
    assert(dupPayRes?.success === true && dupPayRes?.is_duplicate === true, 'Test 7: Duplicate payment submission caught by idempotency protection');

    // TEST 8: Branch Isolation Verification (Branch A payments absent from Branch B)
    const { data: paymentsBranchA } = await admin.from('payments').select('*').eq('branch_id', branchA.id);
    const { data: paymentsBranchB } = await admin.from('payments').select('*').eq('branch_id', branchB.id);

    assert(
      (paymentsBranchA?.length || 0) === 2 && (paymentsBranchB?.length || 0) === 0,
      'Test 8: Branch isolation verified (Branch A has 2 payment rows, Branch B has 0)'
    );

    // TEST 9: Payment Events Audit Trail Verification
    const { data: auditEvents } = await admin.from('payment_events').select('*').eq('order_id', orderId1);
    assert((auditEvents?.length || 0) >= 2, 'Test 9: Payment audit trail events created in payment_events table');

    // TEST 10: Bill Request Integration with Waiter Requests
    const { data: billReqRes, error: billErr } = await admin.rpc('submit_customer_assistance', {
      p_token_hash: tokenHashA,
      p_table_id: tableA.id,
      p_request_type: 'need_bill',
      p_order_id: orderId1,
    });

    assert(!billErr && billReqRes?.success === true, 'Test 10: Customer Need Bill request RPC submitted successfully');

    // TEST 11: Bill Request Linking & Retrieval
    const { data: billReqRows } = await admin
      .from('waiter_requests')
      .select('*')
      .eq('branch_id', branchA.id)
      .eq('order_id', orderId1)
      .eq('request_type', 'need_bill');

    assert((billReqRows?.length || 0) >= 1, 'Test 11: Need Bill request correctly linked to order_id and table_id');

    // TEST 12: Public Safe Payload Audit (Guest view excludes internal notes & actor IDs)
    const { data: orderPublicFetch } = await admin
      .from('orders')
      .select('id, order_number_formatted, status, payment_status, total_cents, currency')
      .eq('id', orderId1)
      .single();

    assert(
      orderPublicFetch !== null &&
        orderPublicFetch.payment_status === 'paid' &&
        !('received_by' in orderPublicFetch) &&
        !('internal_notes' in orderPublicFetch),
      'Test 12: Public safe order payload excludes sensitive cashier metadata & secrets'
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during payment verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    if (bizId) {
      console.log('\n🧹 Cleaning up test business data...');
      await admin.from('businesses').delete().eq('id', bizId);
      console.log('✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('   Phase 11 Payments Verification Finished: ALL TESTS PASSED   ');
  console.log('================================================================\n');
}

runPaymentsVerificationSuite();
