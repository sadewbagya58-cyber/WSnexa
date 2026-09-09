import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
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

let passed = 0;
let failed = 0;

function assert(condition: unknown, testName: string, detail?: string) {
  if (Boolean(condition)) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('      WSNexa Phase 38: Order Cancellation & Adjustment Suite    ');
  console.log('================================================================\n');

  // 1. Fetch a valid menu item and matching branch for test fixture setup
  const { data: menuItem, error: menuErr } = await admin
    .from('menu_items')
    .select('id, name, price_cents, business_id')
    .limit(1)
    .single();

  if (menuErr || !menuItem) {
    console.error('Failed to find a menu item for testing:', menuErr);
    process.exit(1);
  }

  const businessId = menuItem.business_id;
  const menuItemId = menuItem.id;
  const itemName = menuItem.name;
  const itemPrice = menuItem.price_cents || 1200;

  const { data: branch, error: branchErr } = await admin
    .from('branches')
    .select('id, business_id, name')
    .eq('business_id', businessId)
    .limit(1)
    .single();

  if (branchErr || !branch) {
    console.error('Failed to find a branch matching business:', branchErr);
    process.exit(1);
  }

  const branchId = branch.id;

  const { data: usersData } = await admin.auth.admin.listUsers();
  const testUserId = usersData?.users?.[0]?.id || null;

  console.log(`Using Business: ${businessId}, Branch: ${branchId} (${branch.name})`);
  console.log(`Using Menu Item: ${itemName} (${itemPrice} cents)`);
  console.log(`Using User ID for approval tests: ${testUserId || 'null'}\n`);

  const createdOrderIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // CATEGORY 1 & 2: Customer Policy Evaluation (RPC & Service level)
    // -------------------------------------------------------------------------
    console.log('--- Testing Category 1: Customer Cancellation Policies ---');

    // Create a test order in pending status
    const testToken1 = 'token_test_policy_' + Date.now();
    const { data: order1, error: ord1Err } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9901,
        order_number_formatted: '#9901',
        idempotency_key: 'test_cancellation_idemp_' + Date.now(),
        access_token: testToken1,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: itemPrice,
        total_cents: itemPrice,
        currency: 'USD',
      })
      .select()
      .single();

    if (ord1Err || !order1) {
      throw new Error(`Failed to create test order 1: ${ord1Err?.message}`);
    }
    createdOrderIds.push(order1.id);

    // Insert order item
    const { data: item1 } = await admin
      .from('order_items')
      .insert({
        order_id: order1.id,
        menu_item_id: menuItemId,
        item_name_snapshot: itemName,
        unit_price_cents_snapshot: itemPrice,
        quantity: 2,
        line_subtotal_cents: itemPrice * 2,
        status: 'active',
        cancelled_quantity: 0,
      })
      .select()
      .single();

    const { CancellationService } = await import('@/server/services/cancellation.service');

    // Test 1: Policy evaluation with invalid access token (Ownership Gate)
    const authFailEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      'invalid_token_123',
      null
    );
    assert(!authFailEval.canCancel, 'Ownership Gate: Rejects invalid guestAccessToken');

    // Test 2: Policy evaluation with valid access token on pending order
    const authSuccessEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      testToken1,
      null
    );
    assert(authSuccessEval.canCancel, 'Policy Gate: Allows cancellation on pending order when policy is before_confirmation');

    // Test 3: Update branch policy to 'disabled' and test rejection
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        customer_cancellation_policy: 'disabled',
      }, { onConflict: 'branch_id' });

    const disabledEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      testToken1,
      null
    );
    assert(!disabledEval.canCancel, 'Policy Gate: Policy "disabled" strictly blocks customer cancellation');
    assert(disabledEval.reason?.includes('disabled'), 'Policy Gate: Correct user-facing disabled reason message');

    // Test 4: Policy 'before_confirmation' on confirmed order
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        customer_cancellation_policy: 'before_confirmation',
      }, { onConflict: 'branch_id' });

    await admin
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', order1.id);

    const confirmedEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      testToken1,
      null
    );
    assert(!confirmedEval.canCancel, 'Policy Gate: Policy "before_confirmation" blocks customer once status is confirmed');

    // Test 5: Policy 'before_preparation' allows confirmed order
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        customer_cancellation_policy: 'before_preparation',
      }, { onConflict: 'branch_id' });

    const beforePrepEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      testToken1,
      null
    );
    assert(beforePrepEval.canCancel, 'Policy Gate: Policy "before_preparation" allows confirmed order before prep');

    // -------------------------------------------------------------------------
    // CATEGORY 3: Immutability of Completed Orders
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 2: Immutability Protection ---');

    // Set order to completed
    await admin
      .from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', order1.id);

    const completedEval = await CancellationService.evaluateCustomerCancellationPolicy(
      order1.id,
      testToken1,
      null
    );
    assert(!completedEval.canCancel, 'Immutability: Policy evaluator strictly blocks completed orders');

    // Attempt cancellation on completed order via engine
    const completedCancelRes = await CancellationService.cancelOrder({
      orderId: order1.id,
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: 'mistake',
      guestAccessToken: testToken1,
    });
    assert(!completedCancelRes.success, 'Immutability: cancelOrder engine rejects cancellation of completed order');
    assert(completedCancelRes.code === 'ORDER_ALREADY_COMPLETED' || completedCancelRes.code === 'POLICY_VIOLATION',
      'Immutability: Returns expected order completion rejection code');

    // -------------------------------------------------------------------------
    // CATEGORY 4: Atomic Full-Order Cancellation & Refund Decoupling
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 3: Atomic Cancellation & Refund Flags ---');

    // Create a new unpaid test order
    const testToken2 = 'token_test_atomic_' + Date.now();
    const { data: order2 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9902,
        order_number_formatted: '#9902',
        idempotency_key: 'test_cancellation_idemp_2_' + Date.now(),
        access_token: testToken2,
        status: 'pending',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: 2400,
        total_cents: 2400,
        currency: 'USD',
      })
      .select()
      .single();

    createdOrderIds.push(order2.id);

    // Insert 2 items
    await admin.from('order_items').insert([
      {
        order_id: order2.id,
        menu_item_id: menuItemId,
        item_name_snapshot: 'Item Alpha',
        unit_price_cents_snapshot: 1200,
        quantity: 1,
        line_subtotal_cents: 1200,
        status: 'active',
        cancelled_quantity: 0,
      },
      {
        order_id: order2.id,
        menu_item_id: menuItemId,
        item_name_snapshot: 'Item Beta',
        unit_price_cents_snapshot: 1200,
        quantity: 1,
        line_subtotal_cents: 1200,
        status: 'active',
        cancelled_quantity: 0,
      },
    ]);

    // Restore policy to before_confirmation
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        customer_cancellation_policy: 'before_confirmation',
      }, { onConflict: 'branch_id' });

    // Cancel unpaid order as customer
    const cancelUnpaidRes = await CancellationService.cancelOrder({
      orderId: order2.id,
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: 'customer_change_of_mind',
      reasonNotes: 'Testing customer cancel',
      guestAccessToken: testToken2,
    });

    assert(cancelUnpaidRes.success, 'Atomic Engine: cancelOrder succeeds for pending unpaid order');

    // Verify order record state
    const { data: cancelledOrder2 } = await admin
      .from('orders')
      .select('status, refund_eligibility, cancelled_at, cancellation_reason')
      .eq('id', order2.id)
      .single();

    assert(cancelledOrder2?.status === 'cancelled', 'Atomic Engine: Order status transitioned to "cancelled"');
    assert(cancelledOrder2?.refund_eligibility === 'not_applicable', 'Refund Decoupling: Unpaid order marked refund_eligibility = "not_applicable"');
    assert(Boolean(cancelledOrder2?.cancelled_at), 'Audit State: cancelled_at timestamp recorded');

    // Verify all items transitioned to cancelled
    const { data: cancelledItems2 } = await admin
      .from('order_items')
      .select('status, cancelled_quantity, quantity')
      .eq('order_id', order2.id);

    assert(
      cancelledItems2?.every((i) => i.status === 'cancelled' && i.cancelled_quantity === i.quantity),
      'Atomic Engine: All line items automatically marked status="cancelled" and cancelled_quantity=quantity'
    );

    // Verify order_cancellations ledger entry
    const { data: ledgerEntry2 } = await admin
      .from('order_cancellations')
      .select('cancellation_scope, channel, requested_by_type, refund_required')
      .eq('order_id', order2.id)
      .single();

    assert(Boolean(ledgerEntry2), 'Audit Ledger: Dedicated order_cancellations row recorded');
    assert(ledgerEntry2?.refund_required === false, 'Refund Decoupling: refund_required is false for unpaid order');

    // -------------------------------------------------------------------------
    // CATEGORY 5: Paid Order Cancellation (Refund Required Flag)
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 4: Paid Order Cancellation & Refund Flag ---');

    const testToken3 = 'token_test_paid_' + Date.now();
    const { data: order3 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9903,
        order_number_formatted: '#9903',
        idempotency_key: 'test_cancellation_idemp_3_' + Date.now(),
        access_token: testToken3,
        status: 'pending',
        payment_status: 'paid',
        payment_method: 'card',
        subtotal_cents: 3500,
        total_cents: 3500,
        currency: 'USD',
      })
      .select()
      .single();

    createdOrderIds.push(order3.id);

    const cancelPaidRes = await CancellationService.cancelOrder({
      orderId: order3.id,
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: 'ordered_by_mistake',
      reasonNotes: 'Wrong card was used',
      guestAccessToken: testToken3,
    });

    assert(cancelPaidRes.success, 'Atomic Engine: Cancel paid order succeeds');

    const { data: cancelledOrder3 } = await admin
      .from('orders')
      .select('status, refund_eligibility')
      .eq('id', order3.id)
      .single();

    assert(cancelledOrder3?.refund_eligibility === 'eligible', 'Refund Decoupling: Paid cancelled order flagged refund_eligibility = "eligible"');

    const { data: ledgerEntry3 } = await admin
      .from('order_cancellations')
      .select('refund_required')
      .eq('order_id', order3.id)
      .single();

    assert(ledgerEntry3?.refund_required === true, 'Refund Decoupling: ledger entry refund_required = true for paid order');

    // -------------------------------------------------------------------------
    // CATEGORY 6: Item-Level Cancellation & Proportional Consumption Reversal
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 5: Item-Level Adjustment & RPC ---');

    const testToken4 = 'token_test_item_' + Date.now();
    const { data: order4 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9904,
        order_number_formatted: '#9904',
        idempotency_key: 'test_cancellation_idemp_4_' + Date.now(),
        access_token: testToken4,
        status: 'confirmed',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: 3600,
        total_cents: 3600,
        currency: 'USD',
      })
      .select()
      .single();

    createdOrderIds.push(order4.id);

    const { data: item4 } = await admin
      .from('order_items')
      .insert({
        order_id: order4.id,
        menu_item_id: menuItemId,
        item_name_snapshot: 'Adjustable Burger',
        unit_price_cents_snapshot: 1200,
        quantity: 3,
        line_subtotal_cents: 3600,
        status: 'active',
        cancelled_quantity: 0,
      })
      .select()
      .single();

    // Call reverse_order_item_consumption RPC directly for partial cancellation (1 of 3)
    const { data: rpcPartial, error: rpcPartialErr } = await admin.rpc('reverse_order_item_consumption', {
      p_order_id: order4.id,
      p_order_item_id: item4.id,
      p_cancelled_qty: 1,
      p_disposition: 'return_to_stock',
      p_reason: 'Customer requested 1 less burger',
    });

    assert(!rpcPartialErr && rpcPartial?.success, 'Item Reversal RPC: Partial line reversal (1 of 3) executes successfully');

    // Verify item row state after partial cancellation
    const { data: item4Updated } = await admin
      .from('order_items')
      .select('status, cancelled_quantity, quantity')
      .eq('id', item4.id)
      .single();

    assert(item4Updated?.status === 'partially_cancelled', 'Item Lifecycle: Status updated to "partially_cancelled"');
    assert(item4Updated?.cancelled_quantity === 1, 'Item Lifecycle: cancelled_quantity incremented to 1');

    // Call reverse_order_item_consumption RPC for remaining items (2 of remaining 2)
    const { data: rpcFull, error: rpcFullErr } = await admin.rpc('reverse_order_item_consumption', {
      p_order_id: order4.id,
      p_order_item_id: item4.id,
      p_cancelled_qty: 2,
      p_disposition: 'return_to_stock',
      p_reason: 'Customer cancelled remaining 2 burgers',
    });

    assert(!rpcFullErr && rpcFull?.success, 'Item Reversal RPC: Full remaining reversal executes without constraint conflicts');

    const { data: item4Final } = await admin
      .from('order_items')
      .select('status, cancelled_quantity, quantity')
      .eq('id', item4.id)
      .single();

    assert(item4Final?.status === 'cancelled', 'Item Lifecycle: Status updated to "cancelled" once all items cancelled');
    assert(item4Final?.cancelled_quantity === 3, 'Item Lifecycle: cancelled_quantity equals original quantity (3 of 3)');

    // -------------------------------------------------------------------------
    // CATEGORY 7: Manager Approval Workflow
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 6: Manager Approval Workflow ---');

    const testToken5 = 'token_test_approval_' + Date.now();
    const { data: order5 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9905,
        order_number_formatted: '#9905',
        idempotency_key: 'test_cancellation_idemp_5_' + Date.now(),
        access_token: testToken5,
        status: 'preparing',
        payment_status: 'unpaid',
        payment_method: 'pay_at_counter',
        subtotal_cents: 1500,
        total_cents: 1500,
        currency: 'USD',
      })
      .select()
      .single();

    createdOrderIds.push(order5.id);

    // Create cancellation approval request
    const approvalReqRes = await CancellationService.requestCancellationApproval({
      orderId: order5.id,
      channel: 'kitchen_kds',
      requestedByUserId: testUserId,
      reasonCategory: 'kitchen_mistake',
      reasonNotes: 'Wrong seasoning added',
    });

    assert(approvalReqRes.success, 'Approval Workflow: requestCancellationApproval creates pending request');
    assert(Boolean(approvalReqRes.requestId), 'Approval Workflow: Returns created requestId');

    if (approvalReqRes.requestId) {
      // Resolve rejection first
      const rejectRes = await CancellationService.resolveCancellationApproval(
        approvalReqRes.requestId,
        'rejected',
        testUserId,
        'Manager denied cancellation'
      );
      assert(rejectRes.success, 'Approval Workflow: resolveCancellationApproval handles "rejected" decision');

      const { data: rejectedReq } = await admin
        .from('order_cancellations')
        .select('approval_status')
        .eq('id', approvalReqRes.requestId)
        .single();
      assert(rejectedReq?.approval_status === 'rejected', 'Approval Workflow: Request record marked "rejected"');
    }

    // -------------------------------------------------------------------------
    // CATEGORY 8: Idempotent Full-Order Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- Testing Category 7: Idempotent Replays ---');

    const replayRes = await CancellationService.cancelOrder({
      orderId: order2.id, // already cancelled in Category 4
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: 'mistake',
      guestAccessToken: testToken2,
    });

    assert(replayRes.success && replayRes.idempotent, 'Idempotency: Replaying cancelOrder on cancelled order returns idempotent success');

  } finally {
    // Cleanup test fixtures
    console.log('\n--- Cleaning up test fixtures ---');
    if (createdOrderIds.length > 0) {
      await admin.from('order_cancellations').delete().in('order_id', createdOrderIds);
      await admin.from('order_items').delete().in('order_id', createdOrderIds);
      await admin.from('order_status_history').delete().in('order_id', createdOrderIds);
      await admin.from('orders').delete().in('id', createdOrderIds);
      console.log(`Cleaned up ${createdOrderIds.length} test orders.`);
    }

    // Restore branch security settings to default
    await admin
      .from('branch_order_security_settings')
      .update({ customer_cancellation_policy: 'before_confirmation' })
      .eq('branch_id', branchId);
  }

  console.log('\n================================================================');
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
