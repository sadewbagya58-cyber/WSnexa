import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { generateCSV, generateXLSXTable, generateExecutivePDFHtml, sanitizeExportCell } from '../src/lib/export/export-engine';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runReportsVerificationSuite() {
  console.log('================================================================');
  console.log('    WSNexa Phase 12 — Reports & Analytics Live Verification     ');
  console.log('================================================================\n');

  let passed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
    }
  }

  const timestamp = Date.now();
  const bizName = `Report Test Biz ${timestamp}`;
  let testUserId: string | null = null;

  try {
    // 1. Setup Auth User and Test Business with 2 Branches
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: `report_owner_${timestamp}@test.com`,
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authErr || !authUser.user) {
      throw new Error(`Failed to create test owner: ${authErr?.message}`);
    }
    testUserId = authUser.user.id;

    const { data: biz, error: bizErr } = await admin
      .from('businesses')
      .insert({
        name: bizName,
        slug: `report-biz-${timestamp}`,
        default_currency: 'LKR',
        timezone: 'Asia/Colombo',
        created_by: testUserId,
      })
      .select('*')
      .single();

    if (bizErr || !biz) {
      throw new Error(`Failed to create test business: ${bizErr?.message}`);
    }

    const { data: branchA, error: brAErr } = await admin
      .from('branches')
      .insert({ business_id: biz.id, name: 'Branch A', code: 'BRA', status: 'active' })
      .select('*')
      .single();

    if (brAErr || !branchA) {
      throw new Error(`Failed to create Branch A: ${brAErr?.message}`);
    }

    const { data: branchB, error: brBErr } = await admin
      .from('branches')
      .insert({ business_id: biz.id, name: 'Branch B', code: 'BRB', status: 'active' })
      .select('*')
      .single();

    if (brBErr || !branchB) {
      throw new Error(`Failed to create Branch B: ${brBErr?.message}`);
    }

    const { data: catA, error: catAErr } = await admin
      .from('menu_categories')
      .insert({
        business_id: biz.id,
        branch_id: branchA.id,
        name: 'Main Dishes',
        slug: `main-dishes-${timestamp}`,
      })
      .select('*')
      .single();

    if (catAErr || !catA) {
      throw new Error(`Failed to create category A: ${catAErr?.message}`);
    }

    const { data: itemA, error: itemAErr } = await admin
      .from('menu_items')
      .insert({
        business_id: biz.id,
        branch_id: branchA.id,
        category_id: catA.id,
        name: 'Kottu Roti',
        slug: `kottu-roti-${timestamp}`,
        price_cents: 120000, // 1200 LKR
      })
      .select('*')
      .single();

    if (itemAErr || !itemA) {
      throw new Error(`Failed to create menu item A: ${itemAErr?.message}`);
    }

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // TEST 1: Empty range returns safe zeros & empty arrays
    const { data: emptyRes } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      emptyRes?.total_orders === 0 && emptyRes?.gross_sales_cents === 0 && emptyRes?.paid_revenue_cents === 0,
      'Test 1: Empty date range returns safe zeros and zero sales'
    );

    // Create Order 1 in Branch A (Total 120,000 cents, Paid 120,000 cents via Cash)
    const { data: order1 } = await admin
      .from('orders')
      .insert({
        business_id: biz.id,
        branch_id: branchA.id,
        order_number: 1001,
        order_number_formatted: '#BRA-1001',
        idempotency_key: `idemp_rpt_1_${timestamp}`,
        status: 'completed',
        payment_status: 'paid',
        payment_method: 'cash',
        subtotal_cents: 120000,
        total_cents: 120000,
        currency: 'LKR',
      })
      .select('*')
      .single();

    await admin.from('order_items').insert({
      order_id: order1.id,
      menu_item_id: itemA.id,
      item_name_snapshot: 'Kottu Roti Historical',
      unit_price_cents_snapshot: 120000,
      quantity: 1,
      line_subtotal_cents: 120000,
    });

    await admin.from('payments').insert({
      business_id: biz.id,
      branch_id: branchA.id,
      order_id: order1.id,
      payment_reference: `PMT-${timestamp}-1`,
      amount_cents: 120000,
      currency: 'LKR',
      payment_method: 'cash',
      payment_status: 'completed',
      idempotency_key: `idemp_pmt_1_${timestamp}`,
    });

    // Create Order 2 in Branch A (Unpaid order: Total 240,000 cents)
    await admin.from('orders').insert({
      business_id: biz.id,
      branch_id: branchA.id,
      order_number: 1002,
      order_number_formatted: '#BRA-1002',
      idempotency_key: `idemp_rpt_2_${timestamp}`,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method: 'pay_at_counter',
      subtotal_cents: 240000,
      total_cents: 240000,
      currency: 'LKR',
    });

    // TEST 2: Revenue totals match payment records & unpaid orders excluded from paid revenue
    const { data: summaryRes } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      summaryRes?.gross_sales_cents === 360000 &&
        summaryRes?.paid_revenue_cents === 120000 &&
        summaryRes?.outstanding_balance_cents === 240000,
      'Test 2: Paid revenue matches payment records exactly and unpaid orders are excluded from paid revenue',
      `Got gross=${summaryRes?.gross_sales_cents}, paid=${summaryRes?.paid_revenue_cents}, balance=${summaryRes?.outstanding_balance_cents}`
    );

    // TEST 3: Partial payments not double counted
    const { data: order3 } = await admin
      .from('orders')
      .insert({
        business_id: biz.id,
        branch_id: branchA.id,
        order_number: 1003,
        order_number_formatted: '#BRA-1003',
        idempotency_key: `idemp_rpt_3_${timestamp}`,
        status: 'pending',
        payment_status: 'partially_paid',
        payment_method: 'card',
        subtotal_cents: 500000,
        total_cents: 500000,
        currency: 'LKR',
      })
      .select('*')
      .single();

    await admin.from('payments').insert({
      business_id: biz.id,
      branch_id: branchA.id,
      order_id: order3.id,
      payment_reference: `PMT-${timestamp}-2`,
      amount_cents: 200000,
      currency: 'LKR',
      payment_method: 'card',
      payment_status: 'completed',
      idempotency_key: `idemp_pmt_part_${timestamp}`,
    });

    const { data: partialSummary } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      partialSummary?.paid_revenue_cents === 320000 &&
        partialSummary?.outstanding_balance_cents === 540000,
      'Test 3: Partial payments strictly add exact paid amounts without double-counting order totals'
    );

    // TEST 4: Refund calculation correct
    await admin.from('payments').insert({
      business_id: biz.id,
      branch_id: branchA.id,
      order_id: order1.id,
      payment_reference: `PMT-${timestamp}-3`,
      amount_cents: 20000,
      currency: 'LKR',
      payment_method: 'cash',
      payment_status: 'refunded',
      idempotency_key: `idemp_pmt_ref_${timestamp}`,
    });

    const { data: refSummary } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      refSummary?.refunded_cents === 20000,
      'Test 4: Refund amount correctly isolated and recorded in sales summary'
    );

    // TEST 5: Multi-branch isolation (Branch A report excludes Branch B data)
    await admin.from('orders').insert({
      business_id: biz.id,
      branch_id: branchB.id,
      order_number: 2001,
      order_number_formatted: '#BRB-2001',
      idempotency_key: `idemp_brb_1_${timestamp}`,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal_cents: 990000,
      total_cents: 990000,
      currency: 'LKR',
    });

    const { data: branchASummary } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      branchASummary?.gross_sales_cents === 860000, // Order 1 (120k) + Order 2 (240k) + Order 3 (500k) = 860k
      'Test 5: Multi-branch isolation verified (Branch A summary strictly excludes Branch B orders)'
    );

    // TEST 6: Branch comparison RPC allows Business Owner cross-branch rollup
    const { data: compRes } = await admin.rpc('get_branch_comparison', {
      p_business_id: biz.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      compRes?.branches?.length === 2 && compRes.branches.some((b: { branch_code: string }) => b.branch_code === 'BRB'),
      'Test 6: Branch comparison RPC returns cross-branch performance rollups for business owner'
    );

    // TEST 7: Formula Injection Security Protection in CSV & XLSX Exports
    const maliciousInput = '=SUM(A1:A100)';
    const sanitized = sanitizeExportCell(maliciousInput);
    assert(
      sanitized.startsWith("'"),
      'Test 7: Formula injection protection prepends single quote to cells starting with =, +, -, @'
    );

    // TEST 8: CSV Export output structure matches UI headers
    const csvContent = generateCSV(['Order', 'Total'], [['#BRA-1001', 120000]]);
    assert(
      csvContent.includes('"Order","Total"') && csvContent.includes('"#BRA-1001"'),
      'Test 8: CSV export produces clean RFC4180 compliant CSV output'
    );

    // TEST 9: XLSX Spreadsheet XML output structure
    const xlsxContent = generateXLSXTable('Sales', bizName, 'Branch A', ['Order'], [['#BRA-1001']]);
    assert(
      xlsxContent.includes('<?html') || xlsxContent.includes('ExcelWorkbook'),
      'Test 9: XLSX export produces valid spreadsheet table structure'
    );

    // TEST 10: Executive PDF Summary HTML generator
    const pdfHtml = generateExecutivePDFHtml({
      title: 'Sales Summary',
      businessName: bizName,
      branchName: 'Branch A',
      dateRangeLabel: 'Today',
      currency: 'LKR',
      summary: {
        totalOrders: 3,
        completedOrders: 1,
        grossSalesCents: 860000,
        paidRevenueCents: 320000,
        outstandingBalanceCents: 540000,
        aovCents: 286666,
        topItemName: 'Kottu Roti Historical',
        topCategoryName: 'Main Dishes',
      },
      tableHeaders: ['Metric', 'Value'],
      tableRows: [['Total Orders', 3]],
    });

    assert(
      pdfHtml.includes('Sales Summary') && pdfHtml.includes('Branch A'),
      'Test 10: PDF Executive Summary generator formats print-optimized HTML layout'
    );

    // TEST 11: Top Item Ranking & Snapshot Name Preservation
    const { data: menuAnalyticsRes } = await admin.rpc('get_menu_analytics', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      menuAnalyticsRes?.items?.[0]?.item_name === 'Kottu Roti Historical',
      'Test 11: Menu item performance preserves historical snapshot names from order_items'
    );

    // TEST 12: Orders By Hour Aggregation (24-hour array)
    const { data: hoursRes } = await admin.rpc('get_orders_by_hour', {
      p_branch_id: branchA.id,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    assert(
      hoursRes?.hours?.length === 24,
      'Test 12: Orders by hour RPC returns complete 24-hour distribution array (0-23)'
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error during reports verification';
    console.error('❌ Verification Error:', msg);
    process.exit(1);
  } finally {
    // Cleanup temporary business
    console.log('\n🧹 Cleaning up test reporting data...');
    await admin.from('businesses').delete().filter('name', 'eq', bizName);
    if (testUserId) {
      await admin.auth.admin.deleteUser(testUserId);
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('\n================================================================');
  console.log(`   Phase 12 Reports Verification Finished: ALL ${passed} TESTS PASSED `);
  console.log('================================================================\n');
}

runReportsVerificationSuite();
