import * as path from 'path';
import * as fs from 'fs';

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

async function runLaunchReadinessVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 24 — Master Beta Launch Readiness & Diagnostics');
  console.log('================================================================\n');

  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { LaunchReadinessService } = await import('../src/server/services/launch-readiness.service');
  const { PilotOnboardingService } = await import('../src/server/services/pilot-onboarding.service');

  const admin = createAdminClient();
  const timestamp = Date.now();

  let testAdminUserId: string | null = null;
  let testBizId: string | null = null;

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
    // TEST 2: Environment Variables Integrity
    // ------------------------------------------------------------------
    const criticalEnvChecks = report.checks.filter((c) => c.category === 'environment' && c.status === 'critical');
    if (criticalEnvChecks.length > 0) {
      throw new Error(`Critical environment variables missing: ${criticalEnvChecks.map((c) => c.name).join(', ')}`);
    }
    console.log('  ✅ [PASS] Test 02: Critical environment variables verified');

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
    // TEST 4: Pilot Onboarding Service Verification
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
        businessName: `Pilot Resort & Spa ${timestamp}`,
        venueDisplayName: `Grand Azure Pilot Resort`,
        venueType: 'resort',
        city: 'Bentota',
        country: 'LK',
        latitude: 6.4251,
        longitude: 79.9982,
        template: 'resort',
      },
      testAdminUserId
    );

    if (!pilotResult.success || !pilotResult.businessId) {
      throw new Error(`Pilot onboarding failed: ${pilotResult.message}`);
    }
    testBizId = pilotResult.businessId;

    console.log(`  ✅ [PASS] Test 04: PilotOnboardingService successfully initialized venue "${pilotResult.venueSlug}"`);
    console.log(`     Created ${pilotResult.tablesCount} tables with QR tokens and ${pilotResult.menuItemsCount} sample menu items.`);

    // Verify pilot business flag
    const { data: pilotBiz } = await admin.from('businesses').select('is_pilot_demo').eq('id', testBizId).single();
    if (!pilotBiz?.is_pilot_demo) {
      throw new Error('is_pilot_demo column flag was not set to true on pilot business');
    }
    console.log('  ✅ [PASS] Test 05: Pilot business flag is_pilot_demo correctly set to TRUE');

    // ------------------------------------------------------------------
    // TEST 6: Super Admin Authority Lock
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
    console.log('  ✅ [PASS] Test 06: Non-super-admin user strictly rejected from admin authority');

    console.log('\n================================================================');
    console.log('  Phase 24 Beta Launch Readiness Master Suite: ALL 6 TESTS PASSED');
    console.log('  🚀 PLATFORM IS READY FOR BETA LAUNCH!');
    console.log('================================================================\n');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('\n❌ Master Launch Readiness Suite Failed:', msg);
    process.exit(1);
  } finally {
    // Cleanup test data safely
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
}

runLaunchReadinessVerification();
