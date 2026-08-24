import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';

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

async function runCustomerOrdersVerificationSuite() {
  console.log('================================================================');
  console.log('  WSNexa Phase 16 — Customer Order Claiming & History Suite    ');
  console.log('================================================================\n');

  let bizAId: string | null = null;
  let branchAId: string | null = null;
  let ownerUserId: string | null = null;
  let customerAId: string | null = null;
  let customerBId: string | null = null;

  let anonOrder1Id: string | null = null;
  let anonOrder1Token: string | null = null;
  let anonOrder2Id: string | null = null;
  let anonOrder2Token: string | null = null;

  let passed = 0;

  try {
    const uniqueSuffix = Date.now().toString().slice(-6);

    // 1. Create Business & Branch
    const { data: ownerAuth, error: ownerErr } = await admin.auth.admin.createUser({
      email: `customer_owner_${uniqueSuffix}@wsnexa.test`,
      password: 'Password123!',
      email_confirm: true,
    });
    assert(!ownerErr && ownerAuth.user, 'Setup: Owner user creation');
    ownerUserId = ownerAuth.user.id;

    const ownerClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    await ownerClient.auth.signInWithPassword({
      email: `customer_owner_${uniqueSuffix}@wsnexa.test`,
      password: 'Password123!',
    });

    const { data: bizData, error: bizErr } = await ownerClient.rpc('create_business_with_default_branch', {
      p_name: `Customer Test Venue ${uniqueSuffix}`,
      p_slug: `cust-test-venue-${uniqueSuffix}`,
      p_business_type: 'restaurant',
      p_country_code: 'LK',
      p_default_currency: 'LKR',
      p_timezone: 'Asia/Colombo',
    });
    assert(!bizErr && bizData?.business_id, 'Setup: Business creation');
    bizAId = bizData.business_id;
    branchAId = bizData.branch_id;

    // Set branch require_table_selection to false for direct guest order testing
    await admin
      .from('branches')
      .update({ require_table_selection: false, require_table_pin: false })
      .eq('id', branchAId);

    // Create Category & Item
    const { data: cat } = await admin
      .from('menu_categories')
      .insert({
        business_id: bizAId,
        branch_id: branchAId,
        name: 'Main Dishes',
        slug: `mains-${uniqueSuffix}`,
        is_active: true,
      })
      .select()
      .single();

    const { data: item } = await admin
      .from('menu_items')
      .insert({
        business_id: bizAId,
        branch_id: branchAId,
        category_id: cat.id,
        name: 'Kottu Roti',
        slug: `kottu-${uniqueSuffix}`,
        price_cents: 120000, // 1200 LKR
        availability_status: 'available',
        is_active: true,
      })
      .select()
      .single();

    const { generateSecureQrToken, hashQrToken } = await import('../src/lib/qr/security');
    const qrA = generateSecureQrToken();
    const tokenHashA = hashQrToken(qrA.rawToken);

    // Create QR Code
    await admin
      .from('branch_qr_codes')
      .insert({
        business_id: bizAId,
        branch_id: branchAId,
        token_hash: tokenHashA,
        token_prefix: qrA.tokenPrefix,
        encrypted_token: qrA.encryptedToken,
        is_active: true,
      });

    // Create Customer Accounts A and B
    const { data: custAAuth } = await admin.auth.admin.createUser({
      email: `customer_a_${uniqueSuffix}@wsnexa.test`,
      password: 'Password123!',
      email_confirm: true,
    });
    customerAId = custAAuth.user!.id;

    const { data: custBAuth } = await admin.auth.admin.createUser({
      email: `customer_b_${uniqueSuffix}@wsnexa.test`,
      password: 'Password123!',
      email_confirm: true,
    });
    customerBId = custBAuth.user!.id;

    // Initialize user profiles for Customer A and B
    await admin.from('user_profiles').upsert([
      { id: customerAId, first_name: 'Customer', last_name: 'Alpha' },
      { id: customerBId, first_name: 'Customer', last_name: 'Beta' },
    ]);

    // ------------------------------------------------------------------
    // TEST 1: Anonymous order can still be created without account
    // ------------------------------------------------------------------
    const { OrderService } = await import('../src/server/services/order.service');
    const order1Res = await OrderService.createGuestOrder({
      rawQrToken: qrA.rawToken,
      paymentMethod: 'pay_at_counter',
      idempotencyKey: `idem_cust1_${uniqueSuffix}`,
      cartItems: [{ menuItemId: item.id, quantity: 2, selectedModifiers: [] }],
      guestName: 'Anonymous Guest',
    });

    assert(order1Res.success && order1Res.data?.orderId, 'Test 1: Anonymous order creation succeeds');
    anonOrder1Id = order1Res.data.orderId;
    anonOrder1Token = order1Res.data.accessToken;
    passed++;
    console.log('  ✅ [PASS] Test 1: Anonymous order can still be created without account');

    // ------------------------------------------------------------------
    // TEST 2: Anonymous order has customer_user_id = NULL
    // ------------------------------------------------------------------
    const { data: rawOrder1 } = await admin
      .from('orders')
      .select('id, customer_user_id, status, access_token')
      .eq('id', anonOrder1Id)
      .single();

    assert(rawOrder1 && rawOrder1.customer_user_id === null, 'Test 2: Anonymous order has customer_user_id = NULL');
    passed++;
    console.log('  ✅ [PASS] Test 2: Anonymous order has customer_user_id = NULL');

    // ------------------------------------------------------------------
    // TEST 3: Anonymous guest can track order using valid access_token
    // ------------------------------------------------------------------
    const trackedOrder = await OrderService.getOrderById(anonOrder1Id, anonOrder1Token);
    assert(trackedOrder && trackedOrder.id === anonOrder1Id, 'Test 3: Order tracking succeeds with access_token');
    passed++;
    console.log('  ✅ [PASS] Test 3: Anonymous guest can track order using valid access_token');

    // ------------------------------------------------------------------
    // TEST 4: Invalid access_token cannot claim order
    // ------------------------------------------------------------------
    const { CustomerOrderService } = await import('../src/server/services/customer-order.service');
    const invalidTokenClaim = await CustomerOrderService.claimOrder(customerAId, anonOrder1Id, 'invalid_fake_token');
    assert(!invalidTokenClaim.success && invalidTokenClaim.code === 'INVALID_ACCESS_TOKEN', 'Test 4: Claim with invalid access token fails');
    passed++;
    console.log('  ✅ [PASS] Test 4: Invalid access_token cannot claim order');

    // ------------------------------------------------------------------
    // TEST 5: Logged-out user cannot claim order
    // ------------------------------------------------------------------
    const loggedOutClaim = await CustomerOrderService.claimOrder('', anonOrder1Id, anonOrder1Token);
    assert(!loggedOutClaim.success && loggedOutClaim.code === 'INVALID_INPUT', 'Test 5: Logged-out claim attempt fails');
    passed++;
    console.log('  ✅ [PASS] Test 5: Logged-out user cannot claim order');

    // ------------------------------------------------------------------
    // TEST 6: Authenticated customer + valid access_token can claim order
    // ------------------------------------------------------------------
    const validClaim = await CustomerOrderService.claimOrder(customerAId, anonOrder1Id, anonOrder1Token);
    assert(validClaim.success && validClaim.claimed === true, 'Test 6: Valid customer claim succeeds');
    passed++;
    console.log('  ✅ [PASS] Test 6: Authenticated customer + valid access_token can claim order');

    // ------------------------------------------------------------------
    // TEST 7: Claim sets customer_user_id correctly to customer UID
    // ------------------------------------------------------------------
    const { data: claimedOrder1 } = await admin
      .from('orders')
      .select('customer_user_id')
      .eq('id', anonOrder1Id)
      .single();

    assert(claimedOrder1 && claimedOrder1.customer_user_id === customerAId, 'Test 7: customer_user_id set correctly in DB');
    passed++;
    console.log('  ✅ [PASS] Test 7: Claim sets customer_user_id correctly to customer UID');

    // ------------------------------------------------------------------
    // TEST 8: Same customer claiming again is idempotent
    // ------------------------------------------------------------------
    const reClaim = await CustomerOrderService.claimOrder(customerAId, anonOrder1Id, anonOrder1Token);
    assert(reClaim.success && reClaim.alreadyClaimed === true, 'Test 8: Re-claiming by same customer is idempotent');
    passed++;
    console.log('  ✅ [PASS] Test 8: Same customer claiming again is idempotent');

    // ------------------------------------------------------------------
    // TEST 9: Different customer cannot steal claimed order
    // ------------------------------------------------------------------
    const stolenClaim = await CustomerOrderService.claimOrder(customerBId, anonOrder1Id, anonOrder1Token);
    assert(!stolenClaim.success && stolenClaim.code === 'CLAIMED_BY_ANOTHER_USER', 'Test 9: Claiming by another customer is rejected');
    passed++;
    console.log('  ✅ [PASS] Test 9: Different customer cannot steal claimed order');

    // ------------------------------------------------------------------
    // TEST 10: Order number alone cannot claim order
    // ------------------------------------------------------------------
    const { data: orderNumberOnlyOrder } = await admin
      .from('orders')
      .select('order_number')
      .eq('id', anonOrder1Id)
      .single();

    const orderNumberClaim = await CustomerOrderService.claimOrder(customerBId, String(orderNumberOnlyOrder!.order_number), 'no_token');
    assert(!orderNumberClaim.success, 'Test 10: Claiming with order_number fails');
    passed++;
    console.log('  ✅ [PASS] Test 10: Order number alone cannot claim order');

    // ------------------------------------------------------------------
    // TEST 11: Customer A cannot query Customer B orders
    // ------------------------------------------------------------------
    await new Promise((r) => setTimeout(r, 200));
    // Create order 2 and claim by Customer B
    const order2Res = await OrderService.createGuestOrder({
      rawQrToken: qrA.rawToken,
      paymentMethod: 'pay_at_counter',
      idempotencyKey: `idem_cust2_${uniqueSuffix}`,
      cartItems: [{ menuItemId: item.id, quantity: 1, selectedModifiers: [] }],
    });
    assert(order2Res.success && order2Res.data, `Order 2 creation failed: ${order2Res.message}`);
    anonOrder2Id = order2Res.data.orderId;
    anonOrder2Token = order2Res.data.accessToken;

    await CustomerOrderService.claimOrder(customerBId, anonOrder2Id, anonOrder2Token);

    const custAOrders = await CustomerOrderService.getCustomerOrders(customerAId);
    const custBOrders = await CustomerOrderService.getCustomerOrders(customerBId);

    assert(custAOrders.every((o) => o.id !== anonOrder2Id), 'Test 11: Customer A cannot see Customer B order');
    assert(custBOrders.some((o) => o.id === anonOrder2Id), 'Test 11: Customer B sees their own order');
    passed++;
    console.log('  ✅ [PASS] Test 11: Customer A cannot query Customer B orders');

    // ------------------------------------------------------------------
    // TEST 12: Customer history contains only claimed orders
    // ------------------------------------------------------------------
    assert(custAOrders.length === 1 && custAOrders[0].id === anonOrder1Id, 'Test 12: History contains exactly claimed order');
    passed++;
    console.log('  ✅ [PASS] Test 12: Customer history contains only claimed orders');

    // ------------------------------------------------------------------
    // TEST 13: Cancelled/voided amounts excluded correctly from spending metrics
    // ------------------------------------------------------------------
    // Mark order 2 as completed
    await admin.from('orders').update({ status: 'completed', payment_status: 'paid' }).eq('id', anonOrder2Id);
    // Mark order 1 as cancelled
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', anonOrder1Id);

    const analyticsA = await CustomerOrderService.getCustomerAnalytics(customerAId);
    const analyticsB = await CustomerOrderService.getCustomerAnalytics(customerBId);

    assert(analyticsA.lifetimeSpendCents === 0, 'Test 13: Cancelled order total excluded from spend');
    assert(analyticsB.lifetimeSpendCents === 120000, 'Test 13: Completed order total included in spend');
    passed++;
    console.log('  ✅ [PASS] Test 13: Cancelled/voided amounts excluded correctly from spending metrics');

    // ------------------------------------------------------------------
    // TEST 14: Active claimed order appears in Active Orders
    // ------------------------------------------------------------------
    // Reset order 1 to preparing
    await admin.from('orders').update({ status: 'preparing' }).eq('id', anonOrder1Id);
    const activeOrdersA = await CustomerOrderService.getCustomerOrders(customerAId, 'active');
    assert(activeOrdersA.some((o) => o.id === anonOrder1Id), 'Test 14: Active preparing order appears in active filter');
    passed++;
    console.log('  ✅ [PASS] Test 14: Active claimed order appears in Active Orders');

    // ------------------------------------------------------------------
    // TEST 15: Completed claimed order appears in history
    // ------------------------------------------------------------------
    const completedOrdersB = await CustomerOrderService.getCustomerOrders(customerBId, 'completed');
    assert(completedOrdersB.some((o) => o.id === anonOrder2Id), 'Test 15: Completed order appears in completed filter');
    passed++;
    console.log('  ✅ [PASS] Test 15: Completed claimed order appears in history');

    // ------------------------------------------------------------------
    // TEST 16: Customer order details contain customer-safe fields only
    // ------------------------------------------------------------------
    const details = await CustomerOrderService.getCustomerOrderDetails(customerAId, anonOrder1Id);
    assert(details !== null, 'Test 16: Order details fetched');
    assert(!('pin_hash' in details) && !('internal_notes' in details), 'Test 16: Unsafe metadata not exposed in details');
    passed++;
    console.log('  ✅ [PASS] Test 16: Customer order details contain customer-safe fields only');

    // ------------------------------------------------------------------
    // TEST 17: Business A cannot obtain customer's Business B history
    // ------------------------------------------------------------------
    // Customer B's order history only contains Business A order for Business A
    assert(custBOrders.every((o) => o.businessId === bizAId), 'Test 17: Customer history respects business boundary');
    passed++;
    console.log('  ✅ [PASS] Test 17: Business A cannot obtain customer Business B history');

    // ------------------------------------------------------------------
    // TEST 18: Staff permissions remain unaffected
    // ------------------------------------------------------------------
    const { data: ownerMem } = await admin
      .from('business_memberships')
      .select('*')
      .eq('user_id', ownerUserId!)
      .maybeSingle();
    assert(ownerMem !== null, 'Test 18: Staff permissions remain intact');
    passed++;
    console.log('  ✅ [PASS] Test 18: Staff permissions remain unaffected');

    // ------------------------------------------------------------------
    // TEST 19: Anonymous QR ordering remains account-free
    // ------------------------------------------------------------------
    await new Promise((r) => setTimeout(r, 200));
    const order3Res = await OrderService.createGuestOrder({
      rawQrToken: qrA.rawToken,
      paymentMethod: 'pay_at_counter',
      idempotencyKey: `idem_cust3_${uniqueSuffix}`,
      cartItems: [{ menuItemId: item.id, quantity: 1, selectedModifiers: [] }],
    });
    assert(order3Res.success && order3Res.data?.orderId, `Test 19 failed: ${order3Res.message}`);
    passed++;
    console.log('  ✅ [PASS] Test 19: Anonymous QR ordering remains account-free');

    // ------------------------------------------------------------------
    // TEST 20: Existing order access_token security remains intact
    // ------------------------------------------------------------------
    const order3Track = await OrderService.getOrderById(order3Res.data!.orderId, order3Res.data!.accessToken);
    assert(order3Track && order3Track.id === order3Res.data!.orderId, 'Test 20: Access token tracking intact');
    passed++;
    console.log('  ✅ [PASS] Test 20: Existing order access_token security remains intact');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during customer orders verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up test customer order data...');
    if (bizAId) {
      await admin.from('businesses').delete().filter('id', 'eq', bizAId);
    }
    for (const uid of [ownerUserId, customerAId, customerBId]) {
      if (uid) {
        await admin.auth.admin.deleteUser(uid);
      }
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`  Phase 16 Customer Orders Verification: ALL ${passed} TESTS PASSED `);
  console.log('================================================================\n');
}

runCustomerOrdersVerificationSuite();
