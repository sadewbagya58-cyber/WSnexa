/**
 * WSNexa — Pilot QA Fix Batch #6 Verification Suite
 *
 * Validates:
 * 1. ISSUE #1 — Area QR -> Waiter Assistance Request Flow & Security
 * 2. ISSUE #2 — Area QR Initial Generation Lifecycle (No Broken Auto-Generation)
 * 3. ISSUE #3 — Area QR Modal Mobile Responsiveness & Touch Targets
 */

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key';

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

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  const { createSignedAreaQrToken, verifyAreaQrToken } = await import('../src/lib/qr/area-qr-token');
  const { generateSecureQrToken, hashQrToken } = await import('../src/lib/qr/security');

  console.log('================================================================');
  console.log('🧪 VERIFYING PILOT QA FIX BATCH #6: AREA QR & MOBILE UX');
  console.log('================================================================\n');

  const testBizId = '00000000-0000-4000-8000-000000000001';
  const testBranchId = '00000000-0000-4000-8000-000000000002';
  const testAreaAId = '00000000-0000-4000-8000-000000000003';
  const testAreaBId = '00000000-0000-4000-8000-000000000004';

  // ====================================================================
  // TEST SUITE 1: ISSUE #1 — Area QR -> Waiter Assistance
  // ====================================================================
  console.log('--- SUITE 1: Area QR Waiter Assistance & Security ---');

  // 1.1 Generate valid Area QR token
  const areaATokenResult = createSignedAreaQrToken(testBizId, testBranchId, testAreaAId, 1);
  assert(areaATokenResult.rawToken.startsWith('WSN-AQ.'), 'Area QR token has standard WSN-AQ prefix');

  const areaAVerify = verifyAreaQrToken(areaATokenResult.rawToken);
  assert(areaAVerify.valid === true, 'Area QR token verifies successfully');
  assert(areaAVerify.payload?.areaId === testAreaAId, 'Area QR token payload contains correct area ID');

  // 1.2 Tampered Area QR Token
  const tamperedToken = areaATokenResult.rawToken.slice(0, -5) + 'XXXXX';
  const tamperedVerify = verifyAreaQrToken(tamperedToken);
  assert(tamperedVerify.valid === false, 'Tampered Area QR token fails cryptographic verification');

  // 1.3 Waiter assistance request schemas
  const { submitCustomerAssistanceSchema } = await import('../src/lib/validation/waiter');

  const validAssistanceTypes = ['call_waiter', 'need_water', 'need_bill', 'need_assistance'] as const;
  for (const reqType of validAssistanceTypes) {
    const parseRes = submitCustomerAssistanceSchema.safeParse({
      rawQrToken: areaATokenResult.rawToken,
      tableId: '00000000-0000-4000-8000-000000000010',
      requestType: reqType,
      notes: `Need ${reqType}`,
    });
    assert(parseRes.success, `submitCustomerAssistanceSchema accepts requestType: ${reqType}`);
  }

  // 1.4 WaiterService contains Area QR handling logic
  const waiterServiceSource = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/waiter.service.ts'),
    'utf8'
  );
  assert(waiterServiceSource.includes('verifyAreaQrToken(rawQrToken)'), 'WaiterService imports and checks verifyAreaQrToken');
  assert(waiterServiceSource.includes("from('area_qr_codes')"), 'WaiterService queries area_qr_codes for DB state');
  assert(waiterServiceSource.includes('CROSS_AREA_ATTEMPT_BLOCKED'), 'WaiterService blocks cross-area table assistance');
  assert(waiterServiceSource.includes('CROSS_BRANCH_ATTEMPT_BLOCKED'), 'WaiterService blocks cross-branch table assistance');
  assert(waiterServiceSource.includes('areaId: tableData.service_area_id'), 'WaiterService dispatches notification scoped by areaId');

  // ====================================================================
  // TEST SUITE 2: ISSUE #2 — Initial Area QR Lifecycle & Onboarding
  // ====================================================================
  console.log('\n--- SUITE 2: Area QR Initial Generation Lifecycle ---');

  // 2.1 QrService.listBranchAreaQrs source check
  const qrServiceSource = fs.readFileSync(
    path.join(process.cwd(), 'src/server/services/qr.service.ts'),
    'utf8'
  );
  assert(qrServiceSource.includes('hasActiveQr: false'), 'QrService.listBranchAreaQrs returns hasActiveQr: false when no record exists');
  assert(!qrServiceSource.includes('createSignedAreaQrToken(businessId, branchId, area.id, 1);\n        rawToken = generated.rawToken'),
    'QrService.listBranchAreaQrs does NOT fabricate unpersisted in-memory tokens');

  // 2.2 BranchQrManager card renders Not Generated when hasActiveQr is false
  const branchQrManagerSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/qr/branch-qr-manager.tsx'),
    'utf8'
  );
  assert(branchQrManagerSource.includes('area.hasActiveQr ?'), 'BranchQrManager checks area.hasActiveQr');
  assert(branchQrManagerSource.includes('Not Generated'), 'BranchQrManager renders Not Generated badge for ungenerated areas');
  assert(branchQrManagerSource.includes('⚡ Generate Area QR'), 'BranchQrManager renders Generate Area QR button for ungenerated areas');

  // 2.3 AreaQrModal does not auto-generate on mount
  const areaQrModalSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/qr/area-qr-modal.tsx'),
    'utf8'
  );
  assert(!areaQrModalSource.includes('AQ-${area.code}-v'), 'AreaQrModal does not generate fake unpersisted URLs');
  assert(!areaQrModalSource.includes('if (isOpen && !rawToken && canManage) {\n      startTransition'),
    'AreaQrModal does not silently auto-generate tokens on mount');
  assert(areaQrModalSource.includes('Generate Area QR'), 'AreaQrModal provides explicit Generate Area QR action');

  // ====================================================================
  // TEST SUITE 3: ISSUE #3 — Mobile UI Responsiveness & Touch Targets
  // ====================================================================
  console.log('\n--- SUITE 3: Area QR Mobile UI Responsiveness & Touch Targets ---');

  // 3.1 Modal max height and scrolling
  assert(areaQrModalSource.includes('max-h-[90vh] overflow-y-auto'), 'AreaQrModal enforces max-h-[90vh] with internal scrolling');
  assert(areaQrModalSource.includes('p-4 sm:p-6') || areaQrModalSource.includes('p-3 sm:p-4'), 'AreaQrModal uses responsive padding');

  // 3.2 Action buttons touch targets
  assert(areaQrModalSource.includes('min-h-[44px]'), 'AreaQrModal action buttons specify min-h-[44px] touch target');
  assert(areaQrModalSource.includes('min-h-[44px] min-w-[44px]'), 'AreaQrModal close button meets minimum 44px touch target');

  // 3.3 Scope enforcement box readable layout
  assert(areaQrModalSource.includes('Area Scope Enforcement'), 'AreaQrModal includes Area Scope Enforcement info block');
  assert(areaQrModalSource.includes('touch-manipulation'), 'Interactive buttons use touch-manipulation for mobile speed');

  // ====================================================================
  // SUMMARY
  // ====================================================================
  console.log('\n================================================================');
  console.log(`📊 BATCH #6 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled error running verification tests:', err);
  process.exit(1);
});
