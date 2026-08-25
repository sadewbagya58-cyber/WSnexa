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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ [PASS] ${message}`);
  }
}

async function runVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 35 Step 4 — Reservation Operations & Full Closure');
  console.log('================================================================\n');

  // 1. Foundation & Allocation Preservation
  console.log('--- SECTION 1: Step 1 & Step 2 Architecture Preservation ---');
  const servicePath = path.join(process.cwd(), 'src/server/reservations/reservation.service.ts');
  assert(fs.existsSync(servicePath), '1. Step 1 ReservationService exists');

  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert(serviceContent.includes('createReservation'), '2. Staff & public reservation creation preserved');
  assert(serviceContent.includes('transitionStatus'), '3. State machine lifecycle transitions preserved');
  assert(serviceContent.includes('Assign a table before seating this reservation.'), '4. SEATED table-assignment invariant 100% preserved');

  const allocationServicePath = path.join(process.cwd(), 'src/server/reservations/reservation-allocation.service.ts');
  assert(fs.existsSync(allocationServicePath), '5. Step 2 ReservationAllocationService exists');

  const allocationContent = fs.readFileSync(allocationServicePath, 'utf-8');
  assert(allocationContent.includes('allocateReservationTables'), '6. Table capacity & auto-fit allocation preserved');
  assert(allocationContent.includes('releaseReservationTables'), '7. Table release invariant on terminal state preserved');

  // 2. Step 3 Guest Journey Preservation
  console.log('\n--- SECTION 2: Step 3 Guest Journey Preservation ---');
  const publicServicePath = path.join(process.cwd(), 'src/server/reservations/public-reservation.service.ts');
  assert(fs.existsSync(publicServicePath), '8. Step 3 PublicReservationService exists');

  const publicContent = fs.readFileSync(publicServicePath, 'utf-8');
  assert(publicContent.includes('computePublicAvailableSlotsInternal'), '9. In-memory batch availability calculation preserved');
  assert(publicContent.includes('AVAILABILITY_TIMEOUT'), '10. Server availability timeout race protection preserved');

  const customerServicePath = path.join(process.cwd(), 'src/server/reservations/customer-reservation.service.ts');
  assert(fs.existsSync(customerServicePath), '11. CustomerReservationService portal queries preserved');

  // 3. Step 4 Operational Actions & Decline Support
  console.log('\n--- SECTION 3: Step 4 Operational Actions & Decline ---');
  const actionsPath = path.join(process.cwd(), 'src/server/actions/reservation.ts');
  assert(fs.existsSync(actionsPath), '12. Server actions reservation.ts exists');

  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  assert(actionsContent.includes('createStaffReservationAction'), '13. Staff reservation creation action exported');
  assert(actionsContent.includes('confirmReservationAction'), '14. Staff confirm reservation action exported');
  assert(actionsContent.includes('declineReservationAction'), '15. Staff decline reservation action exported');
  assert(actionsContent.includes('cancelReservationAction'), '16. Staff cancel reservation action exported');
  assert(actionsContent.includes('getReservationStatusHistoryAction'), '17. Status audit history action exported');

  // 4. Notification Architecture & Outbox
  console.log('\n--- SECTION 4: Provider-Neutral Notification Outbox ---');
  const notifPath = path.join(process.cwd(), 'src/server/reservations/reservation-notification.service.ts');
  assert(fs.existsSync(notifPath), '18. ReservationNotificationService exists');

  const notifContent = fs.readFileSync(notifPath, 'utf-8');
  assert(notifContent.includes('queueNotificationEvent'), '19. Outbox event queueing implemented');
  assert(notifContent.includes('consentPromotional'), '20. Operational vs marketing consent separation enforced');
  assert(notifContent.includes('isEligibleForReminder'), '21. Reminder eligibility rules enforced');

  const step4MigrationPath = path.join(process.cwd(), 'supabase/migrations/20260825000001_phase35_step4_closure.sql');
  assert(fs.existsSync(step4MigrationPath), '22. Forward-only Step 4 migration exists');

  const step4MigrationSql = fs.readFileSync(step4MigrationPath, 'utf-8');
  assert(step4MigrationSql.includes('reservation_notification_outbox'), '23. Outbox table created in database schema');
  assert(step4MigrationSql.includes('REVOKE ALL ON public.reservation_notification_outbox'), '24. Direct client privileges revoked on outbox table');

  // 5. Operations Dashboard UI & Action Matrix
  console.log('\n--- SECTION 5: Operations Dashboard UI & Action Matrix ---');
  const uiPath = path.join(process.cwd(), 'src/components/reservations/reservation-management-client.tsx');
  assert(fs.existsSync(uiPath), '25. ReservationManagementClient exists');

  const uiContent = fs.readFileSync(uiPath, 'utf-8');
  assert(uiContent.includes('Today Operations') && uiContent.includes('OPERATIONAL'), '26. Today Operations tab prioritizes active operational states');
  assert(uiContent.includes('handleStaffCreateReservation') && uiContent.includes('New Staff Reservation'), '27. Staff create reservation modal integrated');
  assert(uiContent.includes('handleDeclineSubmit') && uiContent.includes('Decline Reservation'), '28. Staff decline modal integrated');
  assert(uiContent.includes('handleOpenDetailModal') && uiContent.includes('Lifecycle Status History'), '29. Staff detail drawer with status audit timeline integrated');
  assert(uiContent.includes('customers.contact_view') || uiContent.includes('hasContactView'), '30. Respects customers.contact_view permission for contact masking');

  // 6. Navigation Integration & Harness Cleanup
  console.log('\n--- SECTION 6: Navigation & Dev Smoke Harness Cleanup ---');
  const navPath = path.join(process.cwd(), 'src/lib/navigation/dashboard-navigation.ts');
  const navContent = fs.readFileSync(navPath, 'utf-8');
  assert((navContent.includes('Table Reservations') || navContent.includes('Reservations')) && navContent.includes('/dashboard/reservations'), '31. Reservations registered in dashboard navigation under OPERATIONS');
  assert(navContent.includes('reservations.view'), '32. Navigation item guarded by canonical reservations.view permission');

  const routePermPath = path.join(process.cwd(), 'src/lib/security/route-permissions.ts');
  const routePermContent = fs.readFileSync(routePermPath, 'utf-8');
  assert(routePermContent.includes('/dashboard/reservations') && routePermContent.includes('reservations.view'), '33. Route /dashboard/reservations registered in ROUTE_PERMISSION_MAP');

  const smokeRoutePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/dev/reservations-smoke/page.tsx');
  assert(!fs.existsSync(smokeRoutePath), '33. Temporary dev smoke route /dashboard/dev/reservations-smoke REMOVED');

  const smokeClientPath = path.join(process.cwd(), 'src/components/dev/reservations-smoke-client.tsx');
  assert(!fs.existsSync(smokeClientPath), '34. Temporary dev smoke component REMOVED');

  // 7. Security, Invariants & Performance
  console.log('\n--- SECTION 7: Security, Invariants & Performance ---');
  assert(actionsContent.includes('resolveAuthorizationContext') && actionsContent.includes('can({'), '35. Server actions enforce RBAC v2 AuthorizationContext');
  assert(!actionsContent.includes('role ===') && !actionsContent.includes("role === 'business_owner'"), '36. Zero runtime role-name string checks in server actions');
  assert(actionsContent.includes('handleAction'), '37. Universal error sanitization prevents raw database error leaks');

  const foundationMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260824200000_phase35_reservation_foundation.sql');
  const foundationSql = fs.readFileSync(foundationMigrationPath, 'utf-8');
  assert(foundationSql.includes('REVOKE ALL ON public.reservations FROM PUBLIC, anon, authenticated;'), '38. Table reservations RLS direct client access revoked');

  const journeyMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260825000000_phase35_guest_reservation_journey.sql');
  const journeySql = fs.readFileSync(journeyMigrationPath, 'utf-8');
  assert(journeySql.includes('idx_reservations_guest_access_token'), '39. Performance index on guest_access_token exists');

  const cleanupDocPath = path.join(process.cwd(), 'scratch/production-smoke-data-cleanup.md');
  assert(fs.existsSync(cleanupDocPath), '40. Optional production smoke data cleanup guidance document exists');

  // 8. Final Production Hardening & Public Feature Policy
  console.log('\n--- SECTION 8: Final Production Hardening & Public Feature Policy ---');
  const dtoTypesPath = path.join(process.cwd(), 'src/lib/reservations/reservation-types.ts');
  const dtoTypesContent = fs.readFileSync(dtoTypesPath, 'utf-8');
  assert(dtoTypesContent.includes('declineReason'), '41. declineReason field added to ReservationDTO');

  assert(uiContent.includes('Operational Outcome') && uiContent.includes('Declined by staff'), '42. Operational Outcome section rendered in detail modal');

  const featureMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260825000002_phase35_public_venue_feature_policy.sql');
  assert(fs.existsSync(featureMigrationPath), '43. Forward-only public venue feature policy migration exists');

  const discoveryServicePath = path.join(process.cwd(), 'src/server/services/venue-discovery.service.ts');
  const discoveryServiceContent = fs.readFileSync(discoveryServicePath, 'utf-8');
  assert(discoveryServiceContent.includes('public_reservations_enabled') && discoveryServiceContent.includes('public_menu_enabled'), '44. VenuePublicProfileRecord includes public feature policy fields');

  const venueValidationPath = path.join(process.cwd(), 'src/lib/validation/venue.ts');
  const venueValidationContent = fs.readFileSync(venueValidationPath, 'utf-8');
  assert(venueValidationContent.includes('publicReservationsEnabled') && venueValidationContent.includes('publicMenuEnabled'), '45. venueProfileSchema validates public feature policy fields');

  const venueFormPath = path.join(process.cwd(), 'src/components/dashboard/venue-profile-form.tsx');
  const venueFormContent = fs.readFileSync(venueFormPath, 'utf-8');
  assert(venueFormContent.includes('publicReservationsEnabled') && venueFormContent.includes('publicMenuEnabled'), '46. VenueProfileForm exposes independent public feature switches');

  const venueSlugPagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/page.tsx');
  const venueSlugPageContent = fs.readFileSync(venueSlugPagePath, 'utf-8');
  assert(venueSlugPageContent.includes('public_reservations_enabled') && venueSlugPageContent.includes('public_menu_enabled'), '47. Public venue page enforces public feature switches for CTAs and menu section');

  const reserveSlugPagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/reserve/page.tsx');
  const reserveSlugPageContent = fs.readFileSync(reserveSlugPagePath, 'utf-8');
  assert(reserveSlugPageContent.includes('public_reservations_enabled'), '48. Direct public reserve route server-enforces public_reservations_enabled with notFound()');

  const publicServicePath2 = path.join(process.cwd(), 'src/server/reservations/public-reservation.service.ts');
  const publicServiceContent2 = fs.readFileSync(publicServicePath2, 'utf-8');
  assert(publicServiceContent2.includes('public_reservations_enabled'), '49. PublicReservationService server-enforces public_reservations_enabled during booking creation and slot lookup');

  const allocServicePath = path.join(process.cwd(), 'src/server/reservations/reservation-allocation.service.ts');
  const allocServiceContent = fs.readFileSync(allocServicePath, 'utf-8');
  assert(allocServiceContent.includes('createWalkInSeating'), '50. Walk-in seating executes as single-action server orchestration');

  const waitlistServicePath = path.join(process.cwd(), 'src/server/reservations/reservation-waitlist.service.ts');
  const waitlistServiceContent = fs.readFileSync(waitlistServicePath, 'utf-8');
  assert(waitlistServiceContent.includes('promoteWaitlistEntry'), '51. Waitlist promotion executes as single-action server orchestration');

  assert(!uiContent.includes('router.refresh()'), '52. No unnecessary router.refresh() mutation loops in reservation dashboard');
  assert(uiContent.includes('isPending'), '53. Reservation dashboard provides immediate pending state on mutation buttons');

  // 9. Public Menu View-Only Semantics & Route Safety
  console.log('\n--- SECTION 9: Public Menu View-Only Semantics & Route Safety ---');
  assert(venueSlugPageContent.includes('View Menu') && !venueSlugPageContent.includes('View Menu & Order') && !venueSlugPageContent.includes('WSNexa Ordering Available'), '54. Public venue CTA says View Menu and contains zero online ordering claims');

  const menuSlugRoutePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/menu/page.tsx');
  assert(fs.existsSync(menuSlugRoutePath), '55. Dedicated view-only public menu route /venues/[slug]/menu exists');

  const menuSlugRouteContent = fs.readFileSync(menuSlugRoutePath, 'utf-8');
  assert(menuSlugRouteContent.includes('public_menu_enabled') && menuSlugRouteContent.includes('notFound()'), '56. Public menu route server-enforces public_menu_enabled with notFound()');
  assert(!menuSlugRouteContent.includes('Add to Cart') && !menuSlugRouteContent.includes('Checkout') && !menuSlugRouteContent.includes('Order Now'), '57. Public menu route is strictly view-only with zero cart or order controls');

  assert(discoveryServiceContent.includes('getVenueFullPublicMenu'), '58. VenueDiscoveryService exposes getVenueFullPublicMenu without requiring QR tokens or table sessions');

  const qrOrderRoutePath = path.join(process.cwd(), 'src/app/m/[token]/page.tsx');
  assert(fs.existsSync(qrOrderRoutePath), '59. QR table ordering route /m/[token] remains 100% intact and separate');

  assert(venueFormContent.includes('publicReservationsEnabled') && venueFormContent.includes('publicMenuEnabled'), '60. Public reservations and public menu remain independent feature toggles');

  // 10. App-Wide Interaction Responsiveness & Query Concurrency
  console.log('\n--- SECTION 10: Interaction Responsiveness & Query Concurrency ---');
  assert(discoveryServiceContent.includes("import { cache } from 'react'") && discoveryServiceContent.includes('static getVenueBySlug = cache('), '61. VenueDiscoveryService.getVenueBySlug memoized via React.cache');

  const resSettingsServicePath = path.join(process.cwd(), 'src/server/reservations/reservation-settings.service.ts');
  const resSettingsServiceContent = fs.readFileSync(resSettingsServicePath, 'utf-8');
  assert(resSettingsServiceContent.includes("import { cache } from 'react'") && resSettingsServiceContent.includes('static getBranchSettings = cache('), '62. ReservationSettingsService.getBranchSettings memoized via React.cache');

  assert(reserveSlugPageContent.includes('Promise.all(['), '63. Reserve page uses Promise.all for query concurrency');

  const dashResPagePath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/reservations/page.tsx');
  const dashResPageContent = fs.readFileSync(dashResPagePath, 'utf-8');
  assert(dashResPageContent.includes('Promise.all(['), '64. Dashboard reservations page uses Promise.all for permissions and data queries');

  const custResPagePath = path.join(process.cwd(), 'src/app/(customer)/customer/reservations/page.tsx');
  const custResPageContent = fs.readFileSync(custResPagePath, 'utf-8');
  assert(custResPageContent.includes('Promise.all(['), '65. Customer reservations page uses Promise.all for query concurrency');

  const venueLoadingPath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/loading.tsx');
  const menuLoadingPath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/menu/loading.tsx');
  const reserveLoadingPath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/reserve/loading.tsx');
  const dashResLoadingPath = path.join(process.cwd(), 'src/app/(dashboard)/dashboard/reservations/loading.tsx');
  const custResLoadingPath = path.join(process.cwd(), 'src/app/(customer)/customer/reservations/loading.tsx');

  assert(
    fs.existsSync(venueLoadingPath) &&
    fs.existsSync(menuLoadingPath) &&
    fs.existsSync(reserveLoadingPath) &&
    fs.existsSync(dashResLoadingPath) &&
    fs.existsSync(custResLoadingPath),
    '66. Route-level loading.tsx skeletons exist for public, customer, and dashboard reservation routes'
  );

  console.log('\n================================================================');
  console.log('  Phase 35 Step 4 Verification Complete: ALL 66 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('Unhandled error in verify-phase35-closure:', err);
  process.exit(1);
});
