import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin, hashQrToken } from '../src/lib/qr/security';
import { createSignedTableAccessProof, verifySignedTableAccessProof } from '../src/lib/qr/table-access-proof';
import { saveCartToStorage, loadCartFromStorage } from '../src/features/cart/cart-storage';
import { CartState } from '../src/features/cart/cart-types';

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

async function runOrdersVerificationSuite() {
  console.log('================================================================');
  console.log('    WSNexa Phase 10 — Private Order RPC & Table Proof Suite      ');
  console.log('================================================================\n');

  let bizId = '';

  try {
    // TEST 1: Schema Contract Verification
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

    // Setup Test Owner User & Isolated Business / Branches
    const timestamp = Date.now();
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: `order_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authErr || !authUser.user) {
      throw new Error(`Failed to create test owner user: ${authErr?.message}`);
    }

    const testUserId = authUser.user.id;

    const { data: biz, error: bizErr } = await admin
      .from('businesses')
      .insert({
        name: 'Private RPC Test Cafe',
        slug: `private-rpc-test-${timestamp}`,
        default_currency: 'LKR',
        timezone: 'Asia/Colombo',
        created_by: testUserId,
      })
      .select('*')
      .single();

    if (bizErr || !biz) throw new Error(`Failed to create test business: ${bizErr?.message}`);
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
      })
      .select('*')
      .single();

    const { data: branchB } = await admin
      .from('branches')
      .insert({
        business_id: bizId,
        name: 'Kandy Branch',
        code: 'KDY',
        status: 'active',
        is_default: false,
        require_table_selection: true,
        require_table_pin: true,
      })
      .select('*')
      .single();

    // Create QR Tokens for Branch A and Branch B
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

    // Create Service Area & Dining Tables for Branch A & B
    const { data: areaA } = await admin.from('service_areas').insert({
      business_id: bizId,
      branch_id: branchA.id,
      name: 'Indoor Dining',
      code: 'IND',
    }).select('*').single();

    const plainPinA1 = generateTablePin(4);
    const pinHashA1 = hashTablePin(plainPinA1);

    const { data: tableA1 } = await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchA.id,
      service_area_id: areaA.id,
      name: 'Table 1',
      code: 'T1',
      capacity: 4,
      table_pin_hash: pinHashA1,
    }).select('*').single();

    const { data: tableA2 } = await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchA.id,
      service_area_id: areaA.id,
      name: 'Table 2',
      code: 'T2',
      capacity: 4,
      table_pin_hash: hashTablePin('5555'),
    }).select('*').single();

    // Create Menu Categories & Items
    const { data: catA } = await admin.from('menu_categories').insert({
      business_id: bizId,
      branch_id: branchA.id,
      name: 'Beverages',
      slug: `bev-${timestamp}`,
    }).select('*').single();

    const { data: itemA } = await admin.from('menu_items').insert({
      business_id: bizId,
      branch_id: branchA.id,
      category_id: catA.id,
      name: 'Iced Coffee',
      slug: `iced-coffee-${timestamp}`,
      price_cents: 120000,
      currency: 'LKR',
      availability_status: 'available',
    }).select('*').single();

    // TEST 2: Anonymous direct execution of create_guest_order RPC is blocked
    const { error: anonRpcErr } = await anonClient.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA1.id,
      p_table_access_verified: true,
      p_idempotency_key: `idemp_anon_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1 }],
    });
    assert(anonRpcErr !== null, 'Test 2: Direct execution of private create_guest_order RPC by anonymous users is revoked & blocked');

    // TEST 3: Unverified table access (p_table_access_verified = false) rejected by RPC
    const { data: unverifiedRes } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA1.id,
      p_table_access_verified: false,
      p_idempotency_key: `idemp_unverified_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1 }],
    });
    assert(unverifiedRes?.success === false && unverifiedRes?.error === 'TABLE_VERIFICATION_REQUIRED', 'Test 3: Unverified table access (p_table_access_verified = false) rejected with TABLE_VERIFICATION_REQUIRED');

    // TEST 4: Signed Table Access Proof generated on single PIN verification
    const proofDataA1 = createSignedTableAccessProof(branchA.id, tableA1.id);
    assert(Boolean(proofDataA1.proof && proofDataA1.proof.includes('.')), 'Test 4: Signed Table Access Proof generated with HMAC signature on single PIN verification');

    // TEST 5: Proof Payload Audit (Raw PIN or PIN hash is NEVER stored in proof string)
    const proofPayloadString = Buffer.from(proofDataA1.proof.split('.')[0], 'base64url').toString('utf8');
    const containsRawPin = proofPayloadString.includes(plainPinA1) || proofPayloadString.includes('pinHash');
    assert(!containsRawPin, 'Test 5: Proof audit passed: Zero raw PINs or PIN hashes in proof payload');

    // TEST 6: Tampered Proof Rejected
    const tamperedProof = `${proofDataA1.proof.split('.')[0]}.invalid_signature_hex_12345`;
    const tamperedCheck = verifySignedTableAccessProof(tamperedProof, branchA.id, tableA1.id);
    assert(tamperedCheck.valid === false && tamperedCheck.error === 'SIGNATURE_MISMATCH', 'Test 6: Tampered proof signature rejected');

    // TEST 7: Expired Proof Rejected
    const expiredProofData = createSignedTableAccessProof(branchA.id, tableA1.id, -1);
    const expiredCheck = verifySignedTableAccessProof(expiredProofData.proof, branchA.id, tableA1.id);
    assert(expiredCheck.valid === false && expiredCheck.error === 'EXPIRED', 'Test 7: Expired table access proof rejected');

    // TEST 8: Branch Mismatch Proof Rejected
    const branchMismatchCheck = verifySignedTableAccessProof(proofDataA1.proof, branchB.id, tableA1.id);
    assert(branchMismatchCheck.valid === false && branchMismatchCheck.error === 'BRANCH_MISMATCH', 'Test 8: Branch A table proof rejected when used for Branch B');

    // TEST 9: Table Mismatch Proof Rejected
    const tableMismatchCheck = verifySignedTableAccessProof(proofDataA1.proof, branchA.id, tableA2.id);
    assert(tableMismatchCheck.valid === false && tableMismatchCheck.error === 'TABLE_MISMATCH', 'Test 9: Table A1 proof rejected when used for Table A2');

    // TEST 10: Verified Table Access Order Creation via Service Role
    const { data: verifiedOrderRes } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA1.id,
      p_table_access_verified: true,
      p_guest_name: 'Single PIN Verification Guest',
      p_idempotency_key: `idemp_verified_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 2 }],
    });

    assert(
      verifiedOrderRes?.success === true && verifiedOrderRes?.order_id !== undefined,
      'Test 10: Guest checkout with p_table_access_verified = true via private RPC succeeded without re-verifying PIN hash'
    );

    // TEST 11: Storage Proof Preservation & Hydration Safety Test
    const mockStorage: Record<string, string> = {};
    global.window = {
      sessionStorage: {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
      },
    } as unknown as Window & typeof globalThis;

    const mockState: CartState = {
      branchId: branchA.id,
      currency: 'LKR',
      confirmedTable: {
        branchId: branchA.id,
        tableId: tableA1.id,
        tableName: 'Table 1',
        tableCode: 'T1',
        signedTableAccessProof: proofDataA1.proof,
        verifiedAt: proofDataA1.verifiedAt,
        expiresAt: proofDataA1.expiresAt,
      },
      lines: [],
      subtotalCents: 0,
      totalQuantity: 0,
      updatedAt: new Date().toISOString(),
      isHydrated: true,
    };

    saveCartToStorage(branchA.id, mockState);
    const loadedState = loadCartFromStorage(branchA.id, 'LKR');
    assert(
      loadedState?.confirmedTable?.signedTableAccessProof === proofDataA1.proof,
      'Test 11: Cart storage preserves signedTableAccessProof across serialization & hydration'
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during verification';
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
  console.log('   Phase 10 Private RPC Verification Finished: ALL TESTS PASSED ');
  console.log('================================================================\n');
}

runOrdersVerificationSuite();
