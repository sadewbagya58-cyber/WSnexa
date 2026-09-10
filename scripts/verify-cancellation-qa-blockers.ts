// Bypass server-only guard for direct tsx execution
try {
  // @ts-expect-error Mock server-only in standalone script
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {
  // Ignore
}

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local BEFORE importing any app modules
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
    console.error(`❌ [FAIL] ${testName}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      return res;
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw new Error('Retry limit reached');
}

async function run() {
  console.log('================================================================');
  console.log('   WSNexa Phase 38: Order Cancellation QA Blocker Verification  ');
  console.log('================================================================\n');

  const { CancellationService } = await import('../src/server/services/cancellation.service');
  const { WaiterService } = await import('../src/server/services/waiter.service');

  // 1. Resolve business fixture with active staff membership, branch, and menu item
  const { data: mems } = await admin
    .from('business_memberships')
    .select('business_id, user_id, role')
    .eq('membership_status', 'active');

  let businessId = '';
  let branchId = '';
  let branchName = '';
  let menuItem: { id: string; name: string; price_cents: number } | null = null;
  let testStaffUserId: string | null = null;
  let staffRole = '';

  for (const m of mems || []) {
    const { data: br } = await admin.from('branches').select('id, name').eq('business_id', m.business_id).limit(1);
    const { data: mi } = await admin.from('menu_items').select('id, name, price_cents').eq('business_id', m.business_id).limit(1);
    if (br?.length && mi?.length) {
      businessId = m.business_id;
      branchId = br[0].id;
      branchName = br[0].name;
      menuItem = mi[0];
      testStaffUserId = m.user_id;
      staffRole = m.role;
      break;
    }
  }

  if (!businessId || !branchId || !menuItem || !testStaffUserId) {
    throw new Error('Failed to find matching business fixture with branch, menu item, and staff membership');
  }

  // 2. Fetch dining table if available
  const { data: table } = await admin
    .from('dining_tables')
    .select('id, name, table_number, service_area_id')
    .eq('branch_id', branchId)
    .limit(1)
    .maybeSingle();

  // 3. Ensure branch order security settings allow customer cancellation initially
  await admin
    .from('branch_order_security_settings')
    .upsert({
      branch_id: branchId,
      business_id: businessId,
      allow_customer_cancellation: true,
      customer_cancellation_policy: 'before_confirmation',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'branch_id' });

  // 4. Ensure storage location and inventory item exist for inventory waste testing (Finding #6)
  let { data: storageLoc } = await admin
    .from('inventory_storage_locations')
    .select('id')
    .eq('branch_id', branchId)
    .limit(1)
    .maybeSingle();

  if (!storageLoc) {
    const { data: newLoc } = await admin
      .from('inventory_storage_locations')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        name: 'Main Kitchen',
        location_type: 'kitchen',
      })
      .select('id')
      .single();
    storageLoc = newLoc;
  }

  let { data: invItem } = await admin
    .from('inventory_items')
    .select('id, name, base_unit')
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle();

  if (!invItem) {
    const { data: newInv } = await admin
      .from('inventory_items')
      .insert({
        business_id: businessId,
        name: 'Fresh Ingredients',
        base_unit: 'kg',
        item_type: 'raw_ingredient',
      })
      .select('id, name, base_unit')
      .single();
    invItem = newInv;
  }

  console.log(`Business: ${businessId}`);
  console.log(`Branch: ${branchName} (${branchId})`);
  console.log(`Menu Item: ${menuItem.name} (${menuItem.id})`);
  console.log(`Table: ${table?.name || 'Table 1'} (${table?.id || 'none'})`);
  console.log(`Staff Actor: ${testStaffUserId} (role: ${staffRole})\n`);

  const createdOrderIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // QA Finding #1: CANCELLED Orders Terminal Invariant & Resurrection Prevention
    // -------------------------------------------------------------------------
    console.log('--- Testing QA Finding #1: Terminal Cancelled State & No Waiter Resurrection ---');

    const testToken1 = 'token_test_resurrection_' + Date.now();
    const { data: order1, error: ord1Err } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9941,
        order_number_formatted: '#9941',
        idempotency_key: 'test_resurrection_idemp_' + Date.now(),
        access_token: testToken1,
        status: 'pending',
        approval_status: 'pending_waiter_approval',
        table_id: table?.id || null,
        service_area_id: table?.service_area_id || null,
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id, status, approval_status')
      .single();

    if (ord1Err || !order1) {
      throw new Error(`Failed to create order1: ${ord1Err?.message}`);
    }
    createdOrderIds.push(order1.id);

    // Verify it initially shows in pending approvals
    const initialApprovals = await WaiterService.getPendingApprovalsForWaiter(branchId, testStaffUserId || '00000000-0000-0000-0000-000000000000');
    const showsInitially = initialApprovals.some((o: any) => o.id === order1.id);
    assert(showsInitially, 'Order shows in pending approvals queue initially');

    // Cancel order as customer
    const cancelRes1 = await CancellationService.cancelOrder({
      orderId: order1.id,
      channel: 'customer_qr',
      requestedByType: 'customer',
      reasonCategory: 'customer_change_of_mind',
      reasonNotes: 'Testing resurrection prevention',
      guestAccessToken: testToken1,
    });
    assert(cancelRes1.success, 'Order cancelled successfully via CancellationService');

    // Verify DB state: status === 'cancelled' AND approval_status === 'cancelled'
    const { data: order1After } = await admin
      .from('orders')
      .select('status, approval_status, cancelled_at')
      .eq('id', order1.id)
      .single();

    assert(order1After?.status === 'cancelled', 'Order status in DB is strictly cancelled');
    assert(order1After?.approval_status === 'rejected', 'Order approval_status in DB dismissed to rejected');
    assert(Boolean(order1After?.cancelled_at), 'Order cancelled_at timestamp recorded');

    // Verify it has vanished from pending approvals
    const approvalsAfter = await WaiterService.getPendingApprovalsForWaiter(branchId, testStaffUserId || '00000000-0000-0000-0000-000000000000');
    const vanished = !approvalsAfter.some((o: any) => o.id === order1.id);
    assert(vanished, 'Cancelled order no longer appears in pending approvals queue');

    // Attempt to approve the cancelled order: MUST fail
    const approveAttempt = await WaiterService.approveGuestOrder(order1.id, testStaffUserId || '00000000-0000-0000-0000-000000000000');
    assert(!approveAttempt.success, 'WaiterService.approveGuestOrder strictly rejects cancelled order', approveAttempt.message);

    // Verify status was NOT modified
    const { data: order1Check } = await admin.from('orders').select('status').eq('id', order1.id).single();
    assert(order1Check?.status === 'cancelled', 'Order status remains cancelled after rejection of approval attempt');

    // -------------------------------------------------------------------------
    // QA Finding #3: Allow Customer Cancellation Venue Master Switch
    // -------------------------------------------------------------------------
    console.log('\n--- Testing QA Finding #3: Master Switch allow_customer_cancellation ---');

    // Disable customer cancellation in branch settings
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        allow_customer_cancellation: false,
        customer_cancellation_policy: 'before_confirmation',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id' });

    const testToken3 = 'token_test_switch_' + Date.now();
    const { data: order3 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9943,
        order_number_formatted: '#9943',
        idempotency_key: 'test_switch_idemp_' + Date.now(),
        access_token: testToken3,
        status: 'pending',
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (order3) createdOrderIds.push(order3.id);

    const evalDisabled = await CancellationService.evaluateCustomerCancellationPolicy(order3!.id, testToken3);
    assert(!evalDisabled.canCancel, 'evaluateCustomerCancellationPolicy returns canCancel=false when allow_customer_cancellation=false');
    assert(evalDisabled.policy === 'disabled', 'Policy reported as disabled');

    // Now re-enable customer cancellation
    await admin
      .from('branch_order_security_settings')
      .upsert({
        branch_id: branchId,
        business_id: businessId,
        allow_customer_cancellation: true,
        customer_cancellation_policy: 'before_confirmation',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'branch_id' });

    const evalEnabled = await CancellationService.evaluateCustomerCancellationPolicy(order3!.id, testToken3);
    assert(evalEnabled.canCancel, 'evaluateCustomerCancellationPolicy returns canCancel=true when re-enabled and pending');

    // -------------------------------------------------------------------------
    // QA Finding #4: Expanded Customer Cancellation Stage Policies
    // -------------------------------------------------------------------------
    // Order in 'preparing' status
    const testToken4a = 'token_test_prep_' + Date.now();
    const { data: order4a } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9944,
        order_number_formatted: '#9944',
        idempotency_key: 'test_prep_idemp_' + Date.now(),
        access_token: testToken4a,
        status: 'preparing',
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (order4a) createdOrderIds.push(order4a.id);

    // Test during_preparation policy
    const evalDuringPrep = await CancellationService.evaluateCustomerCancellationPolicy(
      order4a!.id,
      testToken4a,
      null,
      {
        allow_customer_cancellation: true,
        customer_cancellation_policy: 'during_preparation',
      }
    );
    assert(evalDuringPrep.canCancel, 'during_preparation policy permits cancellation while preparing');

    // Order in 'ready' status with during_preparation policy: should NOT be permitted
    await admin.from('orders').update({ status: 'ready' }).eq('id', order4a!.id);
    const evalAfterPrep = await CancellationService.evaluateCustomerCancellationPolicy(
      order4a!.id,
      testToken4a,
      null,
      {
        allow_customer_cancellation: true,
        customer_cancellation_policy: 'during_preparation',
      }
    );
    assert(!evalAfterPrep.canCancel, 'during_preparation policy blocks cancellation when food is ready');

    // Test until_ready policy
    const evalUntilReady = await CancellationService.evaluateCustomerCancellationPolicy(
      order4a!.id,
      testToken4a,
      null,
      {
        allow_customer_cancellation: true,
        customer_cancellation_policy: 'until_ready',
      }
    );
    assert(evalUntilReady.canCancel, 'until_ready policy permits cancellation when food is ready');

    // Once completed, cannot be cancelled under any customer policy
    await admin.from('orders').update({ status: 'completed' }).eq('id', order4a!.id);
    const evalCompleted = await CancellationService.evaluateCustomerCancellationPolicy(
      order4a!.id,
      testToken4a,
      null,
      {
        allow_customer_cancellation: true,
        customer_cancellation_policy: 'until_ready',
      }
    );
    assert(!evalCompleted.canCancel, 'Completed order is immutable and cannot be cancelled under until_ready policy');

    // -------------------------------------------------------------------------
    // QA Finding #5: Waiter Menu Table Orders Cancellation & Item Adjustment
    // -------------------------------------------------------------------------
    console.log('\n--- Testing QA Finding #5: Waiter Menu Orders & Item Adjustment ---');

    const testToken5 = 'token_test_waiter_menu_' + Date.now();
    const { data: order5 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9945,
        order_number_formatted: '#9945',
        idempotency_key: 'test_waiter_menu_idemp_' + Date.now(),
        access_token: testToken5,
        status: 'confirmed',
        approval_status: 'approved',
        table_id: table?.id || null,
        service_area_id: table?.service_area_id || null,
        subtotal_cents: 2400,
        total_cents: 2400,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (order5) createdOrderIds.push(order5.id);

    const { data: item5, error: item5Err } = await admin
      .from('order_items')
      .insert({
        order_id: order5!.id,
        menu_item_id: menuItem?.id || null,
        item_name_snapshot: menuItem?.name || 'Item 5',
        unit_price_cents_snapshot: 1200,
        quantity: 2,
        cancelled_quantity: 0,
        line_subtotal_cents: 2400,
        status: 'active',
      })
      .select('id, quantity, cancelled_quantity')
      .single();

    if (item5Err || !item5) {
      throw new Error(`Failed to create item5 fixture: ${item5Err?.message}`);
    }

    // Verify getActiveTableOrdersForWaiter returns the table order
    const tableOrders = await WaiterService.getActiveTableOrdersForWaiter(branchId, testStaffUserId || '00000000-0000-0000-0000-000000000000');
    const tableOrderFound = tableOrders.some((o: any) => o.id === order5!.id);
    assert(tableOrderFound, 'Waiter active table orders query returns the active table order');

    // Cancel 1x item via waiter channel
    const cancelItemRes = await CancellationService.cancelOrderItem({
      orderId: order5!.id,
      orderItemId: item5!.id,
      cancelledQuantity: 1,
      channel: 'waiter_menu',
      actorUserId: testStaffUserId || '00000000-0000-0000-0000-000000000000',
      reasonCategory: 'customer_request',
      reasonNotes: 'Waiter adjusted quantity down',
      inventoryDisposition: 'return_to_stock',
    });
    if (!cancelItemRes.success) {
      console.error('[DEBUG cancelItemRes error]:', cancelItemRes);
    }
    assert(cancelItemRes.success, 'Waiter successfully cancelled/adjusted 1x item via waiter_menu channel', cancelItemRes.message || cancelItemRes.code);

    const { data: item5After } = await admin.from('order_items').select('cancelled_quantity, status').eq('id', item5!.id).single();
    assert(item5After?.cancelled_quantity === 1, 'Item cancelled_quantity is 1');
    assert(item5After?.status === 'partially_cancelled', 'Item status is partially_cancelled');

    // Cancel entire order via waiter channel
    const cancelOrder5Res = await CancellationService.cancelOrder({
      orderId: order5!.id,
      channel: 'waiter_menu',
      requestedByType: 'staff',
      reasonCategory: 'customer_walkout',
      reasonNotes: 'Guest left before food served',
      inventoryDisposition: 'return_to_stock',
      actorUserId: testStaffUserId || '00000000-0000-0000-0000-000000000000',
    });
    assert(cancelOrder5Res.success, 'Waiter successfully cancelled entire order via waiter_menu channel');

    // -------------------------------------------------------------------------
    // QA Finding #6: Inventory Waste Logging & Zero Phantom Stock Invariants
    // -------------------------------------------------------------------------
    console.log('\n--- Testing QA Finding #6: Waste Logging & Unconsumed Safety Invariant ---');

    // Case 6A: Preparing food MUST record waste, NEVER return to stock
    const testToken6a = 'token_test_waste_' + Date.now();
    const { data: order6a } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9946,
        order_number_formatted: '#9946',
        idempotency_key: 'test_waste_idemp_' + Date.now(),
        access_token: testToken6a,
        status: 'preparing',
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (order6a) createdOrderIds.push(order6a.id);

    const { data: item6a } = await admin
      .from('order_items')
      .insert({
        order_id: order6a!.id,
        menu_item_id: menuItem.id,
        item_name_snapshot: menuItem.name,
        unit_price_cents_snapshot: 1000,
        quantity: 1,
        cancelled_quantity: 0,
        line_subtotal_cents: 1000,
        status: 'active',
      })
      .select('id')
      .single();

    if (storageLoc && invItem && item6a) {
      await admin.from('inventory_order_consumptions').insert({
        business_id: businessId,
        branch_id: branchId,
        order_id: order6a!.id,
        order_item_id: item6a.id,
        item_id: invItem.id,
        location_id: storageLoc.id,
        quantity_consumed_base: 1,
        unit_cost_cents_snapshot: 100,
        total_cost_cents_snapshot: 100,
        currency: 'USD',
        status: 'consumed',
        idempotency_key: 'cons_test_' + Date.now(),
      });
    }

    // Cancel preparing order requesting 'return_to_stock':
    // The engine MUST override to 'record_waste' because cooking has started
    const cancelRes6a = await CancellationService.cancelOrder({
      orderId: order6a!.id,
      channel: 'waiter_menu',
      requestedByType: 'staff',
      reasonCategory: 'kitchen_mistake',
      inventoryDisposition: 'return_to_stock',
      actorUserId: testStaffUserId || '00000000-0000-0000-0000-000000000000',
    });

    assert(cancelRes6a.success, 'Preparing order cancellation succeeded');
    const { data: audit6a } = await admin
      .from('order_cancellations')
      .select('inventory_disposition')
      .eq('order_id', order6a!.id)
      .single();

    assert(
      audit6a?.inventory_disposition === 'record_waste',
      'Food safety invariant enforced: preparing order disposition strictly overridden to record_waste',
      'Got: ' + audit6a?.inventory_disposition
    );

    // Case 6B: Pending order with 0 consumption records MUST be 'none' (no fake waste, no phantom stock)
    const testToken6b = 'token_test_none_' + Date.now();
    const { data: order6b } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: 9947,
        order_number_formatted: '#9947',
        idempotency_key: 'test_none_idemp_' + Date.now(),
        access_token: testToken6b,
        status: 'pending',
        subtotal_cents: 1000,
        total_cents: 1000,
        currency: 'USD',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (order6b) createdOrderIds.push(order6b.id);

    const cancelRes6b = await CancellationService.cancelOrder({
      orderId: order6b!.id,
      channel: 'waiter_menu',
      requestedByType: 'staff',
      reasonCategory: 'customer_change_of_mind',
      inventoryDisposition: 'record_waste',
      actorUserId: testStaffUserId || '00000000-0000-0000-0000-000000000000',
    });

    assert(cancelRes6b.success, 'Unconsumed pending order cancellation succeeded');
    const { data: audit6b } = await admin
      .from('order_cancellations')
      .select('inventory_disposition')
      .eq('order_id', order6b!.id)
      .single();

    assert(
      audit6b?.inventory_disposition === 'none',
      'Zero fake waste invariant enforced: unconsumed order disposition strictly forced to none',
      'Got: ' + audit6b?.inventory_disposition
    );

  } finally {
    console.log('\nCleaning up test orders...');
    for (const ordId of createdOrderIds) {
      await admin.from('inventory_waste_records').delete().ilike('notes', `%${ordId}%`);
      await admin.from('inventory_consumption_reversals').delete().eq('order_id', ordId);
      await admin.from('inventory_order_consumptions').delete().eq('order_id', ordId);
      await admin.from('order_cancellation_items').delete().eq('cancellation_id', ordId);
      await admin.from('order_cancellations').delete().eq('order_id', ordId);
      await admin.from('order_items').delete().eq('order_id', ordId);
      await admin.from('order_status_history').delete().eq('order_id', ordId);
      await admin.from('orders').delete().eq('id', ordId);
    }
  }

  console.log('\n================================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
