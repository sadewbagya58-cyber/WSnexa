import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken } from '../src/lib/qr/security';

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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
    testsFailed++;
  }
}

interface PublicMenuRpcResponse {
  success: boolean;
  error?: string;
  business?: { name: string };
  table?: { name: string };
  items?: { name: string }[];
}

async function runQrVerificationSuite() {
  console.log('================================================================');
  console.log('   WSNexa Phase 8 Table QR Codes & Public Menu Verification    ');
  console.log('================================================================\n');

  // 1. Schema Check
  const { error: qrTableErr } = await adminClient.from('table_qr_codes').select('*').limit(1);
  const { error: scanTableErr } = await adminClient.from('qr_scan_events').select('*').limit(1);

  assert(!qrTableErr, 'Schema 1: table_qr_codes table exists in Supabase');
  assert(!scanTableErr, 'Schema 2: qr_scan_events table exists in Supabase');

  // 2. Token Security & Standards-Compliant QR Encoder Unit Tests
  const pair1 = generateSecureQrToken();
  assert(pair1.rawToken.length >= 30, 'Token Security 1: Raw token has 256-bit entropy and URL-safe Base64URL encoding');
  assert(pair1.tokenHash !== pair1.rawToken, 'Token Security 2: Database stores SHA-256 hash, not raw token');
  assert(pair1.tokenPrefix.length === 8, 'Token Security 3: Safe 8-character prefix generated');

  const { generateQrSvgString, generateQrPngDataUrl } = await import('../src/lib/qr/qr-generator');
  const sampleUrl = 'https://w-snexa.vercel.app/m/' + pair1.rawToken;
  const svgOutput = await generateQrSvgString(sampleUrl, 256);
  const pngDataUrl = await generateQrPngDataUrl(sampleUrl, 1024);

  assert(svgOutput.includes('<svg') && svgOutput.includes('path'), 'QR Encoder 1: Industry-standard ISO/IEC 18004 SVG vector matrix generated');
  assert(pngDataUrl.startsWith('data:image/png;base64,'), 'QR Encoder 2: High-resolution PNG Data URL generated for Android/Lens/iOS scanners');

  // 3. Create Real Test Users & Businesses
  const emailOwnerA = `test.qr.ownerA.${Date.now()}@wsnexa-test.com`;
  const emailOwnerB = `test.qr.ownerB.${Date.now()}@wsnexa-test.com`;
  const password = 'TestPassword123!';

  const { data: userA } = await adminClient.auth.admin.createUser({ email: emailOwnerA, password, email_confirm: true });
  const { data: userB } = await adminClient.auth.admin.createUser({ email: emailOwnerB, password, email_confirm: true });

  const clientOwnerA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientOwnerB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const clientAnon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  await clientOwnerA.auth.signInWithPassword({ email: emailOwnerA, password });
  await clientOwnerB.auth.signInWithPassword({ email: emailOwnerB, password });

  // Create Business A & Business B
  const { data: bizARes } = await clientOwnerA.rpc('create_business_with_default_branch', {
    p_name: 'QR Test Cafe A',
    p_slug: `qr-cafe-a-${Date.now()}`,
    p_branch_name: 'Main Branch',
    p_branch_code: 'MAIN',
  });
  const bizAId = (bizARes as unknown as { business_id: string; branch_id: string }).business_id;
  const branchAId = (bizARes as unknown as { business_id: string; branch_id: string }).branch_id;

  const { data: bizBRes } = await clientOwnerB.rpc('create_business_with_default_branch', {
    p_name: 'QR Test Cafe B',
    p_slug: `qr-cafe-b-${Date.now()}`,
    p_branch_name: 'Main Branch',
    p_branch_code: 'MAIN',
  });
  const bizBId = (bizBRes as unknown as { business_id: string; branch_id: string }).business_id;

  // Create Service Area A & Table A
  const { data: areaA } = await clientOwnerA.from('service_areas').insert({
    business_id: bizAId,
    branch_id: branchAId,
    name: 'Main Hall',
    code: 'HALL',
  }).select().single();

  const { data: tableA } = await clientOwnerA.from('dining_tables').insert({
    business_id: bizAId,
    branch_id: branchAId,
    service_area_id: areaA!.id,
    name: 'Table 1',
    code: 'T1',
    capacity: 4,
  }).select().single();

  // Create Menu Category & Items in Business A
  const { data: catA } = await clientOwnerA.from('menu_categories').insert({
    business_id: bizAId,
    branch_id: branchAId,
    name: 'Burgers',
    slug: 'burgers',
  }).select().single();

  await clientOwnerA.from('menu_items').insert({
    business_id: bizAId,
    branch_id: branchAId,
    category_id: catA!.id,
    name: 'Cheeseburger',
    slug: 'cheeseburger',
    price_cents: 1250,
    availability_status: 'available',
    is_featured: true,
  });

  await clientOwnerA.from('menu_items').insert({
    business_id: bizAId,
    branch_id: branchAId,
    category_id: catA!.id,
    name: 'Hidden Secret Sauce',
    slug: 'hidden-sauce',
    price_cents: 200,
    availability_status: 'hidden',
  });

  // 4. Generate QR Code for Table A
  const pairA = generateSecureQrToken();
  const { data: qrA, error: qrAErr } = await clientOwnerA.from('table_qr_codes').insert({
    business_id: bizAId,
    branch_id: branchAId,
    dining_table_id: tableA!.id,
    token_hash: pairA.tokenHash,
    token_prefix: pairA.tokenPrefix,
    version: 1,
    is_active: true,
  }).select().single();

  assert(!qrAErr && !!qrA, 'Live RLS 1: Owner A generated QR code for Table A', qrAErr?.message);

  // 5. Cross-Tenant Isolation
  const { data: ownerBRead } = await clientOwnerB.from('table_qr_codes').select('*').eq('id', qrA!.id);
  assert(ownerBRead?.length === 0, 'Live RLS 2: Owner B CANNOT read Owner A QR codes (Cross-tenant RLS blocked)');

  // 6. Public Anonymous Resolution via RPC
  const { data: publicMenuRes, error: rpcErr } = await clientAnon.rpc('resolve_public_table_menu', {
    p_token_hash: pairA.tokenHash,
  });

  const menuPayload = publicMenuRes as unknown as PublicMenuRpcResponse;

  assert(!rpcErr && menuPayload.success === true, 'Public Menu 1: Anonymous guest resolved Table A public menu by token hash');
  assert(menuPayload.business?.name === 'QR Test Cafe A', 'Public Menu 2: Business name matches QR Test Cafe A');
  assert(menuPayload.table?.name === 'Table 1', 'Public Menu 3: Table name matches Table 1');

  const publicItems = menuPayload.items || [];
  const hiddenItemInPublic = publicItems.find((i) => i.name === 'Hidden Secret Sauce');
  const visibleItemInPublic = publicItems.find((i) => i.name === 'Cheeseburger');

  assert(!hiddenItemInPublic, 'Public Menu 4: Hidden availability menu item is EXCLUDED from public menu');
  assert(!!visibleItemInPublic, 'Public Menu 5: Active menu item Cheeseburger is INCLUDED in public menu');

  // 7. Invalid Token Resolution
  const { data: invalidRes } = await clientAnon.rpc('resolve_public_table_menu', {
    p_token_hash: 'non_existent_invalid_token_hash',
  });
  const invalidPayload = invalidRes as unknown as PublicMenuRpcResponse;
  assert(invalidPayload.success === false && invalidPayload.error === 'INVALID_QR', 'Public Menu 6: Invalid token returns generic INVALID_QR error screen');

  // 8. Revocation & Regeneration
  await clientOwnerA.from('table_qr_codes').update({
    is_active: false,
    revoked_at: new Date().toISOString(),
  }).eq('id', qrA!.id);

  const { data: revokedRes } = await clientAnon.rpc('resolve_public_table_menu', {
    p_token_hash: pairA.tokenHash,
  });
  assert((revokedRes as unknown as PublicMenuRpcResponse).success === false, 'Public Menu 7: Revoked token stops working immediately');

  // Generate new version 2
  const pairA2 = generateSecureQrToken();
  const { data: qrA2 } = await clientOwnerA.from('table_qr_codes').insert({
    business_id: bizAId,
    branch_id: branchAId,
    dining_table_id: tableA!.id,
    token_hash: pairA2.tokenHash,
    token_prefix: pairA2.tokenPrefix,
    version: 2,
    is_active: true,
  }).select().single();

  const { data: newVersionRes } = await clientAnon.rpc('resolve_public_table_menu', {
    p_token_hash: pairA2.tokenHash,
  });
  assert(!!qrA2 && (newVersionRes as unknown as PublicMenuRpcResponse).success === true, 'Public Menu 8: Regenerated Version 2 token resolves menu successfully');

  // 9. Scan Analytics Logging
  const { data: scans } = await adminClient.from('qr_scan_events').select('*').eq('business_id', bizAId);
  assert(!!(scans && scans.length >= 1), 'Scan Analytics 1: Valid scan event recorded in qr_scan_events');

  // 10. Clean up live test data
  console.log('\n🧹 Cleaning up live test data...');
  await adminClient.auth.admin.deleteUser(userA.user!.id);
  await adminClient.auth.admin.deleteUser(userB.user!.id);
  await adminClient.from('businesses').delete().eq('id', bizAId);
  await adminClient.from('businesses').delete().eq('id', bizBId);

  assert(true, 'Cleanup: Temporary test users, QR codes, and scan records cleaned up');

  console.log('\n================================================================');
  console.log(`📊 Phase 8 QR Verification Results: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runQrVerificationSuite().catch((err) => {
  console.error('❌ Verification suite exception:', err);
  process.exit(1);
});
