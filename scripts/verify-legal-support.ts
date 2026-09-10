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

import {
  getAllLegalDocuments,
  getLegalDocumentBySlug,
  OFFICIAL_BUSINESS_INFO,
} from '../src/content/legal/registry';
import {
  submitSupportRequestAction,
  submitProblemReportAction,
  submitSecurityReportAction,
} from '../src/server/actions/support';
import { SystemStatusService } from '../src/server/services/system-status.service';
import { SUBSCRIPTION_PRICING_CONFIG } from '../src/lib/config/subscription-plans';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('WSNexa — Legal, Support & Company Foundation Test Suite');
  console.log('============================================================\n');

  // 1. BUSINESS INFORMATION INTEGRITY
  console.log('--- 1. Verified Business Information Integrity ---');
  assert(OFFICIAL_BUSINESS_INFO.brand === 'WSNexa', 'Brand name is strictly WSNexa');
  assert(OFFICIAL_BUSINESS_INFO.tagline === 'Smart Hospitality. Simplified.', 'Tagline matches specification');
  assert(OFFICIAL_BUSINESS_INFO.supportEmail === 'wsnexaofficial@gmail.com', 'Support email is wsnexaofficial@gmail.com');
  assert(OFFICIAL_BUSINESS_INFO.phone === '0761434289', 'Phone number is 0761434289');
  assert(OFFICIAL_BUSINESS_INFO.address === 'Panawewa, Bingiriya, Sri Lanka', 'Address is Panawewa, Bingiriya, Sri Lanka');
  assert(OFFICIAL_BUSINESS_INFO.legalNotice.includes('Sri Lankan legal counsel'), 'Legal notice mandates counsel review');

  // 2. LEGAL DOCUMENTS REGISTRY
  console.log('\n--- 2. Legal Document Registry Coverage ---');
  const docs = getAllLegalDocuments();
  assert(docs.length === 8, 'Exactly 8 authoritative legal documents exist', `Found ${docs.length}`);

  const expectedSlugs = [
    'terms',
    'privacy',
    'cookies',
    'acceptable-use',
    'subscription-billing',
    'refund-cancellation',
    'data-deletion',
    'security',
  ];

  for (const slug of expectedSlugs) {
    const doc = getLegalDocumentBySlug(slug);
    assert(!!doc, `Document exists: ${slug}`);
    if (doc) {
      assert(doc.version === '1.0', `${slug} has version 1.0`);
      assert(doc.effectiveDate === 'March 18, 2025', `${slug} has effective date March 18, 2025`);
      assert(doc.lastUpdatedDate === 'September 10, 2026', `${slug} has last updated date`);
      assert(doc.requiresLegalReview === true, `${slug} requires legal review flag is set`);
      assert(doc.sections.length >= 3, `${slug} contains comprehensive structured sections (${doc.sections.length})`);
    }
  }

  // 3. POLICY CONTENT ACCURACY & FORBIDDEN CLAIMS AUDIT
  console.log('\n--- 3. Policy Content Accuracy & Absolute Claims Audit ---');
  const allContentString = JSON.stringify(docs);

  assert(!allContentString.includes('100% uptime'), 'No forbidden "100% uptime" claims');
  assert(!allContentString.includes('100% secure'), 'No forbidden "100% secure" claims');
  assert(!allContentString.includes('zero data loss'), 'No forbidden "zero data loss" claims');
  assert(!allContentString.includes('never hacked'), 'No forbidden "never hacked" claims');
  assert(!allContentString.includes('guaranteed availability'), 'No forbidden "guaranteed availability" claims');
  assert(!allContentString.includes('guaranteed refunds'), 'No forbidden "guaranteed refunds" claims');
  assert(!allContentString.includes('PV00'), 'No fabricated company registration number');
  assert(!allContentString.includes('TIN-'), 'No fabricated TIN/VAT number');

  // Privacy Policy Specifics
  const privacy = getLegalDocumentBySlug('privacy')!;
  const privacyText = JSON.stringify(privacy);
  assert(privacyText.includes('Personal Data Protection Act No. 9 of 2022'), 'Privacy policy cites SL PDPA Act No. 9 of 2022');
  assert(privacyText.includes('Amendment') && privacyText.includes('2025'), 'Privacy policy cites PDPA Amendment Act of 2025');
  assert(privacyText.includes('18 March 2025'), 'Privacy policy cites operational date 18 March 2025');
  assert(privacyText.includes('Data Controller') && privacyText.includes('Data Processor'), 'Privacy policy distinguishes Controller vs Processor');

  // Subscription Policy Specifics
  const subPolicy = getLegalDocumentBySlug('subscription-billing')!;
  const subText = JSON.stringify(subPolicy);
  assert(subText.includes(String(SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr)), `Subscription policy includes Starter price LKR ${SUBSCRIPTION_PRICING_CONFIG.starterMonthlyLkr}`);
  assert(subText.includes(String(SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr)), `Subscription policy includes Growth price LKR ${SUBSCRIPTION_PRICING_CONFIG.growthMonthlyLkr}`);
  assert(subText.includes(String(SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr)), `Subscription policy includes Enterprise base price LKR ${SUBSCRIPTION_PRICING_CONFIG.enterpriseBaseMonthlyLkr}`);
  assert(subText.includes('OnePay') && subText.includes('Dialog') && subText.includes('PayHere'), 'Subscription policy lists verified payment providers');

  // Refund Policy Specifics
  const refundPolicy = getLegalDocumentBySlug('refund-cancellation')!;
  const refundText = JSON.stringify(refundPolicy);
  assert(refundText.includes('Tier A') && refundText.includes('Tier B'), 'Refund policy separates Tier A SaaS and Tier B Venue food orders');
  assert(refundText.includes('Consumer Affairs Authority Act No. 9 of 2003'), 'Refund policy cites Sri Lanka Consumer Affairs Authority Act');

  // 4. SUPPORT ACTIONS & FORM VALIDATION
  console.log('\n--- 4. Support Actions & Validation Schemas ---');
  
  // Valid support request
  const validSupportRes = await submitSupportRequestAction({
    name: 'Saman Kumara',
    email: 'saman@restaurant.lk',
    category: 'general',
    subject: 'Inquiry regarding printer configuration',
    message: 'Can we connect an EPSON thermal receipt printer over Wi-Fi to the cashier?',
  });
  assert(validSupportRes.success === true, 'Valid support ticket submission succeeds');
  assert(validSupportRes.data?.ticketId.startsWith('SUP-') === true, 'Support ticket ID has SUP- prefix');

  // Invalid support request (short message, bad email)
  const invalidSupportRes = await submitSupportRequestAction({
    name: 'A',
    email: 'not-an-email',
    category: 'general',
    subject: 'Hi',
    message: 'Short',
  });
  assert(invalidSupportRes.success === false, 'Invalid support request is rejected');
  assert(!!invalidSupportRes.fieldErrors?.email, 'Email field error returned');
  assert(!!invalidSupportRes.fieldErrors?.message, 'Message field error returned');

  // Valid problem report
  const validProblemRes = await submitProblemReportAction({
    contactEmail: 'manager@hotel.lk',
    category: 'kitchen',
    description: 'Ticket does not advance to ready status when clicked',
    stepsToReproduce: 'Open kitchen queue, click ready on ticket 10, screen remains pending',
    expectedBehavior: 'Ticket status should update to ready',
    actualBehavior: 'Ticket remains in preparing state',
    deviceBrowser: 'Android 14 Chrome Tablet',
  });
  assert(validProblemRes.success === true, 'Valid problem report submission succeeds');
  assert(validProblemRes.data?.ticketId.startsWith('BUG-') === true, 'Problem ticket ID has BUG- prefix');

  // Valid security disclosure
  const validSecRes = await submitSecurityReportAction({
    researcherName: 'SecurityAnalyst01',
    contactEmail: 'researcher@sec.org',
    summary: 'Missing rate limit on table PIN verification',
    affectedArea: '/api/dine-in/verify-pin',
    severity: 'medium',
    reproductionSteps: 'Send 50 rapid POST requests with incorrect PIN within 2 seconds',
    proofOfConcept: 'curl -X POST https://wsnexa.com/api/dine-in/verify-pin ...',
    adheresToPolicy: true,
  });
  assert(validSecRes.success === true, 'Valid security report submission succeeds');
  assert(validSecRes.data?.ticketId.startsWith('SEC-') === true, 'Security report ID has SEC- prefix');

  // Security report rejected without policy adherence confirmation
  const invalidSecRes = await submitSecurityReportAction({
    contactEmail: 'researcher@sec.org',
    summary: 'Missing rate limit on table PIN verification',
    affectedArea: '/api/dine-in/verify-pin',
    severity: 'medium',
    reproductionSteps: 'Send 50 rapid POST requests with incorrect PIN within 2 seconds',
    adheresToPolicy: false,
  });
  assert(invalidSecRes.success === false, 'Security report rejected when adheresToPolicy is false');

  // 5. SYSTEM STATUS ENGINE
  console.log('\n--- 5. Authoritative System Status Engine ---');
  const statusReport = await SystemStatusService.getAuthoritativeStatus();
  assert(typeof statusReport.overallStatus === 'string', 'System status returns overallStatus');
  assert(typeof statusReport.databaseConnected === 'boolean', 'System status probes databaseConnected');
  assert(statusReport.subsystems.length >= 8, `System status tracks ${statusReport.subsystems.length} subsystems (>= 8)`);
  assert(new Date(statusReport.lastCheckedAt).getTime() > 0, 'System status has valid lastCheckedAt ISO timestamp');

  // 6. SUMMARY REPORT
  console.log('\n============================================================');
  console.log(`Results: ${passed} Passed | ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
