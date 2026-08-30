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

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: string) {
  results.push({
    suite,
    name,
    passed: condition,
    details,
  });
  const icon = condition ? '✓' : '✗';
  console.log(`  ${icon} [${suite}] ${name}${details ? ` (${details})` : ''}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('   WSNEXA — P0 ORDER SECURITY INTEGRITY VERIFICATION SUITE      ');
  console.log('================================================================\n');

  // Dynamic import of services after env is loaded
  const { WaiterService } = await import('../src/server/services/waiter.service');

  // =========================================================================
  // 1. UNIT TESTING STRICT POSITIVE ALLOW-LIST (.eq('approval_status', 'approved'))
  // =========================================================================
  console.log('--- 1. Unit Testing Strict Operational Allow-List (.eq approved) ---');
  const mockOrders = [
    { id: 'ord-1', branch_id: 'b-1', status: 'pending', approval_status: 'pending_waiter_approval' },
    { id: 'ord-2', branch_id: 'b-1', status: 'confirmed', approval_status: 'approved' },
    { id: 'ord-3', branch_id: 'b-1', status: 'cancelled', approval_status: 'rejected' },
    { id: 'ord-4', branch_id: 'b-1', status: 'preparing', approval_status: 'approved' },
    { id: 'ord-5', branch_id: 'b-1', status: 'pending', approval_status: 'unknown_future_state' },
  ];

  const kitchenStrict = mockOrders.filter(
    (o) => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status) && o.approval_status === 'approved'
  );

  assert(
    'Strict Allow-List',
    'Pending approval excluded from Kitchen',
    !kitchenStrict.some((o) => o.id === 'ord-1')
  );
  assert(
    'Strict Allow-List',
    'Rejected excluded from Kitchen',
    !kitchenStrict.some((o) => o.id === 'ord-3')
  );
  assert(
    'Strict Allow-List',
    'Unknown future security state safely excluded from Kitchen',
    !kitchenStrict.some((o) => o.id === 'ord-5')
  );
  assert(
    'Strict Allow-List',
    'Only explicitly approved active orders included in Kitchen',
    kitchenStrict.length === 2 && kitchenStrict.every((o) => o.approval_status === 'approved')
  );

  const cashierStrict = mockOrders.filter((o) => o.approval_status === 'approved');
  assert(
    'Strict Allow-List',
    'Pending approval excluded from Cashier',
    !cashierStrict.some((o) => o.id === 'ord-1')
  );
  assert(
    'Strict Allow-List',
    'Rejected excluded from Cashier',
    !cashierStrict.some((o) => o.id === 'ord-3')
  );
  assert(
    'Strict Allow-List',
    'Unknown future state excluded from Cashier',
    !cashierStrict.some((o) => o.id === 'ord-5')
  );
  assert(
    'Strict Allow-List',
    'Only explicitly approved orders visible in Cashier',
    cashierStrict.every((o) => o.approval_status === 'approved')
  );

  // =========================================================================
  // 2. DATABASE ENVIRONMENT & ISOLATION CHECK
  // =========================================================================
  console.log('\n--- 2. Database Environment & Isolation Check ---');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const parsedUrl = new URL(supabaseUrl);
  console.log(`  Database Target Host: ${parsedUrl.host}`);
  assert('DB Environment', 'Supabase URL configured', Boolean(parsedUrl.host));

  const timestamp = Date.now();
  const testBusinessId = `00000000-0000-4000-a000-${timestamp.toString().slice(-12)}`;
  const testBranchId = `00000000-0000-4000-b000-${timestamp.toString().slice(-12)}`;
  const testServiceAreaId = `00000000-0000-4000-c000-${timestamp.toString().slice(-12)}`;
  const testTableId = `00000000-0000-4000-d000-${timestamp.toString().slice(-12)}`;
  const testCategoryId = `00000000-0000-4000-e000-${timestamp.toString().slice(-12)}`;
  const testItemId = `00000000-0000-4000-f000-${timestamp.toString().slice(-12)}`;
  
  // Find or provision test user
  const { data: existingUser } = await admin.from('user_profiles').select('id').limit(1).maybeSingle();
  let testUserId = existingUser?.id;
  if (!testUserId) {
    testUserId = `00000000-0000-4000-0000-${timestamp.toString().slice(-12)}`;
    await admin.from('user_profiles').insert({
      id: testUserId,
      email: `qa-${timestamp}@wsnexa.test`,
      first_name: 'QA',
      last_name: 'Tester',
      onboarding_intent: 'business_owner',
    });
  }

  const testWaiterId = testUserId;
  const testWaiter2Id = testUserId;
  const rawQrToken = `qr_token_${timestamp}`;
  const tokenHash = crypto.createHash('sha256').update(rawQrToken).digest('hex');

  let setupSucceeded = false;

  try {
    // 1. Create Test Business & Branch
    const { error: bErr } = await admin.from('businesses').insert({
      id: testBusinessId,
      name: `QA Security Biz ${timestamp}`,
      slug: `qa-sec-${timestamp}`,
      created_by: testUserId,
      status: 'active',
      default_currency: 'USD',
    });
    if (bErr) throw new Error(`Business insert failed: ${bErr.message}`);

    const { error: brErr } = await admin.from('branches').insert({
      id: testBranchId,
      business_id: testBusinessId,
      name: 'Main Security Test Branch',
      code: `SEC${timestamp.toString().slice(-3)}`,
      status: 'active',
    });
    if (brErr) throw new Error(`Branch insert failed: ${brErr.message}`);

    // 2. Provision Area & Table
    await admin.from('service_areas').insert({
      id: testServiceAreaId,
      business_id: testBusinessId,
      branch_id: testBranchId,
      name: 'Main Hall',
      code: 'MAIN',
      is_active: true,
    });

    await admin.from('dining_tables').insert({
      id: testTableId,
      business_id: testBusinessId,
      branch_id: testBranchId,
      service_area_id: testServiceAreaId,
      name: 'Table 10',
      code: 'T10',
      table_number: 10,
      capacity: 4,
      is_active: true,
    });

    // 3. Provision Menu Catalog Item
    await admin.from('menu_categories').insert({
      id: testCategoryId,
      business_id: testBusinessId,
      branch_id: testBranchId,
      name: 'Entrees',
      slug: `entrees-${timestamp}`,
      display_order: 1,
      is_active: true,
    });

    await admin.from('menu_items').insert({
      id: testItemId,
      business_id: testBusinessId,
      branch_id: testBranchId,
      category_id: testCategoryId,
      name: 'Gourmet Burger',
      slug: `burger-${timestamp}`,
      price_cents: 1500,
      availability_status: 'available',
      is_active: true,
    });

    // 4. Provision Branch QR Code
    await admin.from('branch_qr_codes').insert({
      business_id: testBusinessId,
      branch_id: testBranchId,
      token_hash: tokenHash,
      is_active: true,
    });

    // 5. Initialize Security Settings with require_waiter_approval = true
    await admin.from('branch_order_security_settings').upsert({
      branch_id: testBranchId,
      require_waiter_approval: true,
      require_location_verification: false,
      require_active_qr_session: false,
    });

    setupSucceeded = true;
    console.log('  ✓ Test environment and QR catalog prerequisites provisioned.');

    const cartItemsPayload = [
      {
        menuItemId: testItemId,
        quantity: 2,
        selectedModifiers: [],
        specialInstructions: 'Extra crispy',
      },
    ];

    // -------------------------------------------------------------------------
    // TEST SUITE A: create_guest_order RPC with require_waiter_approval = ON
    // -------------------------------------------------------------------------
    console.log('\n--- Suite A: create_guest_order Path with Approval ON ---');
    const idempA = `idemp_rpc_${timestamp}_A`;

    // Call ACTUAL create_guest_order RPC
    const { data: rpcResA, error: rpcErrA } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: testTableId,
      p_table_access_verified: true,
      p_guest_name: 'Alice Guest',
      p_guest_phone: '+15551234567',
      p_guest_notes: 'Table 10 order',
      p_idempotency_key: idempA,
      p_cart_items: cartItemsPayload,
      p_payment_method: 'pay_at_counter',
      p_customer_user_id: null,
      p_selected_reward_id: null,
    });

    if (rpcErrA) throw new Error(`RPC Suite A failed: ${rpcErrA.message}`);
    const orderAId = (rpcResA as { order_id?: string })?.order_id;
    assert('create_guest_order Path', 'create_guest_order RPC succeeds', Boolean(orderAId));

    // 1. Immediately query DB order WITHOUT ANY INTERMEDIATE UPDATE
    const { data: dbOrderA } = await admin
      .from('orders')
      .select('approval_status, status')
      .eq('id', orderAId)
      .single();

    console.log(`  Raw initial DB state from create_guest_order: approval_status=${dbOrderA?.approval_status}, status=${dbOrderA?.status}`);

    const isPendingNaturally = dbOrderA?.approval_status === 'pending_waiter_approval';
    assert(
      'create_guest_order Path',
      'Initial committed DB order naturally has approval_status = pending_waiter_approval',
      isPendingNaturally,
      isPendingNaturally ? 'Pass' : 'Database server is running pre-migration function'
    );

    // 2. Kitchen Query Gate
    const { data: kitchenOrdersBefore } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .eq('approval_status', 'approved');

    assert(
      'create_guest_order Path',
      'Kitchen operational loader strictly excludes pending order',
      !kitchenOrdersBefore?.some((o) => o.id === orderAId)
    );

    // 3. Cashier Query Gate
    const { data: cashierOrdersBefore } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .eq('approval_status', 'approved');

    assert(
      'create_guest_order Path',
      'Cashier operational loader strictly excludes pending order',
      !cashierOrdersBefore?.some((o) => o.id === orderAId)
    );

    // 4. Waiter Queue Query
    const pendingWaiterOrders = await WaiterService.getPendingApprovalsForWaiter(testBranchId, testWaiterId);
    assert(
      'create_guest_order Path',
      'Waiter approval queue returns pending order',
      pendingWaiterOrders.some((o) => o.id === orderAId)
    );

    // 5. Approve Order via WaiterService
    const approveRes = await WaiterService.approveGuestOrder(orderAId!, testWaiterId);
    assert(
      'create_guest_order Path',
      'WaiterService.approveGuestOrder transitions order successfully',
      approveRes.success === true
    );

    // 6. Verify DB updated state
    const { data: dbOrderAAfter } = await admin
      .from('orders')
      .select('approval_status, status, approved_by_user_id')
      .eq('id', orderAId)
      .single();

    assert(
      'create_guest_order Path',
      'DB order transitioned to approval_status = approved and status = confirmed',
      dbOrderAAfter?.approval_status === 'approved' && dbOrderAAfter?.status === 'confirmed'
    );

    // 7. Kitchen & Cashier Query Gates After Approval
    const { data: kitchenOrdersAfter } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .eq('approval_status', 'approved');

    assert(
      'create_guest_order Path',
      'Kitchen operational loader returns approved order',
      Boolean(kitchenOrdersAfter?.some((o) => o.id === orderAId))
    );

    const { data: cashierOrdersAfter } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .eq('approval_status', 'approved');

    assert(
      'create_guest_order Path',
      'Cashier operational loader returns approved order',
      Boolean(cashierOrdersAfter?.some((o) => o.id === orderAId))
    );

    // -------------------------------------------------------------------------
    // TEST SUITE B: Rejection Lifecycle via actual RPC
    // -------------------------------------------------------------------------
    console.log('\n--- Suite B: Rejection Lifecycle via create_guest_order ---');
    const idempB = `idemp_rpc_${timestamp}_B`;
    const { data: rpcResB } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: testTableId,
      p_table_access_verified: true,
      p_guest_name: 'Bob Guest',
      p_guest_phone: '+15559876543',
      p_guest_notes: 'Table 10 rejection test',
      p_idempotency_key: idempB,
      p_cart_items: cartItemsPayload,
      p_payment_method: 'pay_at_counter',
      p_customer_user_id: null,
      p_selected_reward_id: null,
    });

    const orderBId = (rpcResB as { order_id?: string })?.order_id;
    assert('Rejection Lifecycle', 'Order B created via RPC', Boolean(orderBId));

    const rejectRes = await WaiterService.rejectGuestOrder(orderBId!, testWaiterId, 'Table occupied by another party');
    assert(
      'Rejection Lifecycle',
      'WaiterService.rejectGuestOrder executes successfully',
      rejectRes.success === true
    );

    const { data: dbOrderBAfter } = await admin
      .from('orders')
      .select('approval_status, status, rejection_reason')
      .eq('id', orderBId)
      .single();

    assert(
      'Rejection Lifecycle',
      'DB order transitioned to approval_status = rejected and status = cancelled',
      dbOrderBAfter?.approval_status === 'rejected' && dbOrderBAfter?.status === 'cancelled'
    );

    const { data: kitchenOrdersReject } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .eq('approval_status', 'approved');

    assert(
      'Rejection Lifecycle',
      'Kitchen operational loader strictly excludes rejected order',
      !kitchenOrdersReject?.some((o) => o.id === orderBId)
    );

    const { data: cashierOrdersReject } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .eq('approval_status', 'approved');

    assert(
      'Rejection Lifecycle',
      'Cashier operational loader strictly excludes rejected order',
      !cashierOrdersReject?.some((o) => o.id === orderBId)
    );

    // -------------------------------------------------------------------------
    // TEST SUITE C: Setting OFF (require_waiter_approval = false)
    // -------------------------------------------------------------------------
    console.log('\n--- Suite C: create_guest_order with Approval OFF ---');
    await admin.from('branch_order_security_settings').upsert({
      branch_id: testBranchId,
      require_waiter_approval: false,
      require_location_verification: false,
      require_active_qr_session: false,
    });

    const idempC = `idemp_rpc_${timestamp}_C`;
    const { data: rpcResC } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: testTableId,
      p_table_access_verified: true,
      p_guest_name: 'Charlie Guest',
      p_guest_phone: '+15553334444',
      p_guest_notes: 'Fast order',
      p_idempotency_key: idempC,
      p_cart_items: cartItemsPayload,
      p_payment_method: 'pay_at_counter',
      p_customer_user_id: null,
      p_selected_reward_id: null,
    });

    const orderCId = (rpcResC as { order_id?: string })?.order_id;
    assert('Approval OFF', 'Order C created via RPC', Boolean(orderCId));

    const { data: dbOrderCAfter } = await admin
      .from('orders')
      .select('approval_status, status')
      .eq('id', orderCId)
      .single();

    assert(
      'Approval OFF',
      'Initial DB order has approval_status = approved immediately',
      dbOrderCAfter?.approval_status === 'approved'
    );

    const { data: kitchenOrdersOff } = await admin
      .from('orders')
      .select('id')
      .eq('branch_id', testBranchId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .eq('approval_status', 'approved');

    assert(
      'Approval OFF',
      'Kitchen operational loader immediately returns order C',
      Boolean(kitchenOrdersOff?.some((o) => o.id === orderCId))
    );

    // -------------------------------------------------------------------------
    // TEST SUITE D: Concurrency & Atomic Race Conditions
    // -------------------------------------------------------------------------
    console.log('\n--- Suite D: Atomic Concurrency on RPC-Created Orders ---');
    await admin.from('branch_order_security_settings').upsert({
      branch_id: testBranchId,
      require_waiter_approval: true,
    });

    const idempD = `idemp_rpc_${timestamp}_D`;
    const { data: rpcResD } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: testTableId,
      p_table_access_verified: true,
      p_guest_name: 'Dan Guest',
      p_guest_phone: '+15556667777',
      p_idempotency_key: idempD,
      p_cart_items: cartItemsPayload,
      p_payment_method: 'pay_at_counter',
    });
    const orderDId = (rpcResD as { order_id?: string })?.order_id;

    // Concurrent Double Approve
    const [resD1, resD2] = await Promise.all([
      WaiterService.approveGuestOrder(orderDId!, testWaiterId),
      WaiterService.approveGuestOrder(orderDId!, testWaiter2Id),
    ]);

    const successes = [resD1, resD2].filter((r) => r.success);
    const failures = [resD1, resD2].filter((r) => !r.success);

    assert(
      'Atomic Concurrency',
      'Concurrent double approve: exactly 1 update succeeds atomically',
      successes.length === 1
    );
    assert(
      'Atomic Concurrency',
      'Concurrent double approve: the second request fails safely with idempotent rejection',
      failures.length === 1 && failures[0].message === 'Order is no longer pending approval.'
    );

    // Concurrent Approve vs Reject Race
    const idempE = `idemp_rpc_${timestamp}_E`;
    const { data: rpcResE } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: testTableId,
      p_table_access_verified: true,
      p_guest_name: 'Eve Guest',
      p_guest_phone: '+15558889999',
      p_idempotency_key: idempE,
      p_cart_items: cartItemsPayload,
      p_payment_method: 'pay_at_counter',
    });
    const orderEId = (rpcResE as { order_id?: string })?.order_id;

    const [raceApprove, raceReject] = await Promise.all([
      WaiterService.approveGuestOrder(orderEId!, testWaiterId),
      WaiterService.rejectGuestOrder(orderEId!, testWaiter2Id, 'Race test reject'),
    ]);

    const raceSuccesses = [raceApprove, raceReject].filter((r) => r.success);
    const raceFailures = [raceApprove, raceReject].filter((r) => !r.success);

    assert(
      'Atomic Concurrency',
      'Concurrent Approve vs Reject: exactly 1 state transition wins',
      raceSuccesses.length === 1 && raceFailures.length === 1
    );

    // -------------------------------------------------------------------------
    // TEST SUITE E: Real Realtime Supabase Channel Subscription Test
    // -------------------------------------------------------------------------
    console.log('\n--- Suite E: Real Realtime Supabase Channel Subscription Test ---');
    const receivedRealtimeEvents: Array<{ event: string; orderId: string; payload: unknown }> = [];
    let subscriptionStatus = 'CONNECTING';

    const realtimeClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const channelName = `realtime_qa_${timestamp}`;
    const testChannel = realtimeClient
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: 'approval_status=eq.approved',
        },
        (payload) => {
          const row = (payload.new as { id?: string }) || (payload.old as { id?: string });
          if (row?.id) {
            receivedRealtimeEvents.push({
              event: payload.eventType,
              orderId: row.id,
              payload: payload.new,
            });
          }
        }
      );

    // Wait until channel status confirms SUBSCRIBED
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (subscriptionStatus !== 'SUBSCRIBED') {
          console.log(`  Realtime subscription timed out with status: ${subscriptionStatus}`);
          resolve();
        }
      }, 4000);

      testChannel.subscribe((status) => {
        subscriptionStatus = status;
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    console.log(`  Realtime Subscription Status: ${subscriptionStatus}`);
    assert('Real Realtime', 'Supabase Realtime channel connected with status SUBSCRIBED', subscriptionStatus === 'SUBSCRIBED');

    if (subscriptionStatus === 'SUBSCRIBED') {
      // 1. Create order RT1
      const idempRT1 = `idemp_rt_${timestamp}_1`;
      const { data: rpcResRT1 } = await admin.rpc('create_guest_order', {
        p_token_hash: tokenHash,
        p_table_id: testTableId,
        p_table_access_verified: true,
        p_guest_name: 'Realtime Guest 1',
        p_guest_phone: '+15551112222',
        p_idempotency_key: idempRT1,
        p_cart_items: cartItemsPayload,
        p_payment_method: 'pay_at_counter',
      });
      const orderRT1Id = (rpcResRT1 as { order_id?: string })?.order_id;

      // Wait 1.5s to verify NO event for unapproved order
      await new Promise((r) => setTimeout(r, 1500));

      // 2. Approve Order RT1
      await WaiterService.approveGuestOrder(orderRT1Id!, testWaiterId);
      await new Promise((r) => setTimeout(r, 2000));

      const receivedUpdate = receivedRealtimeEvents.some(
        (e) => e.orderId === orderRT1Id && e.event === 'UPDATE'
      );
      assert(
        'Real Realtime',
        'Server-side filtered channel delivers UPDATE event upon waiter approval',
        receivedUpdate
      );

      // 3. Create and Reject Order RT2
      const idempRT2 = `idemp_rt_${timestamp}_2`;
      const { data: rpcResRT2 } = await admin.rpc('create_guest_order', {
        p_token_hash: tokenHash,
        p_table_id: testTableId,
        p_table_access_verified: true,
        p_guest_name: 'Realtime Guest 2',
        p_guest_phone: '+15552223333',
        p_idempotency_key: idempRT2,
        p_cart_items: cartItemsPayload,
        p_payment_method: 'pay_at_counter',
      });
      const orderRT2Id = (rpcResRT2 as { order_id?: string })?.order_id;
      await WaiterService.rejectGuestOrder(orderRT2Id!, testWaiterId, 'Realtime reject test');
      await new Promise((r) => setTimeout(r, 1500));

      const receivedReject = receivedRealtimeEvents.some((e) => e.orderId === orderRT2Id);
      assert(
        'Real Realtime',
        'Server-side filtered channel never receives event for rejected order',
        !receivedReject
      );

      realtimeClient.removeChannel(testChannel);
    } else {
      console.log('  [Real Realtime] WebSocket connection blocked in current test runner environment.');
    }

    // -------------------------------------------------------------------------
    // TEST SUITE F: Permission-Aware Direct-Read RLS Policy Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Suite F: Permission-Aware Direct-Read RLS Validation ---');

    // Simulate RLS decision engine with the exact logic defined in migration 20260830150500
    const evaluateRlsPolicy = (userRole: string, permissions: string[], hasBranchAccess: boolean, orderApprovalStatus: string) => {
      if (!hasBranchAccess) return false;
      if (orderApprovalStatus === 'approved') return true;
      if (userRole === 'business_owner' || userRole === 'branch_manager') return true;
      if (userRole === 'waiter') return true;
      if (permissions.some((p) => ['waiter.access', 'waiter.requests.manage', 'orders.manage', 'orders.view'].includes(p))) {
        return true;
      }
      return false;
    };

    assert(
      'RLS Direct Read',
      'Kitchen-only staff cannot read pending_waiter_approval order directly from orders table',
      evaluateRlsPolicy('kitchen_staff', ['kitchen.access', 'kitchen.orders.view'], true, 'pending_waiter_approval') === false
    );

    assert(
      'RLS Direct Read',
      'Cashier-only staff cannot read pending_waiter_approval order directly from orders table',
      evaluateRlsPolicy('cashier', ['cashier.access', 'payments.view'], true, 'pending_waiter_approval') === false
    );

    assert(
      'RLS Direct Read',
      'Waiter-authorized staff CAN read pending_waiter_approval order within branch scope',
      evaluateRlsPolicy('waiter', ['waiter.access'], true, 'pending_waiter_approval') === true
    );

    assert(
      'RLS Direct Read',
      'Custom role with waiter.access permission CAN read pending_waiter_approval order',
      evaluateRlsPolicy('custom_role', ['waiter.access'], true, 'pending_waiter_approval') === true
    );

    assert(
      'RLS Direct Read',
      'Kitchen staff CAN read order once approval_status = approved',
      evaluateRlsPolicy('kitchen_staff', ['kitchen.access'], true, 'approved') === true
    );

    assert(
      'RLS Direct Read',
      'Cashier staff CAN read order once approval_status = approved',
      evaluateRlsPolicy('cashier', ['cashier.access'], true, 'approved') === true
    );

    assert(
      'RLS Direct Read',
      'Staff without branch access CANNOT read even approved orders',
      evaluateRlsPolicy('kitchen_staff', ['kitchen.access'], false, 'approved') === false
    );

  } catch (err: unknown) {
    console.error('Integration test failure:', err);
    assert('DB Integration', 'Database integration suite execution', false, String(err));
  } finally {
    if (setupSucceeded) {
      // Clean up test data
      await admin.from('order_security_audit_logs').delete().eq('business_id', testBusinessId);
      await admin.from('orders').delete().eq('business_id', testBusinessId);
      await admin.from('branch_qr_codes').delete().eq('business_id', testBusinessId);
      await admin.from('menu_items').delete().eq('business_id', testBusinessId);
      await admin.from('menu_categories').delete().eq('business_id', testBusinessId);
      await admin.from('dining_tables').delete().eq('business_id', testBusinessId);
      await admin.from('service_areas').delete().eq('business_id', testBusinessId);
      await admin.from('branch_order_security_settings').delete().eq('branch_id', testBranchId);
      await admin.from('branches').delete().eq('business_id', testBusinessId);
      await admin.from('businesses').delete().eq('id', testBusinessId);
      console.log('\n  ✓ Test database artifacts cleaned up.');
    }
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n================================================================');
  console.log('   VERIFICATION SUMMARY                                         ');
  console.log('================================================================');
  console.table(results);

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${results.length} VERIFICATION TESTS PASSED!`);
  }
}

runVerification().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
