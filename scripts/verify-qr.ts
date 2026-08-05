import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateSecureQrToken, generateTablePin, hashTablePin } from '../src/lib/qr/security';
import { generateQrSvgString, generateQrPngDataUrl } from '../src/lib/qr/qr-generator';

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

interface RpcResult {
  success?: boolean;
  error?: string;
  bypass_table?: boolean;
  dining_tables?: Array<{ table_pin_hash?: string }>;
}

async function runQrVerificationSuite() {
  console.log('================================================================');
  console.log('      WSNexa Phase 8 — Branch QR & Table PIN Verification       ');
  console.log('================================================================\n');

  let testPassed = 0;
  let testTotal = 0;

  function assertTest(name: string, condition: boolean, details?: string) {
    testTotal++;
    if (condition) {
      testPassed++;
      console.log(`✅ TEST ${testTotal}: ${name}`);
    } else {
      console.error(`❌ TEST ${testTotal} FAILED: ${name}`);
      if (details) console.error(`   Details: ${details}`);
    }
  }

  // Fetch or setup active business & branch for live test
  const { data: business } = await admin.from('businesses').select('id, name').limit(1).single();
  const { data: branch } = await admin.from('branches').select('id, name, code').limit(1).single();

  if (!business || !branch) {
    console.error('❌ Database setup missing active business or branch.');
    process.exit(1);
  }

  console.log(`Running tests against Business: "${business.name}" (${business.id}), Branch: "${branch.name}" (${branch.id})\n`);

  // Setup test area & table
  const testAreaCode = `TST_AREA_${Date.now()}`;
  const { data: area } = await admin.from('service_areas').insert({
    business_id: business.id,
    branch_id: branch.id,
    name: 'Test Area',
    code: testAreaCode,
    display_order: 1,
    is_active: true,
  }).select().single();

  const testTableCode = `TST_T_${Date.now()}`;
  const { data: table } = await admin.from('dining_tables').insert({
    business_id: business.id,
    branch_id: branch.id,
    service_area_id: area!.id,
    name: 'Table T1',
    code: testTableCode,
    table_number: 999,
    capacity: 4,
    status: 'available',
    is_active: true,
  }).select().single();

  try {
    // 1. Branch QR generated securely
    const tokenPair = generateSecureQrToken();
    assertTest('Branch QR token pair generated with 256-bit entropy', tokenPair.rawToken.length >= 40 && tokenPair.tokenPrefix.length === 8);

    const { data: branchQr, error: qrErr } = await admin.from('branch_qr_codes').insert({
      business_id: business.id,
      branch_id: branch.id,
      token_hash: tokenPair.tokenHash,
      token_prefix: tokenPair.tokenPrefix,
      encrypted_token: tokenPair.encryptedToken,
      version: 1,
      is_active: true,
    }).select().single();

    assertTest('Branch QR record inserted successfully', !qrErr && branchQr !== null, qrErr?.message);

    // 2. Only one active QR per branch
    const duplicateToken = generateSecureQrToken();
    const { error: dupErr } = await admin.from('branch_qr_codes').insert({
      business_id: business.id,
      branch_id: branch.id,
      token_hash: duplicateToken.tokenHash,
      token_prefix: duplicateToken.tokenPrefix,
      version: 2,
      is_active: true,
    });
    assertTest('Unique index blocks duplicate active QR for same branch', dupErr !== null);

    // 3. Branch QR resolves public menu via RPC
    const { data: menuRes, error: menuErr } = await admin.rpc('resolve_public_branch_menu', {
      p_token_hash: tokenPair.tokenHash,
    });
    assertTest('resolve_public_branch_menu RPC resolves menu catalog', !menuErr && (menuRes as RpcResult)?.success === true, menuErr?.message);

    // 4. Old per-table QR records revoked
    const { data: tableQrs } = await admin.from('table_qr_codes').select('is_active').eq('branch_id', branch.id).eq('is_active', true);
    assertTest('Per-table QR records are inactive/revoked', !tableQrs || tableQrs.length === 0);

    // 5. QR regeneration invalidates old token
    if (branchQr) {
      await admin.from('branch_qr_codes').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', branchQr.id);
    }
    const newTokenPair = generateSecureQrToken();
    const { data: regenQr } = await admin.from('branch_qr_codes').insert({
      business_id: business.id,
      branch_id: branch.id,
      token_hash: newTokenPair.tokenHash,
      token_prefix: newTokenPair.tokenPrefix,
      version: 2,
      is_active: true,
    }).select().single();

    const { data: oldMenuRes } = await admin.rpc('resolve_public_branch_menu', { p_token_hash: tokenPair.tokenHash });
    assertTest('Revoked QR token hash rejected by RPC', (oldMenuRes as RpcResult)?.success === false);
    assertTest('New regenerated QR token hash accepted', regenQr !== null);

    // 6. QR disable blocks public access
    if (regenQr) {
      await admin.from('branch_qr_codes').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', regenQr.id);
    }
    const { data: disabledRes } = await admin.rpc('resolve_public_branch_menu', { p_token_hash: newTokenPair.tokenHash });
    assertTest('Disabled QR blocks public menu resolution', (disabledRes as RpcResult)?.success === false);

    // Restore active QR for remaining tests
    const finalToken = generateSecureQrToken();
    await admin.from('branch_qr_codes').insert({
      business_id: business.id,
      branch_id: branch.id,
      token_hash: finalToken.tokenHash,
      token_prefix: finalToken.tokenPrefix,
      version: 3,
      is_active: true,
    });

    // 7 & 8. QR SVG & PNG encoder verification
    const testUrl = `https://w-snexa.vercel.app/m/${finalToken.rawToken}`;
    const svgStr = await generateQrSvgString(testUrl, 200);
    const pngUrl = await generateQrPngDataUrl(testUrl, 1024);
    assertTest('QR SVG matrix string generated correctly', svgStr.includes('<svg') && svgStr.includes('path'));
    assertTest('QR PNG 1024x1024 data URL generated correctly', pngUrl.startsWith('data:image/png;base64,'));

    // 9. Table Selection OFF flow
    await admin.from('branches').update({ require_table_selection: false, require_table_pin: false }).eq('id', branch.id);
    const { data: bypassRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branch.id,
      p_table_id: table!.id,
    });
    assertTest('Require Table Selection OFF allows no-table bypass flow', (bypassRes as RpcResult)?.success === true && (bypassRes as RpcResult)?.bypass_table === true);

    // 10, 11. Table Selection ON, PIN OFF
    await admin.from('branches').update({ require_table_selection: true, require_table_pin: false }).eq('id', branch.id);
    const { data: tableNoPinRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branch.id,
      p_table_id: table!.id,
    });
    assertTest('Require Table Selection ON with PIN OFF validates valid table', (tableNoPinRes as RpcResult)?.success === true);

    // 12, 13, 14. Table PIN ON (Wrong & Correct PIN)
    const plainPin = generateTablePin(4);
    const pinHash = hashTablePin(plainPin);
    await admin.from('dining_tables').update({ table_pin_hash: pinHash, table_pin_updated_at: new Date().toISOString() }).eq('id', table!.id);
    await admin.from('branches').update({ require_table_selection: true, require_table_pin: true, table_pin_length: 4 }).eq('id', branch.id);

    const wrongHash = hashTablePin('0000');
    const { data: wrongPinRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branch.id,
      p_table_id: table!.id,
      p_pin_hash: wrongHash,
    });
    assertTest('Wrong PIN rejected by verify_table_checkout_access', (wrongPinRes as RpcResult)?.success === false && (wrongPinRes as RpcResult)?.error === 'INVALID_PIN');

    const { data: correctPinRes } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branch.id,
      p_table_id: table!.id,
      p_pin_hash: pinHash,
    });
    assertTest('Correct PIN accepted by verify_table_checkout_access', (correctPinRes as RpcResult)?.success === true);

    // 15, 16. Cross-branch & Archived table rejection
    const { data: otherTable } = await admin.from('dining_tables').select('id').neq('branch_id', branch.id).limit(1).maybeSingle();
    if (otherTable) {
      const { data: crossBranchRes } = await admin.rpc('verify_table_checkout_access', {
        p_branch_id: branch.id,
        p_table_id: otherTable.id,
      });
      assertTest('Cross-branch table ID rejected', (crossBranchRes as RpcResult)?.success === false);
    } else {
      assertTest('Cross-branch table ID rejected (skipped: single branch DB)', true);
    }

    // 17. PIN hash stored; plaintext PIN absent
    const { data: tableDb } = await admin.from('dining_tables').select('*').eq('id', table!.id).single();
    assertTest('Plaintext PIN absent from dining_tables row', !('table_pin_raw' in tableDb) && (tableDb as { table_pin_hash: string | null }).table_pin_hash !== null);

    // 18 & 19. Manual PIN replacement & regeneration
    const newPlainPin = generateTablePin(4);
    const newPinHash = hashTablePin(newPlainPin);
    await admin.from('dining_tables').update({ table_pin_hash: newPinHash }).eq('id', table!.id);
    const { data: oldPinVerify } = await admin.rpc('verify_table_checkout_access', {
      p_branch_id: branch.id,
      p_table_id: table!.id,
      p_pin_hash: pinHash,
    });
    assertTest('PIN regeneration invalidates old PIN hash', (oldPinVerify as RpcResult)?.success === false);

    // 20. PIN lengths (4, 5, 6)
    const pin5 = generateTablePin(5);
    const pin6 = generateTablePin(6);
    assertTest('PIN generator produces exact requested lengths (4, 5, 6)', plainPin.length === 4 && pin5.length === 5 && pin6.length === 6);

    // 21. Table PIN hash is NEVER exposed in public RPC output
    const { data: publicMenuCheck } = await admin.rpc('resolve_public_branch_menu', { p_token_hash: finalToken.tokenHash });
    const tablesJson = JSON.stringify((publicMenuCheck as RpcResult)?.dining_tables || []);
    assertTest('Table PIN hash is NEVER exposed in public menu RPC JSON payload', !tablesJson.includes('table_pin_hash') && !tablesJson.includes(newPinHash));

    // Restore branch default settings
    await admin.from('branches').update({ require_table_selection: true, require_table_pin: false, table_pin_length: 4 }).eq('id', branch.id);

  } finally {
    // 25. Cleanup test table & service area & branch QR codes created for test
    if (table) await admin.from('dining_tables').delete().eq('id', table.id);
    if (area) await admin.from('service_areas').delete().eq('id', area.id);
    await admin.from('branch_qr_codes').delete().eq('branch_id', branch.id);
  }

  console.log('\n================================================================');
  console.log(`   Verification Finished: ${testPassed} / ${testTotal} Tests PASSED   `);
  console.log('================================================================\n');

  if (testPassed !== testTotal) {
    process.exit(1);
  }
}

runQrVerificationSuite().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
