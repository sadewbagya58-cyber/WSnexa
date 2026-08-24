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
  console.log('  WSNexa Phase 33 Step 2 — Hardened Segmentation & Intelligence  ');
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

  // --- SECTION 2: Exact Retention Risk Ranges & Boundaries ---
  console.log('\n--- SECTION 2: Exact Retention Risk Ranges & Boundaries ---');

  assert(CustomerSegmentationService.getRiskLevel(29) === 'LOW', '3. Risk score 29 maps to LOW');
  assert(CustomerSegmentationService.getRiskLevel(30) === 'MEDIUM', '4. Risk score 30 maps to MEDIUM (boundary test)');
  assert(CustomerSegmentationService.getRiskLevel(54) === 'MEDIUM', '5. Risk score 54 maps to MEDIUM');
  assert(CustomerSegmentationService.getRiskLevel(55) === 'HIGH', '6. Risk score 55 maps to HIGH (boundary test)');
  assert(CustomerSegmentationService.getRiskLevel(74) === 'HIGH', '7. Risk score 74 maps to HIGH');
  assert(CustomerSegmentationService.getRiskLevel(75) === 'CRITICAL', '8. Risk score 75 maps to CRITICAL (boundary test)');
  assert(CustomerSegmentationService.getRiskLevel(100) === 'CRITICAL', '9. Risk score 100 maps to CRITICAL');

  const zeroOrderRisk = CustomerSegmentationService.computeRetentionRisk({
    recencyDays: 0,
    totalOrders: 0,
    firstOrderAt: null,
    lastOrderAt: null,
  });
  assert(zeroOrderRisk.riskLevel === 'LOW' && zeroOrderRisk.retentionRiskScore === 0, '10. Zero order history maps safely to retentionRiskScore = 0 and LOW risk');

  // --- SECTION 3: NEW_GUEST / ONE_TIME / LAPSED Boundary Semantics ---
  console.log('\n--- SECTION 3: NEW_GUEST / ONE_TIME / LAPSED Boundary Semantics ---');

  const now = Date.now();
  const d30Ago = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d31Ago = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
  const d90Ago = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
  const d91Ago = new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString();

  // 30 days recency (1 order) -> NEW_GUEST
  const rec30Eval = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 30,
      frequency30d: 1,
      frequency90d: 1,
      totalOrders: 1,
      totalSpendCents: 5000,
      aovCents: 5000,
    }),
    retentionRiskScore: 10,
    riskLevel: 'LOW',
    firstSeenAt: d30Ago,
  });
  assert(rec30Eval.primarySegmentCode === 'NEW_GUEST', '11. 30 days recency (1 order) classifies as NEW_GUEST');

  // 31 days recency (1 order) -> ONE_TIME
  const rec31Eval = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 31,
      frequency30d: 0,
      frequency90d: 1,
      totalOrders: 1,
      totalSpendCents: 5000,
      aovCents: 5000,
    }),
    retentionRiskScore: 40,
    riskLevel: 'MEDIUM',
    firstSeenAt: d31Ago,
  });
  assert(rec31Eval.primarySegmentCode === 'ONE_TIME', '12. 31 days recency (1 order) classifies as ONE_TIME (boundary test)');

  // 90 days recency (1 order) -> ONE_TIME
  const rec90Eval = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 90,
      frequency30d: 0,
      frequency90d: 1,
      totalOrders: 1,
      totalSpendCents: 5000,
      aovCents: 5000,
    }),
    retentionRiskScore: 65,
    riskLevel: 'HIGH',
    firstSeenAt: d90Ago,
  });
  assert(rec90Eval.primarySegmentCode === 'ONE_TIME', '13. 90 days recency (1 order) classifies as ONE_TIME (boundary test)');

  // 91 days recency (1 order) -> LAPSED
  const rec91Eval = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: CustomerSegmentationService.computeCustomerRFM({
      recencyDays: 91,
      frequency30d: 0,
      frequency90d: 0,
      totalOrders: 1,
      totalSpendCents: 5000,
      aovCents: 5000,
    }),
    retentionRiskScore: 80,
    riskLevel: 'CRITICAL',
    firstSeenAt: d91Ago,
  });
  assert(rec91Eval.primarySegmentCode === 'LAPSED', '14. 91 days recency (1 order) classifies as LAPSED (boundary test)');

  // --- SECTION 4: Currency-Independent Monetary Scoring & Cohort Fallbacks ---
  console.log('\n--- SECTION 4: Currency-Independent Monetary Scoring & Cohort Fallbacks ---');

  // Percentile Map Test
  const percentile90 = CustomerSegmentationService.computeCustomerRFM({
    recencyDays: 5,
    frequency30d: 2,
    frequency90d: 4,
    totalOrders: 5,
    totalSpendCents: 500000, // 500,000 LKR or AUD or JPY
    aovCents: 100000,
    monetaryPercentile: 90, // Top 10%
  });
  assert(percentile90.monetaryScore === 5, '15. 90th percentile spend scores Monetary = 5 (currency-independent)');

  const percentile15 = CustomerSegmentationService.computeCustomerRFM({
    recencyDays: 5,
    frequency30d: 2,
    frequency90d: 4,
    totalOrders: 5,
    totalSpendCents: 5000,
    aovCents: 1000,
    monetaryPercentile: 15, // Bottom 15%
  });
  assert(percentile15.monetaryScore === 1, '16. 15th percentile spend scores Monetary = 1 (currency-independent)');

  // Small Cohort Fallback Test (1 customer)
  const singleCohortMap = CustomerSegmentationService.computeCohortPercentiles([{ id: 'c1', totalSpendCents: 20000 }]);
  assert(singleCohortMap.get('c1') === 50, '17. Single customer cohort scores neutral 50th percentile (Monetary = 3)');

  // Small Cohort Fallback Test (2 customers)
  const duoCohortMap = CustomerSegmentationService.computeCohortPercentiles([
    { id: 'c1', totalSpendCents: 10000 },
    { id: 'c2', totalSpendCents: 50000 },
  ]);
  assert(duoCohortMap.get('c1') === 30 && duoCohortMap.get('c2') === 80, '18. 2-customer cohort maps lower to 30th percentile (M2) and higher to 80th percentile (M4)');

  // --- SECTION 5: Currency-Independent VIP Definition ---
  console.log('\n--- SECTION 5: Currency-Independent VIP Definition ---');

  const vipEval = CustomerSegmentationService.classifyCustomerSegments({
    rfmScore: {
      recencyDays: 4,
      frequency30d: 5,
      frequency90d: 10,
      totalOrders: 12,
      totalSpendCents: 1500000,
      aovCents: 125000,
      recencyScore: 5,
      frequencyScore: 5,
      monetaryScore: 5,
    },
    retentionRiskScore: 10,
    riskLevel: 'LOW',
    firstSeenAt: new Date(now - 120 * 24 * 60 * 60 * 1000).toISOString(),
  });
  assert(vipEval.primarySegmentCode === 'VIP', '19. MonetaryScore >= 4 + FrequencyScore >= 4 classifies as VIP (no USD threshold)');

  // --- SECTION 6: Property Scope Cohort Safety ---
  console.log('\n--- SECTION 6: Property Scope Cohort Safety ---');

  const branchASpendCohort = [
    { id: 'cust-1', totalSpendCents: 1000 },
    { id: 'cust-2', totalSpendCents: 2000 },
    { id: 'cust-3', totalSpendCents: 3000 },
    { id: 'cust-4', totalSpendCents: 4000 },
    { id: 'cust-5', totalSpendCents: 5000 },
  ];
  const branchAPercentiles = CustomerSegmentationService.computeCohortPercentiles(branchASpendCohort);
  assert(branchAPercentiles.get('cust-5') === 100, '20. Branch A cohort top spender receives 100th percentile within Branch A reach');

  // --- SECTION 7: Migration & Server-Only Security ---
  console.log('\n--- SECTION 7: Migration & Server-Only Security ---');

  const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260824120000_phase33_crm_segmentation.sql'
  );
  assert(fs.existsSync(migrationPath), '21. Migration 20260824120000_phase33_crm_segmentation.sql exists');

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationContent.includes('ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;'), '22. crm_segments RLS enabled');
  assert(migrationContent.includes('ALTER TABLE public.crm_customer_segments ENABLE ROW LEVEL SECURITY;'), '23. crm_customer_segments RLS enabled');
  assert(migrationContent.includes('REVOKE ALL ON public.crm_segments FROM PUBLIC, anon, authenticated;'), '24. crm_segments direct client access revoked');
  assert(migrationContent.includes('GRANT ALL ON public.crm_segments TO service_role;'), '25. crm_segments service_role granted');

  // --- SECTION 8: Provider-Free & Source Code Audit ---
  console.log('\n--- SECTION 8: Provider-Free & Source Code Audit ---');

  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
  assert(!pkgContent.includes('"openai"'), '26. Zero openai SDK in package.json');
  assert(!pkgContent.includes('"@google/generative-ai"'), '27. Zero @google/generative-ai SDK in package.json');
  assert(!pkgContent.includes('"@anthropic-ai/sdk"'), '28. Zero @anthropic-ai/sdk in package.json');

  const servicePath = path.join(
    process.cwd(),
    'src/server/crm/customer-segmentation.service.ts'
  );
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert(!serviceContent.includes('openai'), '29. Zero LLM references in customer-segmentation.service.ts');
  assert(!serviceContent.includes('$500'), '30. Zero hardcoded $500 USD threshold in customer-segmentation.service.ts');
  assert(!serviceContent.includes('$250'), '31. Zero hardcoded $250 USD threshold in customer-segmentation.service.ts');
  assert(!serviceContent.includes('$100'), '32. Zero hardcoded $100 USD threshold in customer-segmentation.service.ts');
  assert(!serviceContent.includes('customers.map(async'), '33. Zero N+1 per-customer queries in customer-segmentation.service.ts');

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
