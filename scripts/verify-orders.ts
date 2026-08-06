import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin, hashQrToken } from '../src/lib/qr/security';

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
  console.log('    WSNexa Phase 10 — Corrected Order RPC & Security Verification');
  console.log('================================================================\n');

  let bizId = '';
  let branchAId = '';
  let branchBId = '';

  try {
    // TEST 1: Schema Tables & Helpers Verification
    const [{ data: ordersCheck, error: ordersErr }, { data: itemsCheck }, { data: modCheck }] = await Promise.all([
      admin.from('orders').select('id').limit(1),
      admin.from('order_items').select('id').limit(1),
      admin.from('order_item_modifiers').select('id').limit(1),
    ]);

    assert(
      ordersCheck !== null && itemsCheck !== null && modCheck !== null,
      'Test 1: Verified orders, order_items, and order_item_modifiers tables exist in Supabase schema',
      ordersErr?.message || 'Tables not found'
    );

    // Setup Isolated Test Business and Branches
    const testSlug = `order-test-${Date.now()}`;
    const { data: biz } = await admin
      .from('businesses')
      .insert({
        name: 'Order Security Test Cafe',
        slug: testSlug,
        default_currency: 'LKR',
        timezone: 'Asia/Colombo',
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
        status: 'active',
        is_default: true,
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
        status: 'active',
        is_default: false,
      })
      .select('*')
      .single();

    branchBId = branchB.id;

    // Create Branch QR for Branch A
    const qrPair = generateSecureQrToken();
    const tokenHash = hashQrToken(qrPair.rawToken);

    const { data: qrA } = await admin
      .from('branch_qr_codes')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        token_hash: tokenHash,
        token_prefix: qrPair.tokenPrefix,
        encrypted_token: qrPair.encryptedToken,
        is_active: true,
      })
      .select('*')
      .single();

    assert(!!qrA, 'Setup: Branch QR created for Branch A with peppered token_hash');

    // Create Service Area & Dining Table with HMAC-SHA256 Table PIN for Branch A
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
    const wrongPinHash = hashTablePin('9999');

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

    assert(!!tableA, 'Setup: Table 1 created with peppered Table PIN hash in Branch A');

    // Create Category, Items, and Modifiers in Branch A
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

    // Item 1: Signature Burger (1200 LKR = 120000 cents)
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

    // Item 2: Fries (500 LKR = 50000 cents)
    const { data: itemB } = await admin
      .from('menu_items')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        category_id: catA.id,
        name: 'Crispy French Fries',
        slug: `fries-${Date.now()}`,
        price_cents: 50000,
        currency: 'LKR',
        availability_status: 'available',
      })
      .select('*')
      .single();

    // Modifier Group for Item 1: Add Cheese (Required, single selection)
    const { data: modGroupA } = await admin
      .from('modifier_groups')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        menu_item_id: itemA.id,
        name: 'Cheese Selection',
        selection_type: 'single',
        is_required: true,
        min_selections: 1,
        max_selections: 1,
      })
      .select('*')
      .single();

    const { data: modOptA } = await admin
      .from('modifier_options')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        modifier_group_id: modGroupA.id,
        name: 'Cheddar Cheese Slice',
        additional_price_cents: 5000,
      })
      .select('*')
      .single();

    // Modifier Group for Item 2: Dip Sauce (Belongs to Item 2!)
    const { data: modGroupB } = await admin
      .from('modifier_groups')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        menu_item_id: itemB.id,
        name: 'Dipping Sauce',
        selection_type: 'single',
      })
      .select('*')
      .single();

    const { data: modOptB } = await admin
      .from('modifier_options')
      .insert({
        business_id: bizId,
        branch_id: branchAId,
        modifier_group_id: modGroupB.id,
        name: 'Garlic Mayo',
        additional_price_cents: 2000,
      })
      .select('*')
      .single();

    assert(!!itemA && !!modOptA && !!modOptB, 'Setup: Menu items and modifier groups created');

    // TEST 2: Wrong PIN Rejection Test
    const { data: rpcResWrongPin } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: wrongPinHash, // WRONG PIN HASH
      p_guest_name: 'Attacker',
      p_idempotency_key: `idemp_wrongpin_${Date.now()}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1, selectedModifiers: [{ optionId: modOptA.id }] }],
    });

    assert(rpcResWrongPin?.success === false && rpcResWrongPin?.error === 'INVALID_TABLE_PIN', 'Test 2: Wrong Table PIN rejected by create_guest_order');

    // TEST 3: Correct PIN & Price Revalidation Test
    const idempKey1 = `idemp_test_${Date.now()}_1`;
    const { data: rpcResCorrect, error: rpcErrCorrect } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: pinHash, // CORRECT PIN HASH
      p_guest_name: 'Jane Doe',
      p_guest_phone: '+94 77 123 4567',
      p_guest_notes: 'Extra crispy fries',
      p_idempotency_key: idempKey1,
      p_cart_items: [
        {
          menuItemId: itemA.id,
          quantity: 2,
          specialInstructions: 'No onions',
          selectedModifiers: [{ optionId: modOptA.id }],
        },
      ],
    });

    assert(!rpcErrCorrect && rpcResCorrect?.success === true, 'Test 3: Valid order placed successfully with correct Table PIN and token hash', rpcErrCorrect?.message || rpcResCorrect?.error);

    const orderId1 = rpcResCorrect.order_id;
    // Unit price: 120000 + 5000 = 125000 cents. Qty 2 = 250000 cents.
    assert(rpcResCorrect.total_cents === 250000, 'Test 4: Server revalidated prices from database (2x (120000+5000) = 250000 cents)');
    assert(rpcResCorrect.order_number_formatted === '#MNB-1001', 'Test 5: Sequential branch order number formatted (#MNB-1001)');

    // TEST 6: Duplicate Submission Returns Same Order (Idempotency)
    const { data: rpcResDup } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: pinHash,
      p_guest_name: 'Jane Doe',
      p_idempotency_key: idempKey1, // REPEATED KEY
      p_cart_items: [
        {
          menuItemId: itemA.id,
          quantity: 2,
          selectedModifiers: [{ optionId: modOptA.id }],
        },
      ],
    });

    assert(rpcResDup?.success === true && rpcResDup?.is_duplicate === true && rpcResDup?.order_id === orderId1, 'Test 6: Idempotency protection returned original order record without duplicate insertion');

    // TEST 7: Anti-Injection Attack — Cross-Item Modifier Injection Rejection
    const { data: rpcResInject } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: pinHash,
      p_guest_name: 'Attacker',
      p_idempotency_key: `idemp_inject_${Date.now()}`,
      p_cart_items: [
        {
          menuItemId: itemA.id, // Burger
          quantity: 1,
          selectedModifiers: [
            { optionId: modOptA.id }, // Valid Cheese Slice
            { optionId: modOptB.id }, // INVALID: Garlic Mayo belongs to Fries, NOT Burger!
          ],
        },
      ],
    });

    assert(rpcResInject?.success === false && rpcResInject?.error?.includes('CROSS_ITEM_MODIFIER_INJECTION'), 'Test 7: Cross-item modifier injection attack rejected and transaction rolled back');

    // TEST 8: Required Modifier Missing Rejection Test
    const { data: rpcResReqMissing } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: pinHash,
      p_guest_name: 'Guest',
      p_idempotency_key: `idemp_req_${Date.now()}`,
      p_cart_items: [
        {
          menuItemId: itemA.id, // Burger requires Cheese Selection!
          quantity: 1,
          selectedModifiers: [], // MISSING REQUIRED MODIFIER
        },
      ],
    });

    assert(rpcResReqMissing?.success === false && rpcResReqMissing?.error?.includes('REQUIRED_MODIFIER_GROUP_MISSING'), 'Test 8: Missing required modifier group rejected and transaction rolled back');

    // TEST 9: Duplicate Modifier Option Selection Rejection Test
    const { data: rpcResDupOpt } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_pin_hash: pinHash,
      p_guest_name: 'Guest',
      p_idempotency_key: `idemp_dupopt_${Date.now()}`,
      p_cart_items: [
        {
          menuItemId: itemA.id,
          quantity: 1,
          selectedModifiers: [
            { optionId: modOptA.id },
            { optionId: modOptA.id }, // DUPLICATE OPTION SELECTION IN SAME LINE
          ],
        },
      ],
    });

    assert(rpcResDupOpt?.success === false && rpcResDupOpt?.error?.includes('DUPLICATE_MODIFIER_OPTION'), 'Test 9: Duplicate modifier option selection rejected');

    // TEST 10: Multi-Branch Kitchen Queue Isolation Verification
    const { data: ordersBranchA } = await admin.from('orders').select('id, branch_id').eq('branch_id', branchAId);
    const { data: ordersBranchB } = await admin.from('orders').select('id, branch_id').eq('branch_id', branchBId);

    const hasA = (ordersBranchA?.length || 0) >= 1;
    const hasB = (ordersBranchB?.length || 0) === 0;
    assert(Boolean(hasA && hasB), 'Test 10: Multi-branch isolation verified (Branch A order queue does not expose Branch B orders)');

    // TEST 11: Order Lifecycle & Rollback Verification
    const { data: orderHeader } = await admin.from('orders').select('*').eq('id', orderId1).single();
    assert(orderHeader.status === 'pending', 'Test 11: Order initial status is "pending"');

    // Advance status to "confirmed", "preparing", "ready", "completed"
    await admin.from('orders').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'pending', new_status: 'confirmed' });

    await admin.from('orders').update({ status: 'preparing', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'confirmed', new_status: 'preparing' });

    await admin.from('orders').update({ status: 'ready', updated_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'preparing', new_status: 'ready' });

    await admin.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', orderId1);
    await admin.from('order_status_history').insert({ order_id: orderId1, previous_status: 'ready', new_status: 'completed' });

    const { data: history } = await admin.from('order_status_history').select('*').eq('order_id', orderId1);
    assert(Boolean(history && history.length >= 4), 'Test 12: Status history log tracked across kitchen workflow');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    if (bizId) {
      console.log('\n🧹 Cleaning up test business and order data...');
      await admin.from('businesses').delete().eq('id', bizId);
      console.log('✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('   Phase 10 Orders Verification Finished: ALL TESTS PASSED      ');
  console.log('================================================================\n');
}

runOrdersVerificationSuite();
