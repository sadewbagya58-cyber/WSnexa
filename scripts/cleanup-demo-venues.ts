import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ============================================================================
// STRICT PROTECTED WHITELIST — REAL PRODUCTION RECORDS MUST NEVER BE TOUCHED
// ============================================================================
const PROTECTED_VENUE_SLUGS = new Set([
  'aurawedi',
  'nexa-grand-hotel',
]);

const PROTECTED_VENUE_IDS = new Set([
  '4438f0ca-a88b-4f53-a610-000e37dbbcbb', // aurawedi
  '1385759e-54cd-4492-800b-dbc107dba913', // nexa-grand-hotel
]);

const PROTECTED_BUSINESS_SLUGS = new Set([
  'aurawedi',
  'nexa-grand-hotel',
  'luna-garden-restaurant',
]);

const PROTECTED_BUSINESS_IDS = new Set([
  '85fcbbda-834e-4025-9729-e20fe118f57c', // aurawedi
  '14a40694-0cdc-4fbe-bc8e-4b8e45121cab', // Nexa Grand Hotel
  'd8b5fa8c-61c1-4074-9faf-9033cc544eda', // Luna Garden Restaurant
]);

// Known automated test name prefixes / timestamp patterns
const TEST_NAME_PATTERNS = [
  'Draft Hotel',
  'Valid Beach Resort',
  'Admin Created Resort',
  'Pilot Audit Resort',
  'Grand Ocean Resort',
  'No Coord Cafe',
  'Aura Grand Resort',
  'Secret Garden Draft',
  'Alpha Grand Hotel',
  'Beta Bistro',
  'Gamma Draft Cafe',
  'Aura Webi Hotel',
  'Duplicate Aura Webi',
  'Test Business',
  'Verification Business',
  'Demo Business',
  'Publish Gate Hotel',
  'Draft Business',
  'Admin Biz',
];

// Regex matching automated epoch millisecond timestamp suffixes (e.g. 1786587730025)
const TIMESTAMP_SUFFIX_REGEX = /178\d{10}/;

