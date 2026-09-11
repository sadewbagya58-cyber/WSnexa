import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { resolveAnalyticsDateRange, DEFAULT_BRANCH_TIMEZONE } from '../src/lib/analytics/time-range';
import { formatBusinessTime, formatBusinessDateTime, formatBusinessDate } from '../src/lib/utils/date';

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

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    process.exitCode = 1;
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('  WSNexa QA Verification Suite: CRIT-20, CRIT-21 & CRIT-22');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: CRIT-20 — QR Table PIN Disabled Flow Logic
  // ==========================================================================
  console.log('--- SECTION 1: CRIT-20 Table PIN Logic Verification ---');

  // Helper matching table-picker-grid logic
  const evaluatePinRequirement = (requireTablePin: boolean, tableHasPin?: boolean) => {
    return Boolean(requireTablePin && (tableHasPin ?? true));
  };

  // Scenario 1: Branch has PIN DISABLED (requireTablePin = false)
  assert(
    evaluatePinRequirement(false, true) === false,
    'PIN DISABLED: Table with has_pin=true must NOT require PIN'
  );
  assert(
    evaluatePinRequirement(false, false) === false,
    'PIN DISABLED: Table with has_pin=false must NOT require PIN'
  );
  assert(
    evaluatePinRequirement(false, undefined) === false,
    'PIN DISABLED: Table with has_pin=undefined must NOT require PIN'
  );

  // Scenario 2: Branch has PIN ENABLED (requireTablePin = true)
  assert(
    evaluatePinRequirement(true, true) === true,
    'PIN ENABLED: Table with has_pin=true MUST require PIN'
  );
  assert(
    evaluatePinRequirement(true, undefined) === true,
    'PIN ENABLED: Table with has_pin=undefined MUST require PIN'
  );
  assert(
    evaluatePinRequirement(true, false) === false,
    'PIN ENABLED: Table with explicit has_pin=false does not require PIN'
  );

  // Scenario 3: Verify source code in table-picker-grid.tsx
  const tablePickerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/qr/table-picker-grid.tsx'), 'utf8');
  assert(
    tablePickerSrc.includes('const isTablePinRequired = (table: TableItem) => Boolean(requireTablePin && (table.has_pin ?? true));'),
    'table-picker-grid.tsx uses Boolean(requireTablePin && (table.has_pin ?? true)) for isTablePinRequired'
  );
  assert(
    !tablePickerSrc.includes('Boolean(requireTablePin || table.has_pin)'),
    'table-picker-grid.tsx does NOT contain flawed (requireTablePin || table.has_pin) check'
  );
  assert(
    tablePickerSrc.includes('{Boolean(requireTablePin && (table.has_pin ?? true)) && ('),
    'table-picker-grid.tsx renders PIN required badge ONLY when branch requires PIN'
  );

  // ==========================================================================
  // SECTION 2: CRIT-21 — Global Currency & Timezone Resolution
  // ==========================================================================
  console.log('\n--- SECTION 2: CRIT-21 Currency & Timezone Verification ---');

  // 1. Check time-range.ts default
  assert(
    DEFAULT_BRANCH_TIMEZONE === 'UTC',
    'DEFAULT_BRANCH_TIMEZONE in time-range.ts is "UTC"'
  );

  // 2. Test resolveAnalyticsDateRange with different timezones
  const dateRangeNY = resolveAnalyticsDateRange({ preset: 'today' }, 'America/New_York');
  assert(
    dateRangeNY.timezone === 'America/New_York',
    'resolveAnalyticsDateRange properly binds America/New_York'
  );
  assert(
    typeof dateRangeNY.startUtc === 'string' && typeof dateRangeNY.endUtc === 'string',
    'resolveAnalyticsDateRange returns valid ISO UTC start and end bounds'
  );

  const dateRangeLK = resolveAnalyticsDateRange({ preset: 'today' }, 'Asia/Colombo');
  assert(
    dateRangeLK.timezone === 'Asia/Colombo',
    'resolveAnalyticsDateRange properly binds Asia/Colombo'
  );

  const dateRangeDefault = resolveAnalyticsDateRange({ preset: 'today' });
  assert(
    dateRangeDefault.timezone === 'UTC',
    'resolveAnalyticsDateRange defaults cleanly to UTC when no timezone provided'
  );

  // 3. Test centralized date utility functions
  const testIso = '2026-09-11T12:30:00.000Z';
  const timeInUTC = formatBusinessTime(testIso, 'UTC');
  assert(
    timeInUTC.includes('12:30') || timeInUTC.includes('12:30 PM'),
    `formatBusinessTime renders 12:30 in UTC (rendered: ${timeInUTC})`
  );

  const timeInColombo = formatBusinessTime(testIso, 'Asia/Colombo');
  assert(
    timeInColombo.includes('06:00') || timeInColombo.includes('6:00 PM'),
    `formatBusinessTime correctly renders +05:30 offset for Asia/Colombo (rendered: ${timeInColombo})`
  );

  const timeInNY = formatBusinessTime(testIso, 'America/New_York');
  assert(
    timeInNY.includes('08:30') || timeInNY.includes('8:30 AM'),
    `formatBusinessTime correctly renders -04:00 (EDT) offset for America/New_York (rendered: ${timeInNY})`
  );

  const dateTimeNY = formatBusinessDateTime(testIso, 'America/New_York');
  assert(
    dateTimeNY.includes('Sep 11, 2026') && (dateTimeNY.includes('8:30') || dateTimeNY.includes('08:30')),
    `formatBusinessDateTime renders formatted date and time in America/New_York (rendered: ${dateTimeNY})`
  );

  // 4. Verify eradication of hardcoded Asia/Colombo in code files
  const cancellationSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/analytics/cancellation-analytics.ts'), 'utf8');
  assert(
    !cancellationSrc.includes("'Asia/Colombo'"),
    'cancellation-analytics.ts has zero hardcoded "Asia/Colombo"'
  );

  const dashboardTodaySrc = fs.readFileSync(path.join(process.cwd(), 'src/server/navigation/dashboard-today-data.ts'), 'utf8');
  assert(
    !dashboardTodaySrc.includes("'Asia/Colombo'"),
    'dashboard-today-data.ts has zero hardcoded "Asia/Colombo"'
  );

  const filterBarSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/reports/analytics-filter-bar.tsx'), 'utf8');
  assert(
    !filterBarSrc.includes("'Asia/Colombo'"),
    'analytics-filter-bar.tsx has zero hardcoded "Asia/Colombo"'
  );

  const reportsDashboardSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/reports/reports-dashboard.tsx'), 'utf8');
  assert(
    !reportsDashboardSrc.includes("'Asia/Colombo'"),
    'reports-dashboard.tsx has zero hardcoded "Asia/Colombo"'
  );

  const resValidationSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/reservations/reservation-validation.service.ts'), 'utf8');
  assert(
    !resValidationSrc.includes("'Asia/Colombo'"),
    'reservation-validation.service.ts has zero hardcoded "Asia/Colombo"'
  );

  const resServiceSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/reservations/reservation.service.ts'), 'utf8');
  assert(
    !resServiceSrc.includes("'Asia/Colombo'"),
    'reservation.service.ts has zero hardcoded "Asia/Colombo"'
  );

  // ==========================================================================
  // SECTION 3: CRIT-22 — Database Public Venues Verification
  // ==========================================================================
  console.log('\n--- SECTION 3: CRIT-22 Public Venues Database Audit ---');

  let currentVenues: any[] | null = null;
  let vErr: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await admin
      .from('venue_public_profiles')
      .select('id, display_name, slug, is_published, business_id, created_at')
      .order('created_at', { ascending: true });
    if (!res.error) {
      currentVenues = res.data;
      vErr = null;
      break;
    }
    vErr = res.error;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (vErr) {
    console.error('vErr details:', vErr);
  }

  assert(!vErr, 'Successfully queried venue_public_profiles from database');
  assert(
    (currentVenues?.length || 0) === 2,
    `Database has EXACTLY 2 public venues (found: ${currentVenues?.length || 0})`
  );

  const aurawediVenue = currentVenues?.find((v) => v.slug === 'aurawedi');
  assert(
    Boolean(aurawediVenue && aurawediVenue.is_published),
    'Real user venue "aurawedi" is INTACT and PUBLISHED'
  );

  const nexaVenue = currentVenues?.find((v) => v.slug === 'nexa-grand-hotel');
  assert(
    Boolean(nexaVenue && nexaVenue.is_published),
    'Real user venue "nexa-grand-hotel" is INTACT and PUBLISHED'
  );

  const testVenuesCount = currentVenues?.filter((v) => /178\d{10}/.test(v.slug)).length || 0;
  assert(
    testVenuesCount === 0,
    `All test venues were safely eliminated (found ${testVenuesCount} test venues remaining)`
  );

  // Verify real user businesses are intact
  const { data: realBusinesses } = await admin
    .from('businesses')
    .select('id, name, slug, status')
    .in('slug', ['aurawedi', 'nexa-grand-hotel', 'luna-garden-restaurant']);

  assert(
    realBusinesses?.length === 3,
    'All 3 real user businesses ("aurawedi", "Nexa Grand Hotel", "Luna Garden Restaurant") remain intact'
  );

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log('  🎉 ALL CRIT-20, CRIT-21 & CRIT-22 INVARIANTS ARE PASSING!');
  } else {
    console.log('  ⚠️ SOME TESTS FAILED. PLEASE REVIEW LOGS.');
  }
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
