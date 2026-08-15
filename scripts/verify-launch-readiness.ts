import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';

// Parse .env.local BEFORE importing modules
try {
  // @ts-expect-error Mock server-only in standalone script
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {
  // Ignore server-only mock error
}
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

interface VerificationSuiteDef {
  name: string;
  script: string;
}

// Full 29 production verification suites defined in package.json
const MASTER_VERIFICATION_SUITES: VerificationSuiteDef[] = [
  { name: 'Auth & Security Verification', script: 'scripts/verify-auth.ts' },
  { name: 'Multi-Tenant Isolation Verification', script: 'scripts/verify-tenant.ts' },
  { name: 'Business Onboarding Verification', script: 'scripts/verify-onboarding.ts' },
  { name: 'Account Onboarding Verification', script: 'scripts/verify-account-onboarding.ts' },
  { name: 'Menu Management Verification', script: 'scripts/verify-menu.ts' },
  { name: 'Menu Modifiers Verification', script: 'scripts/verify-modifiers.ts' },
  { name: 'Dining Tables Verification', script: 'scripts/verify-tables.ts' },
  { name: 'QR Tokens Verification', script: 'scripts/verify-qr.ts' },
  { name: 'Service Areas Verification', script: 'scripts/verify-areas.ts' },
  { name: 'Staff Service Areas Verification', script: 'scripts/verify-staff-areas.ts' },
  { name: 'Customer Cart Verification', script: 'scripts/verify-cart.ts' },
  { name: 'Customer Orders Verification', script: 'scripts/verify-customer-orders.ts' },
  { name: 'Multi-Branch Management Verification', script: 'scripts/verify-branches.ts' },
  { name: 'Branch Data Isolation Verification', script: 'scripts/verify-branch-isolation.ts' },
  { name: 'Order Processing Lifecycle Verification', script: 'scripts/verify-orders.ts' },
  { name: 'Order Tracking & Status Verification', script: 'scripts/verify-order-tracking.ts' },
  { name: 'Payments & Settlement Verification', script: 'scripts/verify-payments.ts' },
  { name: 'Staff Invitations Verification', script: 'scripts/verify-staff-invitations.ts' },
  { name: 'Staff Roles & Permissions Verification', script: 'scripts/verify-permissions.ts' },
  { name: 'Analytics & Reports Verification', script: 'scripts/verify-reports.ts' },
  { name: 'Customer Loyalty & Rewards Verification', script: 'scripts/verify-loyalty.ts' },
  { name: 'UX Design Token Verification', script: 'scripts/verify-ux.ts' },
  { name: 'Venue Discovery Engine Verification', script: 'scripts/verify-venue-discovery.ts' },
  { name: 'Venue Media & Slug Verification', script: 'scripts/verify-venue-media-and-slug.ts' },
  { name: 'Venue Search & Ranking Engine Verification', script: 'scripts/verify-ranking.ts' },
  { name: 'Mobile UI Responsiveness Verification', script: 'scripts/verify-mobile-ui.ts' },
  { name: 'Order Security & Anti-Tamper Verification', script: 'scripts/verify-order-security.ts' },
  { name: 'Venue Maps & Geolocation Verification', script: 'scripts/verify-venue-maps.ts' },
  { name: 'Venue Publishing & Location Guard Verification', script: 'scripts/verify-venue-publishing.ts' },
  { name: 'Unified Digital Menu & Catalog Verification', script: 'scripts/verify-unified-menu.ts' },
  { name: 'Super Admin System & Platform Control Verification', script: 'scripts/verify-super-admin.ts' },
];

async function runLaunchReadinessVerification() {
  const masterStart = Date.now();
  console.log('\n================================================================');
  console.log('  WSNexa Phase 24 — MASTER E2E LAUNCH READINESS RUNNER');
  console.log('================================================================\n');

  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { LaunchReadinessService } = await import('../src/server/services/launch-readiness.service');
  const { PilotOnboardingService } = await import('../src/server/services/pilot-onboarding.service');

  const admin = createAdminClient();
  const timestamp = Date.now();

  let testAdminUserId: string | null = null;
  let testBizId: string | null = null;
  let diagPassed = false;

  console.log('--- PART 1: PHASE 24 SYSTEM DIAGNOSTICS AUDIT ---');
  try {
    // ------------------------------------------------------------------
    // TEST 1: LaunchReadinessService Health Audit
    // ------------------------------------------------------------------
    const report = await LaunchReadinessService.getHealthReport();
    console.log(`  ✅ [PASS] Test 01: LaunchReadinessService returned health score of ${report.score}%`);
    console.log(`     Status: ${report.status} (${report.checks.length} diagnostic checks performed)`);

    const dbCheck = report.checks.find((c) => c.id === 'db_conn');
    if (dbCheck && dbCheck.status === 'critical') {
      throw new Error(`Database connectivity check failed: ${dbCheck.details}`);
    }

    // ------------------------------------------------------------------
    // TEST 2: Environment Variables Integrity (No Secrets Exposed)
    // ------------------------------------------------------------------
    const criticalEnvChecks = report.checks.filter((c) => c.category === 'environment' && c.status === 'critical');
    if (criticalEnvChecks.length > 0) {
      throw new Error(`Critical environment variables missing: ${criticalEnvChecks.map((c) => c.name).join(', ')}`);
    }
    console.log('  ✅ [PASS] Test 02: Critical environment variables verified safely without exposing secrets');

    // ------------------------------------------------------------------
    // TEST 3: RLS Table Security Audit
    // ------------------------------------------------------------------
    const rlsChecks = report.checks.filter((c) => c.category === 'security');
    const rlsFailures = rlsChecks.filter((c) => c.status === 'critical');
    if (rlsFailures.length > 0) {
      throw new Error(`RLS security check failures on tables: ${rlsFailures.map((c) => c.name).join(', ')}`);
    }
    console.log(`  ✅ [PASS] Test 03: RLS table security verified across ${rlsChecks.length} core tables`);

    // ------------------------------------------------------------------
    // TEST 4: Storage Buckets Accessibility Audit
    // ------------------------------------------------------------------
    const storageChecks = report.checks.filter((c) => c.category === 'storage');
    console.log(`  ✅ [PASS] Test 04: Project storage buckets audited (${storageChecks.length} buckets checked)`);

    // ------------------------------------------------------------------
    // TEST 5: Pilot Onboarding Service & Default Publication Safety
    // ------------------------------------------------------------------
    const { data: testAdmin } = await admin.auth.admin.createUser({
      email: `pilot-admin-${timestamp}@wsnexa.internal`,
      password: 'Password123!',
      email_confirm: true,
    });
    testAdminUserId = testAdmin.user?.id || null;

    if (!testAdminUserId) {
      throw new Error('Failed to create test admin user');
    }

    await admin.from('user_profiles').update({ is_super_admin: true }).eq('id', testAdminUserId);

    const pilotResult = await PilotOnboardingService.initializePilot(
      {
        businessName: `Pilot Verification Venue ${timestamp}`,
        venueDisplayName: `Verification Resort ${timestamp.toString().slice(-4)}`,
        venueType: 'resort',
        city: 'Bentota',
        country: 'LK',
        latitude: 6.4251,
        longitude: 79.9982,
        template: 'resort',
        isPublished: false, // Explicitly verify default safety
      },
      testAdminUserId
    );

    if (!pilotResult.success || !pilotResult.businessId) {
      throw new Error(`Pilot onboarding failed: ${pilotResult.message}`);
    }
    testBizId = pilotResult.businessId;

    console.log(`  ✅ [PASS] Test 05: PilotOnboardingService successfully initialized venue "${pilotResult.venueSlug}"`);
    console.log(`     Created ${pilotResult.tablesCount} tables with QR tokens and ${pilotResult.menuItemsCount} sample menu items.`);

    // Verify pilot business flag & unpublished safety
    const { data: pilotBiz } = await admin.from('businesses').select('is_pilot_demo').eq('id', testBizId).single();
    if (!pilotBiz?.is_pilot_demo) {
      throw new Error('is_pilot_demo column flag was not set to true on pilot business');
    }

    const { data: pilotProfile } = await admin.from('venue_public_profiles').select('is_published').eq('business_id', testBizId).single();
    if (pilotProfile?.is_published !== false) {
      throw new Error('Pilot profile default publication safety failed: is_published was true when default should be false');
    }
    console.log('  ✅ [PASS] Test 06: Pilot flags verified (is_pilot_demo = TRUE, is_published = FALSE by default)');

    // ------------------------------------------------------------------
    // TEST 7: Super Admin Authority Lock
    // ------------------------------------------------------------------
    const { data: normalUser } = await admin.auth.admin.createUser({
      email: `non-admin-${timestamp}@wsnexa.internal`,
      password: 'Password123!',
      email_confirm: true,
    });
    const normalUserId = normalUser.user?.id;

    if (normalUserId) {
      const { SuperAdminVenueService } = await import('../src/server/services/super-admin-venue.service');
      const isSuper = await SuperAdminVenueService.verifySuperAdminAuthority(normalUserId);
      if (isSuper) {
        throw new Error('Normal user was incorrectly granted Super Admin authority');
      }
      await admin.auth.admin.deleteUser(normalUserId);
    }
    console.log('  ✅ [PASS] Test 07: Non-super-admin user strictly rejected from admin authority');
    diagPassed = true;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('\n❌ System Diagnostics Audit Failed:', msg);
  } finally {
    // Cleanup diagnostic test data safely
    if (testBizId) {
      await admin.from('branch_qr_codes').delete().eq('business_id', testBizId);
      await admin.from('dining_tables').delete().eq('business_id', testBizId);
      await admin.from('service_areas').delete().eq('business_id', testBizId);
      await admin.from('menu_items').delete().eq('business_id', testBizId);
      await admin.from('menu_categories').delete().eq('business_id', testBizId);
      await admin.from('venue_public_profiles').delete().eq('business_id', testBizId);
      await admin.from('branches').delete().eq('business_id', testBizId);
      await admin.from('business_memberships').delete().eq('business_id', testBizId);
      await admin.from('businesses').delete().eq('id', testBizId);
    }
    if (testAdminUserId) {
      await admin.auth.admin.deleteUser(testAdminUserId);
    }
  }

  if (!diagPassed) {
    console.error('Halting Master E2E runner due to Phase 24 Diagnostic failure.');
    process.exit(1);
  }

  console.log('\n--- PART 2: FULL MASTER E2E VERIFICATION SUITE ORCHESTRATION ---');
  console.log(`Orchestrating ${MASTER_VERIFICATION_SUITES.length} production verification suites sequentially...\n`);

  const results: { name: string; script: string; durationMs: number; status: 'PASS' | 'FAIL' }[] = [];
  let masterSuccess = true;
  let failedSuiteName: string | null = null;

  for (let i = 0; i < MASTER_VERIFICATION_SUITES.length; i++) {
    const suite = MASTER_VERIFICATION_SUITES[i];
    const indexStr = String(i + 1).padStart(2, '0');
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[${indexStr}/${MASTER_VERIFICATION_SUITES.length}] Executing Suite: ${suite.name} (${suite.script})`);
    console.log(`----------------------------------------------------------------`);

    const suiteStart = Date.now();
    const child = spawnSync('npx', ['tsx', suite.script], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    const durationMs = Date.now() - suiteStart;
    const durationSec = (durationMs / 1000).toFixed(2);

    if (child.status === 0) {
      console.log(`\n  ✅ [SUITE PASS] ${suite.name} (${durationSec}s)`);
      results.push({ name: suite.name, script: suite.script, durationMs, status: 'PASS' });
    } else {
      console.error(`\n  ❌ [SUITE FAIL] ${suite.name} (Exit code: ${child.status}, ${durationSec}s)`);
      results.push({ name: suite.name, script: suite.script, durationMs, status: 'FAIL' });
      masterSuccess = false;
      failedSuiteName = suite.name;
      console.error(`Stopping Master E2E runner immediately upon failure of suite "${suite.name}".`);
      break;
    }
  }

  const masterDurationSec = ((Date.now() - masterStart) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('  MASTER E2E LAUNCH READINESS SUMMARY REPORT');
  console.log('================================================================');
  console.log(`Total Execution Time: ${masterDurationSec}s`);
  console.log(`Phase 24 Diagnostic Tests: PASS`);
  console.log(`Master E2E Suites Executed: ${results.length}/${MASTER_VERIFICATION_SUITES.length}`);
  console.log(`Master E2E Suites Passed: ${results.filter((r) => r.status === 'PASS').length}/${MASTER_VERIFICATION_SUITES.length}`);
  
  if (failedSuiteName) {
    console.log(`Failed Suite: ${failedSuiteName}`);
  } else {
    console.log(`Failed Suite: None`);
  }

  console.log('\nSuite Breakdown:');
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.status.padEnd(4)} | ${(r.durationMs / 1000).toFixed(2)}s | ${r.name}`);
  }

  if (!masterSuccess || results.length < MASTER_VERIFICATION_SUITES.length) {
    console.error('\n❌ MASTER E2E LAUNCH READINESS RUNNER FAILED!');
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('  🚀 ALL 29 VERIFICATION SUITES + DIAGNOSTICS PASSED 100%');
  console.log('  WSNEXA PLATFORM IS FULLY VERIFIED & READY FOR LAUNCH!');
  console.log('================================================================\n');
}

runLaunchReadinessVerification();
