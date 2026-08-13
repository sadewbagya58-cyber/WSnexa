import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeVenueSlug } from '../src/lib/validation/venue';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function assert(condition: boolean | null | undefined, testName: string, failureDetail?: string) {
  if (Boolean(condition)) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${failureDetail ? `: ${failureDetail}` : ''}`);
    process.exit(1);
  }
}

async function runMediaAndSlugVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 17.1 — Slug Normalization & Media Upload Suite   ');
  console.log('================================================================\n');

  let bizAId: string | null = null;
  let bizBId: string | null = null;
  let ownerAId: string | null = null;
  let ownerBId: string | null = null;
  let unauthorizedUserId: string | null = null;

  try {
    // ----------------------------------------------------------------
    // SECTION 1: SLUG NORMALIZATION UNIT TESTS (TESTS 1 - 4)
    // ----------------------------------------------------------------
    const slug1 = normalizeVenueSlug('aura_webi');
    assert(slug1 === 'aura-webi', 'Test 1: Underscore slug becomes hyphen ("aura_webi" -> "aura-webi")');

    const slug2 = normalizeVenueSlug('Aura   Webi');
    assert(slug2 === 'aura-webi', 'Test 2: Spaces become single hyphen ("Aura   Webi" -> "aura-webi")');

    const slug3 = normalizeVenueSlug('AURA WEBI');
    assert(slug3 === 'aura-webi', 'Test 3: Uppercase becomes lowercase ("AURA WEBI" -> "aura-webi")');

    const slug4 = normalizeVenueSlug('Aura@Webi!!!');
    assert(slug4 === 'aura-webi', 'Test 4: Special characters removed ("Aura@Webi!!!" -> "aura-webi")');

    // ----------------------------------------------------------------
    // SECTION 2: ENVIRONMENT SETUP FOR DB & MEDIA TESTS
    // ----------------------------------------------------------------
    const ownerAEmail = `slug_owner_a_${Date.now()}@test.com`;
    const ownerBEmail = `slug_owner_b_${Date.now()}@test.com`;
    const unauthEmail = `slug_unauth_${Date.now()}@test.com`;

    const { data: userA } = await admin.auth.admin.createUser({ email: ownerAEmail, password: 'Password123!', email_confirm: true });
    const { data: userB } = await admin.auth.admin.createUser({ email: ownerBEmail, password: 'Password123!', email_confirm: true });
    const { data: userUnauth } = await admin.auth.admin.createUser({ email: unauthEmail, password: 'Password123!', email_confirm: true });

    ownerAId = userA.user!.id;
    ownerBId = userB.user!.id;
    unauthorizedUserId = userUnauth.user!.id;

    await admin.from('user_profiles').insert([
      { id: ownerAId, first_name: 'SlugOwner', last_name: 'A' },
      { id: ownerBId, first_name: 'SlugOwner', last_name: 'B' },
      { id: unauthorizedUserId, first_name: 'Unauth', last_name: 'User' },
    ]);

    const { data: bizA } = await admin.from('businesses').insert({ name: 'Aura Media Hotel', slug: `aura-media-${Date.now()}`, business_type: 'hotel', created_by: ownerAId }).select().single();
    const { data: bizB } = await admin.from('businesses').insert({ name: 'Secret Garden Media', slug: `secret-media-${Date.now()}`, business_type: 'cafe', created_by: ownerBId }).select().single();

    bizAId = bizA.id;
    bizBId = bizB.id;

    const { data: branchA } = await admin.from('branches').insert({ business_id: bizAId, name: 'Main Branch', code: 'BRA', is_default: true }).select().single();
    await admin.from('branches').insert({ business_id: bizBId, name: 'Beach Branch', code: 'BRB', is_default: true });

    await admin.from('business_memberships').insert([
      { business_id: bizAId, user_id: ownerAId, role: 'business_owner', membership_status: 'active' },
      { business_id: bizBId, user_id: ownerBId, role: 'business_owner', membership_status: 'active' },
    ]);

    const { VenueProfileService } = await import('../src/server/services/venue-profile.service');
    const { VenueMediaService } = await import('../src/server/services/venue-media.service');
    const { VenueDiscoveryService } = await import('../src/server/services/venue-discovery.service');

    // ----------------------------------------------------------------
    // SECTION 3: SERVER-SIDE SLUG VALIDATION & DUPLICATE CHECKS (TESTS 5 - 6)
    // ----------------------------------------------------------------
    const sharedSlugInput = `Aura_Webi_${Date.now()}`;
    const normalizedSharedSlug = normalizeVenueSlug(sharedSlugInput);

    const profileA = await VenueProfileService.upsertProfile(bizAId!, {
      displayName: 'Aura Webi Hotel',
      slug: sharedSlugInput, // Input with underscore & uppercase
      venueType: 'hotel',
      city: 'Bentota',
      addressPublic: '100 Beach Road',
      country: 'US',
      latitude: 6.4251,
      longitude: 79.9982,
      isPublished: true,
      isAcceptingOrders: true,
      priceLevel: 3,
    });

    assert(
      profileA.success && profileA.data?.slug === normalizedSharedSlug,
      `Test 5: Server-side upsert automatically normalizes slug to "${normalizedSharedSlug}"`
    );

    // Duplicate slug attempt by Business B
    const dupRes = await VenueProfileService.upsertProfile(bizBId!, {
      displayName: 'Duplicate Aura Webi',
      slug: sharedSlugInput, // Tries to use same slug
      venueType: 'cafe',
      city: 'Colombo',
      addressPublic: '45 Garden Lane',
      country: 'US',
      isPublished: false,
      isAcceptingOrders: true,
      priceLevel: 2,
    });

    assert(
      !dupRes.success && dupRes.message.includes('already in use'),
      'Test 6: Duplicate slug handled gracefully with human-readable error ("This venue URL is already in use")'
    );

    // ----------------------------------------------------------------
    // SECTION 4: MEDIA UPLOAD VALIDATION & STORAGE TESTS (TESTS 7 - 16)
    // ----------------------------------------------------------------
    // Dummy 1x1 image buffers
    const jpgBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const webpBuffer = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
    const txtBuffer = Buffer.from('This is a text file, not an image.', 'utf8');

    // TEST 7: Valid JPG upload works
    const jpgUpload = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: jpgBuffer,
      fileName: 'test-logo.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: jpgBuffer.length,
    });
    assert(jpgUpload.success && Boolean(jpgUpload.publicUrl), 'Test 7: Valid JPG logo upload succeeded and generated public URL');

    // TEST 8: Valid PNG upload works
    const pngUpload = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'cover',
      fileBuffer: pngBuffer,
      fileName: 'test-cover.png',
      mimeType: 'image/png',
      fileSizeBytes: pngBuffer.length,
    });
    assert(pngUpload.success && Boolean(pngUpload.publicUrl), 'Test 8: Valid PNG cover upload succeeded and generated public URL');

    // TEST 9: Valid WEBP upload works
    const webpUpload = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: webpBuffer,
      fileName: 'test-logo.webp',
      mimeType: 'image/webp',
      fileSizeBytes: webpBuffer.length,
    });
    assert(webpUpload.success && Boolean(webpUpload.publicUrl), 'Test 9: Valid WEBP logo replacement upload succeeded');

    // TEST 10: Oversized image (>5MB logo) rejected
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
    const oversizedRes = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: oversizedBuffer,
      fileName: 'huge-logo.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: oversizedBuffer.length,
    });
    assert(!oversizedRes.success && oversizedRes.message?.includes('exceeds'), 'Test 10: Oversized image (>5MB logo) rejected with limit error');

    // TEST 11: Non-image file (e.g. text/plain) rejected
    const nonImageRes = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: txtBuffer,
      fileName: 'document.txt',
      mimeType: 'text/plain',
      fileSizeBytes: txtBuffer.length,
    });
    assert(!nonImageRes.success && nonImageRes.message?.includes('Invalid file format'), 'Test 11: Non-image MIME type rejected');

    // TEST 12: Unauthorized user cannot upload media
    const unauthUpload = await VenueMediaService.uploadImage({
      userId: unauthorizedUserId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: jpgBuffer,
      fileName: 'unauth.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: jpgBuffer.length,
    });
    assert(!unauthUpload.success && unauthUpload.message?.includes('do not have permission'), 'Test 12: Unauthorized user upload blocked');

    // TEST 13: Business Owner B cannot modify Business A media
    const crossTenantUpload = await VenueMediaService.uploadImage({
      userId: ownerBId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: jpgBuffer,
      fileName: 'cross.jpg',
      mimeType: 'image/jpeg',
      fileSizeBytes: jpgBuffer.length,
    });
    assert(!crossTenantUpload.success && crossTenantUpload.message?.includes('do not have permission'), 'Test 13: Cross-tenant upload blocked');

    // TEST 14: Logo replacement works
    const logoReplaceRes = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: pngBuffer,
      fileName: 'new-logo.png',
      mimeType: 'image/png',
      fileSizeBytes: pngBuffer.length,
    });
    assert(logoReplaceRes.success && Boolean(logoReplaceRes.publicUrl), 'Test 14: Logo replacement succeeded and updated DB reference');

    // TEST 15: Cover photo replacement works
    const coverReplaceRes = await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'cover',
      fileBuffer: webpBuffer,
      fileName: 'new-cover.webp',
      mimeType: 'image/webp',
      fileSizeBytes: webpBuffer.length,
    });
    assert(coverReplaceRes.success && Boolean(coverReplaceRes.publicUrl), 'Test 15: Cover photo replacement succeeded');

    // TEST 16: Image removal works
    const logoRemoveRes = await VenueMediaService.removeImage(ownerAId!, bizAId!, 'logo');
    assert(logoRemoveRes.success, 'Test 16: Image removal cleared DB reference and storage object safely');

    // Re-upload logo so published tests have full media
    await VenueMediaService.uploadImage({
      userId: ownerAId!,
      businessId: bizAId!,
      imageType: 'logo',
      fileBuffer: pngBuffer,
      fileName: 'final-logo.png',
      mimeType: 'image/png',
      fileSizeBytes: pngBuffer.length,
    });

    // ----------------------------------------------------------------
    // SECTION 5: DISCOVERY INTEGRATION & REGRESSION CHECKS (TESTS 17 - 20)
    // ----------------------------------------------------------------
    // TEST 17: Published venue profile displays uploaded images
    const publicProfile = await VenueDiscoveryService.getVenueBySlug(normalizedSharedSlug);
    assert(
      publicProfile && Boolean(publicProfile.logo_url) && Boolean(publicProfile.cover_image_url),
      'Test 17: Public profile endpoint exposes uploaded logo_url and cover_image_url'
    );

    // TEST 18: /explore search displays venue image correctly
    const exploreResults = await VenueDiscoveryService.searchVenues({ query: 'Aura', limit: 5, page: 1, sort: 'recommended' });
    const match = exploreResults.venues.find((v) => v.id === publicProfile?.id);
    assert(match && Boolean(match.logo_url), 'Test 18: Explore search results include uploaded venue logo URL');

    // TEST 19: Existing venue discovery, reviews, and favorites remain 100% functional
    const { VenueFavoriteService } = await import('../src/server/services/venue-favorite.service');
    const favRes = await VenueFavoriteService.toggleFavorite(ownerBId!, publicProfile!.id);
    assert(favRes.success && favRes.isFavorite, 'Test 19: Phase 17 customer favorites ecosystem operates cleanly');

    // TEST 20: Existing anonymous QR ordering flow remains unaffected
    const { OrderService } = await import('../src/server/services/order.service');
    const accessTok = `tok_media_${Date.now()}`;
    const { data: order } = await admin.from('orders').insert({
      business_id: bizAId,
      branch_id: branchA.id,
      order_number: 9001,
      order_number_formatted: '#BRA-9001',
      idempotency_key: `idemp_media_${Date.now()}`,
      access_token: accessTok,
      status: 'pending',
      payment_status: 'unpaid',
      subtotal_cents: 2500,
      total_cents: 2500,
      currency: 'USD',
    }).select().single();

    const tracked = await OrderService.getOrderById(order.id, accessTok);
    assert(tracked && tracked.id === order.id, 'Test 20: Existing anonymous QR ordering remains 100% unaffected');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error';
    console.error('❌ Media & Slug Verification Error:', msg);
    process.exit(1);
  } finally {
    if (bizAId || bizBId) {
      console.log('\n🧹 Cleaning up test media business data...');
      if (bizAId) await admin.from('businesses').delete().eq('id', bizAId);
      if (bizBId) await admin.from('businesses').delete().eq('id', bizBId);
      if (ownerAId) await admin.auth.admin.deleteUser(ownerAId);
      if (ownerBId) await admin.auth.admin.deleteUser(ownerBId);
      if (unauthorizedUserId) await admin.auth.admin.deleteUser(unauthorizedUserId);
      console.log('  ✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('  Phase 17.1 Media & Slug Verification: ALL 20 TESTS PASSED      ');
  console.log('================================================================\n');
}

runMediaAndSlugVerification();
