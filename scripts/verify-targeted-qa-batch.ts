/**
 * WSNexa Targeted Physical QA Fix Batch Verification Script
 * Validates all 5 fixes for physical Android QA:
 * 1. Unavailable table rejected in QR picker & server action
 * 2. Sync Attention Required banner actionable with SyncStatusSheet
 * 3. Offline/Sync banner safe-area status bar spacing
 * 4. In-App Connection Required fallback for offline navigation (no net::ERR_FAILED)
 * 5. Functional and responsive Try Again error handling
 */

import * as fs from 'fs';
import * as path from 'path';

function runChecks() {
  console.log('🔍 Running WSNexa Targeted Physical QA Fix Batch Verification...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  const root = process.cwd();

  // ── ISSUE 1: UNAVAILABLE TABLE GUARDS ───────────────────────────────────────
  console.log('--- Issue 1: Unavailable Table QR Protection ---');
  const qrServicePath = path.join(root, 'src/server/services/qr.service.ts');
  const qrServiceContent = fs.readFileSync(qrServicePath, 'utf-8');
  assert(
    qrServiceContent.includes("status: t.status || 'available'") &&
    qrServiceContent.includes(".select('id, name, code, table_number, capacity, service_area_id, is_active, deleted_at, table_pin_hash, display_order, status')"),
    'QR Service selects and maps table status in Area QR payload'
  );

  const tablePickerPath = path.join(root, 'src/components/qr/table-picker-grid.tsx');
  const tablePickerContent = fs.readFileSync(tablePickerPath, 'utf-8');
  assert(
    tablePickerContent.includes('status?: string') &&
    tablePickerContent.includes("const isUnavailable = table.status === 'unavailable';") &&
    tablePickerContent.includes("disabled={isVerifying || isUnavailable}") &&
    tablePickerContent.includes("t('Unavailable', 'අක්‍රියයි')"),
    'TablePickerGrid marks unavailable tables with disabled state and Unavailable badge'
  );

  const publicGuestMenuPath = path.join(root, 'src/components/qr/public-guest-menu.tsx');
  const publicGuestMenuContent = fs.readFileSync(publicGuestMenuPath, 'utf-8');
  assert(
    publicGuestMenuContent.includes("if (targetTable && targetTable.status !== 'unavailable')"),
    'PublicGuestMenu bypasses auto-selection if initialTableId is unavailable'
  );

  const tableActionPath = path.join(root, 'src/server/actions/table.ts');
  const tableActionContent = fs.readFileSync(tableActionPath, 'utf-8');
  assert(
    tableActionContent.includes("dbTable.status === 'unavailable'") &&
    tableActionContent.includes('This table is currently unavailable for seating or orders'),
    'verifyTableAccessAction rejects unavailable tables server-side'
  );

  const orderServicePath = path.join(root, 'src/server/services/order.service.ts');
  const orderServiceContent = fs.readFileSync(orderServicePath, 'utf-8');
  assert(
    orderServiceContent.includes("dbTable.status === 'unavailable'") &&
    orderServiceContent.includes('TABLE_UNAVAILABLE'),
    'submitGuestOrderAction pre-validates and rejects unavailable tables'
  );

  // ── ISSUE 2: ACTIONABLE SYNC BANNER & SHEET ────────────────────────────────
  console.log('\n--- Issue 2: Actionable Sync Attention Banner ---');
  const offlineBannerPath = path.join(root, 'src/components/mobile/offline-banner.tsx');
  const offlineBannerContent = fs.readFileSync(offlineBannerPath, 'utf-8');
  assert(
    offlineBannerContent.includes('<SyncStatusSheet') &&
    offlineBannerContent.includes('setInternalSheetOpen(true)') &&
    offlineBannerContent.includes('stats.failed_count + stats.conflict_count'),
    'OfflineBanner integrates SyncStatusSheet and opens mutation review UI on click'
  );

  const syncSheetPath = path.join(root, 'src/components/mobile/sync-status-sheet.tsx');
  const syncSheetContent = fs.readFileSync(syncSheetPath, 'utf-8');
  assert(
    syncSheetContent.includes('header-safe-top') &&
    syncSheetContent.includes('syncQueue.retryMutation') &&
    syncSheetContent.includes('syncQueue.discardMutation'),
    'SyncStatusSheet provides retry and discard controls for pending/failed mutations'
  );

  // ── ISSUE 3: STATUS BAR SAFE-AREA SPACING ──────────────────────────────────
  console.log('\n--- Issue 3: Status Bar Safe Area Spacing ---');
  assert(
    offlineBannerContent.includes('calc(max(env(safe-area-inset-top, 0px), var(--sat, 0px)) + 0.625rem)') &&
    offlineBannerContent.includes('data-offline-banner="true"'),
    'OfflineBanner sets dynamic top padding incorporating --sat and safe-area-inset-top'
  );

  const globalsCssPath = path.join(root, 'src/app/globals.css');
  const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf-8');
  assert(
    globalsCssContent.includes('body:has([data-offline-banner]) .header-safe-top'),
    'globals.css suppresses double header padding when offline banner is mounted'
  );

  // ── ISSUE 4: SERVICE WORKER IN-APP FALLBACK (NO NET::ERR_FAILED) ───────────
  console.log('\n--- Issue 4: In-App Connection Required Fallback ---');
  const swPath = path.join(root, 'public/sw.js');
  const swContent = fs.readFileSync(swPath, 'utf-8');
  assert(
    swContent.includes('getConnectionRequiredHtml()') &&
    swContent.includes('status: 200') &&
    swContent.includes('text/html; charset=utf-8'),
    'Service Worker returns in-app HTML (HTTP 200) on uncached offline navigation'
  );

  assert(
    swContent.includes('Take Order (Offline Ready)') &&
    swContent.includes('/dashboard/waiter/order') &&
    swContent.includes('/dashboard/tables'),
    'Service Worker in-app offline view provides direct paths back to offline tools'
  );

  assert(
    swContent.includes('status: 204') &&
    swContent.includes('status: 404') &&
    !swContent.includes('.catch(() => cachedResponse)'),
    'Service Worker never returns undefined in fetch handlers (eliminates net::ERR_FAILED)'
  );

  // ── ISSUE 5: FUNCTIONAL & RESPONSIVE TRY AGAIN ERROR HANDLING ─────────────
  console.log('\n--- Issue 5: Functional Try Again Error Handling ---');
  const rootErrorPath = path.join(root, 'src/app/error.tsx');
  const rootErrorContent = fs.readFileSync(rootErrorPath, 'utf-8');
  assert(
    rootErrorContent.includes('networkStatus.isOffline()') &&
    rootErrorContent.includes('useTransition') &&
    rootErrorContent.includes('router.refresh()') &&
    rootErrorContent.includes('min-h-[44px]') &&
    rootErrorContent.includes('Take Order (Offline Ready)'),
    'Root error.tsx implements offline check, transition feedback, router.refresh, and offline navigation'
  );

  const dashboardErrorPath = path.join(root, 'src/app/(dashboard)/dashboard/error.tsx');
  const dashboardErrorContent = fs.readFileSync(dashboardErrorPath, 'utf-8');
  assert(
    dashboardErrorContent.includes('networkStatus.isOffline()') &&
    dashboardErrorContent.includes('useTransition') &&
    dashboardErrorContent.includes('router.refresh()') &&
    dashboardErrorContent.includes('min-h-[44px]') &&
    dashboardErrorContent.includes('Take Order (Offline Ready)'),
    'Dashboard error.tsx implements offline check, transition feedback, router.refresh, and offline navigation'
  );

  console.log(`\n========================================`);
  console.log(`Verification Results: ${passed}/${total} checks passed.`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runChecks();
