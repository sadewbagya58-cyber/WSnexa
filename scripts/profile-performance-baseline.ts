// Bypass server-only guard for tsx execution
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

import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local safely BEFORE importing server modules
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

export interface PerformanceMeasurement {
  flow: string;
  operation: string;
  durationMs: number;
  dbQueriesEstimated: number;
  status: 'SUCCESS' | 'FAIL';
  details?: Record<string, unknown>;
}

async function benchmark() {
  console.log('================================================================');
  console.log('   WSNEXA — P0 APP-WIDE PERFORMANCE & RESPONSIVENESS BASELINE   ');
  console.log('================================================================\n');

  const { createAdminClient } = await import('../src/lib/supabase/server');
  const { resolveAuthorizationContext } = await import('../src/server/auth/authorization-context');
  const { can } = await import('../src/server/auth/policy-engine');
  const { QrService } = await import('../src/server/services/qr.service');
  const { OrderService } = await import('../src/server/services/order.service');
  const { PaymentService } = await import('../src/server/services/payment.service');
  const { WaiterService } = await import('../src/server/services/waiter.service');
  const { OrganizationService } = await import('../src/server/services/organization.service');

  const adminClient = createAdminClient();
  const measurements: PerformanceMeasurement[] = [];

  const timestamp = Date.now();
  const testBusinessName = `Perf Test Biz ${timestamp}`;
  const testSlug = `perf-biz-${timestamp}`;

  // 1. Setup Test Tenant
  console.log('--- Setting Up Profiling Test Tenant ---');
  const { data: userAuth, error: authErr } = await adminClient.auth.admin.createUser({
    email: `owner_${timestamp}@wsnexa.test`,
    password: 'Password123!Secure',
    email_confirm: true,
  });
  if (authErr || !userAuth.user) throw new Error(`Failed to create owner user: ${authErr?.message}`);
  const ownerUserId = userAuth.user.id;

  const { data: waiterAuth } = await adminClient.auth.admin.createUser({
    email: `waiter_${timestamp}@wsnexa.test`,
    password: 'Password123!Secure',
    email_confirm: true,
  });
  const waiterUserId = waiterAuth!.user!.id;

  await adminClient.from('user_profiles').insert([
    { id: ownerUserId, email: `owner_${timestamp}@wsnexa.test`, first_name: 'Perf', last_name: 'Owner' },
    { id: waiterUserId, email: `waiter_${timestamp}@wsnexa.test`, first_name: 'Fast', last_name: 'Waiter' },
  ]);

  const { data: business, error: bizErr } = await adminClient
    .from('businesses')
    .insert({
      name: testBusinessName,
      slug: testSlug,
      default_currency: 'LKR',
      country_code: 'LK',
      status: 'active',
      created_by: ownerUserId,
    })
    .select()
    .single();

  if (bizErr || !business) {
    throw new Error(`Failed to create test business: ${bizErr?.message}`);
  }

  const businessId = business.id;

  const { data: branch, error: brErr } = await adminClient
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Colombo Flagship',
      code: 'CMB01',
      status: 'active',
      is_default: true,
      country_code: 'LK',
    })
    .select()
    .single();

  if (brErr || !branch) {
    throw new Error(`Failed to create test branch: ${brErr?.message}`);
  }

  const branchId = branch.id;

  await adminClient.from('business_memberships').insert([
    { business_id: businessId, user_id: ownerUserId, role: 'business_owner', membership_status: 'active' },
    { business_id: businessId, user_id: waiterUserId, role: 'waiter', membership_status: 'active' },
  ]);

  // Seed Hierarchy & Job Title
  await OrganizationService.seedDefaultHierarchyLevels(businessId);

  // Create Service Area & Dining Table
  const { data: area } = await adminClient
    .from('service_areas')
    .insert({ business_id: businessId, branch_id: branchId, name: 'Main Dining', code: 'MAIN', is_active: true })
    .select()
    .single();

  const { data: table, error: tblErr } = await adminClient
    .from('dining_tables')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      service_area_id: area!.id,
      name: 'Table 1',
      code: 'T01',
      table_number: 1,
      capacity: 4,
      status: 'available',
      is_active: true,
    })
    .select()
    .single();

  if (tblErr || !table) {
    throw new Error(`Failed to create test table: ${tblErr?.message}`);
  }

  // Create Menu Category & Items
  const { data: category } = await adminClient
    .from('menu_categories')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      name: 'Main Dishes',
      slug: `main-dishes-${timestamp}`,
      display_order: 1,
      is_active: true,
    })
    .select()
    .single();

  const { data: menuItem, error: miErr } = await adminClient
    .from('menu_items')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      category_id: category!.id,
      name: 'Kottu Roti Special',
      slug: `kottu-roti-${timestamp}`,
      price_cents: 120000,
      currency: 'LKR',
      is_active: true,
      availability_status: 'available',
      display_order: 1,
    })
    .select()
    .single();

  if (miErr || !menuItem) {
    throw new Error(`Failed to create menu item: ${miErr?.message}`);
  }

  // Generate QR Token
  await adminClient
    .from('branch_qr_codes')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      qr_type: 'branch',
      is_active: true,
      token_hash: `token_perf_${timestamp}`,
    })
    .select()
    .single();

  console.log('✓ Profiling context initialized successfully.\n');

  // ==========================================
  // Benchmark 1: Auth & RBAC Context Resolution
  // ==========================================
  console.log('--- Profiling Flow A: Auth & RBAC Context Resolution ---');
  const t0 = performance.now();
  const authContext = await resolveAuthorizationContext({
    overrideUserId: ownerUserId,
    requestedBusinessId: businessId,
  });
  const t1 = performance.now();
  const authDuration = t1 - t0;
  console.log(`[Flow A] resolveAuthorizationContext (Owner): ${authDuration.toFixed(2)} ms`);
  measurements.push({
    flow: 'Auth & RBAC',
    operation: 'resolveAuthorizationContext (Owner)',
    durationMs: authDuration,
    dbQueriesEstimated: 12,
    status: 'SUCCESS',
  });

  const t0_can = performance.now();
  await can({
    context: authContext,
    permission: 'menu.manage',
    resource: { type: 'branch', id: branchId },
  });
  const t1_can = performance.now();
  console.log(`[Flow A] Policy Engine can() evaluation: ${(t1_can - t0_can).toFixed(2)} ms`);
  measurements.push({
    flow: 'Auth & RBAC',
    operation: 'Policy Engine can() check',
    durationMs: t1_can - t0_can,
    dbQueriesEstimated: 0,
    status: 'SUCCESS',
  });

  // ==========================================
  // Benchmark 2: Public QR Menu Resolution
  // ==========================================
  console.log('\n--- Profiling Flow H: Public QR Menu Resolution ---');
  const t0_qr = performance.now();
  await QrService.resolvePublicBranchMenuByToken(`token_perf_${timestamp}`);
  const t1_qr = performance.now();
  const qrDuration = t1_qr - t0_qr;
  console.log(`[Flow H] resolvePublicBranchMenuByToken: ${qrDuration.toFixed(2)} ms`);
  measurements.push({
    flow: 'Public QR Menu',
    operation: 'resolvePublicBranchMenuByToken',
    durationMs: qrDuration,
    dbQueriesEstimated: 5,
    status: 'SUCCESS',
  });

  // ==========================================
  // Benchmark 3: Waiter Assistance State Machine
  // ==========================================
  console.log('\n--- Profiling Flow C: Waiter Assistance & Approvals ---');
  const t0_req = performance.now();
  const { data: reqData, error: reqErr } = await adminClient
    .from('waiter_requests')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      table_id: table!.id,
      request_type: 'call_waiter',
      status: 'pending',
      notes: 'Urgent water refill',
    })
    .select()
    .single();

  if (reqErr || !reqData) {
    throw new Error(`Failed to insert waiter request: ${reqErr?.message}`);
  }

  const t1_req = performance.now();
  console.log(`[Flow C] insert waiter_request (Guest): ${(t1_req - t0_req).toFixed(2)} ms`);
  measurements.push({
    flow: 'Waiter Workspace',
    operation: 'insert waiter_request',
    durationMs: t1_req - t0_req,
    dbQueriesEstimated: 1,
    status: 'SUCCESS',
  });

  const t0_accept = performance.now();
  await WaiterService.updateWaiterRequestStatus(reqData!.id, 'accepted');
  const t1_accept = performance.now();
  console.log(`[Flow C] updateWaiterRequestStatus -> accepted: ${(t1_accept - t0_accept).toFixed(2)} ms`);
  measurements.push({
    flow: 'Waiter Workspace',
    operation: 'updateWaiterRequestStatus (Accept)',
    durationMs: t1_accept - t0_accept,
    dbQueriesEstimated: 2,
    status: 'SUCCESS',
  });

  const t0_comp = performance.now();
  await WaiterService.updateWaiterRequestStatus(reqData!.id, 'completed');
  const t1_comp = performance.now();
  console.log(`[Flow C] updateWaiterRequestStatus -> completed: ${(t1_comp - t0_comp).toFixed(2)} ms`);
  measurements.push({
    flow: 'Waiter Workspace',
    operation: 'updateWaiterRequestStatus (Complete)',
    durationMs: t1_comp - t0_comp,
    dbQueriesEstimated: 2,
    status: 'SUCCESS',
  });

  // ==========================================
  // Benchmark 4: Kitchen Order Pipeline
  // ==========================================
  console.log('\n--- Profiling Flow D: Kitchen Order Pipeline ---');
  const { data: order, error: ordErr } = await adminClient
    .from('orders')
    .insert({
      business_id: businessId,
      branch_id: branchId,
      table_id: table.id,
      order_number: 101,
      order_number_formatted: 'ORD-101',
      idempotency_key: `idemp_${timestamp}`,
      access_token: `token_${timestamp}`,
      subtotal_cents: 120000,
      total_cents: 120000,
      currency: 'LKR',
      status: 'confirmed',
      payment_status: 'unpaid',
      payment_method: 'pay_at_counter',
    })
    .select()
    .single();

  if (ordErr || !order) {
    throw new Error(`Failed to insert order: ${ordErr?.message}`);
  }

  await adminClient.from('order_items').insert({
    order_id: order.id,
    menu_item_id: menuItem.id,
    item_name_snapshot: 'Kottu Roti Special',
    unit_price_cents_snapshot: 120000,
    quantity: 1,
    line_subtotal_cents: 120000,
  });

  const t0_prep = performance.now();
  await OrderService.updateOrderStatus(order!.id, 'preparing');
  const t1_prep = performance.now();
  console.log(`[Flow D] updateOrderStatus -> preparing: ${(t1_prep - t0_prep).toFixed(2)} ms`);
  measurements.push({
    flow: 'Kitchen Workspace',
    operation: 'updateOrderStatus (Start Preparing)',
    durationMs: t1_prep - t0_prep,
    dbQueriesEstimated: 4,
    status: 'SUCCESS',
  });

  const t0_ready = performance.now();
  await OrderService.updateOrderStatus(order!.id, 'ready');
  const t1_ready = performance.now();
  console.log(`[Flow D] updateOrderStatus -> ready: ${(t1_ready - t0_ready).toFixed(2)} ms`);
  measurements.push({
    flow: 'Kitchen Workspace',
    operation: 'updateOrderStatus (Mark Ready)',
    durationMs: t1_ready - t0_ready,
    dbQueriesEstimated: 4,
    status: 'SUCCESS',
  });

  // ==========================================
  // Benchmark 5: Cashier Order Load & Settlement
  // ==========================================
  console.log('\n--- Profiling Flow E: Cashier & POS Operations ---');
  const t0_pos = performance.now();
  const cashierAuth = await resolveAuthorizationContext({
    overrideUserId: ownerUserId,
    requestedBusinessId: businessId,
  });
  const t1_pos = performance.now();
  const posLoadDuration = t1_pos - t0_pos;
  console.log(`[Flow E] POS Context Load: ${posLoadDuration.toFixed(2)} ms`);
  measurements.push({
    flow: 'Cashier / POS',
    operation: 'POS Context Load',
    durationMs: posLoadDuration,
    dbQueriesEstimated: 12,
    status: 'SUCCESS',
  });

  const t0_pay = performance.now();
  await adminClient.from('payments').insert({
    business_id: businessId,
    branch_id: branchId,
    order_id: order!.id,
    payment_reference: `RCP-${timestamp}`,
    idempotency_key: `idemp_pay_${timestamp}`,
    amount_cents: 120000,
    currency: 'LKR',
    payment_method: 'cash',
    payment_status: 'completed',
    received_by: waiterUserId,
  });
  const t1_pay = performance.now();
  console.log(`[Flow E] recordPayment: ${(t1_pay - t0_pay).toFixed(2)} ms`);
  measurements.push({
    flow: 'Cashier / POS',
    operation: 'recordPayment (Direct POS)',
    durationMs: t1_pay - t0_pay,
    dbQueriesEstimated: 1,
    status: 'SUCCESS',
  });

  // ==========================================
  // Cleanup Test Data
  // ==========================================
  console.log('\n--- Cleaning Up Profiling Data ---');
  await adminClient.from('businesses').delete().eq('id', businessId);
  await adminClient.auth.admin.deleteUser(ownerUserId);
  await adminClient.auth.admin.deleteUser(waiterUserId);
  console.log('Cleanup completed.\n');

  console.log('================================================================');
  console.log('   PERFORMANCE BASELINE MEASUREMENT MATRIX SUMMARY             ');
  console.log('================================================================');
  console.table(measurements);

  return measurements;
}

benchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
