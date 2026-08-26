import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Bypass server-only guard for direct tsx execution
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 36 Step 1 — Subscription Payments & Pricing Engine');
  console.log('================================================================\n');

  const { SubscriptionPricingService } = await import('../src/server/services/subscription-pricing.service');
  const { SUBSCRIPTION_PRICING_CONFIG, SUBSCRIPTION_PLANS } = await import('../src/lib/config/subscription-plans');

  // 1. Migration File & Schema Validation
  console.log('--- SECTION 1: Migration File & Schema Validation ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260826030000_v1_subscription_payments_schema.sql');
  assert(fs.existsSync(migrationPath), '1. Migration file 20260826030000_v1_subscription_payments_schema.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.business_subscription_payments'), '2. public.business_subscription_payments table created');
  assert(migrationSql.includes('idempotency_key TEXT UNIQUE NOT NULL'), '3. idempotency_key UNIQUE constraint enforced');
  assert(migrationSql.includes('amount_lkr INTEGER NOT NULL'), '4. Integer amount_lkr column defined');
  assert(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), '5. RLS enabled on subscription payments table');
  assert(migrationSql.includes('REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscription_payments'), '6. Direct client mutation revoked on subscription payments');
  assert(migrationSql.includes('public.auth_is_business_owner(business_id)'), '7. Business owner read RLS policy defined');

  // 2. Pricing Configuration Single Source of Truth
  console.log('\n--- SECTION 2: Single Source of Truth Configuration ---');
  assert(SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr === 4499, '8. Starter price configured as 4,499 LKR');
  assert(SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr === 8999, '9. Growth price configured as 8,999 LKR');
  assert(SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr === 24999, '10. Enterprise base price configured as 24,999 LKR');
  assert(SUBSCRIPTION_PRICING_CONFIG.enterpriseIncludedBranches === 5, '11. Enterprise included branches configured as 5');
  assert(SUBSCRIPTION_PRICING_CONFIG.enterpriseIncludedStaff === 75, '12. Enterprise included staff configured as 75');
  assert(SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraBranchMonthlyLkr === 3000, '13. Enterprise extra branch rate is 3,000 LKR');
  assert(SUBSCRIPTION_PRICING_CONFIG.enterpriseExtraStaffBlockMonthlyLkr === 2000, '14. Enterprise extra staff block rate is 2,000 LKR');

  // 3. Starter & Growth Price Calculations
  console.log('\n--- SECTION 3: Starter & Growth Price Calculations ---');
  const starterRes = SubscriptionPricingService.calculateStarterPrice();
  assert(starterRes.total === 4499, '15. Starter price calculates to LKR 4,499');
  assert(starterRes.currency === 'LKR', '16. Currency is LKR');

  const growthRes = SubscriptionPricingService.calculateGrowthPrice();
  assert(growthRes.total === 8999, '17. Growth price calculates to LKR 8,999');

  // 4. Enterprise Ceiling Block Formula Test Cases
  console.log('\n--- SECTION 4: Enterprise Pricing Calculator Test Cases ---');
  
  // Test 1: 5 branches / 75 staff = LKR 24,999
  const ent1 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 5, activeStaff: 75 });
  assert(ent1.total === 24999, '18. Enterprise 5 branches / 75 staff = LKR 24,999');
  assert(ent1.breakdown?.extraBranches === 0, '19. Extra branches = 0');
  assert(ent1.breakdown?.extraStaffBlocks === 0, '20. Extra staff blocks = 0');

  // Test 2: 6 branches / 75 staff = LKR 27,999
  const ent2 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 6, activeStaff: 75 });
  assert(ent2.total === 27999, '21. Enterprise 6 branches / 75 staff = LKR 27,999');
  assert(ent2.breakdown?.extraBranches === 1, '22. Extra branches = 1');
  assert(ent2.breakdown?.extraBranchCharge === 3000, '23. Extra branch charge = LKR 3,000');

  // Test 3: 10 branches / 75 staff = LKR 39,999
  const ent3 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 10, activeStaff: 75 });
  assert(ent3.total === 39999, '24. Enterprise 10 branches / 75 staff = LKR 39,999');
  assert(ent3.breakdown?.extraBranches === 5, '25. Extra branches = 5');

  // Test 4: 5 branches / 76 staff = LKR 26,999 (1 extra staff block)
  const ent4 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 5, activeStaff: 76 });
  assert(ent4.total === 26999, '26. Enterprise 5 branches / 76 staff = LKR 26,999');
  assert(ent4.breakdown?.extraStaffBlocks === 1, '27. Extra staff blocks = 1 (ceiling for 1 staff above 75)');

  // Test 5: 5 branches / 100 staff = LKR 26,999 (1 extra staff block)
  const ent5 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 5, activeStaff: 100 });
  assert(ent5.total === 26999, '28. Enterprise 5 branches / 100 staff = LKR 26,999');
  assert(ent5.breakdown?.extraStaffBlocks === 1, '29. Extra staff blocks = 1 (exactly 25 staff above 75)');

  // Test 6: 5 branches / 101 staff = LKR 28,999 (2 extra staff blocks)
  const ent6 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 5, activeStaff: 101 });
  assert(ent6.total === 28999, '30. Enterprise 5 branches / 101 staff = LKR 28,999');
  assert(ent6.breakdown?.extraStaffBlocks === 2, '31. Extra staff blocks = 2 (ceiling for 26 staff above 75)');

  // Test 7: 10 branches / 200 staff = LKR 49,999 (5 extra branches, 5 extra staff blocks)
  const ent7 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 10, activeStaff: 200 });
  assert(ent7.total === 49999, '32. Enterprise 10 branches / 200 staff = LKR 49,999');
  assert(ent7.breakdown?.extraBranches === 5, '33. Extra branches = 5');
  assert(ent7.breakdown?.extraStaffBlocks === 5, '34. Extra staff blocks = 5 (125 extra staff)');

  // Test 8: Scale below included minimums (e.g. 1 branch / 10 staff) remains base price LKR 24,999
  const ent8 = SubscriptionPricingService.calculateEnterprisePrice({ branches: 1, activeStaff: 10 });
  assert(ent8.total === 24999, '35. Enterprise 1 branch / 10 staff remains base price LKR 24,999');

  // 5. Canonical Entry Point API Verification
  console.log('\n--- SECTION 5: Canonical Entry Point API Verification ---');
  const entryRes = SubscriptionPricingService.calculateSubscriptionPrice({
    planCode: 'enterprise',
    enterpriseConfig: { branches: 10, activeStaff: 200 },
  });
  assert(entryRes.total === 49999, '36. calculateSubscriptionPrice resolves enterprise configuration correctly');

  // 6. Pricing Snapshot Verification
  console.log('\n--- SECTION 6: Pricing Snapshot Creation ---');
  const snapshot = SubscriptionPricingService.createPricingSnapshot(entryRes);
  assert(typeof snapshot.calculatedAt === 'string', '37. Pricing snapshot includes calculatedAt ISO string');
  assert(snapshot.total === 49999, '38. Pricing snapshot preserves total');

  // 7. Input Validation & Error Handling
  console.log('\n--- SECTION 7: Input Validation & Error Handling ---');
  assert.throws(
    () => SubscriptionPricingService.calculateEnterprisePrice({ branches: 0, activeStaff: 75 }),
    /PRICING_INVALID_ENTERPRISE_BRANCHES/,
    '39. Throws error for branches < 1'
  );

  assert.throws(
    () => SubscriptionPricingService.calculateEnterprisePrice({ branches: 5, activeStaff: -5 }),
    /PRICING_INVALID_ENTERPRISE_STAFF/,
    '40. Throws error for activeStaff < 1'
  );

  assert.throws(
    () => SubscriptionPricingService.calculateEnterprisePrice({ branches: 5.5, activeStaff: 75 }),
    /PRICING_INVALID_ENTERPRISE_BRANCHES/,
    '41. Throws error for non-integer decimal branches'
  );

  assert.throws(
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'enterprise' }),
    /PRICING_INVALID_INPUT/,
    '42. Throws error when enterpriseConfig is missing for Enterprise'
  );

  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => SubscriptionPricingService.calculateSubscriptionPrice({ planCode: 'invalid_plan' as any }),
    /PRICING_INVALID_PLAN/,
    '43. Throws error for invalid plan code'
  );

  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => SubscriptionPricingService.calculateStarterPrice('annual' as any),
    /PRICING_UNSUPPORTED_INTERVAL/,
    '44. Throws error for unsupported billing interval'
  );

  // 8. Order Payment Domain Protection & Documentation Verification
  console.log('\n--- SECTION 8: Domain Protection & Documentation ---');
  const docPath = path.join(process.cwd(), 'docs/v1-subscription-payments.md');
  assert(fs.existsSync(docPath), '45. Documentation file docs/v1-subscription-payments.md exists');

  const docContent = fs.readFileSync(docPath, 'utf-8');
  assert(docContent.includes('Domain Separation'), '46. Documentation details payment domain separation');
  assert(docContent.includes('Enterprise Pricing Formula'), '47. Documentation details Enterprise pricing formula');
  assert(docContent.includes('Server-Authoritative'), '48. Documentation details server-authoritative security');

  console.log('\n================================================================');
  console.log('  Phase 36 Step 1 Verification: ALL 48 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
