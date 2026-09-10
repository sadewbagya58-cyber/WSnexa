import { getAllLegalDocuments, getLegalDocumentBySlug } from '../src/content/legal/registry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function run() {
  console.log('============================================================');
  console.log('WSNexa — Legal QA & Branding Master Verification');
  console.log('============================================================');

  // 1. QA-1 Verification: Document Structure & Mobile Invariants
  console.log('\n--- 1. QA-1: Legal Center Mobile & Direct Navigation ---');
  const docs = getAllLegalDocuments();
  assert(docs.length === 8, 'Exactly 8 legal documents in registry');

  for (const doc of docs) {
    assert(!!doc.slug, `Document ${doc.id} has slug`);
    assert(doc.href.startsWith('/legal/'), `Document ${doc.id} href is under /legal/`);
    assert(doc.sections.length > 0, `Document ${doc.id} has structured sections`);
  }

  // 2. QA-2 Verification: Payment Provider Claims Audit
  console.log('\n--- 2. QA-2: Payment Provider Claims Audit ---');
  for (const doc of docs) {
    const text = JSON.stringify(doc);
    assert(!text.includes('verified payment provider'), `Document ${doc.slug} contains NO "verified payment provider" claim`);
    assert(!text.includes('supported payment gateway'), `Document ${doc.slug} contains NO "supported payment gateway" claim`);
    assert(!text.includes('secure payment through OnePay'), `Document ${doc.slug} contains NO "secure payment through OnePay" claim`);
    assert(!text.includes('secure payment through PayHere'), `Document ${doc.slug} contains NO "secure payment through PayHere" claim`);
  }

  const subBilling = getLegalDocumentBySlug('subscription-billing')!;
  const subText = JSON.stringify(subBilling);
  assert(subText.includes('not yet activated a production online payment gateway'), 'Subscription policy explicitly states gateway is NOT yet activated');
  assert(subText.includes('Indicative Subscription Tiers (Pre-Commercial)'), 'Subscription policy describes pricing as indicative pre-commercial configurations');

  const terms = getLegalDocumentBySlug('terms')!;
  const termsText = JSON.stringify(terms);
  assert(termsText.includes('WSNexa has not activated a production online payment gateway'), 'Terms explicitly states online payment gateway is not activated');

  const privacy = getLegalDocumentBySlug('privacy')!;
  const privacyText = JSON.stringify(privacy);
  assert(!privacyText.includes('OnePay') && !privacyText.includes('PayHere'), 'Privacy policy subprocessors do not list unactivated payment gateways as active processors');

  // 3. QA-3 Verification: Navigation & Parent Mapping
  console.log('\n--- 3. QA-3: Authenticated Navigation Parent Mapping ---');
  const { DETAIL_ROUTE_PARENT_MAP, CANONICAL_DASHBOARD_NAV_SECTIONS } = await import('../src/lib/navigation/dashboard-navigation');
  assert(DETAIL_ROUTE_PARENT_MAP['/dashboard/settings/legal'] === '/dashboard/settings', 'DETAIL_ROUTE_PARENT_MAP maps /dashboard/settings/legal to /dashboard/settings');

  const settingsSection = CANONICAL_DASHBOARD_NAV_SECTIONS.flatMap(s => s.items).find(i => i.id === 'settings');
  assert(!!settingsSection, 'Settings section exists in canonical nav');
  const legalChild = settingsSection?.children?.find(c => c.id === 'legal_support');
  assert(!!legalChild, 'legal_support is registered as a child under Settings');
  assert(legalChild?.href === '/dashboard/settings/legal', 'legal_support href points to /dashboard/settings/legal');

  // 4. Branding Assets Verification
  console.log('\n--- 4. Official Branding Assets & Component Check ---');
  const fs = await import('fs');
  assert(fs.existsSync('public/brand/ws-mark.png'), 'public/brand/ws-mark.png exists');
  assert(fs.existsSync('public/brand/wsnexa-full-logo.png'), 'public/brand/wsnexa-full-logo.png exists');
  assert(fs.existsSync('src/app/icon.png'), 'src/app/icon.png exists for Next.js App Router favicon');
  assert(fs.existsSync('src/app/apple-icon.png'), 'src/app/apple-icon.png exists for Apple touch icon');
  assert(fs.existsSync('src/components/brand/wsnexa-logo.tsx'), 'WSNexaLogo component exists');

  console.log('\n============================================================');
  console.log('Results: All QA-1, QA-2, QA-3, and Branding Invariants PASS!');
  console.log('============================================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
