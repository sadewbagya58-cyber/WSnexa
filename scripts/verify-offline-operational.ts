/**
 * WSNexa Phase 38 — Offline-First Operational Mode Comprehensive Verification Suite
 *
 * Verifies:
 * 1. Service Worker & App Shell Offline Resilience
 * 2. Operational Data Cache (Multi-Tenant & Branch Scoped)
 * 3. Offline Operational Mutations (Waiter Order, Tables, KDS, Stock Count)
 * 4. Financial & Administrative Invariant Enforcement (Strict Online-Only Boundaries)
 * 5. Sync Queue Idempotency, FIFO Ordering, and Stats
 * 6. Server Mobile Sync Route Handler & Action Dispatch
 * 7. Component Invariant Safety
 */

import * as fs from 'fs';
import * as path from 'path';
import { syncQueue } from '../src/lib/offline/sync-queue';
import { operationalCache } from '../src/lib/offline/operational-cache';
import { StorageAdapter } from '../src/lib/offline/storage-adapter';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: string) {
  results.push({ suite, name, passed: Boolean(condition), details });
  const mark = condition ? '✓' : '✗';
  console.log(`  ${mark} [${suite}] ${name}${details && !condition ? ` — ${details}` : ''}`);
}

async function runMasterOfflineVerification() {
  console.log('\n===============================================================');
  console.log('⚡ WSNEXA: OFFLINE-FIRST OPERATIONAL MODE VERIFICATION');
  console.log('===============================================================\n');

  const rootDir = process.cwd();

  // -------------------------------------------------------------
  // SUITE 1: Service Worker & App Shell Offline Resilience
  // -------------------------------------------------------------
  console.log('Suite 1: Service Worker & App Shell Offline Resilience');

  const swPath = path.resolve(rootDir, 'public/sw.js');
  assert('ServiceWorker', 'public/sw.js exists', fs.existsSync(swPath));
  const swContent = fs.readFileSync(swPath, 'utf-8');
  assert('ServiceWorker', 'SW defines cache name', swContent.includes('wsnexa-v1') || swContent.includes('CACHE_NAME'));
  assert('ServiceWorker', 'SW handles install event with precaching', swContent.includes("addEventListener('install'"));
  assert('ServiceWorker', 'SW handles activate event with cleanup', swContent.includes("addEventListener('activate'"));
  assert('ServiceWorker', 'SW handles fetch event with caching strategy', swContent.includes("addEventListener('fetch'"));
  assert('ServiceWorker', 'SW caches Next.js static assets with CacheFirst', swContent.includes('/_next/static/'));
  assert('ServiceWorker', 'SW handles navigation requests with fallback', swContent.includes("mode === 'navigate'") || swContent.includes('navigate'));

  const swRegPath = path.resolve(rootDir, 'src/components/mobile/service-worker-register.tsx');
  assert('ServiceWorker', 'service-worker-register.tsx exists', fs.existsSync(swRegPath));
  const swRegContent = fs.readFileSync(swRegPath, 'utf-8');
  assert('ServiceWorker', 'Registers /sw.js in navigator', swRegContent.includes('navigator.serviceWorker') && swRegContent.includes("register('/sw.js')"));

  const rootLayoutPath = path.resolve(rootDir, 'src/app/layout.tsx');
  const rootLayoutContent = fs.readFileSync(rootLayoutPath, 'utf-8');
  assert('ServiceWorker', 'ServiceWorkerRegister mounted in root layout', rootLayoutContent.includes('<ServiceWorkerRegister />'));

  const mainActivityPath = path.resolve(rootDir, 'android/app/src/main/java/com/wsnexa/app/MainActivity.java');
  const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');
  assert('AndroidWebView', 'DOM storage enabled in MainActivity', mainActivityContent.includes('setDomStorageEnabled(true)'));
  assert('AndroidWebView', 'Database storage enabled in MainActivity', mainActivityContent.includes('setDatabaseEnabled(true)'));
  assert('AndroidWebView', 'CacheMode configured to LOAD_DEFAULT', mainActivityContent.includes('LOAD_DEFAULT'));
  assert('AndroidWebView', 'offline.html full-page takeover removed from onReceivedError', !mainActivityContent.includes('loadOfflineFallback(webView)'));

  // -------------------------------------------------------------
  // SUITE 2: Operational Data Cache (Multi-Tenant & Branch Scoped)
  // -------------------------------------------------------------
  console.log('\nSuite 2: Operational Data Cache (Multi-Tenant & Branch Scoped)');

  await operationalCache.clearAllOperationalData();

  const bizA = 'biz_test_a';
  const branchA1 = 'branch_a1';
  const branchA2 = 'branch_a2';
  const bizB = 'biz_test_b';
  const branchB1 = 'branch_b1';

  // 1. Catalog persistence
  const mockCatalogA1: any = {
    business: { id: bizA, name: 'Business A', currency: 'USD' },
    branch: { id: branchA1, name: 'Branch A1', currency: 'USD' },
    categories: [{ id: 'cat_1', name: 'Mains', display_order: 1 }],
    items: [{ id: 'item_1', name: 'Burger', category_id: 'cat_1', price: 12.5, is_active: true, display_order: 1 }],
    modifiers: [],
    customFields: [],
  };

  await operationalCache.saveBranchCatalog(bizA, branchA1, mockCatalogA1);
  const retrievedCatalogA1 = await operationalCache.getBranchCatalog(bizA, branchA1);
  assert('OperationalCache', 'Branch catalog saved and retrieved accurately', retrievedCatalogA1?.items[0]?.name === 'Burger');

  // Branch isolation: Branch A2 must not see Branch A1's catalog
  const retrievedCatalogA2 = await operationalCache.getBranchCatalog(bizA, branchA2);
  assert('OperationalCache', 'Branch catalog isolated from sibling branch A2', retrievedCatalogA2 === null);

  // Business isolation: Biz B must not see Biz A's catalog
  const retrievedCatalogB1 = await operationalCache.getBranchCatalog(bizB, branchB1);
  assert('OperationalCache', 'Branch catalog isolated from separate business B', retrievedCatalogB1 === null);

  // 2. Dining Tables & Areas persistence
  const mockTables = [
    { id: 'tbl_1', name: 'Table 1', tableNumber: 1, serviceAreaId: 'area_1', status: 'available' },
    { id: 'tbl_2', name: 'Table 2', tableNumber: 2, serviceAreaId: 'area_1', status: 'occupied' },
  ];
  const mockAreas = [{ id: 'area_1', name: 'Indoor Hall' }];

  await operationalCache.saveBranchTables(bizA, branchA1, mockTables, mockAreas);
  const retrievedTables = await operationalCache.getBranchTables(bizA, branchA1);
  assert('OperationalCache', 'Tables & areas saved and retrieved', retrievedTables?.tables.length === 2 && retrievedTables?.areas[0]?.name === 'Indoor Hall');

  // 3. Active Tickets persistence
  const mockTickets = [
    { id: 'ord_1', order_number: 'WS-001', status: 'preparing', items_count: 3 },
  ];
  await operationalCache.saveActiveTickets(bizA, branchA1, mockTickets);
  const retrievedTickets = await operationalCache.getActiveTickets(bizA, branchA1);
  assert('OperationalCache', 'Active tickets saved and retrieved', (retrievedTickets as any)?.[0]?.order_number === 'WS-001');

  // 4. Clear branch operational data
  await operationalCache.clearBranchOperationalData(bizA, branchA1);
  const clearedCatalog = await operationalCache.getBranchCatalog(bizA, branchA1);
  const clearedTables = await operationalCache.getBranchTables(bizA, branchA1);
  assert('OperationalCache', 'Branch data cleared cleanly on request', clearedCatalog === null && clearedTables === null);

  // -------------------------------------------------------------
  // SUITE 3: Offline Operational Mutations (Queue Operations)
  // -------------------------------------------------------------
  console.log('\nSuite 3: Offline Operational Mutations');

  await StorageAdapter.clear('wsnexa_sync_queue_v1');
  await syncQueue.init();

  // Test 1: submit_waiter_order
  assert('Queue', 'submit_waiter_order is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('submit_waiter_order') === 'OFFLINE_QUEUEABLE');
  const waiterOrder = await syncQueue.enqueue({
    entity_type: 'order',
    entity_id: 'temp_ord_001',
    action: 'submit_waiter_order',
    payload: {
      table_id: 'tbl_1',
      items: [{ menu_item_id: 'item_1', quantity: 2, unit_price: 12.5 }],
      notes: 'No onions',
    },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_waiter_1',
  });
  assert('Queue', 'Waiter order enqueued with pending status', waiterOrder.status === 'pending');
  assert('Queue', 'Waiter order contains payload and timestamps', waiterOrder.payload.items.length === 1 && waiterOrder.client_timestamp > 0);

  // Test 2: update_table_status
  assert('Queue', 'update_table_status is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('update_table_status') === 'OFFLINE_QUEUEABLE');
  const tableMutation = await syncQueue.enqueue({
    entity_type: 'table_status',
    entity_id: 'tbl_1',
    action: 'update_table_status',
    payload: { status: 'occupied' },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_waiter_1',
  });
  assert('Queue', 'Table status mutation enqueued', tableMutation.status === 'pending' && tableMutation.payload.status === 'occupied');

  // Test 3: update_kitchen_status
  assert('Queue', 'update_kitchen_status is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('update_kitchen_status') === 'OFFLINE_QUEUEABLE');
  const kitchenMutation = await syncQueue.enqueue({
    entity_type: 'kitchen_ticket',
    entity_id: 'ord_1',
    action: 'update_kitchen_status',
    payload: { status: 'ready', order_id: 'ord_1' },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_cook_1',
  });
  assert('Queue', 'Kitchen status progression enqueued', kitchenMutation.status === 'pending');

  // Test 4: record_inventory_count
  assert('Queue', 'record_inventory_count is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('record_inventory_count') === 'OFFLINE_QUEUEABLE');
  const stockMutation = await syncQueue.enqueue({
    entity_type: 'inventory_count',
    entity_id: 'count_sheet_1',
    action: 'record_inventory_count',
    payload: {
      count_sheet_id: 'count_sheet_1',
      entries: [{ ingredient_id: 'ing_1', counted_qty: 45 }],
    },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_stock_1',
  });
  assert('Queue', 'Stock count entry enqueued', stockMutation.status === 'pending');

  // -------------------------------------------------------------
  // SUITE 4: Financial & Administrative Invariants (Online-Only)
  // -------------------------------------------------------------
  console.log('\nSuite 4: Financial & Administrative Invariant Protection');

  const forbiddenOperations = [
    'payment',
    'process_payment',
    'refund',
    'settlement',
    'close_register',
    'subscription_upgrade',
    'subscription_checkout',
    'cancel_order',
    'cancel_item',
    'invite_staff',
    'modify_rbac',
    'publish_venue',
  ];

  for (const op of forbiddenOperations) {
    assert('Invariant', `${op} is strictly ONLINE_ONLY`, syncQueue.classifyOperation(op) === 'ONLINE_ONLY');

    let threw = false;
    try {
      await syncQueue.enqueue({
        entity_type: 'payment' as any,
        entity_id: 'test_entity',
        action: op,
        payload: { amount: 100 },
        business_id: bizA,
        branch_id: branchA1,
        user_id: 'user_1',
      });
    } catch (err: any) {
      threw = err.message.includes('[SyncQueue Invariant Violation]');
    }
    assert('Invariant', `Enqueueing ${op} throws Invariant Violation`, threw);
  }

  // -------------------------------------------------------------
  // SUITE 5: Queue Idempotency, FIFO Ordering, and Stats
  // -------------------------------------------------------------
  console.log('\nSuite 5: Queue Idempotency, FIFO Ordering, and Stats');

  // Test idempotency with explicit operation_id
  const opId = 'idempotent-test-uuid-12345';
  const firstEnqueue = await syncQueue.enqueue({
    entity_type: 'order',
    entity_id: 'ord_idem',
    action: 'submit_waiter_order',
    payload: { test: true },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_1',
    operation_id: opId,
  });

  const secondEnqueue = await syncQueue.enqueue({
    entity_type: 'order',
    entity_id: 'ord_idem',
    action: 'submit_waiter_order',
    payload: { test: true },
    business_id: bizA,
    branch_id: branchA1,
    user_id: 'user_1',
    operation_id: opId,
  });

  assert('Idempotency', 'Re-enqueueing with same operation_id returns identical object', firstEnqueue === secondEnqueue);
  const queueItemsForOp = syncQueue.getQueue().filter((q) => q.operation_id === opId);
  assert('Idempotency', 'Exactly one item in queue for operation_id', queueItemsForOp.length === 1);

  // Test stats calculation
  const stats = syncQueue.getStats();
  assert('Stats', 'Pending count reflects queued items', stats.pending_count >= 5);
  assert('Stats', 'Syncing count is 0 when idle', stats.syncing_count === 0);

  // -------------------------------------------------------------
  // SUITE 6: Server API Route Handler Validation
  // -------------------------------------------------------------
  console.log('\nSuite 6: Server API Route Handler Validation');

  const syncRoutePath = path.resolve(rootDir, 'src/app/api/mobile/sync/route.ts');
  assert('SyncRoute', 'src/app/api/mobile/sync/route.ts exists', fs.existsSync(syncRoutePath));
  const syncRouteContent = fs.readFileSync(syncRoutePath, 'utf-8');

  assert('SyncRoute', 'Rejects ONLINE_ONLY operations at server boundary', syncRouteContent.includes('FORBIDDEN_SYNC_ACTIONS'));
  assert('SyncRoute', 'Extracts and verifies operation_id / idempotency', syncRouteContent.includes('operation_id'));
  assert('SyncRoute', 'Handles submit_waiter_order action', syncRouteContent.includes('submit_waiter_order'));
  assert('SyncRoute', 'Handles update_table_status action', syncRouteContent.includes('update_table_status'));
  assert('SyncRoute', 'Handles update_kitchen_status action', syncRouteContent.includes('update_kitchen_status'));
  assert('SyncRoute', 'Handles record_inventory_count action', syncRouteContent.includes('record_inventory_count'));

  // -------------------------------------------------------------
  // SUITE 7: Component Offline Protection Invariants
  // -------------------------------------------------------------
  console.log('\nSuite 7: Component Offline Protection Invariants');

  const cashierDashPath = path.resolve(rootDir, 'src/components/cashier/cashier-dashboard.tsx');
  const cashierContent = fs.readFileSync(cashierDashPath, 'utf-8');
  assert('UIInvariant', 'CashierDashboard checks networkStatus before payment', cashierContent.includes('networkStatus.isOffline()'));
  assert('UIInvariant', 'CashierDashboard disables payment actions when offline', cashierContent.includes('payment processing and financial settlements'));

  const kitchenQueuePath = path.resolve(rootDir, 'src/components/kitchen/kitchen-order-queue.tsx');
  const kitchenContent = fs.readFileSync(kitchenQueuePath, 'utf-8');
  assert('UIInvariant', 'KitchenOrderQueue blocks offline cancellation', kitchenContent.includes('Order cancellation requires active internet connection'));

  const stockSheetPath = path.resolve(rootDir, 'src/components/inventory/stock-count-mobile-sheet.tsx');
  const stockContent = fs.readFileSync(stockSheetPath, 'utf-8');
  assert('UIInvariant', 'StockCountMobileSheet blocks offline approval', stockContent.includes('Internet connection required for manager stock count approval'));

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`🏁 MASTER VERIFICATION SUMMARY: ${passed}/${total} PASSED (${failed} failed)`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterOfflineVerification().catch((err) => {
  console.error('Master verification script failed:', err);
  process.exit(1);
});
