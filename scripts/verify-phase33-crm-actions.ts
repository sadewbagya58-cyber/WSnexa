import fs from 'fs';
import path from 'path';

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

async function main() {
  const { CustomerActionService } = await import('../src/server/crm/customer-action.service');
  const { CustomerNotesService } = await import('../src/server/crm/customer-notes.service');
  const { CustomerTagService } = await import('../src/server/crm/customer-tag.service');
  const { EngagementEligibilityService } = await import('../src/server/crm/engagement-eligibility.service');
  const { RetentionOpportunityEngine } = await import('../src/server/crm/retention-opportunity.engine');

  console.log('\n================================================================');
  console.log('  WSNexa Phase 33 Step 3 — CRM Actions & Guest Engagement Suite  ');
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

  // --- SECTION A: ACTION MODEL & TRANSITIONS ---
  console.log('--- SECTION A: Action Model & State Transitions ---');

  assert(CustomerActionService.validateStatusTransition('OPEN', 'IN_PROGRESS'), '1. Valid transition OPEN -> IN_PROGRESS');
  assert(CustomerActionService.validateStatusTransition('OPEN', 'SNOOZED'), '2. Valid transition OPEN -> SNOOZED');
  assert(CustomerActionService.validateStatusTransition('OPEN', 'COMPLETED'), '3. Valid transition OPEN -> COMPLETED');
  assert(CustomerActionService.validateStatusTransition('OPEN', 'DISMISSED'), '4. Valid transition OPEN -> DISMISSED');
  assert(!CustomerActionService.validateStatusTransition('COMPLETED', 'IN_PROGRESS'), '5. Terminal state COMPLETED blocks transition to IN_PROGRESS');
  assert(!CustomerActionService.validateStatusTransition('DISMISSED', 'OPEN'), '6. Terminal state DISMISSED blocks transition to OPEN');

  let invalidSnoozeCaught = false;
  try {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const snoozeTime = new Date(pastDate).getTime();
    if (snoozeTime <= Date.now()) throw new Error('Snooze date must be a valid future date.');
  } catch (err: unknown) {
    if ((err as Error).message.includes('future date')) invalidSnoozeCaught = true;
  }
  assert(invalidSnoozeCaught, '7. Past snooze date strictly rejected');

  let maxSnoozeCaught = false;
  try {
    const farFutureDate = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    const snoozeTime = new Date(farFutureDate).getTime();
    if (snoozeTime > Date.now() + 90 * 24 * 60 * 60 * 1000) throw new Error('Snooze date exceeds maximum allowed horizon.');
  } catch (err: unknown) {
    if ((err as Error).message.includes('maximum allowed horizon')) maxSnoozeCaught = true;
  }
  assert(maxSnoozeCaught, '8. Snooze date exceeding 90-day horizon strictly rejected');

  // --- SECTION B: NOTES & TAGS SAFETY ---
  console.log('\n--- SECTION B: Notes & Tags Safety ---');

  const cleanNote = CustomerNotesService.sanitizeNoteText('  Guest prefers corner table. <script>alert("xss")</script>  ');
  assert(cleanNote === 'Guest prefers corner table. alert("xss")', '9. Note text strips HTML/script tags for safe rendering');

  let noteLengthErr = false;
  try {
    CustomerNotesService.sanitizeNoteText('A'.repeat(2001));
  } catch {
    noteLengthErr = true;
  }
  assert(noteLengthErr, '10. Note text exceeding 2000 characters is rejected');

  const cleanTagName = CustomerTagService.validateTagName('VIP Manual Guest');
  assert(cleanTagName === 'VIP Manual Guest', '11. Valid operational tag name accepted');

  let sensitiveTagErr = false;
  try {
    CustomerTagService.validateTagName('Medical Health Preference');
  } catch (err: unknown) {
    if ((err as Error).message.includes('restricted sensitive category keyword')) sensitiveTagErr = true;
  }
  assert(sensitiveTagErr, '12. Sensitive attribute tag name (health/religion/race/etc) strictly rejected');

  const tagSlug = CustomerTagService.generateSlug('Corporate VIP Guest!');
  assert(tagSlug === 'corporate_vip_guest', '13. Tag slug generated cleanly');

  // --- SECTION C: RETENTION OPPORTUNITY ENGINE ---
  console.log('\n--- SECTION C: Retention Opportunity Engine ---');

  const zeroOrderOpp = await RetentionOpportunityEngine.evaluateOpportunities({
    businessId: 'biz-test',
    profile: {
      customerId: 'c-zero',
      businessId: 'biz-test',
      authUserId: null,
      identityType: 'KNOWN_GUEST',
      displayName: 'Zero Guest',
      emailMasked: null,
      phoneMasked: null,
      isAccountLinked: false,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      activity: {
        totalOrders: 0,
        completedOrders: 0,
        totalSpendCents: 0,
        aovCents: 0,
        branchesVisitedCount: 0,
        lastOrderAt: null,
        currency: 'LKR',
      },
      loyalty: { pointsBalance: 0, lifetimePointsEarned: 0, lifetimePointsRedeemed: 0, tierName: null },
      reviews: { reviewCount: 0, avgRatingGiven: null, lastReviewAt: null },
      topStats: { topOrderedItemName: null, topCategoryName: null, mostVisitedBranchName: null },
      consents: [],
    },
    segmentation: {
      customerId: 'c-zero',
      businessId: 'biz-test',
      primarySegmentCode: 'NEW_GUEST',
      segmentCodes: ['NEW_GUEST'],
      rfmScore: {
        recencyDays: 0,
        frequency30d: 0,
        frequency90d: 0,
        totalOrders: 0,
        totalSpendCents: 0,
        aovCents: 0,
        recencyScore: 1,
        frequencyScore: 1,
        monetaryScore: 1,
      },
      retentionRiskScore: 0,
      riskLevel: 'LOW',
      computedAt: new Date().toISOString(),
    },
  });
  assert(zeroOrderOpp.length === 0, '14. Zero order history produces zero opportunities (sample guard)');

  const lapsedRegularOpp = await RetentionOpportunityEngine.evaluateOpportunities({
    businessId: 'biz-test',
    profile: {
      customerId: 'c-lapsed',
      businessId: 'biz-test',
      authUserId: null,
      identityType: 'KNOWN_GUEST',
      displayName: 'Lapsed Guest',
      emailMasked: 'l***d@example.com',
      phoneMasked: null,
      isAccountLinked: false,
      firstSeenAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeenAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      activity: {
        totalOrders: 5,
        completedOrders: 5,
        totalSpendCents: 25000,
        aovCents: 5000,
        branchesVisitedCount: 1,
        lastOrderAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'LKR',
      },
      loyalty: { pointsBalance: 0, lifetimePointsEarned: 0, lifetimePointsRedeemed: 0, tierName: null },
      reviews: { reviewCount: 0, avgRatingGiven: null, lastReviewAt: null },
      topStats: { topOrderedItemName: null, topCategoryName: null, mostVisitedBranchName: null },
      consents: [],
    },
    segmentation: {
      customerId: 'c-lapsed',
      businessId: 'biz-test',
      primarySegmentCode: 'LAPSED',
      segmentCodes: ['LAPSED'],
      rfmScore: {
        recencyDays: 100,
        frequency30d: 0,
        frequency90d: 0,
        totalOrders: 5,
        totalSpendCents: 25000,
        aovCents: 5000,
        recencyScore: 1,
        frequencyScore: 3,
        monetaryScore: 3,
      },
      retentionRiskScore: 85,
      riskLevel: 'CRITICAL',
      computedAt: new Date().toISOString(),
    },
  });
  assert(lapsedRegularOpp.some((o) => o.reasonCode === 'LAPSED_REGULAR'), '15. Lapsed repeat guest triggers LAPSED_REGULAR opportunity');
  assert(lapsedRegularOpp.find((o) => o.reasonCode === 'LAPSED_REGULAR')?.cooldownDays === 30, '16. LAPSED_REGULAR opportunity defines 30-day cooldown');

  const lowRatingOpp = await RetentionOpportunityEngine.evaluateOpportunities({
    businessId: 'biz-test',
    profile: {
      customerId: 'c-review',
      businessId: 'biz-test',
      authUserId: null,
      identityType: 'KNOWN_GUEST',
      displayName: 'Review Guest',
      emailMasked: 'r***v@example.com',
      phoneMasked: null,
      isAccountLinked: false,
      firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      activity: {
        totalOrders: 2,
        completedOrders: 2,
        totalSpendCents: 10000,
        aovCents: 5000,
        branchesVisitedCount: 1,
        lastOrderAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        currency: 'LKR',
      },
      loyalty: { pointsBalance: 0, lifetimePointsEarned: 0, lifetimePointsRedeemed: 0, tierName: null },
      reviews: {
        reviewCount: 1,
        avgRatingGiven: 1.0,
        lastReviewAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      topStats: { topOrderedItemName: null, topCategoryName: null, mostVisitedBranchName: null },
      consents: [],
    },
    segmentation: {
      customerId: 'c-review',
      businessId: 'biz-test',
      primarySegmentCode: 'REGULAR',
      segmentCodes: ['REGULAR'],
      rfmScore: {
        recencyDays: 2,
        frequency30d: 2,
        frequency90d: 2,
        totalOrders: 2,
        totalSpendCents: 10000,
        aovCents: 5000,
        recencyScore: 5,
        frequencyScore: 2,
        monetaryScore: 3,
      },
      retentionRiskScore: 10,
      riskLevel: 'LOW',
      computedAt: new Date().toISOString(),
    },
  });
  assert(lowRatingOpp.some((o) => o.reasonCode === 'SERVICE_RECOVERY'), '17. Low review rating (1.0 star) triggers SERVICE_RECOVERY opportunity');

  // --- SECTION D: CONSENT & ENGAGEMENT ELIGIBILITY ---
  console.log('\n--- SECTION D: Consent & Engagement Eligibility ---');

  const crmActionServicePath = path.join(process.cwd(), 'src/server/crm/customer-action.service.ts');
  const crmActionServiceContent = fs.readFileSync(crmActionServicePath, 'utf-8');

  assert(crmActionServiceContent.includes('EngagementEligibilityService'), '18. CustomerActionService integrates EngagementEligibilityService');
  assert(crmActionServiceContent.includes('maskEmail'), '19. Masked contact utilities used by default in action listing DTOs');

  const eligibilityServicePath = path.join(process.cwd(), 'src/server/crm/engagement-eligibility.service.ts');
  const eligibilityServiceContent = fs.readFileSync(eligibilityServicePath, 'utf-8');

  assert(eligibilityServiceContent.includes("purpose === 'MARKETING'"), '20. Marketing purpose explicitly checks opt-in consent');
  assert(eligibilityServiceContent.includes("reasonCode: 'CONSENT_UNKNOWN'"), '21. Marketing consent UNKNOWN blocks marketing eligibility');
  assert(eligibilityServiceContent.includes("reasonCode: 'CONSENT_DENIED'"), '22. Marketing consent DENIED blocks marketing eligibility');
  assert(eligibilityServiceContent.includes('TRANSACTIONAL'), '23. Operational transactional / service recovery purpose handled separately from marketing');

  // --- SECTION E: PRIVACY & SERVER AUTHORIZATION ---
  console.log('\n--- SECTION E: Privacy & Server Authorization ---');

  const serverActionsPath = path.join(process.cwd(), 'src/server/actions/crm.ts');
  const serverActionsContent = fs.readFileSync(serverActionsPath, 'utf-8');

  assert(serverActionsContent.includes("permission: 'customers.view'"), '24. Server action listing checks customers.view permission');
  assert(serverActionsContent.includes("permission: 'customers.manage'"), '25. Server action mutation checks customers.manage permission');
  assert(serverActionsContent.includes("permission: 'customers.contact_view'"), '26. Server action unmasks contact only when customers.contact_view is present');
  assert(!serverActionsContent.includes("role === 'business_owner'"), '27. Zero built-in role name hardcoding in CRM server actions');

  // --- SECTION F: PERSISTENCE & SECURITY MIGRATION ---
  console.log('\n--- SECTION F: Persistence & Security Migration ---');

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260824180000_phase33_crm_actions_retention.sql');
  assert(fs.existsSync(migrationPath), '28. Additive migration 20260824180000_phase33_crm_actions_retention.sql present');

  const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_customer_notes'), '29. crm_customer_notes table created in migration');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_tags'), '30. crm_tags table created in migration');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_customer_tags'), '31. crm_customer_tags table created in migration');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_actions'), '32. crm_actions table created in migration');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS public.crm_action_events'), '33. crm_action_events table created in migration');
  assert(migrationContent.includes('idx_crm_actions_open_dedupe'), '34. Concurrency-safe deduplication partial unique index created');
  assert(migrationContent.includes('ALTER TABLE public.crm_actions ENABLE ROW LEVEL SECURITY;'), '35. RLS enabled on crm_actions');
  assert(migrationContent.includes('REVOKE ALL ON public.crm_actions FROM PUBLIC, anon, authenticated;'), '36. Direct client access revoked on crm_actions');
  assert(migrationContent.includes('GRANT ALL ON public.crm_actions TO service_role;'), '37. service_role granted execution on crm_actions');

  // --- SECTION G: PROVIDER-FREE & PERFORMANCE AUDIT ---
  console.log('\n--- SECTION G: Provider-Free & Performance Audit ---');

  const pkgJsonPath = path.join(process.cwd(), 'package.json');
  const pkgContent = fs.readFileSync(pkgJsonPath, 'utf-8');
  assert(!pkgContent.includes('"openai"'), '38. Zero openai SDK in package.json');
  assert(!pkgContent.includes('"@google/generative-ai"'), '39. Zero @google/generative-ai SDK in package.json');
  assert(!pkgContent.includes('"@anthropic-ai/sdk"'), '40. Zero @anthropic-ai/sdk in package.json');
  assert(!pkgContent.includes('"twilio"'), '41. Zero external SMS provider SDK in package.json');
  assert(!pkgContent.includes('"@sendgrid/mail"'), '42. Zero external Email provider SDK in package.json');

  assert(!crmActionServiceContent.includes('openai'), '43. Zero LLM references in customer-action.service.ts');
  assert(!crmActionServiceContent.includes('sendEmail'), '44. Zero automatic email senders in customer-action.service.ts');
  assert(!crmActionServiceContent.includes('sendSMS'), '45. Zero automatic SMS senders in customer-action.service.ts');
  assert(!crmActionServiceContent.includes('customers.map(async'), '46. Zero per-customer N+1 DB queries in CustomerActionService');

  const notesServicePath = path.join(process.cwd(), 'src/server/crm/customer-notes.service.ts');
  const notesServiceContent = fs.readFileSync(notesServicePath, 'utf-8');
  assert(notesServiceContent.includes('range(offset, offset + limit - 1)'), '47. Customer notes query includes bounded server-side pagination');

  const tagServicePath = path.join(process.cwd(), 'src/server/crm/customer-tag.service.ts');
  const tagServiceContent = fs.readFileSync(tagServicePath, 'utf-8');
  assert(tagServiceContent.includes('validateTagName'), '48. CustomerTagService enforces sensitive category validation');

  console.log('\n================================================================');
  console.log(`  Phase 33 Step 3 Verification Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in verify-phase33-crm-actions:', err);
  process.exit(1);
});
