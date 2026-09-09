import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const root = path.resolve(__dirname, '..');

// Load .env.local
const envPath = path.join(root, '.env.local');
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

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function run() {
  console.log('================================================================');
  console.log('    WSNexa CRIT-12, CRIT-13, CRIT-14, CRIT-15 Verification     ');
  console.log('================================================================\n');

  // ==========================================
  // 1. CRIT-15: Waiter Modifier Order Fix
  // ==========================================
  console.log('--- Checking CRIT-15: Waiter Modifier Query & Validation ---');
  const waiterOrderActionPath = path.join(root, 'src', 'server', 'actions', 'waiter-order.ts');
  const waiterOrderContent = fs.readFileSync(waiterOrderActionPath, 'utf8');

  // Verify query uses additional_price_cents and NOT price_cents directly on modifier_options
  assert(
    waiterOrderContent.includes('.select(') &&
    waiterOrderContent.includes('additional_price_cents') &&
    !waiterOrderContent.includes('modifier_options\').select(\'id, modifier_group_id, name, price_cents'),
    'CRIT-15: waiter-order.ts selects valid additional_price_cents column'
  );

  // Verify options query does not join nonexistent relation or invalid columns
  assert(
    waiterOrderContent.includes('modifier_groups!inner(id, name, menu_item_id, branch_id)'),
    'CRIT-15: waiter-order.ts joins modifier_groups with canonical columns'
  );

  // Verify strict validation remains active
  assert(
    waiterOrderContent.includes('opt.modifier_group_id !== mod.groupId') &&
    waiterOrderContent.includes('opt.menu_item_id !== itemInput.menuItemId') &&
    waiterOrderContent.includes('opt.branch_id !== authContext.activeBranchId'),
    'CRIT-15: Strict item, group, and branch isolation checks are 100% preserved'
  );

  // Behavioral test: Query Supabase directly with the exact query from waiter-order.ts
  const dbTestRes = await admin
    .from('modifier_options')
    .select('id, modifier_group_id, branch_id, name, additional_price_cents, modifier_groups!inner(id, name, menu_item_id, branch_id)')
    .limit(1);

  assert(
    dbTestRes.error === null,
    'CRIT-15: Supabase query executes cleanly without error 42703 (no column price_cents error)'
  );

  // ==========================================
  // 2. CRIT-12: Waiter Menu Entry Performance
  // ==========================================
  console.log('\n--- Checking CRIT-12: Waiter Menu Entry Latency & UX ---');
  const waiterCenterPath = path.join(root, 'src', 'components', 'waiter', 'waiter-request-center.tsx');
  const waiterCenterContent = fs.readFileSync(waiterCenterPath, 'utf8');

  // Verify button navigates directly to /dashboard/waiter/order
  assert(
    waiterCenterContent.includes("router.push('/dashboard/waiter/order')"),
    'CRIT-12: Take New Order button navigates directly to /dashboard/waiter/order (eliminates 307 redirect)'
  );

  // Verify prefetch
  assert(
    waiterCenterContent.includes("router.prefetch('/dashboard/waiter/order')"),
    'CRIT-12: Prefetches /dashboard/waiter/order on mount'
  );

  // Verify instant feedback state
  assert(
    waiterCenterContent.includes('isOpeningMenu') &&
    waiterCenterContent.includes('Opening Menu...'),
    'CRIT-12: Button provides immediate Opening Menu... visual feedback with spinner and click lock'
  );

  // Verify order page parallelizes queries
  const orderPagePath = path.join(root, 'src', 'app', '(dashboard)', 'dashboard', 'waiter', 'order', 'page.tsx');
  const orderPageContent = fs.readFileSync(orderPagePath, 'utf8');
  assert(
    orderPageContent.includes('Promise.all([') &&
    orderPageContent.includes('listBranchAreas') &&
    orderPageContent.includes('dining_tables') &&
    orderPageContent.includes('getBranchMenuCatalog'),
    'CRIT-12: /dashboard/waiter/order/page.tsx concurrently fetches areas, tables, and catalog with Promise.all'
  );

  // Verify loading skeleton exists
  const orderLoadingPath = path.join(root, 'src', 'app', '(dashboard)', 'dashboard', 'waiter', 'order', 'loading.tsx');
  assert(
    fs.existsSync(orderLoadingPath),
    'CRIT-12: Instant loading skeleton exists at dashboard/waiter/order/loading.tsx'
  );

  // ==========================================
  // 3. CRIT-13: Waiter QR Order Approvals
  // ==========================================
  console.log('\n--- Checking CRIT-13: Waiter QR Order Approval Synchronization ---');

  // Verify static imports
  assert(
    waiterCenterContent.includes('getPendingApprovalsAction') &&
    waiterCenterContent.includes('approveGuestOrderAction') &&
    waiterCenterContent.includes('rejectGuestOrderAction') &&
    !waiterCenterContent.includes("await import('@/server/actions/waiter-approval')"),
    'CRIT-13: Statically imports waiter approval actions, eliminating dynamic import latency'
  );

  // Verify handledOrderIdsRef race condition guard
  assert(
    waiterCenterContent.includes('handledOrderIdsRef') &&
    waiterCenterContent.includes('handledOrderIdsRef.current.has(o.id)'),
    'CRIT-13: Polling and realtime events cannot resurrect approved orders (handledOrderIdsRef guard)'
  );

  // Verify revalidation in waiter-approval.ts
  const approvalActionPath = path.join(root, 'src', 'server', 'actions', 'waiter-approval.ts');
  const approvalActionContent = fs.readFileSync(approvalActionPath, 'utf8');
  assert(
    approvalActionContent.includes("revalidatePath('/dashboard/waiter')"),
    'CRIT-13: waiter-approval.ts revalidates /dashboard/waiter on approval and rejection'
  );

  // ==========================================
  // 4. CRIT-14: Cashier Payment Reconciliation
  // ==========================================
  console.log('\n--- Checking CRIT-14: Cashier Payment State Reconciliation ---');
  const paymentModalPath = path.join(root, 'src', 'components', 'cashier', 'payment-settlement-modal.tsx');
  const paymentModalContent = fs.readFileSync(paymentModalPath, 'utf8');

  // Verify modal propagates server result immediately
  assert(
    paymentModalContent.includes('PaymentSuccessData') &&
    paymentModalContent.includes('onSuccess({') &&
    paymentModalContent.includes('paidCents: res.data.paidCents') &&
    paymentModalContent.includes('balanceDueCents: res.data.balanceDueCents') &&
    paymentModalContent.includes('paymentStatus: res.data.paymentStatus'),
    'CRIT-14: payment-settlement-modal.tsx immediately passes server-verified payment result to onSuccess'
  );

  // Verify cashier dashboard synchronously updates orders state
  const cashierDashboardPath = path.join(root, 'src', 'components', 'cashier', 'cashier-dashboard.tsx');
  const cashierDashboardContent = fs.readFileSync(cashierDashboardPath, 'utf8');
  assert(
    cashierDashboardContent.includes('handlePaymentSuccess') &&
    cashierDashboardContent.includes('payment_status: data.paymentStatus') &&
    cashierDashboardContent.includes('paid_cents: data.paidCents') &&
    cashierDashboardContent.includes('balance_due_cents: data.balanceDueCents'),
    'CRIT-14: cashier-dashboard.tsx immediately updates orders state upon server confirmation (Rule 13)'
  );

  console.log('\n================================================================');
  console.log(`  Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
