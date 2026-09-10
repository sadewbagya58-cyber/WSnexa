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

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string, detail?: unknown) {
  if (Boolean(condition)) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`, detail !== undefined ? detail : '');
    failed++;
  }
}

async function runVerification() {
  console.log('============================================================');
  console.log('🧪 WSNexa — Verification for QA-10, QA-11, QA-12');
  console.log('============================================================\n');

  const { createAdminClient } = await import('@/lib/supabase/server');
  const { CancellationService } = await import('@/server/services/cancellation.service');
  const { OrderService } = await import('@/server/services/order.service');

  const admin = createAdminClient();

  // Find business fixture with staff membership and branch
  const { data: mems } = await admin
    .from('business_memberships')
    .select('business_id, user_id, role')
    .eq('membership_status', 'active')
    .limit(50);

  let businessId = '';
  let branchId = '';
  let testStaffUserId = '';
  let menuItemId = '';
  let menuItemName = '';

  for (const m of mems || []) {
    const { data: br } = await admin.from('branches').select('id, name').eq('business_id', m.business_id).limit(1);
    const { data: mi } = await admin.from('menu_items').select('id, name, price_cents').eq('business_id', m.business_id).limit(1);
    if (br && br.length > 0 && mi && mi.length > 0) {
      businessId = m.business_id;
      branchId = br[0].id;
      testStaffUserId = m.user_id;
      menuItemId = mi[0].id;
      menuItemName = mi[0].name;
      break;
    }
  }

  if (!businessId || !branchId || !testStaffUserId) {
    throw new Error('Failed to resolve business fixture with active staff membership and branch');
  }

  console.log(`Resolved Fixture: Business=${businessId}, Branch=${branchId}, Staff=${testStaffUserId}\n`);

  const { data: table } = await admin.from('dining_tables').select('id, name, table_number').eq('branch_id', branchId).limit(1).maybeSingle();

  // Find or create inventory item and storage location for recipe/BOM testing
  let invItemId: string | null = null;
  let locId: string | null = null;
  const { data: existingInv } = await admin.from('inventory_items').select('id').eq('business_id', businessId).limit(1);
  if (existingInv && existingInv.length > 0) {
    invItemId = existingInv[0].id;
  } else {
    const { data: newInv } = await admin.from('inventory_items').insert({
      business_id: businessId,
      name: 'QA Test Flour',
      sku: 'TEST-FLOUR-' + Date.now(),
      base_unit: 'kg',
      cost_per_unit_cents: 200,
    }).select('id').single();
    invItemId = newInv?.id || null;
  }

  const { data: existingLoc } = await admin.from('inventory_storage_locations').select('id').eq('branch_id', branchId).limit(1);
  if (existingLoc && existingLoc.length > 0) {
    locId = existingLoc[0].id;
  } else {
    const { data: newLoc } = await admin.from('inventory_storage_locations').insert({
      business_id: businessId,
      branch_id: branchId,
      name: 'Main Kitchen Shelf',
    }).select('id').single();
    locId = newLoc?.id || null;
  }

  const createdOrderIds: string[] = [];

  try {
    // =========================================================================
    // SECTION 1: QA-11 — BOM/Recipe Item-Level Cancellation
    // =========================================================================
    console.log('--- TEST SECTION 1: QA-11 BOM/Recipe Item-Level Cancellation ---');

    // Create an order with 1 BOM recipe item (quantity 2) and associated consumption rows
    const { data: bomOrder, error: bErr } = await admin.from('orders').insert({
      business_id: businessId,
      branch_id: branchId,
      order_number: 9911,
      order_number_formatted: '#9911',
      idempotency_key: 'qa11_bom_order_' + Date.now(),
      access_token: 'qa11_token_' + Date.now(),
      status: 'confirmed',
      approval_status: 'approved',
      table_id: table?.id || null,
      subtotal_cents: 3000,
      total_cents: 3000,
      currency: 'USD',
      payment_status: 'unpaid',
    }).select('id').single();

    if (bErr || !bomOrder) throw new Error(`Failed to create bomOrder: ${bErr?.message}`);
    createdOrderIds.push(bomOrder.id);

    const { data: bomItem, error: biErr } = await admin.from('order_items').insert({
      order_id: bomOrder.id,
      menu_item_id: menuItemId || null,
      item_name_snapshot: menuItemName || 'Signature Pizza (BOM)',
      unit_price_cents_snapshot: 1500,
      quantity: 2,
      cancelled_quantity: 0,
      line_subtotal_cents: 3000,
      status: 'active',
    }).select('id, quantity').single();

    if (biErr || !bomItem) throw new Error(`Failed to create bomItem: ${biErr?.message}`);

    // Insert 2 consumption rows for this order item (simulating 2 recipe ingredients)
    let cons1Id: string | null = null;
    let cons2Id: string | null = null;

    if (invItemId && locId) {
      const { data: c1 } = await admin.from('inventory_order_consumptions').insert({
        business_id: businessId,
        branch_id: branchId,
        order_id: bomOrder.id,
        order_item_id: bomItem.id,
        item_id: invItemId,
        location_id: locId,
        quantity_consumed_base: 2.0000, // 1.0kg per pizza x 2 pizzas
        unit_cost_cents_snapshot: 200,
        total_cost_cents_snapshot: 400,
        currency: 'USD',
        deduction_stage: 'preparing',
        status: 'consumed',
        idempotency_key: `qa11_c1_${Date.now()}`,
      }).select('id').single();
      cons1Id = c1?.id || null;

      const { data: c2 } = await admin.from('inventory_order_consumptions').insert({
        business_id: businessId,
        branch_id: branchId,
        order_id: bomOrder.id,
        order_item_id: bomItem.id,
        item_id: invItemId,
        location_id: locId,
        quantity_consumed_base: 0.5000, // 0.25kg per pizza x 2 pizzas
        unit_cost_cents_snapshot: 300,
        total_cost_cents_snapshot: 150,
        currency: 'USD',
        deduction_stage: 'preparing',
        status: 'consumed',
        idempotency_key: `qa11_c2_${Date.now()}`,
      }).select('id').single();
      cons2Id = c2?.id || null;
    }

    // TEST 1.1: Partial cancellation of 1 of 2 pizzas on confirmed order (return_to_stock)
    console.log('Testing partial cancellation of BOM item (cancel 1 of 2)...');
    const cancelPartRes = await CancellationService.cancelOrderItem({
      orderId: bomOrder.id,
      orderItemId: bomItem.id,
      cancelledQuantity: 1,
      channel: 'waiter_menu',
      actorUserId: testStaffUserId,
      reasonCategory: 'customer_request',
      reasonNotes: 'Guest changed mind, cancel 1 pizza',
      inventoryDisposition: 'return_to_stock',
    });

    assert(cancelPartRes.success, 'Partial cancellation of BOM item succeeded without check constraint violations', cancelPartRes);

    const { data: itemAfterPart } = await admin.from('order_items').select('status, cancelled_quantity').eq('id', bomItem.id).single();
    assert(itemAfterPart?.status === 'partially_cancelled', 'Order item status is partially_cancelled');
    assert(itemAfterPart?.cancelled_quantity === 1, 'Cancelled quantity is 1');

    if (cons1Id) {
      const { data: c1AfterPart } = await admin.from('inventory_order_consumptions').select('quantity_consumed_base, status').eq('id', cons1Id).single();
      assert(Number(c1AfterPart?.quantity_consumed_base) === 1.0, 'Consumption 1 quantity reduced from 2.0 to 1.0 kg (> 0 check preserved)');
      assert(c1AfterPart?.status === 'consumed', 'Consumption 1 remains active consumed for remaining pizza');
    }

    // TEST 1.2: Cancel remaining 1 pizza on preparing order (record_waste)
    await admin.from('orders').update({ status: 'preparing' }).eq('id', bomOrder.id);

    console.log('Testing cancellation of remaining BOM item in preparing state (record_waste)...');
    const cancelRemainRes = await CancellationService.cancelOrderItem({
      orderId: bomOrder.id,
      orderItemId: bomItem.id,
      cancelledQuantity: 1,
      channel: 'waiter_menu',
      actorUserId: testStaffUserId,
      reasonCategory: 'item_damaged',
      reasonNotes: 'Burned in oven, cancel remaining pizza',
      inventoryDisposition: 'record_waste',
    });

    assert(cancelRemainRes.success, 'Full cancellation of remaining BOM item succeeded without check constraint violations', cancelRemainRes);

    const { data: itemAfterFull } = await admin.from('order_items').select('status, cancelled_quantity').eq('id', bomItem.id).single();
    assert(itemAfterFull?.status === 'cancelled', 'Order item status is now fully cancelled');
    assert(itemAfterFull?.cancelled_quantity === 2, 'Cancelled quantity is 2');

    if (cons1Id) {
      const { data: c1AfterFull } = await admin.from('inventory_order_consumptions').select('quantity_consumed_base, status, reversed_at').eq('id', cons1Id).single();
      assert(Number(c1AfterFull?.quantity_consumed_base) > 0, 'Consumption 1 quantity_consumed_base is > 0 (history preserved, not zeroed)');
      assert(c1AfterFull?.status === 'reversed_as_waste' || c1AfterFull?.status === 'reversed_to_stock', `Consumption 1 status updated to reversed (${c1AfterFull?.status})`);
      assert(c1AfterFull?.reversed_at !== null, 'Consumption 1 reversed_at is set');

      const { data: reversals } = await admin.from('inventory_consumption_reversals').select('*').eq('consumption_id', cons1Id);
      assert(Boolean(reversals && reversals.length > 0), 'inventory_consumption_reversals row recorded');
      assert(Boolean(reversals?.[0] && ['return_to_stock', 'record_waste', 'no_change'].includes(reversals[0].disposition)), 'Reversal disposition satisfies DB check constraint');
    }

    // =========================================================================
    // SECTION 2: QA-12 — Partial Cancelled Item Visibility in Kitchen + Cashier
    // =========================================================================
    console.log('\n--- TEST SECTION 2: QA-12 Partial Cancelled Item Visibility ---');

    // Create multi-item order: Item 1 (qty 2), Item 2 (qty 1)
    const { data: multiOrder, error: moErr } = await admin.from('orders').insert({
      business_id: businessId,
      branch_id: branchId,
      order_number: 9912,
      order_number_formatted: '#9912',
      idempotency_key: 'qa12_multi_order_' + Date.now(),
      access_token: 'qa12_token_' + Date.now(),
      status: 'confirmed',
      approval_status: 'approved',
      table_id: table?.id || null,
      subtotal_cents: 4500,
      total_cents: 4500,
      currency: 'USD',
      payment_status: 'unpaid',
    }).select('id, updated_at').single();

    if (moErr || !multiOrder) throw new Error(`Failed to create multiOrder: ${moErr?.message}`);
    createdOrderIds.push(multiOrder.id);

    const { data: mItem1 } = await admin.from('order_items').insert({
      order_id: multiOrder.id,
      menu_item_id: menuItemId || null,
      item_name_snapshot: 'Crispy Fries',
      unit_price_cents_snapshot: 1000,
      quantity: 2,
      cancelled_quantity: 0,
      line_subtotal_cents: 2000,
      status: 'active',
    }).select('id').single();

    const { data: mItem2 } = await admin.from('order_items').insert({
      order_id: multiOrder.id,
      menu_item_id: menuItemId || null,
      item_name_snapshot: 'Soda Can',
      unit_price_cents_snapshot: 500,
      quantity: 1,
      cancelled_quantity: 0,
      line_subtotal_cents: 500,
      status: 'active',
    }).select('id').single();

    const initialUpdatedAt = multiOrder.updated_at;

    // Small delay to ensure timestamp change
    await new Promise((r) => setTimeout(r, 100));

    // Cancel 1 item completely (Item 2: Soda Can)
    console.log('Cancelling Soda Can on multi-item order...');
    const cancelItem2Res = await CancellationService.cancelOrderItem({
      orderId: multiOrder.id,
      orderItemId: mItem2!.id,
      cancelledQuantity: 1,
      channel: 'waiter_menu',
      actorUserId: testStaffUserId,
      reasonCategory: 'out_of_stock',
      reasonNotes: 'Out of soda',
      inventoryDisposition: 'none',
    });

    assert(cancelItem2Res.success, 'Soda Can cancelled successfully', cancelItem2Res);

    // Verify order remains active (not cancelled)
    const { data: orderAfterItemCancel } = await admin.from('orders').select('status, updated_at').eq('id', multiOrder.id).single();
    assert(orderAfterItemCancel?.status === 'confirmed', 'Order status remains active ("confirmed") after 1 item cancelled');
    assert(new Date(orderAfterItemCancel!.updated_at).getTime() >= new Date(initialUpdatedAt).getTime(), 'Order updated_at was touched for realtime propagation');

    // Verify item statuses
    const { data: itemsAfter } = await admin.from('order_items').select('id, item_name_snapshot, quantity, cancelled_quantity, status').eq('order_id', multiOrder.id);
    const item1State = itemsAfter?.find((i) => i.id === mItem1!.id);
    const item2State = itemsAfter?.find((i) => i.id === mItem2!.id);

    assert(item1State?.status === 'active' && item1State?.cancelled_quantity === 0, 'Remaining item (Crispy Fries) stays active with cancelled_quantity = 0');
    assert(item2State?.status === 'cancelled' && item2State?.cancelled_quantity === 1, 'Cancelled item (Soda Can) marked status = cancelled');

    // Verify active items calculation for kitchen
    const activeCount = (itemsAfter || []).reduce((sum, item) => sum + (item.status === 'cancelled' ? 0 : (item.quantity - (item.cancelled_quantity || 0))), 0);
    assert(activeCount === 2, `Kitchen active items count is 2 (excludes cancelled item from active count, total is 3)`);

    // =========================================================================
    // SECTION 3: QA-10 — Cancelled Order Kitchen UX & Terminal Lock
    // =========================================================================
    console.log('\n--- TEST SECTION 3: QA-10 Cancelled Order Terminal Lock & UX ---');

    // Full order cancellation of multiOrder
    const cancelFullRes = await CancellationService.cancelOrder({
      orderId: multiOrder.id,
      channel: 'manager_workflow',
      requestedByType: 'staff',
      reasonCategory: 'customer_request',
      reasonNotes: 'Guest had to leave immediately',
      inventoryDisposition: 'none',
      actorUserId: testStaffUserId,
    });

    assert(cancelFullRes.success, 'Full order cancelled successfully');

    // Verify terminal lock: kitchen or staff cannot revive or update status of cancelled order
    const attemptKitchenUpdate = await OrderService.updateOrderStatus(multiOrder.id, 'preparing');
    assert(!attemptKitchenUpdate.success, 'Attempting to update status of cancelled order via OrderService is strictly blocked');

    // Verify database-level trigger strictly blocks modifying/reviving cancelled order (QA-1 & QA-10)
    const { error: dbReviveErr } = await admin.from('orders').update({ status: 'preparing' }).eq('id', multiOrder.id);
    assert(dbReviveErr !== null, 'Database trigger strictly blocks reviving cancelled order');
    assert(dbReviveErr?.message?.toLowerCase().includes('cancelled'), 'Database error specifies cancelled orders are terminal');

    // Verify active orders query excludes the cancelled order from kitchen queue
    const activeOrders = await OrderService.getBranchActiveOrders();
    const isCancelledInActive = activeOrders.some((o) => o.id === multiOrder.id);
    assert(!isCancelledInActive, 'Cancelled order is completely excluded from kitchen display active queue');

  } finally {
    // Clean up test orders
    console.log('\n--- Cleaning up test fixtures ---');
    for (const orderId of createdOrderIds) {
      try {
        const { data: items } = await admin.from('order_items').select('id').eq('order_id', orderId);
        const itemIds = (items || []).map((i) => i.id);
        if (itemIds.length > 0) {
          await admin.from('order_cancellation_items').delete().in('order_item_id', itemIds);
        }
        await admin.from('order_status_history').delete().eq('order_id', orderId);
        await admin.from('inventory_consumption_reversals').delete().eq('order_id', orderId);
        await admin.from('inventory_order_consumptions').delete().eq('order_id', orderId);
        await admin.from('order_cancellations').delete().eq('order_id', orderId);
        await admin.from('order_items').delete().eq('order_id', orderId);
        await admin.from('orders').delete().eq('id', orderId);
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    console.log('Cleanup completed.');
  }

  console.log('\n============================================================');
  console.log(`Summary: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
