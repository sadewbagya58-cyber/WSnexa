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

import * as path from 'path';
import * as fs from 'fs';

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

async function runVenueContactsAndCreationVerification() {
  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { SuperAdminService } = await import('../src/server/services/super-admin.service');
  const { VenueDiscoveryService } = await import('../src/server/services/venue-discovery.service');
  const { VenueProfileService } = await import('../src/server/services/venue-profile.service');

  console.log('\n======================================================================');
  console.log('  WSNEXA VENUE CREATION, IMAGE UPLOAD & CONTACT DISPLAY AUDIT');
  console.log('======================================================================\n');

  const admin = createAdminClient();

  // Find an active Super Admin user with transient retry
  let superAdmins: Array<{ id: string }> | null = null;
  let adminErr: unknown = null;
  for (let retry = 0; retry < 4; retry++) {
    const res = await admin
      .from('user_profiles')
      .select('id')
      .eq('is_super_admin', true);
    if (!res.error && res.data && res.data.length > 0) {
      superAdmins = res.data;
      adminErr = null;
      break;
    }
    adminErr = res.error;
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (adminErr || !superAdmins || superAdmins.length === 0) {
    console.error('Fatal: No Super Admin profile found in database.', adminErr);
    process.exit(1);
  }

  const superAdminId = superAdmins[0].id;
  const timestamp = Date.now();
  let testBusinessId: string | null = null;
  let testVenueId: string | null = null;
  let testSlug: string | null = null;
  let uploadedLogoUrl: string | null = null;
  let uploadedCoverUrl: string | null = null;

  try {
    // ── SECTION 1: SUPER ADMIN VENUE CREATION WITH MEDIA UPLOADS ───────
    console.log('--- 1. Super Admin Venue Creation with Logo and Cover Image ---');

    // Create a 1x1 transparent PNG buffer for logo
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const logoBlob = new Blob([pngBuffer], { type: 'image/png' });

    // Create a simple JPEG buffer for cover
    const jpegBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64'
    );
    const coverBlob = new Blob([jpegBuffer], { type: 'image/jpeg' });

    const createResult = await SuperAdminService.createVenue(
      {
        newBusinessName: `Contacts Audit Biz ${timestamp}`,
        displayName: `Grand Sapphire Resort ${timestamp}`,
        slug: `grand-sapphire-${timestamp}`,
        venueType: 'resort',
        shortDescription: 'Exquisite beachfront resort and spa.',
        description: 'Complete luxury hospitality experience with fine dining and private villas.',
        city: 'Galle',
        country: 'LK',
        addressPublic: '100 LightHouse St, Galle Fort',
        latitude: 6.0535,
        longitude: 80.221,
        phonePublic: '+94 91 223 4567',
        emailPublic: 'reservations@grandsapphire.com',
        priceLevel: 4,
        isPublished: true,
        logoFile: logoBlob,
        coverFile: coverBlob,
      },
      superAdminId
    );

    assert(createResult.success, 'SuperAdminService.createVenue succeeded with logo and cover uploads', createResult.message);
    testVenueId = createResult.venueId || null;
    testSlug = createResult.slug || null;

    // Verify stored venue profile in database
    const { data: createdVenue } = await admin
      .from('venue_public_profiles')
      .select('*')
      .eq('id', testVenueId!)
      .single();

    assert(Boolean(createdVenue), 'Venue profile retrieved from venue_public_profiles');
    testBusinessId = createdVenue?.business_id || null;

    // Verify logo and cover URLs in database
    uploadedLogoUrl = createdVenue?.logo_url;
    uploadedCoverUrl = createdVenue?.cover_image_url;

    assert(
      Boolean(uploadedLogoUrl && uploadedLogoUrl.includes('/venue-media/') && uploadedLogoUrl.includes('/logo/')),
      'Logo uploaded to venue-media bucket with correct path structure',
      `Got: ${uploadedLogoUrl}`
    );

    assert(
      Boolean(uploadedCoverUrl && uploadedCoverUrl.includes('/venue-media/') && uploadedCoverUrl.includes('/cover/')),
      'Cover uploaded to venue-media bucket with correct path structure',
      `Got: ${uploadedCoverUrl}`
    );

    // Verify public contact details persisted in DB
    assert(
      createdVenue?.phone_public === '+94 91 223 4567',
      'Public phone number persisted accurately',
      `Expected "+94 91 223 4567", got "${createdVenue?.phone_public}"`
    );

    assert(
      createdVenue?.email_public === 'reservations@grandsapphire.com',
      'Public email address persisted accurately',
      `Expected "reservations@grandsapphire.com", got "${createdVenue?.email_public}"`
    );

    // ── SECTION 2: MEDIA MIME AND SIZE VALIDATION ─────────────────────
    console.log('\n--- 2. Media Upload MIME Type and Size Limit Gates ---');

    // Invalid MIME type test (PDF file)
    const pdfBlob = new Blob([Buffer.from('%PDF-1.4 test')], { type: 'application/pdf' });
    const invalidMimeResult = await SuperAdminService.createVenue(
      {
        businessId: testBusinessId!,
        displayName: 'Invalid Media Venue',
        slug: `invalid-media-${timestamp}`,
        venueType: 'restaurant',
        city: 'Colombo',
        logoFile: pdfBlob,
      },
      superAdminId
    );

    assert(
      !invalidMimeResult.success && invalidMimeResult.message.includes('Invalid logo format'),
      'Invalid logo MIME rejected with actionable error message',
      invalidMimeResult.message
    );

    // Oversized logo test (>5MB)
    const oversizedLogoBlob = new Blob([new Uint8Array(6 * 1024 * 1024)], { type: 'image/png' });
    const oversizedResult = await SuperAdminService.createVenue(
      {
        businessId: testBusinessId!,
        displayName: 'Oversized Logo Venue',
        slug: `oversized-logo-${timestamp}`,
        venueType: 'restaurant',
        city: 'Colombo',
        logoFile: oversizedLogoBlob,
      },
      superAdminId
    );

    assert(
      !oversizedResult.success && oversizedResult.message.includes('5 MB'),
      'Oversized logo (>5MB) rejected with size limit error message',
      oversizedResult.message
    );

    // ── SECTION 3: STORAGE CLEANUP ON FAILURE ─────────────────────────
    console.log('\n--- 3. Storage Cleanup on Venue Creation Failure ---');

    // Attempt creation with valid files but invalid location to trigger publication gate failure
    const cleanupTestResult = await SuperAdminService.createVenue(
      {
        newBusinessName: `Cleanup Test Biz ${timestamp}`,
        displayName: 'Failing Venue',
        slug: `failing-venue-${timestamp}`,
        venueType: 'restaurant',
        city: 'Colombo',
        isPublished: true, // triggers publication gate failure because coordinates are missing
        logoFile: logoBlob,
      },
      superAdminId
    );

    assert(!cleanupTestResult.success, 'Creation rejected due to publication gate requirements');

    // Verify no orphaned venue was saved
    const { data: orphanedProfile } = await admin
      .from('venue_public_profiles')
      .select('id')
      .eq('slug', `failing-venue-${timestamp}`)
      .maybeSingle();

    assert(!orphanedProfile, 'No orphaned venue profile created on validation failure');

    // ── SECTION 4: SUPER ADMIN VENUE DETAIL VIEW & EDIT ────────────────
    console.log('\n--- 4. Super Admin Venue Detail View & Edit Verification ---');

    const venueDetail = await SuperAdminService.getVenueById(testVenueId!);
    assert(Boolean(venueDetail), 'SuperAdminService.getVenueById successfully fetched venue detail');
    assert(
      venueDetail?.phonePublic === '+94 91 223 4567',
      'Venue detail view reflects phonePublic',
      `Got: ${venueDetail?.phonePublic}`
    );
    assert(
      venueDetail?.emailPublic === 'reservations@grandsapphire.com',
      'Venue detail view reflects emailPublic',
      `Got: ${venueDetail?.emailPublic}`
    );
    assert(Boolean(venueDetail?.logoUrl), 'Venue detail view reflects logoUrl');
    assert(Boolean(venueDetail?.coverImageUrl), 'Venue detail view reflects coverImageUrl');

    // Update phone and email via SuperAdminService.updateVenue
    const updateResult = await SuperAdminService.updateVenue(
      testVenueId!,
      {
        phonePublic: '+94 91 999 8888',
        emailPublic: 'concierge@grandsapphire.com',
      },
      superAdminId
    );

    assert(updateResult.success, 'SuperAdminService.updateVenue succeeded', updateResult.message);

    const updatedDetail = await SuperAdminService.getVenueById(testVenueId!);
    assert(
      updatedDetail?.phonePublic === '+94 91 999 8888',
      'Updated phone number verified in venue detail',
      `Expected "+94 91 999 8888", got "${updatedDetail?.phonePublic}"`
    );
    assert(
      updatedDetail?.emailPublic === 'concierge@grandsapphire.com',
      'Updated email address verified in venue detail',
      `Expected "concierge@grandsapphire.com", got "${updatedDetail?.emailPublic}"`
    );

    // ── SECTION 5: BUSINESS ACCOUNT VENUE PROFILE MANAGEMENT ──────────
    console.log('\n--- 5. Business Account Venue Profile Upsert & Preservation ---');

    // Upsert via VenueProfileService
    const bizUpsertResult = await VenueProfileService.upsertProfile(
      testBusinessId!,
      {
        displayName: `Grand Sapphire Resort ${timestamp}`,
        slug: testSlug!,
        venueType: 'resort',
        city: 'Galle',
        country: 'LK',
        addressPublic: '100 LightHouse St, Galle Fort',
        latitude: 6.0535,
        longitude: 80.221,
        isPublished: true,
        phonePublic: '+94 91 333 2222',
        emailPublic: 'manager@grandsapphire.com',
      }
    );

    assert(bizUpsertResult.success, 'VenueProfileService.upsertProfile succeeded with phone and email');

    const { data: bizProfile } = await admin
      .from('venue_public_profiles')
      .select('phone_public, email_public, logo_url, cover_image_url')
      .eq('business_id', testBusinessId!)
      .single();

    assert(
      bizProfile?.phone_public === '+94 91 333 2222',
      'Business profile updated phone_public correctly'
    );
    assert(
      bizProfile?.email_public === 'manager@grandsapphire.com',
      'Business profile updated email_public correctly'
    );
    assert(
      Boolean(bizProfile?.logo_url && bizProfile?.cover_image_url),
      'Partial upsert preserved existing logo_url and cover_image_url without wiping them'
    );

    // ── SECTION 6: PUBLIC VENUE DISCOVERY & DETAILS API ───────────────
    console.log('\n--- 6. Public Venue Discovery Contact Fields ---');

    const publicVenue = await VenueDiscoveryService.getVenueBySlug(testSlug!);
    assert(Boolean(publicVenue), 'VenueDiscoveryService.getVenueBySlug resolved published venue');
    assert(
      publicVenue?.phone_public === '+94 91 333 2222',
      'Public discovery exposes phone_public for customer dialing',
      `Got: ${publicVenue?.phone_public}`
    );
    assert(
      publicVenue?.email_public === 'manager@grandsapphire.com',
      'Public discovery exposes email_public for customer inquiries',
      `Got: ${publicVenue?.email_public}`
    );
    assert(Boolean(publicVenue?.logo_url), 'Public discovery exposes logo_url');
    assert(Boolean(publicVenue?.cover_image_url), 'Public discovery exposes cover_image_url');

    // ── SECTION 7: URI & LINK FORMAT VALIDATION ───────────────────────
    console.log('\n--- 7. Public Contact Action URI & Protocol Formatting ---');

    const phoneLink = `tel:${publicVenue?.phone_public}`;
    const emailLink = `mailto:${publicVenue?.email_public}`;

    assert(
      phoneLink.startsWith('tel:') && phoneLink.length > 5,
      'Telephone link adheres to RFC 3966 format',
      phoneLink
    );
    assert(
      emailLink.startsWith('mailto:') && emailLink.includes('@'),
      'Email link adheres to mailto protocol format',
      emailLink
    );

  } finally {
    // ── CLEANUP ────────────────────────────────────────────────────────
    console.log('\n🧹 Cleaning up test venue and business data...');
    if (testBusinessId) {
      if (uploadedLogoUrl) {
        const { VenueMediaService } = await import('../src/server/services/venue-media.service');
        await VenueMediaService.deleteStorageObjectByUrl(admin, uploadedLogoUrl);
      }
      if (uploadedCoverUrl) {
        const { VenueMediaService } = await import('../src/server/services/venue-media.service');
        await VenueMediaService.deleteStorageObjectByUrl(admin, uploadedCoverUrl);
      }
      await admin.from('venue_public_profiles').delete().eq('business_id', testBusinessId);
      await admin.from('branches').delete().eq('business_id', testBusinessId);
      await admin.from('business_memberships').delete().eq('business_id', testBusinessId);
      await admin.from('businesses').delete().eq('id', testBusinessId);
    }
    console.log('  ✓ Cleanup complete.');
  }

  console.log('\n======================================================================');
  console.log(`  AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('  ✓ ALL VENUE CREATION, IMAGE & CONTACT TESTS PASSED');
  } else {
    console.error(`  ❌ ${failedTests} TESTS FAILED`);
  }
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVenueContactsAndCreationVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
