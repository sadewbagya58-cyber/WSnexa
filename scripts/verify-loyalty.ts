import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local BEFORE importing modules that validate env variables
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

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runLoyaltyVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa V1 — Loyalty & Rewards Feature Gate & Scope Verification');
  console.log('================================================================\n');

  const { FEATURES, IS_LOYALTY_ENABLED } = await import('../src/lib/config/features');
  const { LoyaltyService } = await import('../src/server/services/loyalty.service');
  const {
    redeemRewardAction,
    createRewardAction,
    updateProgramSettingsAction,
    adjustCustomerPointsAction,
  } = await import('../src/server/actions/loyalty');

  let bizAId: string | null = null;
  let cust1Id: string | null = null;

  try {
    // ── 1. Feature Flag Configuration Verification ──────────────────────────
    console.log('--- 1. Central Feature Flag & Scope Gate ---');
    assert(FEATURES.LOYALTY_REWARDS_ENABLED === false, 'Test 1: LOYALTY_REWARDS_ENABLED is false for V1 launch scope');
    assert(IS_LOYALTY_ENABLED === false, 'Test 2: IS_LOYALTY_ENABLED evaluates to false');

    // ── 2. Database Schema & Preservation ───────────────────────────────────
    console.log('\n--- 2. Database Schema & Historical Architecture Preservation ---');
    const { error: settingsTableErr } = await admin.from('loyalty_program_settings').select('id').limit(1);
    assert(!settingsTableErr, 'Test 3: loyalty_program_settings table exists and is readable');

    const { error: rewardsTableErr } = await admin.from('loyalty_rewards').select('id').limit(1);
    assert(!rewardsTableErr, 'Test 4: loyalty_rewards table exists and is readable');

    const { error: accountsTableErr } = await admin.from('customer_loyalty_accounts').select('id').limit(1);
    assert(!accountsTableErr, 'Test 5: customer_loyalty_accounts table exists and is readable');

    const { error: ledgerTableErr } = await admin.from('loyalty_points_ledger').select('id').limit(1);
    assert(!ledgerTableErr, 'Test 6: loyalty_points_ledger table exists and is readable');

    const { error: redemptionsTableErr } = await admin.from('loyalty_reward_redemptions').select('id').limit(1);
    assert(!redemptionsTableErr, 'Test 7: loyalty_reward_redemptions table exists and is readable');

    // ── 3. Server-Side Safety Gates & Rejections ────────────────────────────
    console.log('\n--- 3. Server-Side Rejections & Safety Gates ---');

    // Setup Test User & Business for service-level testing
    const email1 = `loy_gate_${Date.now()}@test.com`;
    const { data: u1 } = await admin.auth.admin.createUser({ email: email1, password: 'Password123!', email_confirm: true });
    cust1Id = u1.user!.id;
    await admin.from('user_profiles').insert({ id: cust1Id, first_name: 'GateUser', last_name: 'Test' });

    const { data: bA } = await admin.from('businesses').insert({
      name: 'Scope Gate Cafe',
      slug: `gate-biz-${Date.now()}`,
      business_type: 'cafe',
      created_by: cust1Id,
    }).select().single();
    bizAId = bA!.id;

    // Test: Points earning is blocked while feature is disabled
    const earnAttempt = await LoyaltyService.processOrderPointsEarning('fake-order-id');
    assert(
      earnAttempt.success === false && earnAttempt.code === 'FEATURE_DISABLED',
      'Test 8: LoyaltyService.processOrderPointsEarning returns FEATURE_DISABLED'
    );

    // Test: Reward redemption is blocked while feature is disabled
    const redeemAttempt = await LoyaltyService.redeemReward(cust1Id!, bizAId!, 'fake-reward-id');
    assert(
      redeemAttempt.success === false && redeemAttempt.code === 'FEATURE_DISABLED',
      'Test 9: LoyaltyService.redeemReward returns FEATURE_DISABLED'
    );

    // Test: Direct action mutations are blocked while feature is disabled
    const actionUpdateRes = await updateProgramSettingsAction({
      isEnabled: true,
      earningModel: 'spend_based',
      spendLkrPerPoint: 100,
      pointsPerVisit: 10,
      minimumOrderSpendCents: 0,
      minRedemptionBalance: 0,
    });
    assert(
      actionUpdateRes.success === false && Boolean(actionUpdateRes.message?.includes('future update')),
      'Test 10: updateProgramSettingsAction rejects mutation when disabled'
    );

    const actionCreateRewardRes = await createRewardAction({
      title: 'Discount Voucher',
      pointsRequired: 100,
      rewardType: 'fixed_discount',
      discountAmountCents: 50000,
      minOrderValueCents: 0,
      isActive: true,
    });
    assert(
      actionCreateRewardRes.success === false && Boolean(actionCreateRewardRes.message?.includes('future update')),
      'Test 11: createRewardAction rejects mutation when disabled'
    );

    const actionRedeemRes = await redeemRewardAction(bizAId!, 'fake-reward-id');
    assert(
      actionRedeemRes.success === false && Boolean(actionRedeemRes.message?.includes('future update')),
      'Test 12: redeemRewardAction rejects mutation when disabled'
    );

    const actionAdjustRes = await adjustCustomerPointsAction({
      customerUserId: cust1Id!,
      pointsDelta: 50,
      reason: 'Testing',
    });
    assert(
      actionAdjustRes.success === false && Boolean(actionAdjustRes.message?.includes('disabled')),
      'Test 13: adjustCustomerPointsAction rejects points adjustment when disabled'
    );

    // ── 4. Historical Order Snapshot Compatibility ──────────────────────────
    console.log('\n--- 4. Historical Order Snapshot Compatibility ---');

    // Create a mock historical order with reward snapshots
    const { data: brA } = await admin.from('branches').insert({
      business_id: bizAId,
      name: 'Main Branch',
      code: `gate_br_${Date.now()}`,
      is_default: true,
      require_table_selection: false,
    }).select().single();

    const { data: histOrder, error: histErr } = await admin.from('orders').insert({
      business_id: bizAId,
      branch_id: brA!.id,
      order_number: 99991,
      order_number_formatted: '#99991',
      idempotency_key: `hist_idemp_${Date.now()}`,
      access_token: `hist_token_${Date.now()}`,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'cash',
      subtotal_cents: 150000,
      tax_cents: 0,
      service_charge_cents: 0,
      discount_cents: 50000,
      reward_id: null,
      reward_title_snapshot: '500 LKR Patron Voucher',
      reward_points_redeemed_snapshot: 100,
      total_cents: 100000,
      currency: 'LKR',
    }).select().single();

    assert(!histErr && Boolean(histOrder), 'Test 14: Historical order with reward snapshot created');
    assert(histOrder?.reward_title_snapshot === '500 LKR Patron Voucher', 'Test 15: reward_title_snapshot preserved');
    assert(histOrder?.reward_points_redeemed_snapshot === 100, 'Test 16: reward_points_redeemed_snapshot preserved');
    assert(histOrder?.discount_cents === 50000, 'Test 17: discount_cents preserved');
    assert(histOrder?.total_cents === 100000, 'Test 18: total_cents accurately reflects historical discount');

    console.log('\n================================================================');
    console.log('  LOYALTY SCOPE VERIFICATION SUMMARY: ALL 18 TESTS PASSED');
    console.log('  ✓ V1 Launch Scope Gate & Historical Compatibility Confirmed');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Loyalty Verification Failed:', err);
    throw err;
  } finally {
    // Clean up temporary test data
    if (bizAId) {
      await admin.from('orders').delete().eq('business_id', bizAId);
      await admin.from('branches').delete().eq('business_id', bizAId);
      await admin.from('businesses').delete().eq('id', bizAId);
    }
    if (cust1Id) {
      await admin.from('user_profiles').delete().eq('id', cust1Id);
      await admin.auth.admin.deleteUser(cust1Id);
    }
  }
}

runLoyaltyVerification();
