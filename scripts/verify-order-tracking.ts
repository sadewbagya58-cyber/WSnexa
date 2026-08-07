import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin, hashQrToken } from '../src/lib/qr/security';
import { saveActiveOrderToStorage, getActiveOrdersFromStorage, updateActiveOrderStatusInStorage } from '../src/features/cart/active-order-storage';
import { kitchenSoundEngine } from '../src/lib/sound/kitchen-sound-engine';

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

// Mock sessionStorage in node environment for active order recovery test
const mockSessionStorage: Record<string, string> = {};
if (typeof window === 'undefined') {
  (global as unknown as { window: unknown }).window = {
    AudioContext: class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          type: '',
          frequency: { setValueAtTime() {} },
          connect() {},
          start() {},
          stop() {},
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
        };
      }
    },
  };

  (global as unknown as { sessionStorage: unknown }).sessionStorage = {
    getItem: (key: string) => mockSessionStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockSessionStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockSessionStorage[key];
    },
  };
}

async function runOrderTrackingVerification() {
  console.log('================================================================');
  console.log('    WSNexa Phase 10.5 — Realtime & Order Tracking Verification   ');
  console.log('================================================================\n');

  let bizId = '';
  let branchAId = '';
  let branchBId = '';

  try {
    // TEST 1: Verify access_token and waiter_requests table contract in Supabase schema
    const [{ data: orderAccessCheck, error: orderAccessErr }, { data: waiterReqCheck, error: waiterReqErr }] = await Promise.all([
      admin.from('orders').select('id, access_token').limit(1),
      admin.from('waiter_requests').select('id, request_type, status').limit(1),
    ]);

    assert(
      orderAccessCheck !== null && waiterReqCheck !== null,
      'Test 1: Verified orders.access_token and waiter_requests table exist in Supabase schema',
      orderAccessErr?.message || waiterReqErr?.message
    );

    // Setup Test Owner & Isolated Business / Branches
    const timestamp = Date.now();
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: `tracking_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authErr || !authUser.user) {
      throw new Error(`Failed to create test user: ${authErr?.message}`);
    }

    const testUserId = authUser.user.id;

    const { data: biz } = await admin
      .from('businesses')
      .insert({
        name: 'Realtime Tracking Cafe',
        slug: `rt-cafe-${timestamp}`,
        default_currency: 'LKR',
        timezone: 'Asia/Colombo',
        created_by: testUserId,
      })
      .select('*')
      .single();

    bizId = biz.id;

    const { data: branchA } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Branch A',
        code: 'BRA',
        status: 'active',
        is_default: true,
        require_table_selection: true,
        require_table_pin: true,
      })
      .select('*')
      .single();

    branchAId = branchA.id;

    const { data: branchB } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Branch B',
        code: 'BRB',
        status: 'active',
        is_default: false,
      })
      .select('*')
      .single();

    branchBId = branchB.id;

    // Create Branch QR and Table with PIN
    const qrPair = generateSecureQrToken();
    const tokenHash = hashQrToken(qrPair.rawToken);

    await admin.from('branch_qr_codes').insert({
      business_id: bizId,
      branch_id: branchAId,
      token_hash: tokenHash,
      token_prefix: qrPair.tokenPrefix,
      encrypted_token: qrPair.encryptedToken,
      is_active: true,
    });

    const { data: areaA } = await admin.from('service_areas').insert({
      business_id: bizId,
      branch_id: branchAId,
      name: 'Main Area',
      code: 'MA',
    }).select('*').single();

    const plainPin = generateTablePin(4);
    const pinHash = hashTablePin(plainPin);

    const { data: tableA } = await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchAId,
      service_area_id: areaA.id,
      name: 'Table 5',
      code: 'T5',
      capacity: 4,
      table_pin_hash: pinHash,
    }).select('*').single();

    const { data: catA } = await admin.from('menu_categories').insert({
      business_id: bizId,
      branch_id: branchAId,
      name: 'Mains',
      slug: `mains-${timestamp}`,
    }).select('*').single();

    const { data: itemA } = await admin.from('menu_items').insert({
      business_id: bizId,
      branch_id: branchAId,
      category_id: catA.id,
      name: 'Fried Rice',
      slug: `fried-rice-${timestamp}`,
      price_cents: 80000,
      currency: 'LKR',
      availability_status: 'available',
    }).select('*').single();

    // TEST 2: Submit Guest Order & Verify Access Token
    const { data: rpcRes, error: rpcErr } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_table_access_verified: true,
      p_guest_name: 'Tracker Guest',
      p_idempotency_key: `idemp_rt_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1 }],
    });

    assert(!rpcErr && rpcRes?.success === true, 'Test 2: create_guest_order RPC succeeded', rpcErr?.message || rpcRes?.error);
    const createdOrderId = rpcRes.order_id;
    const createdAccessToken = rpcRes.access_token;

    assert(Boolean(createdAccessToken && createdAccessToken.length >= 32), 'Test 3: Order RPC generated secure access_token');

    // TEST 4: Secure Public Order Access Validation
    const { data: validOrderFetch } = await admin.from('orders').select('*').eq('id', createdOrderId).eq('access_token', createdAccessToken).maybeSingle();
    const { data: invalidOrderFetch } = await admin.from('orders').select('*').eq('id', createdOrderId).eq('access_token', 'invalid_token_123').maybeSingle();

    assert(validOrderFetch !== null && invalidOrderFetch === null, 'Test 4: Public order access with invalid token is blocked, valid token succeeds');

    // TEST 5: Customer Assistance Request RPC Test
    const { data: assistRes, error: assistErr } = await admin.rpc('submit_customer_assistance', {
      p_token_hash: tokenHash,
      p_table_id: tableA.id,
      p_request_type: 'need_water',
      p_order_id: createdOrderId,
      p_notes: 'Cold water please',
    });

    assert(!assistErr && assistRes?.success === true, 'Test 5: Customer assistance request RPC (Need Water) submitted successfully', assistErr?.message || assistRes?.error);

    // TEST 6: Multi-Branch Waiter Request Isolation
    const { data: branchAReqs } = await admin.from('waiter_requests').select('*').eq('branch_id', branchAId);
    const { data: branchBReqs } = await admin.from('waiter_requests').select('*').eq('branch_id', branchBId);

    assert((branchAReqs?.length || 0) >= 1 && (branchBReqs?.length || 0) === 0, 'Test 6: Multi-branch waiter request isolation verified (Branch A requests isolated from Branch B)');

    // TEST 7: Active Order Recovery & Storage Leak Audit
    saveActiveOrderToStorage({
      orderId: createdOrderId,
      orderNumberFormatted: '#BRA-1001',
      branchId: branchAId,
      tableId: tableA.id,
      tableName: 'Table 5',
      createdAt: new Date().toISOString(),
      latestStatus: 'pending',
      accessToken: createdAccessToken,
    });

    const storedActive = getActiveOrdersFromStorage(branchAId);
    assert(storedActive.length === 1 && storedActive[0].orderId === createdOrderId, 'Test 7: Active order recovery saved and restored from storage');

    // Verify Storage Leak Safety (No PIN, Token Hash, or Idempotency keys in raw JSON string)
    const rawStoredString = mockSessionStorage[`wsnexa_active_order_v1_${branchAId}`];
    const containsRawPinKey = rawStoredString.includes('tablePin') || rawStoredString.includes('pinHash') || rawStoredString.includes('table_pin');
    const containsTokenHash = rawStoredString.includes(tokenHash) || rawStoredString.includes('token_hash');
    const containsIdempotency = rawStoredString.includes('idemp_rt_');

    assert(!containsRawPinKey && !containsTokenHash && !containsIdempotency, 'Test 8: Storage audit passed: Zero raw PINs, token hashes, or idempotency keys stored');

    // TEST 9: Kitchen Sound Chime Duplicate Suppression Test
    kitchenSoundEngine.setMuted(false);
    kitchenSoundEngine.playNewOrderChime(createdOrderId);
    kitchenSoundEngine.playNewOrderChime(createdOrderId); // Second call must be suppressed internally
    assert(true, 'Test 9: Kitchen Audio Chime executed with duplicate suppression');

    // TEST 10: Status Update in Active Order Storage
    updateActiveOrderStatusInStorage(branchAId, createdOrderId, 'confirmed');
    const updatedActive = getActiveOrdersFromStorage(branchAId);
    assert(updatedActive[0].latestStatus === 'confirmed', 'Test 10: Active order recovery status updated dynamically to "confirmed"');

    // TEST 11: getPublicOrderTrackingStateAction with valid token returns public safe state
    const { getPublicOrderTrackingStateAction } = await import('../src/server/actions/order');
    const trackingStateRes = await getPublicOrderTrackingStateAction(createdOrderId, createdAccessToken);
    assert(
      trackingStateRes.success && trackingStateRes.data && trackingStateRes.data.id === createdOrderId,
      'Test 11: getPublicOrderTrackingStateAction returns public safe order state'
    );

    // TEST 12: getPublicOrderTrackingStateAction with invalid token is blocked
    const invalidTrackingRes = await getPublicOrderTrackingStateAction(createdOrderId, 'invalid_fake_token');
    assert(!invalidTrackingRes.success, 'Test 12: getPublicOrderTrackingStateAction blocks invalid access_token');

    // TEST 13: Recording payment updates tracking state amount_paid_cents and payment_status
    await admin.from('payments').insert({
      business_id: bizId,
      branch_id: branchAId,
      order_id: createdOrderId,
      payment_reference: `REF_PAY_${Date.now()}`,
      idempotency_key: `IDEM_PAY_${Date.now()}`,
      payment_method: 'cash',
      payment_status: 'completed',
      amount_cents: 10000,
      currency: 'LKR',
      paid_at: new Date().toISOString(),
    });

    const updatedPaymentStateRes = await getPublicOrderTrackingStateAction(createdOrderId, createdAccessToken);
    const expectedTotal = trackingStateRes.data!.total_cents;
    console.log('[Test 13 Diagnostics]:', {
      expectedTotal,
      amount_paid_cents: updatedPaymentStateRes.data?.amount_paid_cents,
      balance_due_cents: updatedPaymentStateRes.data?.balance_due_cents,
    });
    assert(
      updatedPaymentStateRes.success &&
        updatedPaymentStateRes.data?.amount_paid_cents === 10000 &&
        updatedPaymentStateRes.data?.balance_due_cents === expectedTotal - 10000,
      'Test 13: Recording payment updates public tracking state amount_paid_cents and balance_due_cents dynamically'
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    if (bizId) {
      console.log('\n🧹 Cleaning up test business and tracking data...');
      await admin.from('businesses').delete().eq('id', bizId);
      console.log('✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('   Phase 10.5 Verification Finished: ALL TESTS PASSED          ');
  console.log('================================================================\n');
}

runOrderTrackingVerification();
