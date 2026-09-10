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

// Load .env.local BEFORE importing any app modules
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

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('====================================================');
  console.log('🚀 Running Final QA Batch Verification (QA-7, QA-8, QA-9)');
  console.log('====================================================\n');

  // Dynamic imports after env loaded
  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { OrderSecurityService } = await import('../src/server/services/order-security.service');
  const { getCancellationAnalytics } = await import('../src/server/analytics/cancellation-analytics');
  const { PaymentService } = await import('../src/server/services/payment.service');
  const { resolveAnalyticsDateRange } = await import('../src/lib/analytics/time-range');

  const admin = createAdminClient();

  // Find an active business and branch
  const { data: branches, error: bErr } = await admin
    .from('branches')
    .select('id, business_id, name')
    .limit(1);

  if (bErr || !branches || branches.length === 0) {
    throw new Error('No branch found for testing.');
  }

  const branch = branches[0];
  const businessId = branch.business_id;
  const branchId = branch.id;
  console.log(`Using Business: ${businessId}, Branch: ${branch.name} (${branchId})\n`);

  // ─────────────────────────────────────────────────────────────
  // 1. QA-7 VERIFICATION: During Preparation & Until Ready Policies
  // ─────────────────────────────────────────────────────────────
  console.log('── QA-7: Cancellation Policy DB Constraint & Resilience ──');

  // Test 7.1 & 7.2: Save 'during_preparation'
  try {
    const res1 = await OrderSecurityService.updateBranchSecuritySettings(branchId, {
      customer_cancellation_policy: 'during_preparation',
    });
    assert(
      res1.success === true,
      'QA7.1: updateBranchSecuritySettings accepts "during_preparation"',
      `Result: ${JSON.stringify(res1)}`
    );

    const fetched1 = await OrderSecurityService.getBranchSecuritySettings(branchId);
    assert(
      fetched1.customer_cancellation_policy === 'during_preparation',
      'QA7.2: getBranchSecuritySettings returns "during_preparation"',
      `Received: ${fetched1.customer_cancellation_policy}`
    );
  } catch (err: unknown) {
    assert(false, 'QA7.1 & 7.2 failed with exception', String(err));
  }

  // Test 7.3 & 7.4: Save 'until_ready'
  try {
    const res2 = await OrderSecurityService.updateBranchSecuritySettings(branchId, {
      customer_cancellation_policy: 'until_ready',
    });
    assert(
      res2.success === true,
      'QA7.3: updateBranchSecuritySettings accepts "until_ready"',
      `Result: ${JSON.stringify(res2)}`
    );

    const fetched2 = await OrderSecurityService.getBranchSecuritySettings(branchId);
    assert(
      fetched2.customer_cancellation_policy === 'until_ready',
      'QA7.4: getBranchSecuritySettings returns "until_ready"',
      `Received: ${fetched2.customer_cancellation_policy}`
    );
  } catch (err: unknown) {
    assert(false, 'QA7.3 & 7.4 failed with exception', String(err));
  }

  // Test 7.5: Save standard policies
  try {
    const standardPolicies = [
      'before_confirmation',
      'within_time_limit',
      'before_preparation',
      'disabled',
    ] as const;
    for (const p of standardPolicies) {
      const res = await OrderSecurityService.updateBranchSecuritySettings(branchId, {
        customer_cancellation_policy: p,
      });
      assert(
        res.success === true,
        `QA7.5: updateBranchSecuritySettings accepts standard policy "${p}"`
      );
      const fetched = await OrderSecurityService.getBranchSecuritySettings(branchId);
      assert(
        fetched.customer_cancellation_policy === p,
        `QA7.6: getBranchSecuritySettings returns standard policy "${p}"`
      );
    }
  } catch (err: unknown) {
    assert(false, 'QA7.5 standard policies failed', String(err));
  }

  console.log('');

  // ─────────────────────────────────────────────────────────────
  // 2. QA-8 VERIFICATION: Cancellation Reports & Analytics Engine
  // ─────────────────────────────────────────────────────────────
  console.log('── QA-8: Cancellation Reports & Analytics Engine ──');

  try {
    const resolvedRange = resolveAnalyticsDateRange({ preset: 'last_30_days' });
    const analytics = await getCancellationAnalytics(
      businessId,
      [branchId],
      resolvedRange,
      'USD',
      true
    );

    assert(typeof analytics.totalOrders === 'number', 'QA8.1: Returns totalOrders count');
    assert(typeof analytics.cancelledOrders === 'number', 'QA8.2: Returns cancelledOrders count');
    assert(typeof analytics.cancellationRate === 'number', 'QA8.3: Returns cancellationRate %');
    assert(
      analytics.cancellationRate >= 0 && analytics.cancellationRate <= 100,
      'QA8.4: Cancellation rate is valid percentage (0 - 100)',
      `Got: ${analytics.cancellationRate}`
    );

    // Verify daily trend
    assert(Array.isArray(analytics.dailyTrend), 'QA8.5: Returns dailyTrend array');
    assert(analytics.dailyTrend.length > 0, 'QA8.6: dailyTrend has date buckets');
    const firstBucket = analytics.dailyTrend[0];
    assert(
      firstBucket &&
        typeof firstBucket.date === 'string' &&
        typeof firstBucket.formattedDate === 'string' &&
        typeof firstBucket.totalOrders === 'number' &&
        typeof firstBucket.cancelledOrders === 'number' &&
        typeof firstBucket.cancellationRate === 'number',
      'QA8.7: Trend bucket contains all required fields (date, formattedDate, totalOrders, cancelledOrders, rate)'
    );

    // Verify breakdowns
    assert(Array.isArray(analytics.actorBreakdown), 'QA8.8: Returns actorBreakdown array');
    assert(Array.isArray(analytics.stageBreakdown), 'QA8.9: Returns stageBreakdown array');
    assert(Array.isArray(analytics.reasonBreakdown), 'QA8.10: Returns reasonBreakdown array');

    // Verify financial impact
    assert(
      typeof analytics.financialImpact.cancelledOrderValueCents === 'number' ||
        analytics.financialImpact.cancelledOrderValueCents === null,
      'QA8.11: Financial impact contains cancelledOrderValueCents'
    );
    assert(
      typeof analytics.financialImpact.cancelledItemValueCents === 'number' ||
        analytics.financialImpact.cancelledItemValueCents === null,
      'QA8.12: Financial impact contains cancelledItemValueCents'
    );
    assert(
      typeof analytics.financialImpact.totalRefundedCents === 'number' ||
        analytics.financialImpact.totalRefundedCents === null,
      'QA8.13: Financial impact contains totalRefundedCents'
    );
    assert(
      typeof analytics.financialImpact.totalWasteCostCents === 'number' ||
        analytics.financialImpact.totalWasteCostCents === null,
      'QA8.14: Financial impact contains totalWasteCostCents'
    );
    assert(
      typeof analytics.financialImpact.estimatedFinancialLossCents === 'number' ||
        analytics.financialImpact.estimatedFinancialLossCents === null,
      'QA8.15: Financial impact contains estimatedFinancialLossCents'
    );

    // Verify financial redaction when hasFinancialAccess = false
    const redactedAnalytics = await getCancellationAnalytics(
      businessId,
      [branchId],
      resolvedRange,
      'USD',
      false
    );
    assert(
      redactedAnalytics.financialImpact.cancelledOrderValueCents === null &&
        redactedAnalytics.financialImpact.totalRefundedCents === null &&
        redactedAnalytics.financialImpact.totalWasteCostCents === null,
      'QA8.16: Financial figures are strictly masked/redacted when hasFinancialAccess is false'
    );
  } catch (err: unknown) {
    assert(false, 'QA8 failed with exception', String(err));
  }

  console.log('');

  // ─────────────────────────────────────────────────────────────
  // 3. QA-9 VERIFICATION: Authoritative Refund Calculation & Logic
  // ─────────────────────────────────────────────────────────────
  console.log('── QA-9: Authoritative Refund Calculation & Validation ──');

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);

  // Create real test orders in DB to thoroughly verify calculateAuthoritativeRefundableAmount
  const { data: testOrder1, error: to1Err } = await admin
    .from('orders')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      order_number: randomSuffix,
      order_number_formatted: `#ORD-${randomSuffix}`,
      idempotency_key: `qa9-idemp-1-${Date.now()}`,
      status: 'cancelled',
      payment_status: 'unpaid',
      subtotal_cents: 5000,
      total_cents: 5000,
      currency: 'USD',
    })
    .select('id')
    .single();

  if (to1Err || !testOrder1) {
    throw new Error(`Failed to create test order 1: ${to1Err?.message}`);
  }

  const orderId1 = testOrder1.id;

  try {
    // 9.1: Unpaid order -> refundable is 0
    const calc1 = await PaymentService.calculateAuthoritativeRefundableAmount(orderId1);
    assert(
      calc1.refundableAmountCents === 0 && calc1.totalPaidCents === 0,
      'QA9.1: Unpaid order has 0 refundable amount',
      `Got refundable: ${calc1.refundableAmountCents}, paid: ${calc1.totalPaidCents}`
    );

    // 9.2: Add completed payment ($50) -> refundable is $50 (5000 cents, NOT 0!)
    const { data: payment1 } = await admin
      .from('payments')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_id: orderId1,
        payment_reference: `PAY-QA9-${Date.now()}`,
        idempotency_key: `pay-idemp-1-${Date.now()}`,
        amount_cents: 5000,
        currency: 'USD',
        payment_method: 'cash',
        payment_status: 'completed',
      })
      .select('id')
      .single();

    const calc2 = await PaymentService.calculateAuthoritativeRefundableAmount(orderId1);
    assert(
      calc2.refundableAmountCents === 5000 && calc2.totalPaidCents === 5000,
      'QA9.2: Fully paid order ($50 paid) calculates authoritative refundable = 5000 cents (NOT 0!)',
      `Got refundable: ${calc2.refundableAmountCents}`
    );

    // 9.3: Add partial refund event ($20) -> refundable is $30 (3000 cents)
    const { error: insErr1 } = await admin.from('payment_events').insert({
      order_id: orderId1,
      payment_id: payment1?.id || null,
      event_type: 'refund_issued',
      new_status: 'partially_refunded',
      amount_cents: 2000,
      metadata: { reason: 'partial compensation' },
    });
    if (insErr1) console.error('insErr1:', insErr1.message);

    const calc3 = await PaymentService.calculateAuthoritativeRefundableAmount(orderId1);
    assert(
      calc3.refundableAmountCents === 3000 && calc3.totalRefundedCents === 2000,
      'QA9.3: Order with prior partial refund ($20) correctly calculates remaining refundable = 3000 cents',
      `Got refundable: ${calc3.refundableAmountCents}, refunded: ${calc3.totalRefundedCents}`
    );

    // 9.4: Add final refund event ($30) -> fully refunded -> refundable is 0
    const { error: insErr2 } = await admin.from('payment_events').insert({
      order_id: orderId1,
      payment_id: payment1?.id || null,
      event_type: 'refund_issued',
      new_status: 'refunded',
      amount_cents: 3000,
      metadata: { reason: 'remaining refund' },
    });
    if (insErr2) console.error('insErr2:', insErr2.message);

    const calc4 = await PaymentService.calculateAuthoritativeRefundableAmount(orderId1);
    assert(
      calc4.refundableAmountCents === 0 && calc4.totalRefundedCents === 5000,
      'QA9.4: Fully refunded order calculates remaining refundable = 0 cents',
      `Got refundable: ${calc4.refundableAmountCents}, refunded: ${calc4.totalRefundedCents}`
    );

    // 9.5: Split payment test on order 2 ($30 cash + $20 card)
    const { data: testOrder2 } = await admin
      .from('orders')
      .insert({
        business_id: businessId,
        branch_id: branchId,
        order_number: randomSuffix + 1,
        order_number_formatted: `#ORD-${randomSuffix + 1}`,
        idempotency_key: `qa9-idemp-2-${Date.now()}`,
        status: 'cancelled',
        payment_status: 'paid',
        subtotal_cents: 5000,
        total_cents: 5000,
        currency: 'USD',
      })
      .select('id')
      .single();

    if (testOrder2) {
      await admin.from('payments').insert([
        {
          business_id: businessId,
          branch_id: branchId,
          order_id: testOrder2.id,
          payment_reference: `PAY-QA9-SPLIT-1-${Date.now()}`,
          idempotency_key: `pay-idemp-s1-${Date.now()}`,
          amount_cents: 3000,
          currency: 'USD',
          payment_method: 'cash',
          payment_status: 'completed',
        },
        {
          business_id: businessId,
          branch_id: branchId,
          order_id: testOrder2.id,
          payment_reference: `PAY-QA9-SPLIT-2-${Date.now()}`,
          idempotency_key: `pay-idemp-s2-${Date.now()}`,
          amount_cents: 2000,
          currency: 'USD',
          payment_method: 'card',
          payment_status: 'completed',
        },
      ]);

      const calcSplit = await PaymentService.calculateAuthoritativeRefundableAmount(testOrder2.id);
      assert(
        calcSplit.refundableAmountCents === 5000 && calcSplit.totalPaidCents === 5000,
        'QA9.5: Split payments ($30 + $20) sum to 5000 cents total refundable',
        `Got: ${calcSplit.refundableAmountCents}`
      );

      // Clean up order 2
      await admin.from('payments').delete().eq('order_id', testOrder2.id);
      await admin.from('orders').delete().eq('id', testOrder2.id);
    }
  } finally {
    // Clean up order 1
    await admin.from('payment_events').delete().eq('order_id', orderId1);
    await admin.from('payments').delete().eq('order_id', orderId1);
    await admin.from('orders').delete().eq('id', orderId1);
  }

  console.log('\n====================================================');
  console.log(`Results: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Unhandled verification error:', e);
  process.exit(1);
});
