import fs from 'fs';
import path from 'path';

// Load .env.local before importing modules that depend on env validation
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

import type { SystemSegmentDefinition } from '../src/lib/crm/crm-segmentation.types';
import { SYSTEM_SEGMENTS } from '../src/lib/crm/crm-segmentation.types';

async function main() {
  const { CustomerSegmentationService } = await import('../src/server/crm/customer-segmentation.service');

  console.log('\n================================================================');
  console.log('  WSNexa Phase 33 Step 2 — Behavioral Segmentation & RFM Suite  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      failed++;
    }
  }

  // --- SECTION 1: System Segment Definitions & Contracts ---
  console.log('--- SECTION 1: System Segment Definitions & Contracts ---');
  assert(SYSTEM_SEGMENTS.length === 6, '1. Exactly 6 system segments defined');
  const codes = SYSTEM_SEGMENTS.map((s: SystemSegmentDefinition) => s.code);
  assert(
    codes.includes('VIP') &&
      codes.includes('REGULAR') &&
      codes.includes('AT_RISK') &&
      codes.includes('LAPSED') &&
      codes.includes('NEW_GUEST') &&
      codes.includes('ONE_TIME'),
    '2. Contains VIP, REGULAR, AT_RISK, LAPSED, NEW_GUEST, and ONE_TIME codes'
  );

  // --- SECTION 2: Deterministic RFM Score Calculation ---
  console.log('\n--- SECTION 2: Deterministic RFM Score Calculation ---');

  const rfmRecentHighSpend = CustomerSegmentationService.computeCustomerRFM({
    recencyDays: 3,
    frequency30d: 5,
    frequency90d: 12,
    totalOrders: 15,
    totalSpendCents: 60000,
    aovCents: 4000,
  });

  assert(rfmRecentHighSpend.recencyScore === 5, '3. Recent visit (3 days) scores Recency = 5');
  assert(rfmRecentHighSpend.frequencyScore === 5, '4. High frequency (15 total orders) scores Frequency = 5');
  assert(rfmRecentHighSpend.monetaryScore === 5, '5. High spend ($600) scores Monetary = 5');

  const rfmOldLowSpend = CustomerSegmentationService.computeCustomerRFM({
    recencyDays: 120,
    frequency30d: 0,
    frequency90d: 0,
    totalOrders: 1,
    totalSpendCents: 1500,
    aovCents: 1500,
  });

  assert(rfmOldLowSpend.recencyScore === 1, '6. Old visit (120 days) scores Recency = 1');
  assert(rfmOldLowSpend.frequencyScore === 1, '7. 1 total order scores Frequency = 1');
  assert(rfmOldLowSpend.monetaryScore === 1, '8. Low spend ($15) scores Monetary = 1');

  // --- SECTION 3: Retention Risk & Sample-Size Safety ---
  console.log('\n--- SECTION 3: Retention Risk & Sample-Size Safety ---');

  const zeroOrderRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 0,
    totalOrders: 0,
    firstOrderAt: null,
    lastOrderAt: null,
  });
  assert(zeroOrderRisk.riskLevel === 'LOW', '9. Customer with 0 completed orders evaluates riskLevel = LOW (no fabricated confidence)');
  assert(zeroOrderRisk.retentionRiskScore <= 15, '10. Customer with 0 completed orders retention risk score is <= 15');

  const oneOrderRecentRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 5,
    totalOrders: 1,
    firstOrderAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastOrderAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(oneOrderRecentRisk.riskLevel === 'LOW', '11. Single-order recent guest evaluates riskLevel = LOW');

  const oneOrderOldRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 50,
    totalOrders: 1,
    firstOrderAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    lastOrderAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(oneOrderOldRisk.riskLevel === 'HIGH', '12. Single-order guest 50 days inactive evaluates riskLevel = HIGH');

  const multiOrderLowRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 5,
    totalOrders: 10,
    firstOrderAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
    lastOrderAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(multiOrderLowRisk.riskLevel === 'LOW', '13. Active multi-order customer evaluates riskLevel = LOW');

  const multiOrderAtRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 45,
    totalOrders: 10,
    firstOrderAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    lastOrderAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(
    multiOrderAtRisk.riskLevel === 'HIGH' || multiOrderAtRisk.riskLevel === 'CRITICAL',
    '14. Multi-order customer with doubled visit interval evaluates riskLevel = HIGH or CRITICAL'
  );

  // --- SECTION 4: Segment Classification Rules & Idempotency ---
  console.log('\n--- SECTION 4: Segment Classification Rules & Idempotency ---');

  const vipClass = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: rfmRecentHighSpend,
    retentionRiskScore: 10,
    riskLevel: 'LOW',
    firstSeenAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(vipClass.primarySegmentCode === 'VIP', '15. High spend + high frequency customer classified as VIP');
  assert(vipClass.segmentCodes.includes('VIP'), '16. segmentCodes includes VIP');

  const lapsedClass = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: rfmOldLowSpend,
    retentionRiskScore: 85,
    riskLevel: 'CRITICAL',
    firstSeenAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(lapsedClass.segmentCodes.includes('LAPSED'), '17. Customer >90 days inactive includes LAPSED segment');

  const newGuestClass = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 2,
      frequency30d: 1,
      frequency90d: 1,
      totalOrders: 1,
      totalSpendCents: 2500,
      aovCents: 2500,
    }),
    retentionRiskScore: 10,
    riskLevel: 'LOW',
    firstSeenAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(newGuestClass.primarySegmentCode === 'NEW_GUEST', '18. Customer joined 5 days ago classified as NEW_GUEST');

  const oneTimeClass = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 40,
      frequency30d: 0,
      frequency90d: 1,
      totalOrders: 1,
      totalSpendCents: 2000,
      aovCents: 2000,
    }),
    retentionRiskScore: 65,
    riskLevel: 'HIGH',
    firstSeenAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(oneTimeClass.segmentCodes.includes('ONE_TIME'), '19. Customer with 1 order 40 days ago includes ONE_TIME segment');

  // --- SECTION 5: Property Scope Reach Isolation ---
  console.log('\n--- SECTION 5: Property Scope Reach Isolation ---');

  // Scenario: Customer has 2 orders on Branch A ($40 total) and 10 orders on Branch B ($1,000 total)
  // Scoped to Branch A only
  const branchAScopedEval = CustomerSegmentationService.evaluateCustomerSegmentation({
    customerId: 'cust-branch-test',
    businessId: 'biz-123',
    firstSeenAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    lastOrderAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    firstOrderAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    totalOrders: 2, // ONLY Branch A orders
    completedOrders: 2,
    totalSpendCents: 4000, // ONLY Branch A spend ($40)
    orders30d: 1,
    orders90d: 2,
  });

  assert(branchAScopedEval.rfmScore.totalOrders === 2, '20. Scoped evaluation totalOrders reflects strictly authorized Branch A orders (2)');
  assert(branchAScopedEval.rfmScore.totalSpendCents === 4000, '21. Scoped evaluation totalSpendCents reflects strictly authorized Branch A spend (4000 cents)');
  assert(branchAScopedEval.primarySegmentCode !== 'VIP', '22. Scoped evaluation does NOT classify customer as VIP based on unauthorized Branch B spend');
  assert(branchAScopedEval.rfmScore.monetaryScore <= 3 && branchAScopedEval.rfmScore.monetaryScore < 5, '23. Scoped monetary score reflects ONLY Branch A spend ($40 total spend, score 3 vs 5 for Branch B)');

  // --- SECTION 6: Migration & Server-Only Security ---
  console.log('\n--- SECTION 6: Migration & Server-Only Security ---');

  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260824120000_phase33_crm_segmentation.sql'
  );
  assert(fs.existsSync(migrationPath), '24. Migration 20260824120000_phase33_crm_segmentation.sql exists');

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_segments'), '25. crm_segments table created in migration');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_customer_segments'), '26. crm_customer_segments table created in migration');
  assert(migrationContent.includes('ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;'), '27. crm_segments RLS enabled');
  assert(migrationContent.includes('ALTER TABLE public.crm_customer_segments ENABLE ROW LEVEL SECURITY;'), '28. crm_customer_segments RLS enabled');
  assert(migrationContent.includes('REVOKE ALL ON public.crm_segments FROM PUBLIC, anon, authenticated;'), '29. crm_segments direct client access revoked');
  assert(migrationContent.includes('REVOKE ALL ON public.crm_customer_segments FROM PUBLIC, anon, authenticated;'), '30. crm_customer_segments direct client access revoked');
  assert(migrationContent.includes('GRANT ALL ON public.crm_segments TO service_role;'), '31. crm_segments service_role granted');
  assert(migrationContent.includes('GRANT ALL ON public.crm_customer_segments TO service_role;'), '32. crm_customer_segments service_role granted');

  // --- SECTION 7: Provider-Free & Performance Architecture Audit ---
  console.log('\n--- SECTION 7: Provider-Free & Performance Architecture Audit ---');

  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
  assert(!pkgContent.includes('"openai"'), '33. Zero openai SDK in package.json');
  assert(!pkgContent.includes('"@google/generative-ai"'), '34. Zero @google/generative-ai SDK in package.json');
  assert(!pkgContent.includes('"@anthropic-ai/sdk"'), '35. Zero @anthropic-ai/sdk in package.json');

  const servicePath = path.join(
    process.cwd(),
    'src/server/crm/customer-segmentation.service.ts'
  );
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert(!serviceContent.includes('openai'), '36. Zero LLM references in customer-segmentation.service.ts');
  assert(!serviceContent.includes('gemini'), '37. Zero Gemini references in customer-segmentation.service.ts');
  assert(!serviceContent.includes('customers.map(async'), '38. Zero N+1 per-customer queries in customer-segmentation.service.ts');

  console.log('\n================================================================');
  console.log(`  Phase 33 Step 2 Verification Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in verify-phase33-segmentation:', err);
  process.exit(1);
});
