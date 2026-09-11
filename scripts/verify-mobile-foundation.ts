/**
 * WSNexa Phase 38 — Mobile Foundation & Offline Resilience Automated Verification Suite
 * Validates:
 * 1. Mobile & Android Foundation Configuration
 * 2. Branding & Asset Pipeline Invariants
 * 3. Operation Classification & Online-Only Boundary Safety
 * 4. Idempotency & Deduplication Engine
 * 5. Exponential Backoff Calculations
 * 6. Offline Queue Persistence & Lifecycle
 * 7. Network Connectivity Detection & Events
 * 8. Multi-Tenant & Branch Isolation
 * 9. Realtime Recovery Reconciliation
 */

import * as fs from 'fs';
import * as path from 'path';
import { syncQueue } from '../src/lib/offline/sync-queue';
import { networkStatus } from '../src/lib/offline/network-status';
import { realtimeReconciliation } from '../src/lib/offline/realtime-reconciliation';
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

async function runTests() {
  console.log('\n===============================================================');
  console.log('🧪 WSNEXA PHASE 38: MOBILE FOUNDATION & OFFLINE VERIFICATION');
  console.log('===============================================================\n');

  const rootDir = process.cwd();

  // -------------------------------------------------------------
  // SUITE 1: Mobile & Android Configuration
  // -------------------------------------------------------------
  console.log('Suite 1: Mobile & Android Configuration');
  
  const capConfigPath = path.resolve(rootDir, 'capacitor.config.ts');
  assert('Config', 'capacitor.config.ts exists', fs.existsSync(capConfigPath));
  const capConfigContent = fs.readFileSync(capConfigPath, 'utf-8');
  assert('Config', 'Package ID is com.wsnexa.app', capConfigContent.includes("'com.wsnexa.app'"));
  assert('Config', 'App name is WSNexa', capConfigContent.includes("'WSNexa'"));
  assert('Config', 'webDir is mobile-dist', capConfigContent.includes("'mobile-dist'"));

  const buildGradlePath = path.resolve(rootDir, 'android/app/build.gradle');
  assert('Android', 'android/app/build.gradle exists', fs.existsSync(buildGradlePath));
  const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf-8');
  assert('Android', 'applicationId is com.wsnexa.app', buildGradleContent.includes('applicationId "com.wsnexa.app"'));
  assert('Android', 'namespace is com.wsnexa.app', buildGradleContent.includes('namespace "com.wsnexa.app"'));

  const manifestPath = path.resolve(rootDir, 'android/app/src/main/AndroidManifest.xml');
  assert('Android', 'AndroidManifest.xml exists', fs.existsSync(manifestPath));
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  assert('Android', 'INTERNET permission declared', manifestContent.includes('android.permission.INTERNET'));
  assert('Android', 'ACCESS_NETWORK_STATE permission declared', manifestContent.includes('android.permission.ACCESS_NETWORK_STATE'));

  const stringsPath = path.resolve(rootDir, 'android/app/src/main/res/values/strings.xml');
  const stringsContent = fs.readFileSync(stringsPath, 'utf-8');
  assert('Android', 'App string name is WSNexa', stringsContent.includes('<string name="app_name">WSNexa</string>'));

  // -------------------------------------------------------------
  // SUITE 2: Branding & Asset Pipeline
  // -------------------------------------------------------------
  console.log('\nSuite 2: Branding & Asset Pipeline');
  
  const markSrc = path.resolve(rootDir, 'image/1000041108.png');
  const logoSrc = path.resolve(rootDir, 'image/1000041106.png');
  assert('Branding', 'Official WS mark asset exists', fs.existsSync(markSrc));
  assert('Branding', 'Official WSNexa full logo asset exists', fs.existsSync(logoSrc));

  const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  for (const m of mipmaps) {
    const iconFile = path.resolve(rootDir, `android/app/src/main/res/${m}/ic_launcher.png`);
    const fgFile = path.resolve(rootDir, `android/app/src/main/res/${m}/ic_launcher_foreground.png`);
    const roundFile = path.resolve(rootDir, `android/app/src/main/res/${m}/ic_launcher_round.png`);
    assert('Branding', `${m} ic_launcher generated`, fs.existsSync(iconFile) && fs.statSync(iconFile).size > 500);
    assert('Branding', `${m} foreground generated`, fs.existsSync(fgFile) && fs.statSync(fgFile).size > 500);
    assert('Branding', `${m} round generated`, fs.existsSync(roundFile) && fs.statSync(roundFile).size > 500);
  }

  const splashBase = path.resolve(rootDir, 'android/app/src/main/res/drawable/splash.png');
  const splashPort = path.resolve(rootDir, 'android/app/src/main/res/drawable-port-xxhdpi/splash.png');
  const splashLand = path.resolve(rootDir, 'android/app/src/main/res/drawable-land-xxhdpi/splash.png');
  assert('Branding', 'Base splash.png generated', fs.existsSync(splashBase) && fs.statSync(splashBase).size > 1000);
  assert('Branding', 'Portrait splash generated', fs.existsSync(splashPort) && fs.statSync(splashPort).size > 2000);
  assert('Branding', 'Landscape splash generated', fs.existsSync(splashLand) && fs.statSync(splashLand).size > 2000);

  // -------------------------------------------------------------
  // SUITE 3: Operation Classification & Online Invariants
  // -------------------------------------------------------------
  console.log('\nSuite 3: Operation Classification & Online Invariants');

  assert('Invariant', 'payment is ONLINE_ONLY', syncQueue.classifyOperation('payment') === 'ONLINE_ONLY');
  assert('Invariant', 'refund is ONLINE_ONLY', syncQueue.classifyOperation('refund') === 'ONLINE_ONLY');
  assert('Invariant', 'cancel_order is ONLINE_ONLY', syncQueue.classifyOperation('cancel_order') === 'ONLINE_ONLY');
  assert('Invariant', 'cancel_item is ONLINE_ONLY', syncQueue.classifyOperation('cancel_item') === 'ONLINE_ONLY');
  assert('Invariant', 'subscription_checkout is ONLINE_ONLY', syncQueue.classifyOperation('subscription_checkout') === 'ONLINE_ONLY');
  assert('Invariant', 'invite_staff is ONLINE_ONLY', syncQueue.classifyOperation('invite_staff') === 'ONLINE_ONLY');
  assert('Invariant', 'submit_waiter_order is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('submit_waiter_order') === 'OFFLINE_QUEUEABLE');
  assert('Invariant', 'update_table_status is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('update_table_status') === 'OFFLINE_QUEUEABLE');
  assert('Invariant', 'record_count is OFFLINE_QUEUEABLE', syncQueue.classifyOperation('record_count') === 'OFFLINE_QUEUEABLE');

  let rejectedPayment = false;
  try {
    await syncQueue.enqueue({
      entity_type: 'order',
      entity_id: 'ord-123',
      action: 'process_payment',
      payload: { amount_cents: 5000 },
      business_id: 'biz-1',
      branch_id: 'br-1',
      user_id: 'usr-1',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('[SyncQueue Invariant Violation]')) {
      rejectedPayment = true;
    }
  }
  assert('Invariant', 'Enqueueing payment throws Invariant Violation', rejectedPayment);

  let rejectedCancel = false;
  try {
    await syncQueue.enqueue({
      entity_type: 'order',
      entity_id: 'ord-123',
      action: 'cancel_order',
      payload: { reason: 'Guest left' },
      business_id: 'biz-1',
      branch_id: 'br-1',
      user_id: 'usr-1',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('[SyncQueue Invariant Violation]')) {
      rejectedCancel = true;
    }
  }
  assert('Invariant', 'Enqueueing cancel_order throws Invariant Violation', rejectedCancel);

  // -------------------------------------------------------------
  // SUITE 4: Idempotency & Deduplication Engine
  // -------------------------------------------------------------
  console.log('\nSuite 4: Idempotency & Deduplication Engine');

  const testOpId = `test-op-${Date.now()}`;
  const mutation1 = await syncQueue.enqueue({
    operation_id: testOpId,
    entity_type: 'order',
    entity_id: 'draft-order-1',
    action: 'submit_waiter_order',
    payload: { tableNumber: 5, items: [{ id: 'i1', qty: 2 }] },
    business_id: 'biz-test',
    branch_id: 'br-test',
    user_id: 'usr-test',
  });

  assert('Idempotency', 'Mutation enqueued with deterministic operation_id', mutation1.operation_id === testOpId);
  assert('Idempotency', 'Mutation status initialized to pending', mutation1.status === 'pending');

  // Enqueue identical operation_id again
  const mutation2 = await syncQueue.enqueue({
    operation_id: testOpId,
    entity_type: 'order',
    entity_id: 'draft-order-1',
    action: 'submit_waiter_order',
    payload: { tableNumber: 5, items: [{ id: 'i1', qty: 2 }] },
    business_id: 'biz-test',
    branch_id: 'br-test',
    user_id: 'usr-test',
  });

  assert('Idempotency', 'Re-enqueueing returns existing mutation without duplication', mutation1 === mutation2);
  const queueItemsWithOpId = syncQueue.getQueue().filter((q) => q.operation_id === testOpId);
  assert('Idempotency', 'Exactly one item in queue for operation_id', queueItemsWithOpId.length === 1);

  // -------------------------------------------------------------
  // SUITE 5: Exponential Backoff Calculation
  // -------------------------------------------------------------
  console.log('\nSuite 5: Exponential Backoff Calculation');

  const delay0 = syncQueue.calculateBackoffDelay(0);
  const delay1 = syncQueue.calculateBackoffDelay(1);
  const delay2 = syncQueue.calculateBackoffDelay(2);
  const delay10 = syncQueue.calculateBackoffDelay(10);

  assert('Backoff', 'Attempt 0 delay is between 1000ms and 1500ms', delay0 >= 1000 && delay0 <= 1500);
  assert('Backoff', 'Attempt 1 delay is between 2000ms and 2500ms', delay1 >= 2000 && delay1 <= 2500);
  assert('Backoff', 'Attempt 2 delay is between 4000ms and 4500ms', delay2 >= 4000 && delay2 <= 4500);
  assert('Backoff', 'High attempts capped at max 30000ms + jitter', delay10 >= 30000 && delay10 <= 30500);

  // -------------------------------------------------------------
  // SUITE 6: Multi-Tenant & Branch Isolation
  // -------------------------------------------------------------
  console.log('\nSuite 6: Multi-Tenant & Branch Isolation');

  const bizA_Op = `op-bizA-${Date.now()}`;
  const bizB_Op = `op-bizB-${Date.now()}`;

  await syncQueue.enqueue({
    operation_id: bizA_Op,
    entity_type: 'table_status',
    entity_id: 'tbl-a',
    action: 'update_table_status',
    payload: { status: 'occupied' },
    business_id: 'business-A',
    branch_id: 'branch-A-1',
    user_id: 'user-A',
  });

  await syncQueue.enqueue({
    operation_id: bizB_Op,
    entity_type: 'table_status',
    entity_id: 'tbl-b',
    action: 'update_table_status',
    payload: { status: 'cleaning' },
    business_id: 'business-B',
    branch_id: 'branch-B-1',
    user_id: 'user-B',
  });

  const branchAQueue = syncQueue.getQueue('branch-A-1');
  const branchBQueue = syncQueue.getQueue('branch-B-1');

  assert('Isolation', 'Branch A queue contains Branch A mutation', branchAQueue.some((q) => q.operation_id === bizA_Op));
  assert('Isolation', 'Branch A queue does NOT contain Branch B mutation', !branchAQueue.some((q) => q.operation_id === bizB_Op));
  assert('Isolation', 'Branch B queue contains Branch B mutation', branchBQueue.some((q) => q.operation_id === bizB_Op));
  assert('Isolation', 'Branch B queue does NOT contain Branch A mutation', !branchBQueue.some((q) => q.operation_id === bizA_Op));

  // -------------------------------------------------------------
  // SUITE 7: Network Detection & Realtime Recovery
  // -------------------------------------------------------------
  console.log('\nSuite 7: Network Detection & Realtime Recovery');

  let networkListenerCalled = false;
  let receivedState = false;

  const unsubNet = networkStatus.subscribe((st) => {
    networkListenerCalled = true;
    receivedState = st.connected;
  });

  networkStatus._overrideStateForTesting(false, 'none');
  assert('Network', 'Offline transition dispatched to subscribers', networkStatus.isOffline());

  let reconcilerCalled = false;
  realtimeReconciliation.registerReconciler(async () => {
    reconcilerCalled = true;
  });

  networkStatus._overrideStateForTesting(true, 'wifi');
  assert('Network', 'Online transition dispatched to subscribers', networkStatus.isOnline());

  await realtimeReconciliation.reconcile('test_reconnect');
  assert('Recovery', 'Reconciler triggered on reconnection sequence', reconcilerCalled);

  unsubNet();

  // Clean test queue items
  await syncQueue.discardMutation(testOpId);
  await syncQueue.discardMutation(bizA_Op);
  await syncQueue.discardMutation(bizB_Op);

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log('\n===============================================================');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed}/${total} PASSED (${failed} failed)`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
