import * as path from 'path';
import * as fs from 'fs';

// Bypass server-only guard
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
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

const PASS = '✓ PASS:';
const FAIL = '❌ FAIL:';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS} ${testName}`);
  } else {
    failedTests++;
    console.error(`  ${FAIL} ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runSuperAdminVerification() {
  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { SuperAdminService } = await import('../src/server/services/super-admin.service');
  const { VenueDiscoveryService } = await import('../src/server/services/venue-discovery.service');

  console.log('\n======================================================');
  console.log('  WSNEXA SUPER ADMIN SYSTEM & PLATFORM CONTROL AUDIT');
  console.log('======================================================\n');

  const admin = createAdminClient();

  // ---------------------------------------------------------
  // TEST SUITE 1: SUPER ADMIN AUTHORITY & TARGET ACCOUNT
  // ---------------------------------------------------------
  console.log('--- 1. Super Admin Authority & Configured Account ---');

  // Verify at least 1 Super Admin profile exists
  const { data: superAdmins, error: adminErr } = await admin
    .from('user_profiles')
    .select('id, first_name, last_name, is_super_admin')
    .eq('is_super_admin', true);

  assert(!adminErr, 'Query user_profiles with is_super_admin = true succeeds', adminErr?.message);
  assert(
    Boolean(superAdmins && superAdmins.length >= 1),
    `Super Admin profiles exist in the system (Found: ${superAdmins?.length || 0})`
  );

  // Paginate auth.users to find configured admin user
  let allAuthUsers: Array<{ id: string; email?: string }> = [];
  let page = 1;
  while (true) {
    const { data: pageData } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (!pageData?.users || pageData.users.length === 0) break;
    allAuthUsers = allAuthUsers.concat(pageData.users);
    if (pageData.users.length < 100) break;
    page++;
  }

  const targetUser = allAuthUsers.find((u) => u.email?.toLowerCase() === 'sadewbagya58@gmail.com');
  assert(Boolean(targetUser), 'Configured Super Admin user (sadewbagya58@gmail.com) found in auth.users');

  let testAdminUserId = targetUser?.id;
  if (targetUser) {
    const { data: targetProfile } = await admin
      .from('user_profiles')
      .select('id, is_super_admin')
      .eq('id', targetUser.id)
      .single();

    assert(
      targetProfile?.is_super_admin === true,
      'sadewbagya58@gmail.com has user_profiles.is_super_admin === true'
    );
  } else if (superAdmins && superAdmins[0]) {
    testAdminUserId = superAdmins[0].id;
  }

  // ---------------------------------------------------------
  // TEST SUITE 2: PUBLICATION GATE ENFORCEMENT
  // ---------------------------------------------------------
  console.log('\n--- 2. Publication Gate Enforcement ---');

  const testBusinessName = `Audit Gate Business ${Date.now()}`;
  const { data: testBiz, error: bizErr } = await admin
    .from('businesses')
    .insert({
      name: testBusinessName,
      slug: `audit-gate-biz-${Date.now()}`,
      business_type: 'restaurant',
      country_code: 'LK',
      default_currency: 'LKR',
      status: 'active',
      created_by: testAdminUserId,
    })
    .select()
    .single();

  assert(!bizErr && Boolean(testBiz), 'Created temporary test business for audit', bizErr?.message);

  if (testBiz && testAdminUserId) {
    const testSlug = `audit-gate-venue-${Date.now()}`;

    // A. Venue with missing coordinates (latitude = null)
    const { data: incompleteVenue, error: incErr } = await admin
      .from('venue_public_profiles')
      .insert({
        business_id: testBiz.id,
        display_name: 'Incomplete Coords Audit Venue',
        slug: testSlug,
        venue_type: 'restaurant',
        city: 'Colombo',
        country: 'LK',
        address_public: '100 Main St',
        latitude: null, // MISSING
        longitude: null, // MISSING
        is_published: false,
      })
      .select()
      .single();

    assert(!incErr && Boolean(incompleteVenue), 'Created draft venue with missing coordinates');

    if (incompleteVenue) {
      // Attempt publication via SuperAdminService.togglePublish
      const publishAttempt = await SuperAdminService.togglePublish(
        incompleteVenue.id,
        true,
        testAdminUserId
      );

      assert(
        publishAttempt.success === false,
        'Server-side gate blocks publication when coordinates are missing'
      );
      assert(
        publishAttempt.message.toLowerCase().includes('coordinates') ||
          publishAttempt.message.toLowerCase().includes('location') ||
          publishAttempt.message.toLowerCase().includes('address'),
        `Actionable error message returned: "${publishAttempt.message}"`
      );

      // B. Update venue with valid coordinates and try publishing again
      await admin
        .from('venue_public_profiles')
        .update({
          latitude: 6.9271,
          longitude: 79.8612,
        })
        .eq('id', incompleteVenue.id);

      const validPublishAttempt = await SuperAdminService.togglePublish(
        incompleteVenue.id,
        true,
        testAdminUserId
      );

      assert(
        validPublishAttempt.success === true,
        'Publication succeeds once valid coordinates and address are set'
      );

      // ---------------------------------------------------------
      // TEST SUITE 3: VENUE SUSPENSION & DISCOVERY ISOLATION
      // ---------------------------------------------------------
      console.log('\n--- 3. Venue Suspension & Discovery Isolation ---');

      // 1. Verify venue appears in discovery search before suspension
      const searchBefore = await VenueDiscoveryService.searchVenues({ query: 'Incomplete Coords Audit' });
      const foundBefore = searchBefore.venues.some((v) => v.id === incompleteVenue.id);
      assert(foundBefore, 'Live published venue appears in Discovery search');

      // 2. Suspend the venue
      const suspendRes = await SuperAdminService.suspendVenue(
        incompleteVenue.id,
        'Platform policy compliance suspension',
        testAdminUserId,
        'sadewbagya58@gmail.com'
      );
      assert(suspendRes.success === true, 'SuperAdminService.suspendVenue succeeds');

      // 3. Verify venue is now excluded from discovery search
      const searchAfter = await VenueDiscoveryService.searchVenues({ query: 'Incomplete Coords Audit' });
      const foundAfter = searchAfter.venues.some((v) => v.id === incompleteVenue.id);
      assert(!foundAfter, 'Suspended venue is immediately filtered out of Discovery search');

      // 4. Verify slug lookup for suspended venue returns null
      const slugLookup = await VenueDiscoveryService.getVenueBySlug(testSlug);
      assert(slugLookup === null, 'Suspended venue slug lookup returns null (hidden from customer portal)');

      // 5. Reactivate venue
      const reactivateRes = await SuperAdminService.reactivateVenue(
        incompleteVenue.id,
        testAdminUserId,
        'sadewbagya58@gmail.com'
      );
      assert(reactivateRes.success === true, 'SuperAdminService.reactivateVenue succeeds');

      // 6. Cleanup test venue
      await admin.from('venue_public_profiles').delete().eq('id', incompleteVenue.id);
    }

    // Cleanup test business
    await admin.from('businesses').delete().eq('id', testBiz.id);
  }

  // ---------------------------------------------------------
  // TEST SUITE 4: PILOT / DEMO PROVISIONING & DEFAULTS
  // ---------------------------------------------------------
  console.log('\n--- 4. Pilot / Demo Provisioning & Defaults ---');

  if (testAdminUserId) {
    const pilotInit = await SuperAdminService.initializePilotVenue(
      {
        businessName: `Pilot Audit Resort ${Date.now()}`,
        venueDisplayName: `Pilot Audit Resort ${Date.now()}`,
        venueType: 'resort',
        city: 'Galle',
        country: 'LK',
        latitude: 6.0535,
        longitude: 80.221,
        template: 'resort',
        isPublished: false, // Default safety check
      },
      testAdminUserId
    );

    assert(pilotInit.success === true, 'SuperAdminService.initializePilotVenue succeeds', pilotInit.message);

    if (pilotInit.businessId) {
      // Verify is_pilot_demo = true on business
      const { data: pilotBiz } = await admin
        .from('businesses')
        .select('id, is_pilot_demo, status')
        .eq('id', pilotInit.businessId)
        .single();

      assert(pilotBiz?.is_pilot_demo === true, 'Pilot business has is_pilot_demo = true');

      // Verify venue profile has is_published = false (default safety)
      const { data: pilotVenue } = await admin
        .from('venue_public_profiles')
        .select('id, is_published, slug')
        .eq('business_id', pilotInit.businessId)
        .single();

      assert(pilotVenue?.is_published === false, 'Pilot venue defaults to is_published = false');

      // Verify menu categories and items were populated
      const { data: categories } = await admin
        .from('menu_categories')
        .select('id')
        .eq('business_id', pilotInit.businessId);

      assert(Boolean(categories && categories.length >= 3), `Sample menu categories created (${categories?.length || 0})`);

      // Verify dining tables were created
      const { data: tables } = await admin
        .from('dining_tables')
        .select('id')
        .eq('business_id', pilotInit.businessId);

      assert(Boolean(tables && tables.length >= 3), `Pilot dining tables created (${tables?.length || 0})`);

      // Verify branch QR code generated
      const { data: qrCodes } = await admin
        .from('branch_qr_codes')
        .select('id, token_hash, is_active')
        .eq('business_id', pilotInit.businessId);

      assert(Boolean(qrCodes && qrCodes.length >= 1 && qrCodes[0].is_active), 'Branch QR code generated with active status');

      // Cleanup pilot records
      if (pilotVenue) await admin.from('venue_public_profiles').delete().eq('id', pilotVenue.id);
      await admin.from('branch_qr_codes').delete().eq('business_id', pilotInit.businessId);
      await admin.from('dining_tables').delete().eq('business_id', pilotInit.businessId);
      await admin.from('service_areas').delete().eq('business_id', pilotInit.businessId);
      await admin.from('menu_items').delete().eq('business_id', pilotInit.businessId);
      await admin.from('menu_categories').delete().eq('business_id', pilotInit.businessId);
      await admin.from('branches').delete().eq('business_id', pilotInit.businessId);
      await admin.from('businesses').delete().eq('id', pilotInit.businessId);
    }
  }

  // ---------------------------------------------------------
  // TEST SUITE 5: SUPER ADMIN GOVERNANCE & SAFETY PROTECTIONS
  // ---------------------------------------------------------
  console.log('\n--- 5. Super Admin Governance & Safety Protections ---');

  if (testAdminUserId) {
    // A. Self-revocation protection test
    const selfRevokeAttempt = await SuperAdminService.revokeSuperAdmin(
      testAdminUserId,
      testAdminUserId
    );

    assert(
      selfRevokeAttempt.success === false,
      'Governance protects against self-revocation lockout'
    );
    assert(
      selfRevokeAttempt.message.includes('cannot revoke your own'),
      `Safety error message returned: "${selfRevokeAttempt.message}"`
    );

    // B. Grant and Revoke on a temporary test user
    const dummyEmail = `test-admin-candidate-${Date.now()}@wsnexa.test`;
    const { data: dummyAuth } = await admin.auth.admin.createUser({
      email: dummyEmail,
      password: 'TemporaryPassword123!',
      email_confirm: true,
    });

    if (dummyAuth?.user) {
      await admin.from('user_profiles').insert({
        id: dummyAuth.user.id,
        first_name: 'Test',
        last_name: 'Candidate',
        is_super_admin: false,
      });

      // Grant Super Admin
      const grantRes = await SuperAdminService.grantSuperAdmin(
        dummyEmail,
        testAdminUserId
      );
      assert(grantRes.success === true, 'SuperAdminService.grantSuperAdmin succeeds for registered user');

      // Verify is_super_admin is true
      const { data: dummyProfile } = await admin
        .from('user_profiles')
        .select('is_super_admin')
        .eq('id', dummyAuth.user.id)
        .single();
      assert(dummyProfile?.is_super_admin === true, 'Candidate profile now has is_super_admin = true');

      // Revoke Super Admin
      const revokeRes = await SuperAdminService.revokeSuperAdmin(
        dummyAuth.user.id,
        testAdminUserId
      );
      assert(revokeRes.success === true, 'SuperAdminService.revokeSuperAdmin succeeds');

      // Cleanup dummy user
      await admin.from('user_profiles').delete().eq('id', dummyAuth.user.id);
      await admin.auth.admin.deleteUser(dummyAuth.user.id);
    }
  }

  // ---------------------------------------------------------
  // TEST SUITE 6: AUDIT LOG INTEGRITY
  // ---------------------------------------------------------
  console.log('\n--- 6. Audit Log Integrity ---');

  const { logs, total } = await SuperAdminService.listAuditLogs({ limit: 10 });
  assert(total >= 1, `Audit logs recorded platform administrative events (Found: ${total})`);
  assert(
    logs.some((l) => l.action.startsWith('venue.') || l.action.startsWith('super_admin.') || l.action.startsWith('pilot.')),
    'Audit logs accurately capture platform actions (venue.*, super_admin.*, pilot.*)'
  );

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log('\n======================================================');
  console.log(`  AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests > 0) {
    console.error(`  ❌ ${failedTests} TESTS FAILED`);
  } else {
    console.log('  ✓ ALL SUPER ADMIN SECURITY & OPERATIONAL CONTRACTS PASSED');
  }
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuperAdminVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
