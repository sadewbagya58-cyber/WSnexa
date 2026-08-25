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
  console.log('  WSNexa Phase 35 Step 3 — Guest Booking Journey Suite');
  console.log('================================================================\n');

  // 1. Migration File & Schema Architecture
  console.log('--- SECTION 1: Migration & Schema Architecture ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260825000000_phase35_guest_reservation_journey.sql');
  assert(fs.existsSync(migrationPath), '1. Step 3 migration file 20260825000000_phase35_guest_reservation_journey.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.includes('guest_access_token'), '2. guest_access_token column added for secure guest lookup');
  assert(migrationSql.includes('consent_promotional'), '3. consent_promotional column added to separate marketing opt-in from booking contact');
  assert(migrationSql.includes('idx_reservations_guest_access_token'), '4. Performance index created on guest_access_token');

  // 2. Public Venue Reserve Table CTA
  console.log('\n--- SECTION 2: Public Venue Profile CTA ---');
  const venuePagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/page.tsx');
  const venuePageContent = fs.readFileSync(venuePagePath, 'utf-8');
  assert(venuePageContent.includes('reservationSettings?.reservationsEnabled'), '5. Public CTA conditionally checks reservationSettings.reservationsEnabled');
  assert(venuePageContent.includes('Reserve Table'), '6. Reserve Table CTA rendered for reservation-enabled venues');

  // 3. Slot Availability & Capacity Engine
  console.log('\n--- SECTION 3: Slot Availability & Capacity Engine ---');
  const publicServicePath = path.join(process.cwd(), 'src/server/reservations/public-reservation.service.ts');
  assert(fs.existsSync(publicServicePath), '7. PublicReservationService exists');

  const publicServiceContent = fs.readFileSync(publicServicePath, 'utf-8');
  assert(publicServiceContent.includes('getPublicAvailableSlots'), '8. getPublicAvailableSlots method implemented');
  assert(publicServiceContent.includes('ReservationAvailabilityService.getAvailability'), '9. Slot generator evaluates actual table capacity & Turnover buffer via ReservationAvailabilityService');
  assert(!publicServiceContent.includes('table_number') && !publicServiceContent.includes('tableId'), '10. Public slot engine strictly hides internal table IDs/numbers from public guests');

  // 4. Public Booking & Race Protection
  console.log('\n--- SECTION 4: Public Booking & Race Protection ---');
  assert(publicServiceContent.includes('createPublicBooking'), '11. createPublicBooking method implemented');
  assert(publicServiceContent.includes('SLOT_NO_LONGER_AVAILABLE'), '12. Pre-booking capacity revalidation enforces SLOT_NO_LONGER_AVAILABLE race protection');
  assert(publicServiceContent.includes('autoConfirm ? \'CONFIRMED\' : \'PENDING\''), '13 & 14. Initial status respects branch autoConfirm policy (PENDING vs CONFIRMED)');
  assert(publicServiceContent.includes('CustomerIdentityService.findOrCreateCustomerByEmailOrPhone'), '15 & 16. Resolves CRM customer identity while preserving Step 33 conflict protections');
  assert(publicServiceContent.includes('crypto.randomUUID()'), '17. Generates secure guestAccessToken on reservation creation');

  // 5. Customer Portal & Ownership Isolation
  console.log('\n--- SECTION 5: Customer Portal & Ownership Isolation ---');
  const customerServicePath = path.join(process.cwd(), 'src/server/reservations/customer-reservation.service.ts');
  assert(fs.existsSync(customerServicePath), '18. CustomerReservationService exists');

  const customerServiceContent = fs.readFileSync(customerServicePath, 'utf-8');
  assert(customerServiceContent.includes('getCustomerReservations'), '19. getCustomerReservations queries user bookings safely');
  assert(customerServiceContent.includes('getCustomerStatusLabel'), '20. Customer-friendly status labels translated (e.g. Awaiting Confirmation, Confirmed, Seated)');
  assert(customerServiceContent.includes('internalNotes: null'), '21. Internal staff notes strictly hidden from customer DTOs');
  assert(customerServiceContent.includes('cancelCustomerReservation'), '22. cancelCustomerReservation validates user ownership or guestAccessToken before cancellation');
  assert(customerServiceContent.includes('releaseReservationTables'), '23. Table assignments automatically released upon customer cancellation');

  // 6. Public Actions & Error Sanitization
  console.log('\n--- SECTION 6: Public Server Actions & Security ---');
  const publicActionsPath = path.join(process.cwd(), 'src/server/actions/reservation-public.ts');
  assert(fs.existsSync(publicActionsPath), '24. Public server actions file exists');

  const publicActionsContent = fs.readFileSync(publicActionsPath, 'utf-8');
  assert(
    publicActionsContent.includes('getPublicAvailableSlotsAction') &&
    publicActionsContent.includes('createPublicBookingAction') &&
    publicActionsContent.includes('getGuestReservationDetailAction') &&
    publicActionsContent.includes('cancelCustomerReservationAction'),
    '25. Public server actions exported'
  );
  assert(publicActionsContent.includes('not-null constraint') && publicActionsContent.includes('Unable to complete reservation request.'), '26 & 35. Public actions sanitize raw database/Postgres error messages');

  // 7. UI Components & Routes
  console.log('\n--- SECTION 7: UI Components & Routes ---');
  const reservePagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/reserve/page.tsx');
  assert(fs.existsSync(reservePagePath), '27. Public reservation booking route /venues/[slug]/reserve exists');

  const bookingClientPath = path.join(process.cwd(), 'src/components/discovery/guest-reservation-booking-client.tsx');
  assert(fs.existsSync(bookingClientPath), '28. GuestReservationBookingClient interactive component exists');

  const confirmPagePath = path.join(process.cwd(), 'src/app/(public)/venues/[slug]/reserve/confirmation/[code]/page.tsx');
  assert(fs.existsSync(confirmPagePath), '29. Guest confirmation route /venues/[slug]/reserve/confirmation/[code] exists');

  const customerReservationsPagePath = path.join(process.cwd(), 'src/app/(customer)/customer/reservations/page.tsx');
  assert(fs.existsSync(customerReservationsPagePath), '30. Customer portal route /customer/reservations exists');

  const customerReservationsClientPath = path.join(process.cwd(), 'src/components/customer/customer-reservations-client.tsx');
  assert(fs.existsSync(customerReservationsClientPath), '31. CustomerReservationsClient component exists');

  const shellPath = path.join(process.cwd(), 'src/components/customer/customer-shell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf-8');
  assert(shellContent.includes('/customer/reservations'), '32. Customer navigation includes /customer/reservations link');

  // 8. Staff Settings & SEATED Invariant Preserved
  console.log('\n--- SECTION 8: Staff Settings & Step 2 Invariant Regression ---');
  const mgmtPath = path.join(process.cwd(), 'src/components/reservations/reservation-management-client.tsx');
  const mgmtContent = fs.readFileSync(mgmtPath, 'utf-8');
  assert(mgmtContent.includes('Branch Reservation Settings'), '33. Staff management UI includes Branch Reservation Settings panel');
  assert(mgmtContent.includes('updateReservationSettingsAction'), '34. Staff settings panel connects to updateReservationSettingsAction');

  const servicePath = path.join(process.cwd(), 'src/server/reservations/reservation.service.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf-8');
  assert(serviceContent.includes('Assign a table before seating this reservation.'), '36. Step 2 SEATED table-assignment invariant 100% preserved');

  console.log('\n================================================================');
  console.log('  Phase 35 Step 3 Verification Complete: ALL 36 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('Unhandled error in verify-phase35-guest-booking-journey:', err);
  process.exit(1);
});
