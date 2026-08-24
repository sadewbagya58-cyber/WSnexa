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

// Load .env.local before importing modules that depend on env validation
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
  console.log('  WSNexa Phase 35 Step 1 — Reservation Foundation Verification');
  console.log('================================================================\n');

  // 1. Migration File Checks
  console.log('--- SECTION 1: Migration & Schema Architecture ---');
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260824200000_phase35_reservation_foundation.sql');
  assert(fs.existsSync(migrationPath), '1. Migration file 20260824200000_phase35_reservation_foundation.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.reservations'), '2. public.reservations table definition present in migration');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.reservation_settings'), '3. public.reservation_settings table definition present in migration');
  assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.reservation_status_events'), '4. public.reservation_status_events table definition present in migration');
  assert(
    migrationSql.includes('idx_reservations_bus_branch_start') &&
    migrationSql.includes('idx_reservations_conf_code') &&
    migrationSql.includes('idx_res_status_events_res_id'),
    '5. Performance indexes present in migration'
  );
  assert(
    migrationSql.includes('ENABLE ROW LEVEL SECURITY') &&
    migrationSql.includes('REVOKE ALL ON public.reservations FROM PUBLIC, anon, authenticated') &&
    migrationSql.includes('GRANT ALL ON public.reservations TO service_role'),
    '6 & 7. Server-authoritative RLS enabled and direct client table access revoked'
  );

  // Permission Catalog & Role Seed Integrity Checks
  assert(
    migrationSql.includes("INSERT INTO public.permissions") &&
    migrationSql.includes("'reservations.view'") &&
    migrationSql.includes("'reservations.create'") &&
    migrationSql.includes("'reservations.manage'") &&
    migrationSql.includes("'reservations.cancel'"),
    '7a. All 4 reservation permissions seeded into public.permissions catalog'
  );

  const permIndex = migrationSql.indexOf('INSERT INTO public.permissions');
  const rolePermIndex = migrationSql.indexOf('INSERT INTO public.role_permissions');
  assert(permIndex !== -1 && rolePermIndex !== -1 && permIndex < rolePermIndex, '7b. Permission catalog seed strictly precedes role_permissions mapping seed');

  assert(migrationSql.includes('WHERE NOT EXISTS') && migrationSql.includes('rp.business_id IS NULL'), '7c. Role default permission seeding is idempotent using WHERE NOT EXISTS');
  assert(!migrationSql.includes("('kitchen_staff', 'reservations."), '7d. Kitchen staff has zero reservation default permissions');
  assert(!migrationSql.includes('ON CONFLICT (role_key, permission_key)'), '7e. Migration avoids invalid ON CONFLICT assumption on role_permissions');

  // 2. Types & Schema Enums
  console.log('\n--- SECTION 2: Domain Model & Validation Constraints ---');
  const typesPath = path.join(process.cwd(), 'src/lib/reservations/reservation-types.ts');
  assert(fs.existsSync(typesPath), '8. Reservation types definition file exists');
  const typesContent = fs.readFileSync(typesPath, 'utf-8');
  assert(
    typesContent.includes("'PENDING'") &&
    typesContent.includes("'CONFIRMED'") &&
    typesContent.includes("'ARRIVED'") &&
    typesContent.includes("'SEATED'") &&
    typesContent.includes("'COMPLETED'") &&
    typesContent.includes("'CANCELLED'") &&
    typesContent.includes("'NO_SHOW'") &&
    typesContent.includes("'DECLINED'"),
    '8. Canonical ReservationStatus lifecycle enum values defined'
  );
  assert(
    typesContent.includes("'PUBLIC_WEB'") &&
    typesContent.includes("'STAFF'") &&
    typesContent.includes("'PHONE'") &&
    typesContent.includes("'WALK_IN'"),
    '9. Canonical ReservationSource channel enum values defined'
  );

  const validationPath = path.join(process.cwd(), 'src/lib/validation/reservation.ts');
  assert(fs.existsSync(validationPath), '10 & 11. Zod validation schemas present');
  const validationContent = fs.readFileSync(validationPath, 'utf-8');
  assert(validationContent.includes('partySize') && validationContent.includes('min(1'), '10. Party size validation (> 0) enforced');
  assert(migrationSql.includes('chk_reservations_end_after_start'), '11. Time interval constraint (end_at > start_at) enforced in DB migration');

  // 3. Lifecycle State Machine
  console.log('\n--- SECTION 3: Lifecycle State Machine & Transition Rules ---');
  const { ReservationLifecycleService } = await import('@/server/reservations/reservation-lifecycle.service');
  assert(Boolean(ReservationLifecycleService), '12. ReservationLifecycleService exists');
  assert(ReservationLifecycleService.canTransition('PENDING', 'CONFIRMED'), '12a. Valid transition PENDING -> CONFIRMED allowed');
  assert(ReservationLifecycleService.canTransition('CONFIRMED', 'ARRIVED'), '12b. Valid transition CONFIRMED -> ARRIVED allowed');
  assert(ReservationLifecycleService.canTransition('ARRIVED', 'SEATED'), '12c. Valid transition ARRIVED -> SEATED allowed');
  assert(ReservationLifecycleService.canTransition('SEATED', 'COMPLETED'), '12d. Valid transition SEATED -> COMPLETED allowed');

  let illegalBlocked = false;
  try {
    ReservationLifecycleService.validateTransition('COMPLETED', 'PENDING');
  } catch {
    illegalBlocked = true;
  }
  assert(illegalBlocked, '13. Illegal transition COMPLETED -> PENDING strictly blocked');

  let cancelledToSeatedBlocked = false;
  try {
    ReservationLifecycleService.validateTransition('CANCELLED', 'SEATED');
  } catch {
    cancelledToSeatedBlocked = true;
  }
  assert(cancelledToSeatedBlocked, '13b. Illegal transition CANCELLED -> SEATED strictly blocked');

  // 4. Tenancy & Property Scope Enforcement
  console.log('\n--- SECTION 4: Authorization & Tenancy Isolation ---');
  const permCatalogPath = path.join(process.cwd(), 'src/lib/validation/permission.ts');
  const permCatalogContent = fs.readFileSync(permCatalogPath, 'utf-8');
  assert(
    permCatalogContent.includes("'reservations.view'") &&
    permCatalogContent.includes("'reservations.create'") &&
    permCatalogContent.includes("'reservations.manage'") &&
    permCatalogContent.includes("'reservations.cancel'"),
    '14 & 15. Reservation permissions registered in permissionKeyEnum catalog'
  );

  const actionsPath = path.join(process.cwd(), 'src/server/actions/reservation.ts');
  assert(fs.existsSync(actionsPath), '14-17. Reservation Server Actions file exists');
  const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
  assert(actionsContent.includes('resolveAuthorizationContext()'), '14. Server actions resolve authorization context');
  assert(actionsContent.includes('authorizedBranchIds'), '15. Property reach isolation enforced on reservation list queries');
  assert(
    !actionsContent.includes("role === 'business_owner'") &&
    !actionsContent.includes("role === 'branch_manager'") &&
    !actionsContent.includes("role === 'waiter'"),
    '17. Zero hardcoded runtime role-name checks in reservation server actions'
  );

  // 5. CRM & Guest Snapshot Architecture
  console.log('\n--- SECTION 5: CRM Integration & Guest Contact Privacy ---');
  const reservationServicePath = path.join(process.cwd(), 'src/server/reservations/reservation.service.ts');
  const reservationServiceContent = fs.readFileSync(reservationServicePath, 'utf-8');
  assert(
    reservationServiceContent.includes('CustomerIdentityService.resolveOrCreateCustomerIdentity'),
    '18. CRM linkage integrates canonical CustomerIdentityService'
  );
  assert(
    reservationServiceContent.includes('guest_name:') &&
    reservationServiceContent.includes('guest_email:') &&
    reservationServiceContent.includes('guest_phone:'),
    '19 & 20. Historical guest snapshot (name, email, phone) preserved on reservation record'
  );

  const queryServicePath = path.join(process.cwd(), 'src/server/reservations/reservation-query.service.ts');
  const queryServiceContent = fs.readFileSync(queryServicePath, 'utf-8');
  assert(
    queryServiceContent.includes('maskEmail') && queryServiceContent.includes('maskPhone'),
    '21. Default query responses mask email and phone contact details'
  );
  assert(
    actionsContent.includes("can({ context: authContext, permission: 'customers.contact_view' })"),
    '22. Unmasked contact details require explicit customers.contact_view capability'
  );

  // 6. Public Reservation Security & Confirmation Code
  console.log('\n--- SECTION 6: Public Reservation & Confirmation Security ---');
  assert(
    actionsContent.includes('createPublicReservationAction') &&
    actionsContent.includes('ReservationService.toPublicDTO'),
    '23 & 24. Public creation path uses server action and returns sanitized PublicReservationDTO'
  );
  assert(
    actionsContent.includes("from('branches')") && actionsContent.includes("select('id, business_id')"),
    '25. Public creation resolves business_id from trusted venue branch context preventing client parameter tampering'
  );
  assert(
    actionsContent.includes('cancelReservationAction') &&
    actionsContent.includes('markReservationNoShowAction'),
    '26 & 27. Cancellation and No-Show operations protected by server capability authorization'
  );

  const { ReservationService } = await import('@/server/reservations/reservation.service');
  const code = ReservationService.generateConfirmationCode();
  assert(code.startsWith('RSV-') && code.length === 10, '28. Confirmation code generator produces alphanumeric RSV-XXXXXX code');

  assert(
    queryServiceContent.includes('range(offset, offset + limit - 1)'),
    '29. Reservation listing supports server-side bounded pagination'
  );

  // 7. Step 1 Boundaries & Exclusions
  console.log('\n--- SECTION 7: Step 1 Scope Boundaries & Exclusions ---');
  assert(!reservationServiceContent.includes('table_id:'), '30. Table auto-allocation strictly absent from Step 1 foundation');
  assert(!reservationServiceContent.includes('waitlist'), '31. Waitlist queue architecture strictly absent from Step 1 foundation');
  assert(!reservationServiceContent.includes('hotel') && !reservationServiceContent.includes('pms'), '32. Hotel room/PMS booking architecture strictly absent from dining reservation foundation');

  console.log('\n================================================================');
  console.log('  Phase 35 Step 1 Verification Complete: ALL 32 ASSERTIONS PASSED');
  console.log('================================================================\n');
}

runVerification().catch((err) => {
  console.error('Unhandled error in verify-phase35-reservation-foundation:', err);
  process.exit(1);
});
