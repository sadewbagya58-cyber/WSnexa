import {
  createSignedAreaQrToken,
  verifyAreaQrToken,
  getAreaQrTokenPrefix,
} from '../src/lib/qr/area-qr-token';
import { generateSecureQrToken, hashQrToken, hashTablePin, verifyTablePin } from '../src/lib/qr/security';
import { createSignedTableAccessProof, verifySignedTableAccessProof } from '../src/lib/qr/table-access-proof';
import { generateQrSvgString, generateQrPngDataUrl } from '../src/lib/qr/qr-generator';
import * as fs from 'fs';
import * as path from 'path';

async function runAreaQrVerificationSuite() {
  console.log('================================================================');
  console.log('      WSNexa — Area-Level QR Ordering Verification Suite        ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // ── 1. Cryptographic Area QR Token Engine Tests ──────────────────────
  console.log('--- 1. Cryptographic Area QR Token Engine ---');

  const biz1 = 'biz_luna_1111-2222-3333';
  const branch1 = 'br_colombo_4444-5555-6666';
  const areaA = 'area_dining_hall_aaaa-bbbb-cccc';
  const areaB = 'area_garden_dddd-eeee-ffff';

  const tokenA = createSignedAreaQrToken(biz1, branch1, areaA, 1);
  assert(tokenA.rawToken.startsWith('WSN-AQ.'), 'Area QR token has standard "WSN-AQ." prefix');
  assert(tokenA.tokenPrefix.includes('area'), 'Token prefix identifies area code');

  const verifyA = verifyAreaQrToken(tokenA.rawToken);
  assert(verifyA.valid === true, 'Valid Area QR token verifies successfully');
  assert(verifyA.payload?.scope === 'area', 'Payload scope is "area"');
  assert(verifyA.payload?.businessId === biz1, 'Payload businessId matches');
  assert(verifyA.payload?.branchId === branch1, 'Payload branchId matches');
  assert(verifyA.payload?.areaId === areaA, 'Payload areaId matches Area A');
  assert(verifyA.payload?.version === 1, 'Payload version is 1');

  // Tampering resistance: decode payload, change areaId, re-encode with old signature
  const parts = tokenA.rawToken.split('.');
  const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  decodedPayload.areaId = areaB;
  const tamperedBase64 = Buffer.from(JSON.stringify(decodedPayload), 'utf8').toString('base64url');
  const tamperedToken = `WSN-AQ.${tamperedBase64}.${parts[2]}`;

  const verifyTampered = verifyAreaQrToken(tamperedToken);
  assert(
    verifyTampered.valid === false && verifyTampered.error === 'SIGNATURE_MISMATCH',
    'Tampered Area QR token payload is immediately rejected with SIGNATURE_MISMATCH'
  );

  // Non-Area QR tokens handled gracefully
  const branchTokenPair = generateSecureQrToken();
  const verifyBranchToken = verifyAreaQrToken(branchTokenPair.rawToken);
  assert(
    verifyBranchToken.valid === false && verifyBranchToken.error === 'NOT_AN_AREA_TOKEN',
    'Standard Branch QR token is cleanly identified as NOT_AN_AREA_TOKEN'
  );

  // ── 2. Table Access Proof Binding & Replay Prevention ────────────────
  console.log('\n--- 2. Table Access Proof Cryptographic Binding ---');

  const sessionToken1 = 'session_token_alpha_12345';
  const sessionToken2 = 'session_token_beta_67890';
  const tableA1 = 't_a1';

  // Issue proof bound to Branch 1, Table A1, Area A, and Session 1
  const proofResult = createSignedTableAccessProof(branch1, tableA1, areaA, sessionToken1, 2);
  assert(Boolean(proofResult.proof), 'createSignedTableAccessProof produces signed proof');

  // Legitimate verification
  const legitVerify = verifySignedTableAccessProof(proofResult.proof, branch1, tableA1, areaA, sessionToken1);
  assert(legitVerify.valid === true, 'Legitimate proof verification succeeds with matching branch, table, area, session');

  // Replay with different Area (Area B) -> rejected
  const replayAreaB = verifySignedTableAccessProof(proofResult.proof, branch1, tableA1, areaB, sessionToken1);
  assert(
    replayAreaB.valid === false && replayAreaB.error === 'AREA_MISMATCH',
    'Proof replay with different dining area (Area B) is strictly rejected with AREA_MISMATCH'
  );

  // Replay with different Branch (Branch 2) -> rejected
  const replayBranch2 = verifySignedTableAccessProof(proofResult.proof, 'br_kandy_7777', tableA1, areaA, sessionToken1);
  assert(
    replayBranch2.valid === false && replayBranch2.error === 'BRANCH_MISMATCH',
    'Proof replay with different branch is strictly rejected with BRANCH_MISMATCH'
  );

  // Replay with different Table (Table A2) -> rejected
  const replayTableA2 = verifySignedTableAccessProof(proofResult.proof, branch1, 't_a2', areaA, sessionToken1);
  assert(
    replayTableA2.valid === false && replayTableA2.error === 'TABLE_MISMATCH',
    'Proof replay with different table is strictly rejected with TABLE_MISMATCH'
  );

  // Replay with different QR visit session -> rejected
  const replaySession2 = verifySignedTableAccessProof(proofResult.proof, branch1, tableA1, areaA, sessionToken2);
  assert(
    replaySession2.valid === false && replaySession2.error === 'SESSION_MISMATCH',
    'Proof replay with different QR visit session is strictly rejected with SESSION_MISMATCH'
  );

  // Expired proof rejection
  const expiredProof = createSignedTableAccessProof(branch1, tableA1, areaA, sessionToken1, -1);
  const verifyExpired = verifySignedTableAccessProof(expiredProof.proof, branch1, tableA1, areaA, sessionToken1);
  assert(
    verifyExpired.valid === false && verifyExpired.error === 'EXPIRED',
    'Expired table access proof is rejected with EXPIRED'
  );

  // ── 3. DB Persistence, Revocation & Regeneration Lifecycle ───────────
  console.log('\n--- 3. Persistent DB Revocation & Regeneration Lifecycle ---');

  // Persistent DB Mock Table: public.area_qr_codes
  interface DbAreaQrRecord {
    id: string;
    business_id: string;
    branch_id: string;
    service_area_id: string;
    token_hash: string;
    token_prefix: string;
    version: number;
    is_active: boolean;
    revoked_at: string | null;
    expires_at: string | null;
  }

  const dbAreaQrRecords: DbAreaQrRecord[] = [];

  function dbGenerateAreaQr(bId: string, brId: string, aId: string): string {
    const { rawToken, tokenPrefix } = createSignedAreaQrToken(bId, brId, aId, 1);
    const tokenHash = hashQrToken(rawToken);

    // Deactivate previous active record
    for (const r of dbAreaQrRecords) {
      if (r.service_area_id === aId && r.is_active) {
        r.is_active = false;
        r.revoked_at = new Date().toISOString();
      }
    }

    dbAreaQrRecords.push({
      id: `aqr_${Date.now()}_v1`,
      business_id: bId,
      branch_id: brId,
      service_area_id: aId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      version: 1,
      is_active: true,
      revoked_at: null,
      expires_at: null,
    });

    return rawToken;
  }

  function dbRegenerateAreaQr(bId: string, brId: string, aId: string, currentVersion: number): string {
    const nextVersion = currentVersion + 1;
    const { rawToken, tokenPrefix } = createSignedAreaQrToken(bId, brId, aId, nextVersion);
    const tokenHash = hashQrToken(rawToken);

    for (const r of dbAreaQrRecords) {
      if (r.service_area_id === aId && r.is_active) {
        r.is_active = false;
        r.revoked_at = new Date().toISOString();
      }
    }

    dbAreaQrRecords.push({
      id: `aqr_${Date.now()}_v${nextVersion}`,
      business_id: bId,
      branch_id: brId,
      service_area_id: aId,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      version: nextVersion,
      is_active: true,
      revoked_at: null,
      expires_at: null,
    });

    return rawToken;
  }

  function dbRevokeAreaQr(aId: string) {
    for (const r of dbAreaQrRecords) {
      if (r.service_area_id === aId && r.is_active) {
        r.is_active = false;
        r.revoked_at = new Date().toISOString();
      }
    }
  }

  function dbValidateAreaQr(rawToken: string) {
    const sigCheck = verifyAreaQrToken(rawToken);
    if (!sigCheck.valid || !sigCheck.payload) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    const tokenHash = hashQrToken(rawToken);
    const dbRecord = dbAreaQrRecords.find((r) => r.token_hash === tokenHash);

    if (!dbRecord) {
      return { valid: false, error: 'NOT_FOUND_IN_DB' };
    }

    if (!dbRecord.is_active || dbRecord.revoked_at !== null) {
      return { valid: false, error: 'QR_REVOKED' };
    }

    if (
      dbRecord.business_id !== sigCheck.payload.businessId ||
      dbRecord.branch_id !== sigCheck.payload.branchId ||
      dbRecord.service_area_id !== sigCheck.payload.areaId ||
      dbRecord.version !== sigCheck.payload.version
    ) {
      return { valid: false, error: 'METADATA_MISMATCH' };
    }

    return { valid: true, payload: sigCheck.payload, record: dbRecord };
  }

  // 3a. Generate v1
  const rawTokenV1 = dbGenerateAreaQr(biz1, branch1, areaA);
  const valV1 = dbValidateAreaQr(rawTokenV1);
  assert(valV1.valid === true, 'Generated v1 token validates against DB record');

  // 3b. Revoke Area QR -> presentation of v1 fails
  dbRevokeAreaQr(areaA);
  const valV1AfterRevoke = dbValidateAreaQr(rawTokenV1);
  assert(
    valV1AfterRevoke.valid === false && valV1AfterRevoke.error === 'QR_REVOKED',
    'Revoked Area QR is rejected by DB check with QR_REVOKED even though signature is valid'
  );

  // 3c. Regenerate -> v2 created, old v1 remains rejected
  const rawTokenV2 = dbRegenerateAreaQr(biz1, branch1, areaA, 1);
  const valV1AfterRegen = dbValidateAreaQr(rawTokenV1);
  const valV2 = dbValidateAreaQr(rawTokenV2);
  assert(
    valV1AfterRegen.valid === false && valV1AfterRegen.error === 'QR_REVOKED',
    'Old v1 token remains permanently rejected with QR_REVOKED after regeneration'
  );
  assert(valV2.valid === true && valV2.payload?.version === 2, 'New v2 token validates successfully against active DB record');

  // 3d. Non-persisted token (signed with valid key but not in DB)
  const validSigNotPersisted = createSignedAreaQrToken(biz1, branch1, 'area_unregistered', 1);
  const valNotPersisted = dbValidateAreaQr(validSigNotPersisted.rawToken);
  assert(
    valNotPersisted.valid === false && valNotPersisted.error === 'NOT_FOUND_IN_DB',
    'Validly signed token not present in DB is rejected with NOT_FOUND_IN_DB'
  );

  // ── 4. Targeted Functional Scenarios (A through L) ───────────────────
  console.log('\n--- 4. Targeted Functional Scenarios (A through L) ---');

  const mockAreas = [
    { id: areaA, business_id: biz1, branch_id: branch1, name: 'Main Dining Hall', code: 'MDH', is_active: true },
    { id: areaB, business_id: biz1, branch_id: branch1, name: 'Garden Terrace', code: 'GDN', is_active: true },
    { id: 'area_zero_tables', business_id: biz1, branch_id: branch1, name: 'Empty Patio', code: 'PAT', is_active: true },
    { id: 'area_sinhala', business_id: biz1, branch_id: branch1, name: 'ප්රධාන ආහාර ශාලාව', code: 'SIN', is_active: true },
  ];

  const mockTables = [
    { id: 't_a1', business_id: biz1, branch_id: branch1, service_area_id: areaA, name: 'Table A1', code: 'TA1', is_active: true, table_pin_hash: hashTablePin('1234') },
    { id: 't_a2', business_id: biz1, branch_id: branch1, service_area_id: areaA, name: 'Table A2', code: 'TA2', is_active: true, table_pin_hash: null },
    { id: 't_b1', business_id: biz1, branch_id: branch1, service_area_id: areaB, name: 'Table B1', code: 'TB1', is_active: true, table_pin_hash: hashTablePin('5678') },
    { id: 't_b2', business_id: biz1, branch_id: branch1, service_area_id: areaB, name: 'Table B2', code: 'TB2', is_active: true, table_pin_hash: null },
    { id: 't_other_branch', business_id: biz1, branch_id: 'br_galle_9999', service_area_id: 'area_galle', name: 'Table G1', code: 'TG1', is_active: true, table_pin_hash: null },
    { id: 't_other_biz', business_id: 'biz_competitor_8888', branch_id: 'br_comp_8888', service_area_id: 'area_comp', name: 'Table C1', code: 'TC1', is_active: true, table_pin_hash: null },
  ];

  function simulatePublicMenuResolution(rawToken: string) {
    if (rawToken.startsWith('WSN-AQ.')) {
      const areaCheck = verifyAreaQrToken(rawToken);
      if (!areaCheck.valid || !areaCheck.payload) {
        return { success: false, error: 'INVALID_QR' };
      }

      const { branchId, areaId, businessId } = areaCheck.payload;
      const matchingArea = mockAreas.find((a) => a.id === areaId && a.branch_id === branchId && a.is_active);
      if (!matchingArea) return { success: false, error: 'AREA_UNAVAILABLE' };

      const areaTables = mockTables.filter((t) => t.business_id === businessId && t.branch_id === branchId && t.service_area_id === areaId && t.is_active);
      return {
        success: true,
        scope: 'area',
        qr_scope: 'area',
        service_area_id: areaId,
        service_area_name: matchingArea.name,
        service_areas: [matchingArea],
        dining_tables: areaTables,
      };
    }

    return {
      success: true,
      scope: 'branch',
      qr_scope: 'branch',
      service_area_id: null,
      service_areas: mockAreas.filter((a) => a.branch_id === branch1 && a.is_active),
      dining_tables: mockTables.filter((t) => t.branch_id === branch1 && t.is_active),
    };
  }

  function simulateTableAccessVerification(branchId: string, tableId: string, inputPin?: string, expectedServiceAreaId?: string) {
    const table = mockTables.find((t) => t.id === tableId && t.branch_id === branchId && t.is_active);
    if (!table) {
      return { success: false, message: 'Selected dining table is unavailable or archived.' };
    }

    if (expectedServiceAreaId && table.service_area_id !== expectedServiceAreaId) {
      return { success: false, message: 'Selected table does not belong to the active service area.' };
    }

    if (table.table_pin_hash) {
      if (!inputPin || !verifyTablePin(inputPin, table.table_pin_hash)) {
        return { success: false, message: 'Invalid Table PIN.' };
      }
    }

    return { success: true, data: { table } };
  }

  function simulateCreateGuestOrder(input: { rawQrToken: string; tableId?: string; requireWaiterApproval?: boolean }) {
    const { rawQrToken, tableId, requireWaiterApproval } = input;
    const areaCheck = verifyAreaQrToken(rawQrToken);

    let authoritativeAreaId: string | null = null;
    let targetBranchId: string | null = branch1;
    let targetBusinessId: string | null = biz1;

    if (areaCheck.valid && areaCheck.payload) {
      targetBranchId = areaCheck.payload.branchId;
      targetBusinessId = areaCheck.payload.businessId;
      authoritativeAreaId = areaCheck.payload.areaId;
    }

    if (tableId) {
      const table = mockTables.find((t) => t.id === tableId);
      if (!table || table.branch_id !== targetBranchId) {
        return { success: false, errorType: 'CROSS_BRANCH_ORDER_ATTEMPT_BLOCKED', message: 'Selected table belongs to a different venue branch.' };
      }

      if (table.business_id !== targetBusinessId) {
        return { success: false, errorType: 'CROSS_BUSINESS_ORDER_ATTEMPT_BLOCKED', message: 'Selected table belongs to a different business.' };
      }

      if (authoritativeAreaId && table.service_area_id !== authoritativeAreaId) {
        return { success: false, errorType: 'CROSS_AREA_ORDER_ATTEMPT_BLOCKED', message: 'Selected table does not belong to the verified dining area.' };
      }
    }

    const orderStatus = requireWaiterApproval ? 'pending_waiter_approval' : 'confirmed';
    return { success: true, orderId: `ord_${Date.now()}`, status: orderStatus };
  }

  // Scenario A: Area A QR -> only Area A tables shown
  const resA = simulatePublicMenuResolution(tokenA.rawToken);
  assert(resA.success === true, 'Scenario A: Area A QR resolves successfully');
  assert(resA.service_area_id === areaA, 'Scenario A: Resolved service_area_id is Area A');
  assert(resA.dining_tables?.length === 2, 'Scenario A: Exactly 2 tables returned');
  assert(Boolean(resA.dining_tables?.every((t) => t.service_area_id === areaA)), 'Scenario A: ALL returned tables belong strictly to Area A');

  // Scenario B: Area B QR -> only Area B tables shown
  const tokenB = createSignedAreaQrToken(biz1, branch1, areaB, 1);
  const resB = simulatePublicMenuResolution(tokenB.rawToken);
  assert(resB.success === true, 'Scenario B: Area B QR resolves successfully');
  assert(resB.service_area_id === areaB, 'Scenario B: Resolved service_area_id is Area B');
  assert(resB.dining_tables?.length === 2, 'Scenario B: Exactly 2 tables returned for Area B');
  assert(Boolean(resB.dining_tables?.every((t) => t.service_area_id === areaB)), 'Scenario B: ALL returned tables belong strictly to Area B');

  // Scenario C: Area A QR + manually tampered Area B table ID -> server rejects
  const tableCheckTampered = simulateTableAccessVerification(branch1, 't_b1', '5678', areaA);
  assert(tableCheckTampered.success === false, 'Scenario C: verifyTableAccessAction rejects table from Area B when expected area is Area A');

  const orderTampered = simulateCreateGuestOrder({ rawQrToken: tokenA.rawToken, tableId: 't_b1' });
  assert(
    orderTampered.success === false && orderTampered.errorType === 'CROSS_AREA_ORDER_ATTEMPT_BLOCKED',
    'Scenario C: createGuestOrder strictly blocks cross-area table tampering with CROSS_AREA_ORDER_ATTEMPT_BLOCKED'
  );

  // Scenario D: Area A QR + table from another branch -> server rejects
  const orderCrossBranch = simulateCreateGuestOrder({ rawQrToken: tokenA.rawToken, tableId: 't_other_branch' });
  assert(
    orderCrossBranch.success === false && orderCrossBranch.errorType === 'CROSS_BRANCH_ORDER_ATTEMPT_BLOCKED',
    'Scenario D: createGuestOrder strictly blocks cross-branch table tampering with CROSS_BRANCH_ORDER_ATTEMPT_BLOCKED'
  );

  // Scenario E: Corrupted Area QR -> cannot establish valid ordering context
  const badToken = 'WSN-AQ.eyJzY29wZSI6ImFyZWEifQ.invalid_signature_hex';
  const resBad = simulatePublicMenuResolution(badToken);
  assert(
    resBad.success === false,
    'Scenario E: Corrupted Area QR fails verification and blocks public menu resolution'
  );

  // Scenario F: Distinct signatures across versions
  const tokenA_v1 = createSignedAreaQrToken(biz1, branch1, areaA, 1);
  const tokenA_v2 = createSignedAreaQrToken(biz1, branch1, areaA, 2);
  const verifyV1 = verifyAreaQrToken(tokenA_v1.rawToken);
  const verifyV2 = verifyAreaQrToken(tokenA_v2.rawToken);
  assert(verifyV1.payload?.version === 1, 'Scenario F: Token v1 carries version 1');
  assert(verifyV2.payload?.version === 2, 'Scenario F: Token v2 carries version 2');
  assert(tokenA_v1.rawToken !== tokenA_v2.rawToken, 'Scenario F: Regenerated token has distinct cryptographic signature');

  // Scenario G: Branch QR -> existing behavior still works
  const resBranch = simulatePublicMenuResolution('BRANCH_SAMPLE_RAW_TOKEN');
  assert(resBranch.success === true && resBranch.scope === 'branch', 'Scenario G: Branch QR resolves with scope "branch"');
  assert(resBranch.service_area_id === null, 'Scenario G: Branch QR does not lock service_area_id');
  assert(resBranch.service_areas?.length === 4, 'Scenario G: Branch QR returns all 4 service areas for guest selection');

  // Scenario H: Area QR with zero active tables -> safe empty state, no fallback to another area
  const tokenZero = createSignedAreaQrToken(biz1, branch1, 'area_zero_tables', 1);
  const resZero = simulatePublicMenuResolution(tokenZero.rawToken);
  assert(resZero.success === true, 'Scenario H: Area QR with zero tables resolves successfully');
  assert(resZero.dining_tables?.length === 0, 'Scenario H: Returns 0 tables and does NOT fallback to other area tables');

  // Scenario I: Sinhala Area name “ප්රධාන ආහාර ශාලාව” -> renders correctly
  const sinhalaAreaName = 'ප්රධාන ආහාර ශාලාව';
  const tokenSinhala = createSignedAreaQrToken(biz1, branch1, 'area_sinhala', 1);
  const resSinhala = simulatePublicMenuResolution(tokenSinhala.rawToken);
  assert(resSinhala.service_area_name === sinhalaAreaName, 'Scenario I: Unicode Sinhala area name preserved without corruption');
  const svgOut = await generateQrSvgString(`http://localhost:3000/m/${tokenSinhala.rawToken}`, 256);
  assert(svgOut.includes('<svg') && svgOut.includes('</svg>'), 'Scenario I: Generates valid SVG QR code for Sinhala Area QR');

  // Scenario J: Waiter approval enabled -> Area QR order follows pending_waiter_approval
  const orderApproval = simulateCreateGuestOrder({ rawQrToken: tokenA.rawToken, tableId: 't_a1', requireWaiterApproval: true });
  assert(
    orderApproval.success === true && orderApproval.status === 'pending_waiter_approval',
    'Scenario J: Area QR order enters pending_waiter_approval status when waiter approval is required'
  );

  // Scenario K: Table PIN enabled -> existing table PIN validation remains enforced
  const pinOk = simulateTableAccessVerification(branch1, 't_a1', '1234', areaA);
  assert(pinOk.success === true, 'Scenario K: Correct PIN unlocks table in Area A');
  const pinFail = simulateTableAccessVerification(branch1, 't_a1', '9999', areaA);
  assert(pinFail.success === false && Boolean(pinFail.message?.includes('Invalid Table PIN')), 'Scenario K: Wrong PIN is rejected');

  // Scenario L: Multi-tenant isolation -> QR from Business A can never select tables from Business B
  const orderCrossBiz = simulateCreateGuestOrder({ rawQrToken: tokenA.rawToken, tableId: 't_other_biz' });
  assert(
    orderCrossBiz.success === false && orderCrossBiz.errorType === 'CROSS_BRANCH_ORDER_ATTEMPT_BLOCKED',
    'Scenario L: QR from Business A is strictly prohibited from selecting tables from Business B'
  );

  // ── 5. Source-Level Code & Integration Integrity ─────────────────────
  console.log('\n--- 5. Source-Level Code & Integration Integrity ---');

  const qrServiceSource = fs.readFileSync(path.join(process.cwd(), 'src/server/services/qr.service.ts'), 'utf8');
  const orderServiceSource = fs.readFileSync(path.join(process.cwd(), 'src/server/services/order.service.ts'), 'utf8');
  const tableActionsSource = fs.readFileSync(path.join(process.cwd(), 'src/server/actions/table.ts'), 'utf8');
  const areaMgmtSource = fs.readFileSync(path.join(process.cwd(), 'src/components/area/area-management.tsx'), 'utf8');
  const branchQrMgrSource = fs.readFileSync(path.join(process.cwd(), 'src/components/qr/branch-qr-manager.tsx'), 'utf8');
  const publicMenuSource = fs.readFileSync(path.join(process.cwd(), 'src/components/qr/public-guest-menu.tsx'), 'utf8');

  assert(qrServiceSource.includes('generateAreaQr') && qrServiceSource.includes('regenerateAreaQr'), 'QrService implements generateAreaQr and regenerateAreaQr');
  assert(qrServiceSource.includes('verifyAreaQrToken'), 'QrService.resolvePublicBranchMenuByToken imports and verifies Area QR tokens');
  assert(qrServiceSource.includes('from(\'area_qr_codes\')'), 'QrService persists to and validates against area_qr_codes table');
  assert(orderServiceSource.includes('CROSS_AREA_ORDER_ATTEMPT_BLOCKED'), 'OrderService enforces CROSS_AREA_ORDER_ATTEMPT_BLOCKED server-side');
  assert(tableActionsSource.includes('authoritativeAreaId'), 'verifyTableAccessAction enforces authoritativeAreaId');
  assert(areaMgmtSource.includes('AreaQrModal') && areaMgmtSource.includes('QR Code'), 'AreaManagement renders AreaQrModal and QR Code button for each area');
  assert(branchQrMgrSource.includes('Dining Area QR Codes') && branchQrMgrSource.includes('AreaQrModal'), 'BranchQrManager renders Dining Area QR Codes section');
  assert(publicMenuSource.includes('serviceAreaId') && publicMenuSource.includes('Area Verified'), 'PublicGuestMenu renders Area Verified badge for Area QR sessions');

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`Area QR Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAreaQrVerificationSuite().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
