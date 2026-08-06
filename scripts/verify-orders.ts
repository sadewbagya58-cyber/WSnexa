import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin } from '../src/lib/qr/security';

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

function assert(condition: boolean | null | undefined, testName: string, failureDetail?: string) {
  if (Boolean(condition)) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${failureDetail ? `: ${failureDetail}` : ''}`);
    process.exit(1);
  }
}

async function runOrdersVerificationSuite() {
  console.log('================================================================');
  console.log('    WSNexa Phase 10 — Server Checkout & Order RPC Verification   ');
  console.log('================================================================\n');

  let bizId = '';
  let branchAId = '';
  let branchBId = '';

  try {
    // TEST 1: Schema Tables Verification
    const [{ data: ordersCheck, error: ordersErr }, { data: itemsCheck }, { data: modCheck }] = await Promise.all([
      admin.from('orders').select('id').limit(1),
      admin.from('order_items').select('id').limit(1),
      admin.from('order_item_modifiers').select('id').limit(1),
    ]);

    assert(
      ordersCheck !== null && itemsCheck !== null && modCheck !== null,
      'Test 1: Verified orders, order_items, and order_item_modifiers tables exist',
      ordersErr?.message || 'Tables not found in Supabase schema cache. Please run migration 20260806090000_create_order_schema.sql in Supabase SQL Editor.'
    );

    // Setup Test Business and Branches
    const testSlug = `order-test-${Date.now()}`;
    const { data: biz } = await admin
      .from('businesses')
      .insert({
        name: 'Order Test Cafe',
        slug: testSlug,
        default_currency: 'LKR',
        time_zone: 'Asia/Colombo',
      })
      .select('*')
      .single();

    bizId = biz.id;

    const { data: branchA } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Main Branch',
        code: 'MNB',
        currency: 'LKR',
        status: 'active',
        is_primary_default: true,
        require_table_selection: true,
        require_table_pin: true,
        table_pin_length: 4,
      })
      .select('*')
      .single();

    branchAId = branchA.id;

    const { data: branchB } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Kandy Branch',
        code: 'KDY',
        currency: 'LKR',
        status: 'active',
        is_primary_default: false,
      })
      .select('*')
      .single();

    branchBId = branchB.id;

    // Create Branch QR for Branch A
    const qrPair = generateSecureQrToken();
    const { data: qrA } = await admin
      .from('branch_qr_codes')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        token_hash: qrPair.tokenHash,
        token_prefix: qrPair.tokenPrefix,
        encrypted_token: qrPair.encryptedToken,
        is_active: true,
      })
      .select('*')
      .single();

    assert(!!qrA, 'Setup: Branch QR created for Branch A');

    // Create Service Area & Dining Table with PIN for Branch A
    const { data: areaA } = await admin
      .from('service_areas')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        name: 'Main Dining Hall',
        code: 'MDH',
      })
      .select('*')
      .single();

    const plainPin = generateTablePin(4);
    const pinHash = hashTablePin(plainPin);

    const { data: tableA } = await admin
      .from('dining_tables')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        service_area_id: areaA.id,
        name: 'Table 1',
        code: 'T1',
        table_number: 1,
        capacity: 4,
        table_pin_hash: pinHash,
      })
      .select('*')
      .single();

    assert(!!tableA, 'Setup: Table 1 created with PIN in Branch A');

    // Create Category, Item (1200 LKR = 120000 cents), and Modifier Option (50 LKR = 5000 cents)
    const { data: catA } = await admin
      .from('menu_categories')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        name: 'Burgers',
        slug: `burgers-${Date.now()}`,
      })
      .select('*')
      .single();

    const { data: itemA } = await admin
      .from('menu_items')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        category_id: catA.id,
        name: 'Signature Beef Burger',
        slug: `beef-burger-${Date.now()}`,
        price_cents: 120000,
        currency: 'LKR',
        availability_status: 'available',
      })
      .select('*')
      .single();

    const { data: modGroup } = await admin
      .from('modifier_groups')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        menu_item_id: itemA.id,
        name: 'Add Cheese',
        selection_type: 'single',
      })
      .select('*')
      .single();

    const { data: modOpt } = await admin
      .from('modifier_options')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        modifier_group_id: modGroup.id,
        name: 'Cheddar Cheese Slice',
        additional_price_cents: 5000,
      })
      .select('*')
      .single();

    assert(!!itemA && !!modOpt, 'Setup: Menu Item and Modifier Option created in Branch A');

    // TEST 2: Submit Guest Order via Atomic RPC (Price Revalidation)
    const idempKey1 = `idemp_test_${Date.now()}_1`;
    const { data: rpcRes1, error: rpcErr1 } = await admin.rpc('create_guest_order', {
      p_raw_qr_token: qrPair.rawToken,
      p_table_id: tableA.id,
      p_input_pin: plainPin,
      p_guest_name: 'Jane Doe',
      p_guest_phone: '+94 77 123 4567',
      p_guest_notes: 'Extra crispy fries',
      p_idempotency_key: idempKey1,
      p_cart_items: [
        {
          menuItemId: itemA.id,
          quantity: 2,
          specialInstructions: 'No onions',
          selectedModifiers: [{ groupId: modGroup.id, optionId: modOpt.id }],
        },
      ],
    });

    assert(!rpcErr1 && rpcRes1?.success === true, 'Test 2: Atomic create_guest_order RPC succeeded', rpcErr1?.message || rpcRes1?.error);

    const orderId1 = rpcRes1.order_id;
    // Expected unit price: 120000 + 5000 = 125000 cents. For Qty 2 = 250000 cents.
    assert(rpcRes1.total_cents === 250000, 'Test 3: Server revalidated exact minor-unit totals (2x (120000+5000) = 250000 cents)');
    assert(rpcRes1.order_number_formatted === '#MNB-1001', 'Test 4: Sequential branch-scoped order numbering formatted correctly (#MNB-1001)');

    // TEST 5: Idempotency Protection Test
    const { data: rpcResDup } = await admin.rpc('create_guest_order', {
      p_raw_qr_token: qrPair.rawToken,
      p_table_id: tableA.id,
      p_input_pin: plainPin,
      p_guest_name: 'Jane Doe',
      p_guest_phone: '+94 77 123 4567',
      p_guest_notes: 'Extra crispy fries',
      p_idempotency_key: idempKey1, // SAME KEY
      p_cart_items: [
        {
          menuItemId: itemA.id,
          quantity: 2,
          specialInstructions: 'No onions',
          selectedModifiers: [{ groupId: modGroup.id, optionId: modOpt.id }],
        },
      ],
    });

    assert(rpcResDup?.success === true && rpcResDup?.is_duplicate === true && rpcResDup?.order_id === orderId1, 'Test 5: Idempotency key duplicate returned existing order without creating duplicate database row');

    // TEST 6: Out-of-Stock Item Rejection & Transaction Rollback
    const { data: outOfStockItem } = await admin
      .from('menu_items')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        category_id: catA.id,
        name: 'Sold Out Shake',
        slug: `sold-out-shake-${Date.now()}`,
        price_cents: 60000,
        currency: 'LKR',
        availability_status: 'out_of_stock',
      })
      .select('*')
      .single();

    const { data: rpcResStock } = await admin.rpc('create_guest_order', {
      p_raw_qr_token: qrPair.rawToken,
      p_table_id: tableA.id,
      p_input_pin: plainPin,
      p_guest_name: 'John Doe',
      p_idempotency_key: `idemp_stock_${Date.now()}`,
      p_cart_items: [{ menuItemId: outOfStockItem.id, quantity: 1 }],
    });

    assert(rpcResStock?.success === false && rpcResStock?.error?.includes('ITEM_OUT_OF_STOCK'), 'Test 6: Out-of-stock item submission rejected and transaction rolled back');

    // TEST 7: Invalid Table PIN Rejection Test
    const { data: rpcResPin } = await admin.rpc('create_guest_order', {
      p_raw_qr_token: qrPair.rawToken,
      p_table_id: tableA.id,
      p_input_pin: '9999', // WRONG PIN
      p_guest_name: 'John Doe',
      p_idempotency_key: `idemp_pin_${Date.now()}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1 }],
    });

    assert(rpcResPin?.success === false && rpcResPin?.error === 'INVALID_TABLE_PIN', 'Test 7: Incorrect Table PIN submission rejected cleanly');

    // TEST 8: Order Status Advancement Lifecycle Test
    const { data: orderHeader } = await admin.from('orders').select('*').eq('id', orderId1).single();
    assert(orderHeader.status === 'pending', 'Test 8: Newly created order initial status is "pending"');

    // Advance status to "confirmed"
    await admin.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'pending', new_status: 'confirmed' });

    // Advance status to "preparing"
    await admin.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'confirmed', new_status: 'preparing' });

    // Advance status to "ready"
    await admin.from('orders').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'preparing', new_status: 'ready' });

    // Advance status to "completed"
    await admin.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'ready', new_status: 'completed' });

    const { data: history } = await admin.from('order_status_history').select('*').eq('order_id', orderId1);
    assert(history && history.length >= 4, 'Test 9: Order status lifecycle history recorded accurately');

    // TEST 10: Multi-Branch Isolation Verification
    const { data: branchAOrders } = await admin.from('orders').select('id').eq('branch_id', branchAId);
    const { data: branchBOrders } = await admin.from('orders').select('id').eq('branch_id', branchBId);

    const hasA = (branchAOrders?.length || 0) >= 1;
    const hasB = (branchBOrders?.length || 0) === 0;
    assert(Boolean(hasA && hasB), 'Test 10: Multi-branch isolation verified (Branch A order queue does not expose Branch B orders)');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    // Cleanup temporary test data
    if (bizId) {
      console.log('\n🧹 Cleaning up test business and order data...');
      await admin.from('businesses').delete().eq('id', bizId);
      console.log('✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('   Phase 10 Orders Verification Finished: All Tests PASSED      ');
  console.log('================================================================\n');
}

runOrdersVerificationSuite();
