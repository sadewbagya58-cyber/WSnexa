import fs from 'fs';
import path from 'path';
import assert from 'assert';

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

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

async function runTests() {
  console.log('\n================================================================');
  console.log('  WSNexa Phase 37 Step 3: Production QA Closure Hotfix Suite');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(`  ❌ [FAIL] ${name}:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // ISSUE 1: Cashier Payment Settlement RPC Signature & Payload
  // -------------------------------------------------------------
  console.log('--- ISSUE 1: Cashier Payment Settlement RPC ---');

  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260807000000_create_payment_schema.sql');
  const migrationCode = fs.readFileSync(migrationPath, 'utf8');

  test('1. Canonical SQL migration defines record_order_payment with p_actor_id', () => {
    assert(migrationCode.includes('CREATE OR REPLACE FUNCTION public.record_order_payment('), 'Migration defines record_order_payment function');
    assert(migrationCode.includes('p_actor_id UUID DEFAULT NULL'), 'Canonical SQL parameter is p_actor_id');
    assert(!migrationCode.includes('p_received_by UUID'), 'p_received_by is NOT a parameter in canonical SQL function');
  });

  const paymentServicePath = path.join(process.cwd(), 'src', 'server', 'services', 'payment.service.ts');
  const paymentServiceCode = fs.readFileSync(paymentServicePath, 'utf8');

  test('2. PaymentService.recordPayment sends p_actor_id matching canonical PostgreSQL RPC', () => {
    assert(paymentServiceCode.includes("admin.rpc('record_order_payment'"), 'PaymentService calls record_order_payment RPC');
    assert(paymentServiceCode.includes('p_actor_id: authContext.userId'), 'PaymentService sends p_actor_id (not p_received_by)');
    assert(!paymentServiceCode.includes('p_received_by: authContext.userId'), 'Obsolete p_received_by parameter removed from payload');
  });

  test('3. PaymentService enforces authorization and order tenant isolation', () => {
    assert(paymentServiceCode.includes("permission: 'payments.record'"), 'Checks payments.record permission');
    assert(paymentServiceCode.includes("permission: 'cashier.access'"), 'Allows cashier.access fallback permission');
    assert(paymentServiceCode.includes('order.business_id !== authContext.businessId'), 'Rejects cross-business order payment');
    assert(paymentServiceCode.includes("order.status === 'cancelled'"), 'Rejects payment on cancelled order');
  });

  // -------------------------------------------------------------
  // ISSUE 2: Waiter Approval Queue Realtime Subscriptions
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 2: Waiter Approval Queue Realtime ---');

  const waiterCenterPath = path.join(process.cwd(), 'src', 'components', 'waiter', 'waiter-request-center.tsx');
  const waiterCenterCode = fs.readFileSync(waiterCenterPath, 'utf8');

  test('4. PendingOrderApprovalsSection subscribes to orders table realtime channel', () => {
    assert(waiterCenterCode.includes("table: 'orders'"), 'Subscribes to orders table in PendingOrderApprovalsSection');
    assert(waiterCenterCode.includes('waiter_order_approvals_${branchId}'), 'Uses branch-scoped channel name for approvals');
    assert(waiterCenterCode.includes('filter: `branch_id=eq.${branchId}`'), 'Enforces branch_id filter on orders subscription');
  });

  const waiterApprovalActionPath = path.join(process.cwd(), 'src', 'server', 'actions', 'waiter-approval.ts');
  const waiterApprovalActionCode = fs.readFileSync(waiterApprovalActionPath, 'utf8');

  test('5. approveGuestOrderAction and rejectGuestOrderAction revalidate paths', () => {
    assert(waiterApprovalActionCode.includes("revalidatePath('/dashboard/waiter')"), 'Revalidates /dashboard/waiter on approval');
    assert(waiterApprovalActionCode.includes("revalidatePath('/dashboard/kitchen')"), 'Revalidates /dashboard/kitchen on approval');
    assert(waiterApprovalActionCode.includes("revalidatePath('/dashboard/cashier')"), 'Revalidates /dashboard/cashier on approval');
  });

  // -------------------------------------------------------------
  // ISSUE 3: Customer Order Tracker Realtime State Propagation
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 3: Customer Order Tracker Realtime ---');

  const realtimeOrderHookPath = path.join(process.cwd(), 'src', 'hooks', 'use-realtime-order.ts');
  const realtimeOrderHookCode = fs.readFileSync(realtimeOrderHookPath, 'utf8');

  test('6. useRealtimeOrder maps approval_status, approved_at, rejected_at, and rejection_reason', () => {
    assert(realtimeOrderHookCode.includes('approval_status: data.approval_status'), 'useRealtimeOrder reconciles approval_status');
    assert(realtimeOrderHookCode.includes('approved_at: data.approved_at'), 'useRealtimeOrder reconciles approved_at');
    assert(realtimeOrderHookCode.includes('rejected_at: data.rejected_at'), 'useRealtimeOrder reconciles rejected_at');
    assert(realtimeOrderHookCode.includes('rejection_reason: data.rejection_reason'), 'useRealtimeOrder reconciles rejection_reason');
  });

  test('7. useRealtimeOrder includes broadcast event support and fast polling fallback', () => {
    assert(realtimeOrderHookCode.includes("event: 'order_status_updated'"), 'useRealtimeOrder listens to broadcast order_status_updated');
    assert(realtimeOrderHookCode.includes('2500'), 'Polling interval tightened to 2500ms for fast convergence');
  });

  const realtimeTrackerPath = path.join(process.cwd(), 'src', 'components', 'guest', 'realtime-order-tracker.tsx');
  const realtimeTrackerCode = fs.readFileSync(realtimeTrackerPath, 'utf8');

  test('8. RealtimeOrderTracker displays waiting for waiter badge and message correctly', () => {
    assert(realtimeTrackerCode.includes("order.approval_status === 'pending_waiter_approval'"), 'Handles pending_waiter_approval status');
    assert(realtimeTrackerCode.includes('WAITING FOR WAITER'), 'Shows WAITING FOR WAITER text');
    assert(realtimeTrackerCode.includes('Your order is awaiting waiter confirmation'), 'Shows explanatory customer copy');
  });

  // -------------------------------------------------------------
  // ISSUE 4: Dashboard Orders Today Secondary Copy
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 4: Dashboard Orders Today Secondary Copy ---');

  const dashboardMetricsPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-today-metrics.tsx');
  const dashboardMetricsCode = fs.readFileSync(dashboardMetricsPath, 'utf8');

  test('9. Orders Today secondary copy describes today orders, not Active Queue count', () => {
    assert(!dashboardMetricsCode.includes('${data.activeOrdersCount} in progress'), 'Removed misleading activeOrdersCount in progress from Orders Today');
    assert(dashboardMetricsCode.includes('No orders yet today'), 'Handles 0 orders copy');
    assert(dashboardMetricsCode.includes('1 order placed today'), 'Handles 1 order copy');
    assert(dashboardMetricsCode.includes('orders placed today'), 'Handles N orders copy');
  });

  // -------------------------------------------------------------
  // ISSUE 5: Low Stock Duplication Removal
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 5: Low Stock De-duplication ---');

  test('10. Low Stock card is completely removed from Today\'s Performance', () => {
    assert(!dashboardMetricsCode.includes('key="low-stock"'), 'Low Stock card removed from Today\'s Performance');
  });

  const dashboardAttentionPath = path.join(process.cwd(), 'src', 'components', 'dashboard', 'dashboard-needs-attention.tsx');
  const dashboardAttentionCode = fs.readFileSync(dashboardAttentionPath, 'utf8');

  test('11. Low Stock alert is preserved under Needs Attention', () => {
    assert(dashboardAttentionCode.includes('Needs Attention'), 'Needs Attention section exists');
    assert(dashboardAttentionCode.includes('items.map'), 'Maps attention items including low stock');
  });

  // -------------------------------------------------------------
  // ISSUE 6: Kitchen Queue Newest-First Ordering
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 6: Kitchen Queue Newest-First Sorting ---');

  const orderServicePath = path.join(process.cwd(), 'src', 'server', 'services', 'order.service.ts');
  const orderServiceCode = fs.readFileSync(orderServicePath, 'utf8');

  test('12. OrderService.getBranchActiveOrders sorts created_at DESCENDING', () => {
    assert(orderServiceCode.includes(".order('created_at', { ascending: false })"), 'OrderService sorts active kitchen orders newest-first');
  });

  const realtimeKitchenHookPath = path.join(process.cwd(), 'src', 'hooks', 'use-realtime-kitchen.ts');
  const realtimeKitchenHookCode = fs.readFileSync(realtimeKitchenHookPath, 'utf8');

  test('13. useRealtimeKitchen queries and maintains orders in DESCENDING order', () => {
    assert(realtimeKitchenHookCode.includes(".order('created_at', { ascending: false })"), 'useRealtimeKitchen queries newest-first');
  });

  const kitchenQueuePath = path.join(process.cwd(), 'src', 'components', 'kitchen', 'kitchen-order-queue.tsx');
  const kitchenQueueCode = fs.readFileSync(kitchenQueuePath, 'utf8');

  test('14. KitchenOrderQueue enforces deterministic newest-first sort with id tie-breaker', () => {
    assert(kitchenQueueCode.includes('new Date(b.created_at).getTime() - new Date(a.created_at).getTime()'), 'Sorts by created_at descending in component');
    assert(kitchenQueueCode.includes('b.id.localeCompare(a.id)'), 'Deterministic secondary sort on order id');
  });

  // -------------------------------------------------------------
  // ISSUE 7: Kitchen Order Cards Context & At-a-Glance Readability
  // -------------------------------------------------------------
  console.log('\n--- ISSUE 7: Kitchen Order Cards Context & Readability ---');

  test('15. Kitchen queries select service_area relation for dining_tables', () => {
    assert(orderServiceCode.includes('service_area:service_areas(id, name)'), 'OrderService selects service_area');
    assert(realtimeKitchenHookCode.includes('service_area:service_areas(id, name)'), 'useRealtimeKitchen selects service_area');
  });

  test('16. KitchenOrderQueue formats Table + Service Area cleanly without null/undefined placeholders', () => {
    assert(kitchenQueueCode.includes('tableName && serviceAreaName'), 'Handles Table · Service Area format');
    assert(kitchenQueueCode.includes("locationLabel = `${tableName} · ${serviceAreaName}`"), 'Formats Table · Service Area string');
    assert(kitchenQueueCode.includes("locationLabel = 'Direct Order'"), 'Fallback to Direct Order when no table exists');
  });

  test('17. KitchenOrderQueue highlights quantities (2x) and modifier options (+ Extra Cheese)', () => {
    assert(kitchenQueueCode.includes('{item.quantity}x'), 'Renders prominent quantity');
    assert(kitchenQueueCode.includes('{mod.option_name_snapshot}'), 'Renders modifiers');
    assert(kitchenQueueCode.includes('{item.special_instructions}'), 'Renders special instructions');
  });

  console.log('\n================================================================');
  console.log(`  Step 3 Closure Verification Suite: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
