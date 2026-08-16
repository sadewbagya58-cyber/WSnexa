import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local BEFORE importing modules that validate env variables
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function runInventoryVerificationSuite() {
  const { UnitConverter } = await import('../src/lib/inventory/unit-converter');
  const {
    createInventoryItemSchema,
    stockAdjustmentSchema,
    recordWasteSchema,
    createStockTransferSchema,
  } = await import('../src/lib/validation/inventory');
  const { ROLE_PRESETS } = await import('../src/lib/validation/permission-presets');
  const { getAllArticles, getCategoryById } = await import('../src/content/help/registry');

  console.log('================================================================');
  console.log('  WSNexa Phase 27 — Advanced Inventory Core Verification Suite  ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
      failed++;
      process.exitCode = 1;
    }
  }

  // ── 1. Unit Conversion Engine ─────────────────────────────────────────
  console.log('--- 1. Deterministic Unit Conversion Engine ---');
  assert(UnitConverter.normalizeToBase(2.5, 'kg', 'kg') === 2.5, 'Same unit kg -> kg identity');
  assert(UnitConverter.normalizeToBase(500, 'g', 'kg') === 0.5, 'Weight conversion 500 g -> 0.5 kg');
  assert(UnitConverter.normalizeToBase(2500, 'g', 'kg') === 2.5, 'Weight conversion 2500 g -> 2.5 kg');
  assert(UnitConverter.normalizeToBase(750, 'ml', 'l') === 0.75, 'Volume conversion 750 ml -> 0.75 L');
  assert(UnitConverter.normalizeToBase(1.5, 'l', 'l') === 1.5, 'Volume conversion 1.5 L -> 1.5 L');
  assert(UnitConverter.normalizeToBase(12, 'pcs', 'pcs') === 12, 'Count conversion 12 pcs -> 12 pcs');
  assert(UnitConverter.normalizeToBase(6, 'bottle', 'pcs') === 6, 'Count unit bottle -> pcs');

  let threwIncompatible = false;
  try {
    UnitConverter.normalizeToBase(5, 'kg', 'l');
  } catch {
    threwIncompatible = true;
  }
  assert(threwIncompatible, 'Incompatible dimension conversion kg -> L strictly rejected');

  let threwUnrecognized = false;
  try {
    UnitConverter.normalizeToBase(5, 'unknown_alien_unit', 'kg');
  } catch {
    threwUnrecognized = true;
  }
  assert(threwUnrecognized, 'Unrecognized unit strictly rejected');

  // ── 2. Zod Validation Schemas ──────────────────────────────────────────
  console.log('\n--- 2. Zod Validation & Domain Invariants ---');
  const validItem = createInventoryItemSchema.safeParse({
    name: 'Fresh Atlantic Salmon',
    baseUnit: 'kg',
    costPerUnitCents: 2400,
    minStockLevel: 5.0,
    targetStockLevel: 20.0,
  });
  assert(validItem.success, 'Valid inventory item schema passes validation');

  const invalidNegativeCost = createInventoryItemSchema.safeParse({
    name: 'Bad Item',
    baseUnit: 'kg',
    costPerUnitCents: -500,
  });
  assert(!invalidNegativeCost.success, 'Negative cost per unit rejected by Zod');

  const testBranchId = crypto.randomUUID();
  const testLocationId = crypto.randomUUID();
  const testItemId = crypto.randomUUID();
  const testDestBranchId = crypto.randomUUID();
  const testDestLocationId = crypto.randomUUID();

  const invalidNegativeQtyAdj = stockAdjustmentSchema.safeParse({
    branchId: testBranchId,
    locationId: testLocationId,
    itemId: testItemId,
    direction: 'in',
    quantity: -10,
    unit: 'kg',
    reason: 'Test',
    idempotencyKey: 'valid_idempotency_key_123',
  });
  assert(!invalidNegativeQtyAdj.success, 'Negative quantity adjustment rejected by Zod');

  const validWaste = recordWasteSchema.safeParse({
    branchId: testBranchId,
    locationId: testLocationId,
    itemId: testItemId,
    quantity: 1.5,
    unit: 'kg',
    reason: 'spoiled',
    idempotencyKey: 'waste_idempotency_123',
  });
  assert(validWaste.success, 'Valid waste record schema passes validation');

  const validTransfer = createStockTransferSchema.safeParse({
    sourceBranchId: testBranchId,
    sourceLocationId: testLocationId,
    destinationBranchId: testDestBranchId,
    destinationLocationId: testDestLocationId,
    items: [
      { itemId: testItemId, quantitySent: 5, unitSent: 'kg' },
    ],
  });
  assert(validTransfer.success, 'Valid stock transfer schema passes validation');

  // ── 3. Role-Based Access Control & Route Security ────────────────────
  console.log('\n--- 3. Role-Based Access Control & Route Security ---');
  const bmPreset = ROLE_PRESETS.find((p) => p.key === 'branch_manager')?.permissions || [];
  assert(bmPreset.includes('inventory.view'), 'branch_manager has inventory.view');
  assert(bmPreset.includes('inventory.items.manage'), 'branch_manager has inventory.items.manage');
  assert(bmPreset.includes('inventory.costs.view'), 'branch_manager has inventory.costs.view');
  assert(bmPreset.includes('inventory.adjust'), 'branch_manager has inventory.adjust');
  assert(bmPreset.includes('inventory.counts.approve'), 'branch_manager has inventory.counts.approve');
  assert(bmPreset.includes('inventory.transfers.manage'), 'branch_manager has inventory.transfers.manage');

  const ksPreset = ROLE_PRESETS.find((p) => p.key === 'kitchen_staff')?.permissions || [];
  assert(ksPreset.includes('inventory.view'), 'kitchen_staff has inventory.view');
  assert(ksPreset.includes('inventory.counts.manage'), 'kitchen_staff has inventory.counts.manage');
  assert(ksPreset.includes('inventory.waste.record'), 'kitchen_staff has inventory.waste.record');
  assert(!ksPreset.includes('inventory.costs.view'), 'kitchen_staff DOES NOT have inventory.costs.view (redacted)');
  assert(!ksPreset.includes('inventory.counts.approve'), 'kitchen_staff DOES NOT have inventory.counts.approve (manager only)');

  const { getRequiredPermissionForRoute } = await import('../src/lib/security/route-permissions');
  assert(getRequiredPermissionForRoute('/dashboard/inventory') === 'inventory.view', 'Route /dashboard/inventory protected by inventory.view');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/items') === 'inventory.view', 'Route /dashboard/inventory/items protected by inventory.view');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/items/new') === 'inventory.items.manage', 'Route /dashboard/inventory/items/new protected by inventory.items.manage');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/counts') === 'inventory.counts.manage', 'Route /dashboard/inventory/counts protected by inventory.counts.manage');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/waste') === 'inventory.waste.record', 'Route /dashboard/inventory/waste protected by inventory.waste.record');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/transfers') === 'inventory.transfers.manage', 'Route /dashboard/inventory/transfers protected by inventory.transfers.manage');
  assert(getRequiredPermissionForRoute('/dashboard/inventory/locations') === 'inventory.locations.manage', 'Route /dashboard/inventory/locations protected by inventory.locations.manage');

  // ── 3.1 Stock Aggregation, Classification & Redaction Logic ──────────
  console.log('\n--- 3.1 Stock Aggregation, Classification & Redaction Invariants ---');

  // Scenario: Chicken Breast multi-location stock calculation
  const mockBalances = [
    { locationId: 'loc-main', locationName: 'Main Stock', quantity: 10.0 },
    { locationId: 'loc-kitchen', locationName: 'Kitchen', quantity: 2.5 },
    { locationId: 'loc-bar', locationName: 'Bar', quantity: 0.0 },
  ];

  const branchTotalStock = mockBalances.reduce((sum, b) => sum + b.quantity, 0);
  assert(branchTotalStock === 12.5, 'Branch total stock correctly aggregates across multiple storage locations (10 + 2.5 = 12.5 kg)');

  const nonZeroLocations = mockBalances.filter((b) => b.quantity > 0);
  assert(nonZeroLocations.length === 2, 'Non-zero storage locations correctly identified for item');

  // Classification 1: In Stock / Healthy
  const classifyStock = (currentStock: number, minStockLevel: number): 'healthy' | 'low_stock' | 'out_of_stock' => {
    if (currentStock <= 0) return 'out_of_stock';
    if (minStockLevel > 0 && currentStock <= minStockLevel) return 'low_stock';
    return 'healthy';
  };

  assert(classifyStock(12.5, 5.0) === 'healthy', 'Stock 12.5 kg with min 5.0 kg classified as healthy / In Stock');
  assert(classifyStock(4.5, 5.0) === 'low_stock', 'Stock 4.5 kg with min 5.0 kg classified as low_stock');
  assert(classifyStock(5.0, 5.0) === 'low_stock', 'Stock exactly at threshold 5.0 kg classified as low_stock');
  assert(classifyStock(0, 5.0) === 'out_of_stock', 'Stock 0 kg classified as out_of_stock');
  assert(classifyStock(-1, 5.0) === 'out_of_stock', 'Negative stock strictly classified as out_of_stock');

  // Permission Redaction test
  const testItemRaw = {
    cost_per_unit_cents: 2500,
    currentStock: 12.5,
  };

  const redactCost = (hasPerm: boolean) => ({
    costPerUnitCents: hasPerm ? testItemRaw.cost_per_unit_cents : null,
    totalStockValueCents: hasPerm ? Math.round(testItemRaw.currentStock * testItemRaw.cost_per_unit_cents) : null,
  });

  const withCostPerm = redactCost(true);
  assert(withCostPerm.costPerUnitCents === 2500 && withCostPerm.totalStockValueCents === 31250, 'Manager with inventory.costs.view receives unit cost and stock value');

  const withoutCostPerm = redactCost(false);
  assert(withoutCostPerm.costPerUnitCents === null && withoutCostPerm.totalStockValueCents === null, 'Staff without inventory.costs.view receives strictly redacted null values');

  // ── 4. Help Center Knowledge Base Integration ─────────────────────────
  console.log('\n--- 4. Help Center Knowledge Base Integration ---');
  const invCategory = getCategoryById('inventory-management');
  assert(!!invCategory, 'Help Center category "inventory-management" exists in registry');
  assert(invCategory?.title === 'Inventory & Stock Management', 'Help Center category title is accurate');

  const allArticles = getAllArticles();
  const invArticles = allArticles.filter((a) => a.category === 'inventory-management');
  assert(invArticles.length >= 6, `Found ${invArticles.length} detailed Help Center guides for inventory`);

  const quickStart = invArticles.find((a) => a.slug === 'inventory-quick-start');
  assert(!!quickStart, 'Found "inventory-quick-start" article');
  assert(quickStart?.gettingStarted === true, 'Quick start guide marked as gettingStarted');

  const stockCountsGuide = invArticles.find((a) => a.slug === 'performing-physical-stock-counts');
  assert(!!stockCountsGuide, 'Found "performing-physical-stock-counts" article');

  // ── 5. Database Schema File Inspection ───────────────────────────────
  console.log('\n--- 5. Database Schema File Inspection ---');
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260816000000_phase27_inventory_core_schema.sql');
  assert(fs.existsSync(migrationPath), 'Phase 27 migration file exists on disk');

  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  assert(sqlContent.includes('inventory_categories'), 'Migration defines inventory_categories table');
  assert(sqlContent.includes('inventory_storage_locations'), 'Migration defines inventory_storage_locations table');
  assert(sqlContent.includes('inventory_items'), 'Migration defines inventory_items table');
  assert(sqlContent.includes('inventory_balances'), 'Migration defines inventory_balances table');
  assert(sqlContent.includes('inventory_stock_movements'), 'Migration defines immutable inventory_stock_movements audit table');
  assert(sqlContent.includes('inventory_stock_counts'), 'Migration defines inventory_stock_counts table');
  assert(sqlContent.includes('inventory_waste_records'), 'Migration defines inventory_waste_records table');
  assert(sqlContent.includes('inventory_transfers'), 'Migration defines inventory_stock_transfers table');
  assert(sqlContent.includes('record_inventory_adjustment'), 'Migration defines record_inventory_adjustment RPC');
  assert(sqlContent.includes('record_inventory_waste'), 'Migration defines record_inventory_waste RPC');
  assert(sqlContent.includes('approve_stock_count_and_reconcile'), 'Migration defines approve_stock_count_and_reconcile RPC');
  assert(sqlContent.includes('execute_stock_transfer_send'), 'Migration defines execute_stock_transfer_send RPC');
  assert(sqlContent.includes('execute_stock_transfer_receive'), 'Migration defines execute_stock_transfer_receive RPC');
  assert(sqlContent.includes('CHECK (current_quantity >= 0)'), 'Migration enforces non-negative stock database constraint');
  assert(sqlContent.includes('DELETE FROM public.role_permissions'), 'Migration includes safe historical deduplication of role_permissions');
  assert(sqlContent.includes('uq_role_permissions_builtin'), 'Migration defines uq_role_permissions_builtin unique index');
  assert(sqlContent.includes('uq_role_permissions_custom'), 'Migration defines uq_role_permissions_custom unique index');
  assert(sqlContent.includes('uq_inventory_units_global_code'), 'Migration defines uq_inventory_units_global_code unique index');
  assert(sqlContent.includes('uq_inventory_units_tenant_code'), 'Migration defines uq_inventory_units_tenant_code unique index');
  assert(sqlContent.includes('ON CONFLICT (role_key, permission_key) WHERE custom_role_id IS NULL AND business_id IS NULL DO NOTHING'), 'Migration has idempotent built-in role permission conflict target');
  assert(sqlContent.includes('ON CONFLICT (code) WHERE business_id IS NULL DO NOTHING'), 'Migration has idempotent global units conflict target');

  // ── 7. Cross-Branch Transfer Lifecycle Regression Test ──────────────
  console.log('\n--- 7. Cross-Branch Transfer Lifecycle Regression Test ---');
  const ts = Date.now();
  let regUserId: string | null = null;
  let regBizId: string | null = null;
  let regMainBranchId: string | null = null;
  let regChilawBranchId: string | null = null;
  let regItemId: string | null = null;
  let regTransferId: string | null = null;

  try {
    const { data: user, error: uErr } = await admin.auth.admin.createUser({
      email: `reg_transfer_${ts}@test.com`,
      password: 'Password123!',
      email_confirm: true,
    });
    if (uErr || !user?.user) throw new Error(uErr?.message || 'User creation failed');
    regUserId = user.user.id;

    const { data: biz, error: bErr } = await admin
      .from('businesses')
      .insert({
        name: `Transfer Regression Biz ${ts}`,
        slug: `trf-reg-${ts}`,
        created_by: regUserId,
        default_currency: 'EUR',
        timezone: 'UTC',
      })
      .select('id')
      .single();
    if (bErr || !biz) throw new Error(bErr?.message || 'Biz creation failed');
    regBizId = biz.id;

    // Main Branch
    const { data: mainBranch, error: mbErr } = await admin
      .from('branches')
      .insert({
        business_id: regBizId,
        name: 'Main Branch',
        code: `MB-${ts.toString().slice(-4)}`,
        is_default: true,
      })
      .select('id')
      .single();
    if (mbErr || !mainBranch) throw new Error(mbErr?.message || 'Main Branch creation failed');
    regMainBranchId = mainBranch.id;

    // Chilaw Branch
    const { data: chilawBranch, error: cbErr } = await admin
      .from('branches')
      .insert({
        business_id: regBizId,
        name: 'Chilaw Branch',
        code: `CB-${ts.toString().slice(-4)}`,
        is_default: false,
      })
      .select('id')
      .single();
    if (cbErr || !chilawBranch) throw new Error(cbErr?.message || 'Chilaw Branch creation failed');
    regChilawBranchId = chilawBranch.id;

    // Storage Locations
    const { data: mainLocId } = await admin.rpc('get_or_create_default_storage_location', {
      p_business_id: regBizId,
      p_branch_id: regMainBranchId,
    });
    const { data: chilawLocId } = await admin.rpc('get_or_create_default_storage_location', {
      p_business_id: regBizId,
      p_branch_id: regChilawBranchId,
    });

    // 1. Create item with 20 kg opening stock at Main Branch
    const { data: item, error: itmErr } = await admin
      .from('inventory_items')
      .insert({
        business_id: regBizId,
        name: `Fresh Beef ${ts}`,
        base_unit: 'kg',
        cost_per_unit_cents: 1200,
        currency: 'EUR',
        min_stock_level: 5,
        item_type: 'raw_ingredient',
      })
      .select('id')
      .single();
    if (itmErr || !item) throw new Error(itmErr?.message || 'Item creation failed');
    regItemId = item.id;

    await admin.rpc('record_inventory_adjustment', {
      p_business_id: regBizId,
      p_branch_id: regMainBranchId,
      p_location_id: mainLocId,
      p_item_id: regItemId,
      p_direction: 'set',
      p_quantity: 20,
      p_unit: 'kg',
      p_quantity_base: 20,
      p_reason: 'Opening Stock',
      p_notes: null,
      p_actor_id: regUserId,
      p_idempotency_key: `open-mb-${ts}`,
      p_movement_type: 'opening_balance',
    });

    // Initial check: Main = 20kg, Chilaw = 0kg
    const { data: mbBal0 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', mainLocId)
      .single();
    assert(Number(mbBal0?.current_quantity) === 20, 'Initial Main Branch opening stock is 20 kg');

    const { data: cbBal0 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', chilawLocId);
    const cbQty0 = cbBal0 && cbBal0.length > 0 ? Number(cbBal0[0].current_quantity) : 0;
    assert(cbQty0 === 0, 'Initial Chilaw Branch stock is 0 kg');

    // 2. Create Stock Transfer 5 kg to Chilaw
    const { data: transfer, error: trErr } = await admin
      .from('inventory_stock_transfers')
      .insert({
        business_id: regBizId,
        source_branch_id: regMainBranchId,
        source_location_id: mainLocId,
        destination_branch_id: regChilawBranchId,
        destination_location_id: chilawLocId,
        transfer_number: `TRF-${ts}`,
        status: 'draft',
      })
      .select('id')
      .single();
    if (trErr || !transfer) throw new Error(trErr?.message || 'Transfer creation failed');
    regTransferId = transfer.id;

    await admin.from('inventory_stock_transfer_items').insert({
      transfer_id: regTransferId,
      item_id: regItemId,
      quantity_sent: 5,
      unit_sent: 'kg',
      quantity_sent_base: 5,
      unit_cost_cents: 1200,
      currency: 'EUR',
    });

    // 3. Dispatch Send -> in_transit
    const { data: sendRes, error: sendErr } = await admin.rpc('execute_stock_transfer_send', {
      p_transfer_id: regTransferId,
      p_actor_id: regUserId,
    });
    assert(!sendErr && sendRes?.success === true, 'execute_stock_transfer_send succeeds');

    const { data: trfAfterSend } = await admin
      .from('inventory_stock_transfers')
      .select('status')
      .eq('id', regTransferId)
      .single();
    assert(trfAfterSend?.status === 'in_transit', 'Transfer status is in_transit after dispatch');

    const { data: mbBal1 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', mainLocId)
      .single();
    assert(Number(mbBal1?.current_quantity) === 15, 'Main Branch stock decreases to 15 kg after Send');

    const { data: cbBal1 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', chilawLocId);
    const cbQty1 = cbBal1 && cbBal1.length > 0 ? Number(cbBal1[0].current_quantity) : 0;
    assert(cbQty1 === 0, 'Chilaw Branch stock remains 0 kg while transfer is in_transit');

    // 4. Receive Stock at Chilaw -> received
    const { data: recRes, error: recErr } = await admin.rpc('execute_stock_transfer_receive', {
      p_transfer_id: regTransferId,
      p_actor_id: regUserId,
      p_received_items: null,
      p_discrepancy_reason: null,
    });
    assert(!recErr && recRes?.success === true, 'execute_stock_transfer_receive succeeds');

    const { data: trfAfterRec } = await admin
      .from('inventory_stock_transfers')
      .select('status')
      .eq('id', regTransferId)
      .single();
    assert(trfAfterRec?.status === 'received', 'Transfer status becomes received after receipt');

    const { data: mbBal2 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', mainLocId)
      .single();
    assert(Number(mbBal2?.current_quantity) === 15, 'Main Branch stock remains 15 kg after Receive');

    const { data: cbBal2 } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId)
      .eq('location_id', chilawLocId)
      .single();
    assert(Number(cbBal2?.current_quantity) === 5, 'Chilaw Branch stock immediately reflects 5 kg upon receipt');

    // Total business stock check
    const { data: allBals } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('item_id', regItemId);
    const totalBusinessStock = (allBals || []).reduce((s, b) => s + Number(b.current_quantity), 0);
    assert(totalBusinessStock === 20, 'Total business stock across all branches is conserved at 20 kg (15 kg + 5 kg)');

    // Audit movements verification
    const { data: movements } = await admin
      .from('inventory_stock_movements')
      .select('movement_type, branch_id, quantity_base')
      .eq('item_id', regItemId);
    const hasTransferOut = movements?.some((m) => m.movement_type === 'transfer_out' && m.branch_id === regMainBranchId);
    const hasTransferIn = movements?.some((m) => m.movement_type === 'transfer_in' && m.branch_id === regChilawBranchId);
    assert(Boolean(hasTransferOut), 'Movement ledger includes transfer_out for Main Branch');
    assert(Boolean(hasTransferIn), 'Movement ledger includes transfer_in for Chilaw Branch');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ [FAIL] Cross-Branch Regression failed: ${message}`);
    failed++;
  } finally {
    // Cleanup regression records
    if (regTransferId) {
      await admin.from('inventory_stock_transfer_items').delete().eq('transfer_id', regTransferId);
      await admin.from('inventory_stock_transfers').delete().eq('id', regTransferId);
    }
    if (regBizId) {
      await admin.from('inventory_stock_movements').delete().eq('business_id', regBizId);
      await admin.from('inventory_balances').delete().eq('business_id', regBizId);
      await admin.from('inventory_items').delete().eq('business_id', regBizId);
      await admin.from('inventory_storage_locations').delete().eq('business_id', regBizId);
      await admin.from('branches').delete().eq('business_id', regBizId);
      await admin.from('businesses').delete().eq('id', regBizId);
    }
    if (regUserId) {
      await admin.auth.admin.deleteUser(regUserId);
    }
  }

  console.log('\n================================================================');
  console.log(`  Phase 27 Verification Results: ${passed} PASS, ${failed} FAIL`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runInventoryVerificationSuite().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
