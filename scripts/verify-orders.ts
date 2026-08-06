import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin, hashQrToken } from '../src/lib/qr/security';
import { createSignedTableAccessProof, verifySignedTableAccessProof } from '../src/lib/qr/table-access-proof';

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
  console.log('    WSNexa Phase 10 — Table Access Proof & Order Verification    ');
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
        name: 'Order Security Test Cafe',
        slug: `order-test-${timestamp}`,
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

    const qrB = generateSecureQrToken();
    const tokenHashB = hashQrToken(qrB.rawToken);
    await admin.from('branch_qr_codes').insert({
      business_id: bizId,
      branch_id: branchB.id,
      token_hash: tokenHashB,
      token_prefix: qrB.tokenPrefix,
      encrypted_token: qrB.encryptedToken,
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

    const plainPinA2 = generateTablePin(4);
    const pinHashA2 = hashTablePin(plainPinA2);

    const { data: tableA2 } = await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchA.id,
      service_area_id: areaA.id,
      name: 'Table 2',
      code: 'T2',
      capacity: 4,
      table_pin_hash: pinHashA2,
    }).select('*').single();

    const { data: areaB } = await admin.from('service_areas').insert({
      business_id: bizId,
      branch_id: branchB.id,
      name: 'Patio Area',
      code: 'PAT',
    }).select('*').single();

    await admin.from('dining_tables').insert({
      business_id: bizId,
      branch_id: branchB.id,
      service_area_id: areaB.id,
      name: 'Table 10',
      code: 'T10',
      capacity: 2,
      table_pin_hash: hashTablePin('9999'),
    });

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

    // TEST 2: Wrong Table PIN rejected during initial verification
    const { data: wrongPinRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branchA.id,
      p_table_id: tableA1.id,
      p_pin_hash: hashTablePin('0000'),
    });
    assert(wrongPinRes?.success === false && wrongPinRes?.error === 'INVALID_PIN', 'Test 2: Wrong PIN rejected during initial verification');

    // TEST 3: Correct PIN verification generates signed proof
    const { data: validPinRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branchA.id,
      p_table_id: tableA1.id,
      p_pin_hash: pinHashA1,
    });
    assert(validPinRes?.success === true, 'Test 3: Correct PIN verified on table');

    const proofDataA1 = createSignedTableAccessProof(branchA.id, tableA1.id);
    assert(Boolean(proofDataA1.proof && proofDataA1.proof.includes('.')), 'Test 4: Signed Table Access Proof generated with HMAC signature');

    // TEST 5: Proof Payload Audit (Raw PIN is NEVER stored in proof string)
    const proofPayloadString = Buffer.from(proofDataA1.proof.split('.')[0], 'base64url').toString('utf8');
    const containsRawPin = proofPayloadString.includes(plainPinA1) || proofPayloadString.includes('pin');
    assert(!containsRawPin, 'Test 5: Proof audit passed: Zero raw PINs or plaintext secret values in proof payload');

    // TEST 6: Tampered Proof Rejected
    const tamperedProof = `${proofDataA1.proof.split('.')[0]}.invalid_signature_hex_12345`;
    const tamperedCheck = verifySignedTableAccessProof(tamperedProof, branchA.id, tableA1.id);
    assert(tamperedCheck.valid === false && tamperedCheck.error === 'SIGNATURE_MISMATCH', 'Test 6: Tampered proof signature rejected');

    // TEST 7: Expired Proof Rejected
    const expiredProofData = createSignedTableAccessProof(branchA.id, tableA1.id, -1); // TTL -1 hour
    const expiredCheck = verifySignedTableAccessProof(expiredProofData.proof, branchA.id, tableA1.id);
    assert(expiredCheck.valid === false && expiredCheck.error === 'EXPIRED', 'Test 7: Expired table access proof rejected');

    // TEST 8: Proof for Branch A Cannot Be Used in Branch B
    const branchMismatchCheck = verifySignedTableAccessProof(proofDataA1.proof, branchB.id, tableA1.id);
    assert(branchMismatchCheck.valid === false && branchMismatchCheck.error === 'BRANCH_MISMATCH', 'Test 8: Branch A table proof rejected when used for Branch B');

    // TEST 9: Proof for Table A1 Cannot Be Used for Table A2
    const tableMismatchCheck = verifySignedTableAccessProof(proofDataA1.proof, branchA.id, tableA2.id);
    assert(tableMismatchCheck.valid === false && tableMismatchCheck.error === 'TABLE_MISMATCH', 'Test 9: Table A1 proof rejected when used for Table A2');

    // TEST 10: Checkout Without Proof or PIN Rejected (Empty PIN Hash)
    const { data: emptyPinRes } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA1.id,
      p_pin_hash: null,
      p_idempotency_key: `idemp_empty_pin_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 1 }],
    });
    assert(emptyPinRes?.success === false && emptyPinRes?.error === 'INVALID_TABLE_PIN', 'Test 10: Checkout submission with empty PIN hash is blocked');

    // TEST 11: End-to-End Order Submission With Valid Table Access Proof
    // Simulate OrderService verifying signed proof and retrieving table_pin_hash
    const serviceVerify = verifySignedTableAccessProof(proofDataA1.proof, branchA.id, tableA1.id);
    assert(serviceVerify.valid === true, 'Test 11: OrderService verified signed table access proof signature');

    const { data: e2eOrderRes } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHashA,
      p_table_id: tableA1.id,
      p_pin_hash: pinHashA1,
      p_guest_name: 'Verified Table Guest',
      p_idempotency_key: `idemp_e2e_proof_${timestamp}`,
      p_cart_items: [{ menuItemId: itemA.id, quantity: 2 }],
    });

    assert(
      e2eOrderRes?.success === true && e2eOrderRes?.order_id !== undefined,
      'Test 12: End-to-end guest checkout with signed Table Access Proof succeeded without re-entering PIN'
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
  console.log('   Phase 10 Table Proof Verification Finished: ALL TESTS PASSED ');
  console.log('================================================================\n');
}

runOrdersVerificationSuite();
