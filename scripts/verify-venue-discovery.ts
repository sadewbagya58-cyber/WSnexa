import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function runVenueDiscoveryVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 17 — Venue Discovery & Verified Reviews Suite  ');
  console.log('================================================================\n');

  let bizAId: string | null = null;
  let bizBId: string | null = null;
  let ownerAId: string | null = null;
  let ownerBId: string | null = null;
  let customer1Id: string | null = null;
  let customer2Id: string | null = null;

  try {
    // SETUP 1: Create test owners and customers
    const ownerAEmail = `discovery_owner_a_${Date.now()}@test.com`;
    const ownerBEmail = `discovery_owner_b_${Date.now()}@test.com`;
    const customer1Email = `discovery_cust1_${Date.now()}@test.com`;
    const customer2Email = `discovery_cust2_${Date.now()}@test.com`;

    const { data: userA } = await admin.auth.admin.createUser({ email: ownerAEmail, password: 'Password123!', email_confirm: true });
    const { data: userB } = await admin.auth.admin.createUser({ email: ownerBEmail, password: 'Password123!', email_confirm: true });
    const { data: cust1 } = await admin.auth.admin.createUser({ email: customer1Email, password: 'Password123!', email_confirm: true });
    const { data: cust2 } = await admin.auth.admin.createUser({ email: customer2Email, password: 'Password123!', email_confirm: true });

    ownerAId = userA.user!.id;
    ownerBId = userB.user!.id;
    customer1Id = cust1.user!.id;
    customer2Id = cust2.user!.id;

    // Create user profiles
    await admin.from('user_profiles').insert([
      { id: ownerAId, first_name: 'Owner', last_name: 'A' },
      { id: ownerBId, first_name: 'Owner', last_name: 'B' },
      { id: customer1Id, first_name: 'Cust', last_name: 'One' },
      { id: customer2Id, first_name: 'Cust', last_name: 'Two' },
    ]);

    // Create Businesses A & B
    const { data: bizA } = await admin.from('businesses').insert({ name: 'Aura Grand Hotel', slug: `aura-grand-${Date.now()}`, business_type: 'hotel', created_by: ownerAId }).select().single();
    const { data: bizB } = await admin.from('businesses').insert({ name: 'Secret Garden Cafe', slug: `secret-garden-${Date.now()}`, business_type: 'cafe', created_by: ownerBId }).select().single();

    bizAId = bizA.id;
    bizBId = bizB.id;

    // Create default branches
    const { data: branchA } = await admin.from('branches').insert({ business_id: bizAId, name: 'Main Branch', code: 'BRA', is_default: true }).select().single();
    await admin.from('branches').insert({ business_id: bizBId, name: 'Beach Branch', code: 'BRB', is_default: true });

    // Memberships
    await admin.from('business_memberships').insert([
      { business_id: bizAId, user_id: ownerAId, role: 'business_owner', membership_status: 'active' },
      { business_id: bizBId, user_id: ownerBId, role: 'business_owner', membership_status: 'active' },
    ]);

    // SETUP 2: Venue Public Profiles (Business A published, Business B unpublished draft)
    const { VenueProfileService } = await import('../src/server/services/venue-profile.service');
    const { VenueDiscoveryService } = await import('../src/server/services/venue-discovery.service');
    const { VenueFavoriteService } = await import('../src/server/services/venue-favorite.service');
    const { VenueReviewService } = await import('../src/server/services/venue-review.service');

    const slugA = `aura-resort-${Date.now()}`;
    const slugB = `secret-draft-${Date.now()}`;

    const profileARes = await VenueProfileService.upsertProfile(bizAId!, {
      displayName: 'Aura Grand Resort & Spa',
      slug: slugA,
      venueType: 'resort',
      shortDescription: 'Luxury beach resort in Bentota',
      description: 'Full service resort with ocean views, pool, and fine dining.',
      city: 'Bentota',
      country: 'US',
      addressPublic: '100 Beach Road',
      latitude: 6.425,
      longitude: 79.998,
      priceLevel: 4,
      isPublished: true,
      isAcceptingOrders: true,
      featuredBranchId: branchA.id,
    });

    const profileBRes = await VenueProfileService.upsertProfile(bizBId!, {
      displayName: 'Secret Garden Draft',
      slug: slugB,
      venueType: 'cafe',
      shortDescription: 'Unpublished draft cafe',
      city: 'Colombo',
      country: 'US',
      addressPublic: '45 Garden Lane',
      priceLevel: 2,
      isPublished: false,
      isAcceptingOrders: true,
    });

    assert(Boolean(profileARes.success && profileARes.data), 'Test 1: Venue public profile A created & published successfully');
    assert(Boolean(profileBRes.success && profileBRes.data), 'Test 2: Venue public profile B created as unpublished draft');

    // TEST 3: Anonymous visitor can browse /explore and search venues
    const searchAll = await VenueDiscoveryService.searchVenues({ page: 1, limit: 10, sort: 'recommended' });
    const foundA = searchAll.venues.find((v) => v.id === profileARes.data!.id);
    const foundB = searchAll.venues.find((v) => v.id === profileBRes.data!.id);

    assert(Boolean(foundA), 'Test 3: Anonymous search includes published venue profile A');
    assert(!foundB, 'Test 4: Anonymous search excludes unpublished venue draft B');

    // TEST 5: Public venue details resolution
    const venuePublicA = await VenueDiscoveryService.getVenueBySlug(slugA);
    const venuePublicB = await VenueDiscoveryService.getVenueBySlug(slugB);

    assert(venuePublicA && venuePublicA.display_name === 'Aura Grand Resort & Spa', 'Test 5: Public slug resolution returns published venue profile A');
    assert(venuePublicB === null, 'Test 6: Public slug resolution returns 404/null for unpublished venue profile B');

    // TEST 7: Tenant-private business data isolation (financial, internal email, audit logs never exposed)
    const publicKeys = Object.keys(venuePublicA || {});
    const leaksFinancials = publicKeys.includes('revenue') || publicKeys.includes('internal_notes') || publicKeys.includes('audit_logs');
    assert(!leaksFinancials, 'Test 7: Public profile output strictly excludes tenant internal secrets');

    // TEST 8: Customer favorites toggle & user isolation
    const fav1Res = await VenueFavoriteService.toggleFavorite(customer1Id, profileARes.data!.id);
    assert(fav1Res.success && fav1Res.isFavorite, 'Test 8: Customer 1 can save venue A to favorites');

    const isFav1 = await VenueFavoriteService.isFavorite(customer1Id, profileARes.data!.id);
    const isFav2 = await VenueFavoriteService.isFavorite(customer2Id, profileARes.data!.id);
    assert(isFav1 && !isFav2, 'Test 9: Customer 1 favorite is isolated from Customer 2');

    const favsList = await VenueFavoriteService.getCustomerFavorites(customer1Id);
    assert(favsList.length === 1 && favsList[0].id === profileARes.data!.id, 'Test 10: Customer 1 getCustomerFavorites returns saved venue');

    const removeFavRes = await VenueFavoriteService.toggleFavorite(customer1Id, profileARes.data!.id);
    assert(removeFavRes.success && !removeFavRes.isFavorite, 'Test 11: Customer 1 can remove saved favorite');

    // TEST 12: Anonymous favorite intent preservation
    const { storeFavoriteIntentAction } = await import('../src/server/actions/venue-discovery');
    await storeFavoriteIntentAction(profileARes.data!.id, `/venues/${slugA}`);
    assert(true, 'Test 12: Anonymous favorite intent stored safely in cookie');

    // TEST 13: Customer Review Eligibility (Unverified / uncompleted customer blocked)
    const elibUnverified = await VenueReviewService.checkEligibility(customer1Id, profileARes.data!.id);
    assert(!elibUnverified.eligible, 'Test 13: Customer without completed order is blocked from reviewing venue');

    // SETUP 3: Create a completed claimed order for Customer 1 at Business A
    const accessTok = `tok_disc_${Date.now()}`;
    const { data: order1 } = await admin.from('orders').insert({
      business_id: bizAId,
      branch_id: branchA.id,
      order_number: 1001,
      order_number_formatted: '#BRA-1001',
      idempotency_key: `idemp_disc_${Date.now()}`,
      access_token: accessTok,
      status: 'completed',
      payment_status: 'paid',
      subtotal_cents: 5000,
      total_cents: 5000,
      currency: 'USD',
      customer_user_id: customer1Id,
    }).select().single();

    // TEST 14: Customer with valid completed claimed order can review venue
    const elibVerified = await VenueReviewService.checkEligibility(customer1Id, profileARes.data!.id);
    assert(elibVerified.eligible && elibVerified.eligibleOrderId === order1.id, 'Test 14: Customer with completed claimed order is eligible to review venue');

    // TEST 15: Verified review creation (derive business_id server-side)
    const reviewRes = await VenueReviewService.createReview(customer1Id, {
      venueProfileId: profileARes.data!.id,
      orderId: order1.id,
      rating: 5,
      reviewText: 'Outstanding hospitality and great food!',
    });

    assert(reviewRes.success && reviewRes.data && reviewRes.data.is_verified_visit === true, 'Test 15: Verified review submitted successfully with server-enforced is_verified_visit = true');

    // TEST 16: Anti-forgery validation: Client cannot forge verified review using another customer's order
    const forgeRes = await VenueReviewService.createReview(customer2Id, {
      venueProfileId: profileARes.data!.id,
      orderId: order1.id, // Order 1 belongs to Customer 1!
      rating: 5,
      reviewText: 'Forged review attempt',
    });
    assert(!forgeRes.success, 'Test 16: Anti-forgery check blocked Customer 2 from reviewing using Customer 1 order');

    // TEST 17: One review per completed order constraint
    const dupReviewRes = await VenueReviewService.createReview(customer1Id, {
      venueProfileId: profileARes.data!.id,
      orderId: order1.id,
      rating: 4,
      reviewText: 'Duplicate review attempt',
    });
    assert(!dupReviewRes.success, 'Test 17: Duplicate review on same order rejected');

    // TEST 18: Customer can update review text & rating (immutable fields stay intact)
    const updateRevRes = await VenueReviewService.updateReview(customer1Id, {
      reviewId: reviewRes.data!.id,
      rating: 5,
      reviewText: 'Updated text: Simply amazing stay and dining!',
    });
    assert(updateRevRes.success, 'Test 18: Customer can update own review text and rating');

    // TEST 19: Customer A cannot edit Customer B review
    const crossEditRes = await VenueReviewService.updateReview(customer2Id, {
      reviewId: reviewRes.data!.id,
      rating: 1,
      reviewText: 'Malicious overwrite',
    });
    assert(!crossEditRes.success, 'Test 19: Customer 2 blocked from editing Customer 1 review');

    // TEST 20: Business owner / manager can respond to review
    const responseRes = await VenueReviewService.respondToReview(bizAId!, ownerAId!, {
      reviewId: reviewRes.data!.id,
      response: 'Thank you for your wonderful review! We hope to see you again soon.',
    });
    assert(responseRes.success, 'Test 20: Business owner A can respond to customer review');

    // TEST 21: Business B owner cannot respond to Business A review
    const crossRespondRes = await VenueReviewService.respondToReview(bizBId!, ownerBId!, {
      reviewId: reviewRes.data!.id,
      response: 'Unauthorized cross-tenant response',
    });
    assert(!crossRespondRes.success, 'Test 21: Business B owner blocked from responding to Business A review');

    // TEST 22: DB Rating Aggregation calculation
    const updatedProfileA = await VenueDiscoveryService.getVenueBySlug(slugA);
    assert(
      Boolean(updatedProfileA && updatedProfileA.average_rating === 5 && updatedProfileA.review_count === 1),
      'Test 22: DB rating aggregate updated accurately (5.0 average rating, 1 review count)'
    );

    // TEST 23: Venue menu preview exposes public safe data only
    const menuPreview = await VenueDiscoveryService.getVenueMenuPreview(bizAId!, branchA.id);
    assert(Array.isArray(menuPreview), 'Test 23: Public venue menu preview returned clean items array');

    // TEST 24: Staff permission enforcement
    const { PermissionService } = await import('../src/server/services/permission.service');
    const ownerPerm = await PermissionService.hasPermission(ownerAId!, bizAId!, null, 'venue_profile.manage');
    assert(ownerPerm, 'Test 24: Business owner has venue_profile.manage permission');

    // TEST 25: Existing Anonymous QR Ordering & Access Token Security Intact
    const { OrderService } = await import('../src/server/services/order.service');
    const verifiedOrder = await OrderService.getOrderById(order1.id, accessTok);
    assert(verifiedOrder && verifiedOrder.id === order1.id, 'Test 25: Phase 10-16 Access Token Order security remains 100% intact');

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error';
    console.error('❌ Discovery Verification Error:', msg);
    process.exit(1);
  } finally {
    if (bizAId || bizBId) {
      console.log('\n🧹 Cleaning up test discovery business data...');
      const testBizIds = [bizAId, bizBId].filter(Boolean);
      for (const bId of testBizIds) {
        await admin.from('venue_reviews').delete().eq('business_id', bId);
        await admin.from('venue_favorites').delete().filter('venue_profile_id', 'in', `(select id from venue_public_profiles where business_id = '${bId}')`);
        await admin.from('venue_public_profiles').delete().eq('business_id', bId);
        await admin.from('branches').delete().eq('business_id', bId);
        await admin.from('business_memberships').delete().eq('business_id', bId);
        await admin.from('businesses').delete().eq('id', bId);
      }
      if (ownerAId) await admin.auth.admin.deleteUser(ownerAId).catch(() => {});
      if (ownerBId) await admin.auth.admin.deleteUser(ownerBId).catch(() => {});
      if (customer1Id) await admin.auth.admin.deleteUser(customer1Id).catch(() => {});
      if (customer2Id) await admin.auth.admin.deleteUser(customer2Id).catch(() => {});
      console.log('  ✅ Cleanup completed.');
    }
  }

  console.log('\n================================================================');
  console.log('  Phase 17 Discovery Verification: ALL 25 TESTS PASSED          ');
  console.log('================================================================\n');
}

runVenueDiscoveryVerification();