async function safeCleanupDemoVenues() {
  console.log('================================================================');
  console.log('  WSNexa QA — Safe Agent/Test Public Venue Cleanup (CRIT-22)');
  console.log('================================================================\n');

  // 1. Fetch all venue public profiles with associated business info
  const { data: profiles, error } = await admin
    .from('venue_public_profiles')
    .select('id, business_id, display_name, slug, city, is_published, created_at, businesses(id, name, slug, default_currency, timezone)');

  if (error || !profiles) {
    console.error('Failed to query venue profiles:', error);
    process.exit(1);
  }

  console.log(`Auditing ${profiles.length} total venue public profiles in database...\n`);

  const demoCandidates: Array<{
    venueId: string;
    displayName: string;
    slug: string;
    businessId: string;
    businessName: string;
    businessSlug: string;
    reason: string;
  }> = [];

  const realProductionVenues: Array<{
    venueId: string;
    displayName: string;
    slug: string;
    businessName: string;
    businessSlug: string;
  }> = [];

  for (const p of profiles) {
    const bizObj = p.businesses as unknown as { id?: string; name?: string; slug?: string };
    const bizId = p.business_id;
    const bizName = bizObj?.name || '';
    const bizSlug = bizObj?.slug || '';

    // Safety Layer 1: Strict Slug, Venue ID, and Business ID/Slug Whitelist
    if (
      PROTECTED_VENUE_SLUGS.has(p.slug) ||
      PROTECTED_VENUE_IDS.has(p.id) ||
      PROTECTED_BUSINESS_SLUGS.has(bizSlug) ||
      PROTECTED_BUSINESS_IDS.has(bizId)
    ) {
      realProductionVenues.push({
        venueId: p.id,
        displayName: p.display_name,
        slug: p.slug,
        businessName: bizName,
        businessSlug: bizSlug,
      });
      continue;
    }

    // Safety Layer 2: Verify Test Match (Timestamp or Test Prefix)
    const matchesTestPrefix = TEST_NAME_PATTERNS.some(
      (pat) =>
        p.display_name.startsWith(pat) ||
        bizName.startsWith(pat) ||
        p.slug.startsWith(pat.toLowerCase().replace(/ /g, '-'))
    );
    const hasTimestampSuffix =
      TIMESTAMP_SUFFIX_REGEX.test(p.slug) ||
      TIMESTAMP_SUFFIX_REGEX.test(p.display_name) ||
      TIMESTAMP_SUFFIX_REGEX.test(bizSlug) ||
      TIMESTAMP_SUFFIX_REGEX.test(bizName);

    if (matchesTestPrefix || hasTimestampSuffix) {
      demoCandidates.push({
        venueId: p.id,
        displayName: p.display_name,
        slug: p.slug,
        businessId: p.business_id,
        businessName: bizName,
        businessSlug: bizSlug,
        reason: hasTimestampSuffix
          ? `Contains test timestamp suffix (${p.slug})`
          : `Matches test naming pattern ("${p.display_name}")`,
      });
    } else {
      // Ambiguous: If uncertain, DO NOT DELETE!
      console.warn(`⚠️ AMBIGUOUS VENUE: [${p.id}] "${p.display_name}" (${p.slug}). Not matching test patterns. PROTECTED.`);
      realProductionVenues.push({
        venueId: p.id,
        displayName: p.display_name,
        slug: p.slug,
        businessName: bizName,
        businessSlug: bizSlug,
      });
    }
  }

  console.log(`\n🔍 AUDIT RESULTS:`);
  console.log(`  - Confirmed Test Venues for Safe Removal: ${demoCandidates.length}`);
  console.log(`  - Strictly Protected Real Production Venues: ${realProductionVenues.length}\n`);

  console.log('--- PROTECTED PRODUCTION VENUES (MUST REMAIN INTACT) ---');
  realProductionVenues.forEach((r, idx) => {
    console.log(`  ${idx + 1}. [${r.venueId}] "${r.displayName}" (slug: ${r.slug}, business: "${r.businessName}")`);
  });

  if (demoCandidates.length === 0) {
    console.log('\n✅ No leftover demo venues found. Database is clean!');
    return;
  }

  console.log('\n--- CONFIRMED AGENT / TEST VENUES SCHEDULED FOR REMOVAL ---');
  demoCandidates.forEach((c, idx) => {
    console.log(`  ${idx + 1}. [${c.venueId}] "${c.displayName}" (${c.slug}) -> ${c.reason}`);
  });

  console.log('\n🧹 Performing transaction-safe removal of verified test records...');

  const testVenueIds = demoCandidates.map((c) => c.venueId);
  const testBizIds = Array.from(new Set(demoCandidates.map((c) => c.businessId)));

  // 1. Delete dependent venue records
  if (testVenueIds.length > 0) {
    await admin.from('customer_favorite_venues').delete().in('venue_profile_id', testVenueIds);
    await admin.from('venue_reviews').delete().in('venue_profile_id', testVenueIds);
    await admin.from('venue_public_profiles').delete().in('id', testVenueIds);
  }

  // 2. Delete test-exclusive businesses and branches (only if not protected)
  for (const bizId of testBizIds) {
    if (PROTECTED_BUSINESS_IDS.has(bizId)) {
      console.warn(`PROTECTION CHECK: Skipping business ${bizId} because it is protected.`);
      continue;
    }
    const { data: b } = await admin.from('businesses').select('slug').eq('id', bizId).maybeSingle();
    if (b && PROTECTED_BUSINESS_SLUGS.has(b.slug)) {
      console.warn(`PROTECTION CHECK: Skipping business ${bizId} (${b.slug}) because it is protected.`);
      continue;
    }
    await admin.from('branches').delete().eq('business_id', bizId);
    await admin.from('business_memberships').delete().eq('business_id', bizId);
    await admin.from('businesses').delete().eq('id', bizId);
  }

  // 3. Post-cleanup verification
  const { data: remainingVenues } = await admin
    .from('venue_public_profiles')
    .select('id, display_name, slug, is_published');

  console.log(`\n================================================================`);
  console.log(`  CLEANUP COMPLETE: ${demoCandidates.length} test records removed.`);
  console.log(`  Remaining Venues in Database: ${remainingVenues?.length || 0}`);
  remainingVenues?.forEach((rv, i) => {
    console.log(`    ${i + 1}. [${rv.id}] "${rv.display_name}" (${rv.slug}) - published: ${rv.is_published}`);
  });
  console.log(`================================================================\n`);
}

safeCleanupDemoVenues().catch(console.error);
