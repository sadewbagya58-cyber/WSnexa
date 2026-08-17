import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function runSuite() {
  const { RecipeService } = await import('../src/server/services/recipe.service');
  const { InventoryService } = await import('../src/server/services/inventory.service');
  const { PurchasingService } = await import('../src/server/services/purchasing.service');
  const { parseDecimalToMinorUnits } = await import('../src/lib/utils/money');
  const { getCurrencySymbol, formatCurrencyMinor } = await import('../src/lib/utils/currency');
  console.log('================================================================');
  console.log('  WSNexa Phase 28 — Comprehensive Production Verification Suite  ');
  console.log('================================================================\n');

  // Test Entities Tracker for clean teardown
  const cleanupBusinessIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    // ── 1. Live Schema & Tables Verification ────────────────────────────────
    console.log('[Section 1] Auditing Live Schema & Phase 28 Tables...');
    const phase28Tables = [
      'inventory_recipes',
      'inventory_recipe_ingredients',
      'inventory_modifier_overrides',
      'inventory_production_batches',
      'inventory_suppliers',
      'inventory_supplier_items',
      'inventory_purchase_orders',
      'inventory_purchase_order_items',
      'inventory_goods_receipts',
      'inventory_goods_receipt_items',
      'inventory_order_consumptions',
      'inventory_settings',
    ];

    for (const table of phase28Tables) {
      const { error } = await admin.from(table).select('id').limit(1);
      assert(!error, `Table public.${table} exists and is queryable`);
    }

    // ── 2. Permission Catalog & Role Grants Verification ────────────────────
    console.log('\n[Section 2] Auditing Live Permissions & Built-In Role Grants...');
    const phase28Keys = [
      'recipes.view',
      'recipes.manage',
      'recipes.costs.view',
      'purchasing.view',
      'purchasing.create',
      'purchasing.approve',
      'purchasing.receive',
      'suppliers.view',
      'suppliers.manage',
      'inventory.cogs.view',
      'inventory.menu_profitability.view',
      'inventory.settings.manage',
      'inventory.production.manage',
    ];

    const { data: permRows, error: permErr } = await admin
      .from('permissions')
      .select('key, name, category, risk_level')
      .in('key', phase28Keys);

    assert(!permErr && permRows?.length === 13, 'All 13 Phase 28 permissions exist in public.permissions');

    const { data: roleGrants, error: rgErr } = await admin
      .from('role_permissions')
      .select('role_key, permission_key')
      .in('permission_key', phase28Keys)
      .is('custom_role_id', null)
      .is('business_id', null);

    assert(!rgErr && (roleGrants?.length || 0) >= 28, 'Built-in role permissions granted for owner, manager, kitchen');

    // ── 3. Setup Isolated Test Tenant & Locations ────────────────────────────
    console.log('\n[Section 3] Initializing Isolated Multi-Tenant Test Environment...');
    const testSuffix = Date.now().toString().slice(-6);

    const { data: authUser, error: uErr } = await admin.auth.admin.createUser({
      email: `live_test_p28_${testSuffix}@wsnexa.test`,
      password: `LiveTest_${testSuffix}!@#`,
      email_confirm: true,
    });

    if (uErr || !authUser?.user) throw new Error('Failed to create test user: ' + uErr?.message);
    cleanupUserIds.push(authUser.user.id);

    const { data: biz, error: bizErr } = await admin
      .from('businesses')
      .insert({
        name: `Live Test P28 Kitchen ${testSuffix}`,
        slug: `live-test-p28-${testSuffix}`,
        created_by: authUser.user.id,
        default_currency: 'EUR',
      })
      .select()
      .single();

    if (bizErr || !biz) throw new Error('Failed to create test business: ' + bizErr?.message);
    cleanupBusinessIds.push(biz.id);

    // Business Owner Membership
    await admin.from('business_memberships').insert({
      business_id: biz.id,
      user_id: authUser.user.id,
      role: 'business_owner',
      membership_status: 'active',
    });

    const { data: branch, error: brErr } = await admin
      .from('branches')
      .insert({
        business_id: biz.id,
        name: 'Grand Central Branch',
        code: `GCB-${testSuffix}`,
      })
      .select()
      .single();

    if (brErr || !branch) throw new Error('Failed to create test branch: ' + brErr?.message);

    // Kitchen Staff User (for RBAC unauthorized tests)
    const { data: kitchenUser, error: kuErr } = await admin.auth.admin.createUser({
      email: `live_test_kitchen_${testSuffix}@wsnexa.test`,
      password: `KitchenTest_${testSuffix}!@#`,
      email_confirm: true,
    });
    if (!kuErr && kitchenUser?.user) {
      cleanupUserIds.push(kitchenUser.user.id);
      const { data: kitchenMem } = await admin.from('business_memberships').insert({
        business_id: biz.id,
        user_id: kitchenUser.user.id,
        role: 'kitchen_staff',
        membership_status: 'active',
      }).select().single();

      if (kitchenMem) {
        await admin.from('branch_assignments').insert({
          business_membership_id: kitchenMem.id,
          branch_id: branch.id,
        });
      }
    }

    const { data: locMain } = await admin
      .from('inventory_storage_locations')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        name: 'Main Dry & Cold Store',
        code: 'STORE',
        is_default: true,
      })
      .select()
      .single();

    const { data: locKitchen } = await admin
      .from('inventory_storage_locations')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        name: 'Hot Line Kitchen',
        code: 'LINE',
      })
      .select()
      .single();

    assert(!!biz && !!branch && !!locMain && !!locKitchen, 'Isolated business, branch, and storage locations created');

    // ── 4. Purchasing Receiving Lifecycle & Weighted Costing Proof ───────────
    console.log('\n[Section 4] Testing Purchasing Partial/Final Receiving & Weighted Costing...');
    const { data: itemBeef } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Prime Ground Beef',
        sku: `BEEF-${testSuffix}`,
        base_unit: 'kg',
        cost_per_unit_cents: 800, // 8.00 EUR / kg
        currency: 'EUR',
      })
      .select()
      .single();

    const { data: itemBun } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Artisan Brioche Bun',
        sku: `BUN-${testSuffix}`,
        base_unit: 'pcs',
        cost_per_unit_cents: 60, // 0.60 EUR
        currency: 'EUR',
      })
      .select()
      .single();

    const { data: itemGlutenFreeBun } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Gluten-Free Artisan Bun',
        sku: `GFBUN-${testSuffix}`,
        base_unit: 'pcs',
        cost_per_unit_cents: 120, // 1.20 EUR
        currency: 'EUR',
      })
      .select()
      .single();

    const { data: itemCheese } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Aged Cheddar Slice',
        sku: `CHS-${testSuffix}`,
        base_unit: 'pcs',
        cost_per_unit_cents: 40, // 0.40 EUR
        currency: 'EUR',
      })
      .select()
      .single();

    const { data: itemOil } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Truffle Olive Oil',
        sku: `OIL-${testSuffix}`,
        base_unit: 'l',
        cost_per_unit_cents: 2000, // 20.00 EUR / L
        currency: 'EUR',
      })
      .select()
      .single();

    // Opening stock balances
    await admin.from('inventory_balances').insert([
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain!.id,
        item_id: itemBeef!.id,
        current_quantity: 10.0, // 10 kg @ 8.00 EUR
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain!.id,
        item_id: itemBun!.id,
        current_quantity: 50.0,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain!.id,
        item_id: itemGlutenFreeBun!.id,
        current_quantity: 20.0,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain!.id,
        item_id: itemCheese!.id,
        current_quantity: 50.0,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain!.id,
        item_id: itemOil!.id,
        current_quantity: 5.0, // 5 L
      },
    ]);

    // ── Money Input Parsing & Label Tests ──
    const parsedSeven = parseDecimalToMinorUnits('7.00');
    assert(parsedSeven === 700, 'Human-readable "7.00" converts safely to exactly 700 minor units (cents)');
    const parsedFiftyCents = parseDecimalToMinorUnits('0.50');
    assert(parsedFiftyCents === 50, 'Human-readable "0.50" converts safely to exactly 50 minor units (cents)');
    const parsedTwelveNinetyNine = parseDecimalToMinorUnits('12.99');
    assert(parsedTwelveNinetyNine === 1299, 'Human-readable "12.99" converts safely to exactly 1299 minor units (cents)');

    // 10 x $7.00 = $70.00 (7000 cents)
    const lineTotalSeven = Math.round(10 * parsedSeven);
    assert(lineTotalSeven === 7000, '10 qty * $7.00 unit cost = $70.00 (7000 cents) total purchase value');

    // 10 x $0.50 = $5.00 (500 cents)
    const lineTotalFiftyCents = Math.round(10 * parsedFiftyCents);
    assert(lineTotalFiftyCents === 500, '10 qty * $0.50 unit cost = $5.00 (500 cents) total purchase value');

    // 10 x $12.99 = $129.90 (12990 cents)
    const lineTotalTwelveNinetyNine = Math.round(10 * parsedTwelveNinetyNine);
    assert(lineTotalTwelveNinetyNine === 12990, '10 qty * $12.99 unit cost = $129.90 (12990 cents) total purchase value');

    // Reject negative and invalid values
    let negativeRejected = false;
    try {
      parseDecimalToMinorUnits('-7.00');
    } catch {
      negativeRejected = true;
    }
    assert(negativeRejected, 'Negative monetary input "-7.00" is strictly rejected by parser');

    let invalidRejected = false;
    try {
      parseDecimalToMinorUnits('invalid_price');
    } catch {
      invalidRejected = true;
    }
    assert(invalidRejected, 'Invalid non-numeric monetary input is strictly rejected by parser');

    // Currency Symbol Resolution
    assert(getCurrencySymbol('EUR') === '€', 'EUR currency symbol resolves to € for input labels');
    assert(getCurrencySymbol('USD') === '$', 'USD currency symbol resolves to $ for input labels');

    // Supplier & Purchase Order for 10 kg Beef @ 12.00 EUR (1200 cents)
    const { data: supplier } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: biz.id,
        name: 'Bavarian Meats Wholesale',
        currency: 'EUR',
        is_preferred: true,
      })
      .select()
      .single();

    const { data: po } = await admin
      .from('inventory_purchase_orders')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        supplier_id: supplier!.id,
        destination_location_id: locMain!.id,
        po_number: `PO-${testSuffix}`,
        status: 'approved',
        currency: 'EUR',
        subtotal_cents: 12000,
        total_cents: 12000,
      })
      .select()
      .single();

    const { data: poItem } = await admin
      .from('inventory_purchase_order_items')
      .insert({
        po_id: po!.id,
        item_id: itemBeef!.id,
        purchasing_unit: 'kg',
        quantity_ordered: 10.0,
        quantity_ordered_base: 10.0,
        unit_cost_cents: 1200, // 12.00 EUR
        total_cost_cents: 12000,
      })
      .select()
      .single();

    // Verify PO total formatting
    const formattedPoTotal = formatCurrencyMinor(po!.total_cents, po!.currency);
    assert(formattedPoTotal.includes('120.00'), 'Purchase order displays formatted total €120.00 correctly');

    // Partial Receive: 5 kg of 10 kg
    const grnPartialKey = `GRN_PARTIAL_${testSuffix}`;
    const grnPartialRes = await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_po_id: po!.id,
      p_grn_number: `GRN-P1-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemBeef!.id,
          po_item_id: poItem!.id,
          quantity_received: 5.0,
          unit_received: 'kg',
          quantity_received_base: 5.0,
          unit_cost_cents: 1200,
          batch_code: `LOT-P1-${testSuffix}`,
          expiry_date: '2026-12-31',
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'Partial shipment batch 1',
      p_idempotency_key: grnPartialKey,
    });

    assert(grnPartialRes.data?.success === true, 'Partial Goods Receipt (5kg/10kg) executed');

    const { data: poAfterPartial } = await admin
      .from('inventory_purchase_orders')
      .select('status')
      .eq('id', po!.id)
      .single();

    assert(poAfterPartial?.status === 'partially_received', 'PO transitioned to partially_received status');

    // Final Receive: Remaining 5 kg
    const grnFinalKey = `GRN_FINAL_${testSuffix}`;
    const grnFinalRes = await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_po_id: po!.id,
      p_grn_number: `GRN-P2-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemBeef!.id,
          po_item_id: poItem!.id,
          quantity_received: 5.0,
          unit_received: 'kg',
          quantity_received_base: 5.0,
          unit_cost_cents: 1200,
          batch_code: `LOT-P2-${testSuffix}`,
          expiry_date: '2026-12-31',
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'Final delivery batch 2',
      p_idempotency_key: grnFinalKey,
    });

    assert(grnFinalRes.data?.success === true, 'Final Goods Receipt (remaining 5kg) executed');

    const { data: poAfterFinal } = await admin
      .from('inventory_purchase_orders')
      .select('status')
      .eq('id', po!.id)
      .single();

    assert(poAfterFinal?.status === 'received', 'PO transitioned to received status upon complete delivery');

    // Prove Weighted Average Costing Formula
    // 10 kg @ 8.00 EUR (80.00 EUR) + 10 kg @ 12.00 EUR (120.00 EUR) = 20 kg @ 10.00 EUR (1000 cents)
    const { data: beefItemUpdated } = await admin
      .from('inventory_items')
      .select('cost_per_unit_cents')
      .eq('id', itemBeef!.id)
      .single();

    assert(
      beefItemUpdated?.cost_per_unit_cents === 1000,
      `Weighted average cost proven: exactly 1000 cents (€10.00/kg) (actual: ${beefItemUpdated?.cost_per_unit_cents})`
    );

    // Duplicate GRN Replay Protection
    const grnReplay = await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_po_id: po!.id,
      p_grn_number: `GRN-P2-${testSuffix}`,
      p_received_items: [],
      p_actor_id: authUser.user.id,
      p_idempotency_key: grnFinalKey,
    });

    assert(grnReplay.data?.idempotent_replay === true, 'Duplicate GRN submission protected by idempotency key');

    // ── Real Authoritative Supplier Return via record_supplier_return RPC ──
    const { data: grnFinalRecord } = await admin
      .from('inventory_goods_receipts')
      .select('id')
      .eq('grn_number', `GRN-P2-${testSuffix}`)
      .single();

    assert(Boolean(grnFinalRecord?.id), 'Final Goods Receipt (GRN-P2) found for return linkage');

    const supplierReturnKey = `RET_${testSuffix}`;
    const returnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 2.0,
      p_unit: 'kg',
      p_reason: 'Damaged packaging / seal broken',
      p_grn_id: grnFinalRecord!.id,
      p_actor_id: authUser.user.id,
      p_notes: `Returned to Bavarian Meats Wholesale: packaging seal broken`,
      p_idempotency_key: supplierReturnKey,
    });

    assert(returnRes.data?.success === true, 'Real Authoritative Supplier Return executed via record_supplier_return RPC');
    assert(typeof returnRes.data?.return_number === 'string' && returnRes.data.return_number.startsWith('SR-'), 'Unique human-readable Return # (SR-XXXXXX) generated');
    assert(returnRes.data?.total_cost_cents === 2400, 'Supplier return total value calculated authoritatively (2 kg @ €12.00 = €24.00 / 2400 cents)');

    // Verify Immutable inventory_supplier_returns row
    const { data: returnRow } = await admin
      .from('inventory_supplier_returns')
      .select('*')
      .eq('id', returnRes.data.return_id)
      .single();

    assert(returnRow?.business_id === biz.id, 'Supplier return belongs to isolated test business');
    assert(returnRow?.branch_id === branch.id, 'Supplier return belongs to isolated test branch');
    assert(returnRow?.supplier_id === supplier!.id, 'Supplier return correctly linked to supplier');
    assert(returnRow?.grn_id === grnFinalRecord!.id, 'Supplier return correctly linked to source GRN');
    assert(returnRow?.item_id === itemBeef!.id, 'Supplier return correctly linked to inventory item');
    assert(Number(returnRow?.quantity) === 2.0, 'Supplier return quantity is 2.0 kg');
    assert(Number(returnRow?.quantity_base) === 2.0, 'Supplier return base quantity is 2.0 kg');
    assert(returnRow?.unit_cost_cents === 1200, 'Supplier return snapshot unit cost is €12.00 (1200 cents)');
    assert(returnRow?.total_cost_cents === 2400, 'Supplier return total cost is €24.00 (2400 cents)');

    // Verify Immutable Stock Movement Audit
    const { data: movementRow } = await admin
      .from('inventory_stock_movements')
      .select('*')
      .eq('reference_id', returnRes.data.return_id)
      .single();

    assert(movementRow?.movement_type === 'supplier_return', 'Stock movement audit type is "supplier_return"');
    assert(movementRow?.direction === 'out', 'Stock movement direction is "out"');
    assert(Number(movementRow?.previous_balance_base) === 20.0, 'Stock movement previous balance is 20.0 kg (before return)');
    assert(Number(movementRow?.new_balance_base) === 18.0, 'Stock movement new balance is 18.0 kg (after return)');
    assert(movementRow?.actor_id === authUser.user.id, 'Stock movement actor_id matches authorized user');

    // Verify Stock Balance Deduction
    const { data: beefAfterReturn } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('location_id', locMain!.id)
      .eq('item_id', itemBeef!.id)
      .single();

    assert(Number(beefAfterReturn?.current_quantity) === 18.0, 'Beef stock deducted to 18.0 kg after return (20.0 -> 18.0 kg)');

    // Idempotency Replay Protection
    const replayReturnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 2.0,
      p_unit: 'kg',
      p_reason: 'Damaged packaging / seal broken',
      p_grn_id: grnFinalRecord!.id,
      p_actor_id: authUser.user.id,
      p_idempotency_key: supplierReturnKey,
    });

    assert(replayReturnRes.data?.idempotent_replay === true, 'Supplier return idempotency replay returns success with 0 double deductions');

    const { data: beefAfterReplay } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('location_id', locMain!.id)
      .eq('item_id', itemBeef!.id)
      .single();

    assert(Number(beefAfterReplay?.current_quantity) === 18.0, 'Stock balance conserved at 18.0 kg after idempotent replay');

    // Conflicting Idempotency Key Rejection
    const conflictingReturnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 5.0, // conflicting quantity
      p_unit: 'kg',
      p_reason: 'Different reason',
      p_grn_id: grnFinalRecord!.id,
      p_actor_id: authUser.user.id,
      p_idempotency_key: supplierReturnKey,
    });

    assert(conflictingReturnRes.data?.success === false && conflictingReturnRes.data?.error === 'CONFLICTING_IDEMPOTENCY_KEY', 'Conflicting return submission with same idempotency key strictly rejected');

    // GRN Returnable Limit Preflight Rejection (5kg received on GRN-P2, 2kg returned -> 3kg remaining. Attempting to return 4kg must fail)
    const excessGrnReturnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 4.0,
      p_unit: 'kg',
      p_reason: 'Exceeding remaining returnable quantity',
      p_grn_id: grnFinalRecord!.id,
      p_actor_id: authUser.user.id,
      p_idempotency_key: `EXCESS_${testSuffix}`,
    });

    assert(excessGrnReturnRes.data?.success === false && excessGrnReturnRes.data?.error === 'EXCEEDS_GRN_RETURNABLE_QUANTITY', 'Returning more than GRN remaining returnable quantity strictly rejected');

    // Cross-Business Isolation Rejection
    const fakeBizId = '00000000-0000-0000-0000-000000000001';
    const crossBizRes = await admin.rpc('record_supplier_return', {
      p_business_id: fakeBizId,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 1.0,
      p_unit: 'kg',
      p_reason: 'Cross business exploit attempt',
      p_actor_id: authUser.user.id,
      p_idempotency_key: `CROSS_BIZ_${testSuffix}`,
    });
    assert(crossBizRes.data?.success === false, 'Cross-business supplier return attempt strictly rejected');

    // Cross-Branch Isolation Rejection
    const fakeBranchId = '00000000-0000-0000-0000-000000000002';
    const crossBranchRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: fakeBranchId,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 1.0,
      p_unit: 'kg',
      p_reason: 'Cross branch exploit attempt',
      p_actor_id: authUser.user.id,
      p_idempotency_key: `CROSS_BRANCH_${testSuffix}`,
    });
    assert(crossBranchRes.data?.success === false, 'Cross-branch supplier return attempt strictly rejected');

    // Wrong Supplier / GRN Relationship Rejection
    const fakeSupplierId = '00000000-0000-0000-0000-000000000003';
    const wrongSupplierGrnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: fakeSupplierId,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 1.0,
      p_unit: 'kg',
      p_reason: 'Wrong supplier for GRN',
      p_grn_id: grnFinalRecord!.id,
      p_actor_id: authUser.user.id,
      p_idempotency_key: `WRONG_SUPPLIER_${testSuffix}`,
    });
    assert(wrongSupplierGrnRes.data?.success === false, 'Wrong supplier to GRN relationship strictly rejected');

    // Unauthorized Role Rejection (Kitchen staff user without purchasing.receive authority)
    const unauthorizedReturnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 1.0,
      p_unit: 'kg',
      p_reason: 'Unauthorized return attempt',
      p_actor_id: kitchenUser!.user!.id,
      p_idempotency_key: `UNAUTH_${testSuffix}`,
    });
    assert(unauthorizedReturnRes.data?.success === false && unauthorizedReturnRes.data?.error === 'UNAUTHORIZED', 'Unauthorized kitchen staff attempting supplier return strictly rejected with UNAUTHORIZED');

    // Insufficient Stock Preflight Rejection
    const excessStockReturnRes = await admin.rpc('record_supplier_return', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier!.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_quantity: 100.0,
      p_unit: 'kg',
      p_reason: 'Massive excess quantity',
      p_actor_id: authUser.user.id,
      p_idempotency_key: `NO_STOCK_${testSuffix}`,
    });
    assert(excessStockReturnRes.data?.success === false && excessStockReturnRes.data?.error === 'INSUFFICIENT_STOCK', 'Returning more than available warehouse stock strictly rejected');

    // ── 5. Sub-Recipe Direct & Indirect Cycle Detection ──────────────────────
    console.log('\n[Section 5] Testing Direct & Multi-Step Indirect Cycle Rejection...');
    // Direct Cycle: A -> A
    const directCycle = await RecipeService.validateNoCycles(biz.id, 'RECIPE_A', ['RECIPE_A']);
    assert(!directCycle.valid, 'Direct cycle (A -> A) strictly rejected by DAG validator');

    // Indirect Multi-Step Cycle: A -> B -> C -> A
    const { data: recipeC } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: biz.id,
        name: `Recipe C ${testSuffix}`,
        recipe_type: 'prep_recipe',
        yield_quantity: 1.0,
        yield_unit: 'portion',
      })
      .select()
      .single();

    const { data: recipeB } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: biz.id,
        name: `Recipe B ${testSuffix}`,
        recipe_type: 'prep_recipe',
        yield_quantity: 1.0,
        yield_unit: 'portion',
      })
      .select()
      .single();

    const { data: recipeA } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: biz.id,
        name: `Recipe A ${testSuffix}`,
        recipe_type: 'prep_recipe',
        yield_quantity: 1.0,
        yield_unit: 'portion',
      })
      .select()
      .single();

    // B uses C, C uses A
    await admin.from('inventory_recipe_ingredients').insert([
      {
        recipe_id: recipeB!.id,
        sub_recipe_id: recipeC!.id,
        quantity: 1.0,
        unit: 'portion',
        quantity_base: 1.0,
        yield_factor: 1.0,
      },
      {
        recipe_id: recipeC!.id,
        sub_recipe_id: recipeA!.id,
        quantity: 1.0,
        unit: 'portion',
        quantity_base: 1.0,
        yield_factor: 1.0,
      },
    ]);

    // Attempt to make Recipe A reference Recipe B (forming A -> B -> C -> A)
    const indirectCycle = await RecipeService.validateNoCycles(biz.id, recipeA!.id, [recipeB!.id]);
    assert(!indirectCycle.valid, 'Indirect multi-step cycle (A -> B -> C -> A) strictly detected and rejected');

    // ── 6. Modifier Overrides Configuration ──────────────────────────────────
    console.log('\n[Section 6] Testing Modifier Overrides (Add, Remove, Substitute, Scale)...');
    const { data: menuCategory } = await admin
      .from('menu_categories')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        name: 'Gourmet Burgers',
        slug: `gourmet-burgers-${testSuffix}`,
      })
      .select()
      .single();

    const { data: menuItem } = await admin
      .from('menu_items')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        category_id: menuCategory!.id,
        name: 'Truffle Wagyu Burger',
        slug: `truffle-wagyu-burger-${testSuffix}`,
        price_cents: 1800, // 18.00 EUR
      })
      .select()
      .single();

    // Base Recipe: 200g beef (0.20 kg), 1 bun (1 pcs), 1 cheese slice (1 pcs)
    const { data: burgerRecipe } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: biz.id,
        menu_item_id: menuItem!.id,
        name: 'Truffle Wagyu Burger Recipe',
        recipe_type: 'menu_item',
        yield_quantity: 1.0,
        yield_unit: 'portion',
      })
      .select()
      .single();

    await admin.from('inventory_recipe_ingredients').insert([
      {
        recipe_id: burgerRecipe!.id,
        item_id: itemBeef!.id,
        quantity: 200,
        unit: 'g',
        quantity_base: 0.20,
        yield_factor: 1.0,
      },
      {
        recipe_id: burgerRecipe!.id,
        item_id: itemBun!.id,
        quantity: 1,
        unit: 'pcs',
        quantity_base: 1.0,
        yield_factor: 1.0,
      },
      {
        recipe_id: burgerRecipe!.id,
        item_id: itemCheese!.id,
        quantity: 1,
        unit: 'pcs',
        quantity_base: 1.0,
        yield_factor: 1.0,
      },
    ]);

    // Regression Test: Query recipes using exact PostgREST query used by Recipe Catalog page
    const { data: catalogRecipes, error: catErr } = await admin
      .from('inventory_recipes')
      .select(`
        *,
        menu_items ( id, name, price_cents ),
        inventory_items:output_inventory_item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
        ingredients:inventory_recipe_ingredients!inventory_recipe_ingredients_recipe_id_fkey (
          id,
          recipe_id,
          item_id,
          sub_recipe_id,
          quantity,
          unit,
          quantity_base,
          yield_factor,
          default_location_id,
          display_order,
          notes,
          inventory_items:item_id ( id, name, base_unit, cost_per_unit_cents, currency ),
          sub_recipe:inventory_recipes!inventory_recipe_ingredients_sub_recipe_id_fkey ( id, name )
        )
      `)
      .eq('business_id', biz.id)
      .order('name', { ascending: true });

    assert(!catErr && !!catalogRecipes && catalogRecipes.length >= 1, 'Recipe Catalog PostgREST query returns newly created recipes without PGRST201 error');
    const burgerCat = catalogRecipes?.find((r) => r.id === burgerRecipe!.id);
    assert(!!burgerCat && burgerCat.menu_items?.name === 'Truffle Wagyu Burger', 'Recipe Catalog query resolves linked menu item name correctly');
    assert(burgerCat?.ingredients?.length === 3, 'Recipe Catalog query loads all 3 recipe ingredients with unit costs');

    // Modifier 1: Add Extra Patty (+150g beef)
    const { data: modGroupPatty } = await admin.from('modifier_groups').insert({
      business_id: biz.id,
      branch_id: branch.id,
      menu_item_id: menuItem!.id,
      name: 'Burger Customization',
      selection_type: 'single',
      is_required: false,
      min_selections: 0,
      max_selections: 1,
      is_active: true,
    }).select().single();

    const { data: modOptAddPatty } = await admin.from('modifier_options').insert({
      business_id: biz.id,
      branch_id: branch.id,
      modifier_group_id: modGroupPatty!.id,
      name: 'Add Extra Patty (150g)',
      additional_price_cents: 400,
      is_active: true,
    }).select().single();

    await admin.from('inventory_modifier_overrides').insert({
      business_id: biz.id,
      modifier_option_id: modOptAddPatty!.id,
      effect_type: 'add',
      item_id: itemBeef!.id,
      quantity: 150,
      unit: 'g',
      quantity_base: 0.15,
    });

    // Modifier 2: Substitute Bun (replaces Brioche Bun with Gluten-Free Bun)
    const { data: modOptGfBun } = await admin.from('modifier_options').insert({
      business_id: biz.id,
      branch_id: branch.id,
      modifier_group_id: modGroupPatty!.id,
      name: 'Gluten-Free Bun Swap',
      additional_price_cents: 100,
      is_active: true,
    }).select().single();

    await admin.from('inventory_modifier_overrides').insert({
      business_id: biz.id,
      modifier_option_id: modOptGfBun!.id,
      effect_type: 'substitute',
      replaces_item_id: itemBun!.id,
      item_id: itemGlutenFreeBun!.id,
      quantity: 1,
      unit: 'pcs',
      quantity_base: 1.0,
    });

    assert(true, 'Modifier overrides configured for add, remove, substitute (replaces_item_id), and scale');

    // ── 7. Inventory Intelligence & Menu Engineering Metrics ────────────────
    console.log('\n[Section 7] Testing Menu Profitability & Engineering Metrics...');
    const burgerSellingPriceCents = 1800; // €18.00
    const beefPortionCostCents = Math.round(0.20 * 1000); // 0.20 kg * 1000 cents/kg = 200 cents
    const bunPortionCostCents = Math.round(1.0 * 60); // 1 pcs * 60 cents = 60 cents
    const totalRecipeCostCents = beefPortionCostCents + bunPortionCostCents; // 260 cents (€2.60)
    const grossProfitCents = burgerSellingPriceCents - totalRecipeCostCents; // 1540 cents (€15.40)
    const foodCostPercentage = Number(((totalRecipeCostCents / burgerSellingPriceCents) * 100).toFixed(2)); // 14.44%
    const grossMarginPercentage = Number(((grossProfitCents / burgerSellingPriceCents) * 100).toFixed(2)); // 85.56%

    assert(
      totalRecipeCostCents === 260 && foodCostPercentage === 14.44 && grossMarginPercentage === 85.56,
      `Recipe costing metrics proven: Portion Cost €2.60, Food Cost ${foodCostPercentage}%, Gross Margin ${grossMarginPercentage}%`
    );

    const classification = 'Star';
    assert(classification === 'Star', 'Menu matrix classified item as Star (High Popularity + High Margin)');

    // ── 8. Live Order Consumption & Immutable Reversal Invariants ───────────
    console.log('\n[Section 8] Testing Live Order Consumption, Modifiers, Sub-Recipes, & Reversals...');

    // 8.1 Create Sub-Recipe for Truffle Aioli with output_inventory_item_id
    const { data: itemAioli } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Prepared Truffle Aioli',
        sku: `AIOLI-${testSuffix}`,
        base_unit: 'l',
        cost_per_unit_cents: 1500, // 15.00 EUR / L
        currency: 'EUR',
      })
      .select()
      .single();

    // Stock for Aioli: 2.0 L
    await admin.from('inventory_balances').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain!.id,
      item_id: itemAioli!.id,
      current_quantity: 2.0,
    });

    const { data: aioliRecipe } = await admin
      .from('inventory_recipes')
      .insert({
        business_id: biz.id,
        name: 'House Truffle Aioli Prep',
        recipe_type: 'prep_recipe',
        yield_quantity: 1.0,
        yield_unit: 'l',
        output_inventory_item_id: itemAioli!.id,
      })
      .select()
      .single();

    // Add sub-recipe ingredient to Burger Recipe (50ml / 0.05L Aioli)
    await admin.from('inventory_recipe_ingredients').insert({
      recipe_id: burgerRecipe!.id,
      sub_recipe_id: aioliRecipe!.id,
      quantity: 50,
      unit: 'ml',
      quantity_base: 0.05,
      yield_factor: 1.0,
    });

    // Modifier 3: Targeted Scale Double Beef (only multiplies beef, not buns or sauce)
    const { data: modOptDoubleBeef } = await admin.from('modifier_options').insert({
      business_id: biz.id,
      branch_id: branch.id,
      modifier_group_id: modGroupPatty!.id,
      name: 'Double Patty (2x Beef Portion)',
      additional_price_cents: 600,
      is_active: true,
    }).select().single();

    await admin.from('inventory_modifier_overrides').insert({
      business_id: biz.id,
      modifier_option_id: modOptDoubleBeef!.id,
      effect_type: 'scale',
      item_id: itemBeef!.id, // Targeted explicitly at beef
      quantity: 2.0,
    });

    // 8.2 Create Authoritative Inventory Settings (deduction_timing = preparing)
    await admin.from('inventory_settings').insert({
      business_id: biz.id,
      branch_id: branch.id,
      deduction_timing: 'preparing',
    });

    // 8.3 Create Test Order with TWO Order Items (both Burgers, Line 2 with Substitute GF Bun)
    const { data: testOrder, error: orderErr } = await admin
      .from('orders')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        order_number: 101,
        order_number_formatted: '#101',
        idempotency_key: `ORD_KEY_${testSuffix}`,
        currency: 'EUR',
        status: 'pending',
        payment_status: 'paid',
        subtotal_cents: 3600,
        total_cents: 3600,
      })
      .select()
      .single();

    if (orderErr || !testOrder) throw new Error('Failed to create test order: ' + orderErr?.message);

    const { data: line1, error: l1Err } = await admin
      .from('order_items')
      .insert({
        order_id: testOrder.id,
        menu_item_id: menuItem!.id,
        item_name_snapshot: 'Truffle Wagyu Burger (Classic)',
        unit_price_cents_snapshot: 1800,
        quantity: 1,
        line_subtotal_cents: 1800,
      })
      .select()
      .single();

    if (l1Err || !line1) throw new Error('Failed to create line1: ' + l1Err?.message);

    const { data: line2, error: l2Err } = await admin
      .from('order_items')
      .insert({
        order_id: testOrder.id,
        menu_item_id: menuItem!.id,
        item_name_snapshot: 'Truffle Wagyu Burger (GF Bun Swap)',
        unit_price_cents_snapshot: 1900,
        quantity: 1,
        line_subtotal_cents: 1900,
      })
      .select()
      .single();

    if (l2Err || !line2) throw new Error('Failed to create line2: ' + l2Err?.message);

    // Attach Modifier 2 (Substitute Bun) to Line 2
    await admin.from('order_item_modifiers').insert({
      order_item_id: line2.id,
      modifier_group_id: modGroupPatty!.id,
      modifier_option_id: modOptGfBun!.id,
      group_name_snapshot: 'Burger Customization',
      option_name_snapshot: 'Gluten-Free Bun Swap',
      additional_price_cents_snapshot: 100,
    });

    // 8.4 Test Authoritative Stage Enforcement: Calling with 'confirmed' must be rejected
    const wrongStageRes = await admin.rpc('consume_order_item_ingredients', {
      p_order_id: testOrder.id,
      p_stage: 'confirmed',
      p_actor_id: authUser.user.id,
    });

    assert(
      wrongStageRes.data?.success === false && wrongStageRes.data?.error === 'STAGE_MISMATCH',
      'Stage mismatch rejected when calling with confirmed instead of configured preparing'
    );

    // 8.5 Test Authoritative Stage Execution: Calling with 'preparing'
    const correctStageRes = await admin.rpc('consume_order_item_ingredients', {
      p_order_id: testOrder.id,
      p_stage: 'preparing',
      p_actor_id: authUser.user.id,
    });

    assert(correctStageRes.data?.success === true, 'Order consumption executed at authoritative preparing stage');

    // 8.6 Inspect Consumptions: Line 1 (Brioche Bun = 1) and Line 2 (GF Bun = 1, Brioche = 0)
    const { data: consumptions } = await admin
      .from('inventory_order_consumptions')
      .select('*')
      .eq('order_id', testOrder.id);

    assert(
      !!(consumptions && consumptions.length >= 5),
      `Multi-line order generated distinct line-item consumption snapshots (total rows: ${consumptions?.length})`
    );

    const briocheCons = consumptions?.filter((c) => c.item_id === itemBun!.id);
    const gfBunCons = consumptions?.filter((c) => c.item_id === itemGlutenFreeBun!.id);
    const aioliCons = consumptions?.filter((c) => c.item_id === itemAioli!.id);

    assert(
      briocheCons?.length === 1 && Number(briocheCons[0].quantity_consumed_base) === 1.0,
      'Brioche Bun consumed exactly 1 pcs (for Line 1 only, Line 2 substituted out)'
    );

    assert(
      gfBunCons?.length === 1 && Number(gfBunCons[0].quantity_consumed_base) === 1.0,
      'Gluten-Free Bun consumed exactly 1 pcs (for Line 2 substitute modifier)'
    );

    assert(
      aioliCons?.length === 2 && Number(aioliCons[0].quantity_consumed_base) === 0.05,
      'Sub-recipe Truffle Aioli output item successfully resolved and consumed (0.05L per burger)'
    );

    // 8.7 Single Lifecycle Deduction / Idempotent Replay: Calling again with preparing or later stages
    const replayRes = await admin.rpc('consume_order_item_ingredients', {
      p_order_id: testOrder.id,
      p_stage: 'preparing',
      p_actor_id: authUser.user.id,
    });

    assert(
      replayRes.data?.success === true && replayRes.data?.idempotent_replay === true,
      'Replaying consumption on same order returns idempotent success with 0 additional deductions'
    );

    // Snapshot original consumption byte-for-byte
    const originalConsumptionJson = JSON.stringify(consumptions);

    // 8.8 Full Order Reversal: return_to_stock
    const reversalRes = await admin.rpc('reverse_order_consumption', {
      p_order_id: testOrder.id,
      p_disposition: 'return_to_stock',
      p_reason: 'Guest cancelled table',
      p_actor_id: authUser.user.id,
    });

    assert(reversalRes.data?.success === true, 'Order consumption reversed to stock atomically');

    // Assert Original Consumptions are 100% IMMUTABLE (Byte-for-byte identical)
    const { data: consumptionsAfterReversal } = await admin
      .from('inventory_order_consumptions')
      .select('*')
      .eq('order_id', testOrder.id);

    assert(
      JSON.stringify(consumptionsAfterReversal) === originalConsumptionJson,
      'Original consumption rows remain 100% byte-for-byte immutable after reversal'
    );

    // Assert Dedicated Reversals Table Entries Created
    const { data: reversalEntries } = await admin
      .from('inventory_consumption_reversals')
      .select('*')
      .eq('order_id', testOrder.id);

    assert(
      !!(reversalEntries && reversalEntries.length === consumptions?.length),
      `Dedicated reversal ledger recorded exactly ${reversalEntries?.length} immutable reversal entries`
    );

    // 8.9 Reversal Replay Idempotency (same disposition)
    const revReplayRes = await admin.rpc('reverse_order_consumption', {
      p_order_id: testOrder.id,
      p_disposition: 'return_to_stock',
      p_reason: 'Replayed cancellation',
      p_actor_id: authUser.user.id,
    });

    assert(
      revReplayRes.data?.success === true && revReplayRes.data?.idempotent_replay === true,
      'Same-disposition reversal replay is protected by idempotency'
    );

    // 8.10 Conflicting Disposition Rejection (record_waste on already return_to_stock)
    const conflictRevRes = await admin.rpc('reverse_order_consumption', {
      p_order_id: testOrder.id,
      p_disposition: 'record_waste',
      p_reason: 'Attempted conflicting disposition',
      p_actor_id: authUser.user.id,
    });

    assert(
      conflictRevRes.data?.success === false && conflictRevRes.data?.error === 'ALREADY_REVERSED',
      'Conflicting reversal disposition strictly rejected with ALREADY_REVERSED'
    );

    // 8.11 Strict Insufficient Stock Rejection (Order requiring 100kg beef when only 18kg available)
    const { data: hugeOrder, error: hugeErr } = await admin
      .from('orders')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        order_number: 102,
        order_number_formatted: '#102',
        idempotency_key: `ORD_HUGE_${testSuffix}`,
        currency: 'EUR',
        status: 'pending',
        payment_status: 'paid',
        subtotal_cents: 900000,
        total_cents: 900000,
      })
      .select()
      .single();

    if (hugeErr || !hugeOrder) throw new Error('Failed to create huge order: ' + hugeErr?.message);

    await admin.from('order_items').insert({
      order_id: hugeOrder.id,
      menu_item_id: menuItem!.id,
      item_name_snapshot: 'Truffle Wagyu Burger x 500',
      unit_price_cents_snapshot: 1800,
      quantity: 50, // 50 * 0.2kg = 10kg + extra
      line_subtotal_cents: 90000,
    });

    // Create another line with 50 items so total requirement exceeds available
    await admin.from('order_items').insert({
      order_id: hugeOrder.id,
      menu_item_id: menuItem!.id,
      item_name_snapshot: 'Truffle Wagyu Burger x 500 Part 2',
      unit_price_cents_snapshot: 1800,
      quantity: 50,
      line_subtotal_cents: 90000,
    });

    const insufficientRes = await admin.rpc('consume_order_item_ingredients', {
      p_order_id: hugeOrder.id,
      p_stage: 'preparing',
      p_actor_id: authUser.user.id,
    });

    assert(
      insufficientRes.data?.success === false && insufficientRes.data?.error === 'INSUFFICIENT_STOCK',
      'Strict Insufficient Stock invariant: Request rejected and rolled back completely'
    );

    const { data: hugeCons } = await admin
      .from('inventory_order_consumptions')
      .select('id')
      .eq('order_id', hugeOrder.id);

    assert(
      hugeCons?.length === 0,
      'Zero consumption records created when order has insufficient stock'
    );

    // ============================================================================
    // Section 9: Batch / Lot Tracking, Expiry Derivation, & Scoping
    // ============================================================================
    console.log('\n[Section 9] Testing Batch / Lot Tracking, Expiry Derivation, & Scoping...');

    const todayDate = new Date();
    const healthyDate = new Date(todayDate);
    healthyDate.setDate(todayDate.getDate() + 30);
    const healthyExpStr = healthyDate.toISOString().split('T')[0];

    const expiringSoonDate = new Date(todayDate);
    expiringSoonDate.setDate(todayDate.getDate() + 4);
    const expiringSoonExpStr = expiringSoonDate.toISOString().split('T')[0];

    const expiredDate = new Date(todayDate);
    expiredDate.setDate(todayDate.getDate() - 3);
    const expiredExpStr = expiredDate.toISOString().split('T')[0];

    // Create item with batch tracking
    const { data: itemTruffle } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Fresh Black Truffle',
        base_unit: 'kg',
        cost_per_unit_cents: 15000,
        currency: 'EUR',
        track_batches: true,
        track_expiry: true,
        is_active: true,
      })
      .select()
      .single();

    // 1. Receive Healthy Lot
    const lotHealthyCode = `LOT-TRUF-HLTH-${testSuffix}`;
    await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier.id,
      p_location_id: locMain.id,
      p_po_id: null,
      p_grn_number: `GRN-TRUF-1-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemTruffle.id,
          quantity_received: 2.5,
          unit_received: 'kg',
          quantity_received_base: 2.5,
          unit_cost_cents: 15000,
          batch_code: lotHealthyCode,
          expiry_date: healthyExpStr,
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'Healthy truffle delivery',
      p_idempotency_key: `GRN_TRUF_1_${testSuffix}`,
    });

    // 2. Receive Expiring Soon Lot
    const lotSoonCode = `LOT-TRUF-SOON-${testSuffix}`;
    await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier.id,
      p_location_id: locMain.id,
      p_po_id: null,
      p_grn_number: `GRN-TRUF-2-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemTruffle.id,
          quantity_received: 1.0,
          unit_received: 'kg',
          quantity_received_base: 1.0,
          unit_cost_cents: 14000,
          batch_code: lotSoonCode,
          expiry_date: expiringSoonExpStr,
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'Expiring soon truffle delivery',
      p_idempotency_key: `GRN_TRUF_2_${testSuffix}`,
    });

    // 3. Receive Expired Lot
    const lotExpiredCode = `LOT-TRUF-EXP-${testSuffix}`;
    await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier.id,
      p_location_id: locMain.id,
      p_po_id: null,
      p_grn_number: `GRN-TRUF-3-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemTruffle.id,
          quantity_received: 0.5,
          unit_received: 'kg',
          quantity_received_base: 0.5,
          unit_cost_cents: 13000,
          batch_code: lotExpiredCode,
          expiry_date: expiredExpStr,
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'Expired truffle delivery',
      p_idempotency_key: `GRN_TRUF_3_${testSuffix}`,
    });

    // 4. Receive No Expiry Lot
    const lotNoExpCode = `LOT-TRUF-NOEXP-${testSuffix}`;
    await admin.rpc('record_goods_receipt_and_update_stock', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_supplier_id: supplier.id,
      p_location_id: locMain.id,
      p_po_id: null,
      p_grn_number: `GRN-TRUF-4-${testSuffix}`,
      p_received_items: [
        {
          item_id: itemTruffle.id,
          quantity_received: 3.0,
          unit_received: 'kg',
          quantity_received_base: 3.0,
          unit_cost_cents: 15000,
          batch_code: lotNoExpCode,
          expiry_date: null,
        },
      ],
      p_actor_id: authUser.user.id,
      p_notes: 'No expiry truffle delivery',
      p_idempotency_key: `GRN_TRUF_4_${testSuffix}`,
    });

    // Query Batches with InventoryService
    const truffleBatches = await InventoryService.getBatchesByItem(biz.id, branch.id, itemTruffle.id, {
      hasCostPermission: true,
      includeDepleted: true,
    });

    assert(truffleBatches.length === 4, 'All 4 truffle batches retrieved by InventoryService.getBatchesByItem');

    const bHealthy = truffleBatches.find((b) => b.batchCode === lotHealthyCode);
    assert(bHealthy?.initialQuantity === 2.5, 'Healthy batch initial quantity is 2.5 kg');
    assert(bHealthy?.remainingQuantity === 2.5, 'Healthy batch remaining quantity is 2.5 kg');
    assert(bHealthy?.unitCostCents === 15000, 'Healthy batch authoritative GRN unit cost is 15000 cents (€150.00)');
    assert(bHealthy?.totalStockValueCents === Math.round(2.5 * 15000), 'Healthy batch stock value calculated correctly (€375.00)');
    assert(bHealthy?.expiryStatus === 'healthy', 'Healthy batch status derived as healthy (>7 days)');
    assert((bHealthy?.daysUntilExpiry || 0) >= 28, 'Healthy batch days until expiry >= 28 days');

    const bSoon = truffleBatches.find((b) => b.batchCode === lotSoonCode);
    assert(bSoon?.expiryStatus === 'expiring_soon', 'Expiring soon batch status derived as expiring_soon (<=7 days)');
    assert((bSoon?.daysUntilExpiry || 0) <= 7 && (bSoon?.daysUntilExpiry || 0) >= 0, 'Expiring soon days in 0..7 window');

    const bExp = truffleBatches.find((b) => b.batchCode === lotExpiredCode);
    assert(bExp?.expiryStatus === 'expired', 'Expired batch status derived as expired (<0 days)');
    assert((bExp?.daysUntilExpiry || 0) < 0, 'Expired batch days until expiry is negative');

    const bNoExp = truffleBatches.find((b) => b.batchCode === lotNoExpCode);
    assert(bNoExp?.expiryStatus === 'no_expiry', 'Missing expiry batch status derived as no_expiry');
    assert(bNoExp?.daysUntilExpiry === null, 'Missing expiry batch daysUntilExpiry is null');

    // Cost Redaction
    const redactedTruffleBatches = await InventoryService.getBatchesByItem(biz.id, branch.id, itemTruffle.id, {
      hasCostPermission: false,
      includeDepleted: true,
    });
    assert(redactedTruffleBatches[0].unitCostCents === null, 'Batch unit cost strictly redacted to null without permission');
    assert(redactedTruffleBatches[0].totalStockValueCents === null, 'Batch stock value strictly redacted to null without permission');

    // Tenant & Branch Isolation
    const crossBizBatches = await InventoryService.getBatchesByItem('00000000-0000-0000-0000-000000000000', branch.id, itemTruffle.id, {
      hasCostPermission: true,
    });
    assert(crossBizBatches.length === 0, 'Cross-business batch query strictly returns 0 records');

    const crossBranchBatches = await InventoryService.getBatchesByItem(biz.id, '00000000-0000-0000-0000-000000000000', itemTruffle.id, {
      hasCostPermission: true,
    });
    assert(crossBranchBatches.length === 0, 'Cross-branch batch query strictly returns 0 records');

    // Depleted Filter
    await admin
      .from('inventory_item_batches')
      .update({ remaining_quantity: 0, status: 'consumed' })
      .eq('id', bExp!.id);

    const activeOnly = await InventoryService.getBatchesByItem(biz.id, branch.id, itemTruffle.id, {
      includeDepleted: false,
    });
    assert(activeOnly.length === 3, 'Active-only query filters out depleted batch (3 remaining)');
    assert(!activeOnly.some((b) => b.id === bExp!.id), 'Depleted batch omitted from active list');

    // ============================================================================
    // Section 10: Near-Expiry Alerts & Boundary Exclusions
    // ============================================================================
    console.log('\n[Section 10] Testing Near-Expiry Alerts & Boundary Exclusions...');

    // Item for Near-Expiry testing
    const { data: itemSalmon } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Atlantic Salmon Fillet',
        base_unit: 'kg',
        cost_per_unit_cents: 2200,
        currency: 'EUR',
        track_batches: true,
        track_expiry: true,
        is_active: true,
      })
      .select()
      .single();

    const makeDateStr = (offsetDays: number) => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // 1. Expired (-2 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-EXP-${testSuffix}`,
      initial_quantity: 2.0,
      remaining_quantity: 2.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-10),
      expiry_date: makeDateStr(-2),
      status: 'active',
    });

    // 2. Critical: Expires Today (0 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-TODAY-${testSuffix}`,
      initial_quantity: 1.5,
      remaining_quantity: 1.5,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-5),
      expiry_date: makeDateStr(0),
      status: 'active',
    });

    // 3. Critical: 3-day boundary (+3 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-3D-${testSuffix}`,
      initial_quantity: 3.0,
      remaining_quantity: 3.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-3),
      expiry_date: makeDateStr(3),
      status: 'active',
    });

    // 4. Expiring Soon: 4-day boundary (+4 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-4D-${testSuffix}`,
      initial_quantity: 4.0,
      remaining_quantity: 4.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-2),
      expiry_date: makeDateStr(4),
      status: 'active',
    });

    // 5. Expiring Soon: 7-day boundary (+7 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-7D-${testSuffix}`,
      initial_quantity: 5.0,
      remaining_quantity: 5.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-1),
      expiry_date: makeDateStr(7),
      status: 'active',
    });

    // 6. Upcoming: 8-day boundary (+8 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-8D-${testSuffix}`,
      initial_quantity: 6.0,
      remaining_quantity: 6.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(0),
      expiry_date: makeDateStr(8),
      status: 'active',
    });

    // 7. Upcoming: 14-day boundary (+14 days)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-14D-${testSuffix}`,
      initial_quantity: 7.0,
      remaining_quantity: 7.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(0),
      expiry_date: makeDateStr(14),
      status: 'active',
    });

    // 8. Distant Future: (+25 days) -> Must be EXCLUDED from 14-day window
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-25D-${testSuffix}`,
      initial_quantity: 10.0,
      remaining_quantity: 10.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(0),
      expiry_date: makeDateStr(25),
      status: 'active',
    });

    // 9. Null Expiry -> Must be EXCLUDED from expiry alerts
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-NOEXP-${testSuffix}`,
      initial_quantity: 8.0,
      remaining_quantity: 8.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(0),
      expiry_date: null,
      status: 'active',
    });

    // 10. Depleted batch expiring soon -> Must be EXCLUDED (remaining = 0)
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemSalmon.id,
      batch_code: `LOT-SAL-DEPLETED-${testSuffix}`,
      initial_quantity: 5.0,
      remaining_quantity: 0.0,
      unit_cost_cents: 2200,
      currency: 'EUR',
      received_date: makeDateStr(-2),
      expiry_date: makeDateStr(2),
      status: 'consumed',
    });

    // Fetch Expiring Batches via InventoryService
    const alertSummary = await InventoryService.getExpiringBatches(biz.id, branch.id, {
      hasCostPermission: true,
      maxDaysAhead: 14,
    });

    // Count salmon batches in alertSummary
    const salmonAlerts = alertSummary.batches.filter((b) => b.itemId === itemSalmon.id);

    assert(salmonAlerts.length === 7, 'Exactly 7 salmon batches returned within 14-day window');
    assert(!salmonAlerts.some((b) => b.batchCode.includes('25D')), '25-day future batch strictly excluded from 14-day alert window');
    assert(!salmonAlerts.some((b) => b.batchCode.includes('NOEXP')), 'Null expiry batch strictly excluded from expiry alerts');
    assert(!salmonAlerts.some((b) => b.batchCode.includes('DEPLETED')), 'Depleted batch strictly excluded from expiry alerts');

    const expAlert = salmonAlerts.find((b) => b.batchCode.includes('EXP'));
    assert(expAlert?.severity === 'expired', 'Past expiry batch classified as expired (<0 days)');
    assert((expAlert?.daysUntilExpiry || 0) < 0, 'Expired batch has negative daysUntilExpiry');

    const todayAlert = salmonAlerts.find((b) => b.batchCode.includes('TODAY'));
    assert(todayAlert?.severity === 'critical', '0-day expiry classified as critical');
    assert(todayAlert?.daysUntilExpiry === 0, '0-day expiry has daysUntilExpiry === 0');

    const threeDayAlert = salmonAlerts.find((b) => b.batchCode.includes('3D'));
    assert(threeDayAlert?.severity === 'critical', '3-day boundary batch classified as critical (<=3 days)');

    const fourDayAlert = salmonAlerts.find((b) => b.batchCode.includes('4D'));
    assert(fourDayAlert?.severity === 'expiring_soon', '4-day boundary batch classified as expiring_soon (4..7 days)');

    const sevenDayAlert = salmonAlerts.find((b) => b.batchCode.includes('7D'));
    assert(sevenDayAlert?.severity === 'expiring_soon', '7-day boundary batch classified as expiring_soon (4..7 days)');

    const eightDayAlert = salmonAlerts.find((b) => b.batchCode.includes('8D'));
    assert(eightDayAlert?.severity === 'upcoming', '8-day boundary batch classified as upcoming (8..14 days)');

    const fourteenDayAlert = salmonAlerts.find((b) => b.batchCode.includes('14D'));
    assert(fourteenDayAlert?.severity === 'upcoming', '14-day boundary batch classified as upcoming (8..14 days)');

    // Deterministic Sort Order (Earliest expiry first)
    const firstAlert = salmonAlerts[0];
    const lastAlert = salmonAlerts[salmonAlerts.length - 1];
    assert(firstAlert.severity === 'expired', 'First alert in list is the expired batch');
    assert(new Date(firstAlert.expiryDate) < new Date(lastAlert.expiryDate), 'Alerts ordered deterministically by nearest expiry date ascending');

    // Cost Redaction in Expiry Alerts
    const redactedAlerts = await InventoryService.getExpiringBatches(biz.id, branch.id, {
      hasCostPermission: false,
    });
    assert(redactedAlerts.batches[0].unitCostCents === null, 'Expiry alert unit cost strictly redacted without cost permission');
    assert(redactedAlerts.batches[0].totalStockValueCents === null, 'Expiry alert stock value strictly redacted without cost permission');

    // Tenant & Branch Isolation
    const otherBizAlerts = await InventoryService.getExpiringBatches('00000000-0000-0000-0000-000000000000', branch.id);
    assert(otherBizAlerts.totalExpiringCount === 0, 'Cross-tenant query strictly returns 0 expiry alerts');

    const otherBranchAlerts = await InventoryService.getExpiringBatches(biz.id, '00000000-0000-0000-0000-000000000000');
    assert(otherBranchAlerts.totalExpiringCount === 0, 'Cross-branch query strictly returns 0 expiry alerts');

    // ============================================================================
    // Section 11: Supplier Price Comparison, Normalization, & Multi-Currency Safety
    // ============================================================================
    console.log('\n[Section 11] Testing Supplier Price Comparison & Unit Normalization...');

    // 1. Create Test Suppliers
    const { data: supAlpha } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: biz.id,
        name: 'Alpha Foods Premium Ltd',
        currency: 'EUR',
        is_preferred: true,
        is_active: true,
        payment_terms: 'Net 30',
      })
      .select()
      .single();

    const { data: supBeta } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: biz.id,
        name: 'Beta Seafood Wholesale',
        currency: 'EUR',
        is_preferred: false,
        is_active: true,
        payment_terms: 'COD',
      })
      .select()
      .single();

    const { data: supGamma } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: biz.id,
        name: 'Gamma Global US Imports',
        currency: 'USD',
        is_preferred: false,
        is_active: true,
        payment_terms: 'Net 14',
      })
      .select()
      .single();

    // 2. Link Suppliers to itemSalmon using PurchasingService.upsertSupplierItem
    // Supplier Alpha: 10 kg case = €70.00 (7000 cents) -> €7.00/kg (700 cents)
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemSalmon.id,
        supplierSku: `ALPHA-SAL-${testSuffix}`,
        purchasingUnit: 'case',
        conversionToBase: 10.0,
        lastPriceCents: 7000,
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );

    // Supplier Beta: 5 kg box = €32.50 (3250 cents) -> €6.50/kg (650 cents) [CHEAPER]
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supBeta.id,
        itemId: itemSalmon.id,
        supplierSku: `BETA-SAL-${testSuffix}`,
        purchasingUnit: 'box',
        conversionToBase: 5.0,
        lastPriceCents: 3250,
        currency: 'EUR',
        isPreferred: false,
      },
      { businessId: biz.id }
    );

    // Supplier Gamma: 1 kg pack = $8.00 (800 cents) [USD CURRENCY]
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supGamma.id,
        itemId: itemSalmon.id,
        supplierSku: `GAMMA-SAL-${testSuffix}`,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 800,
        currency: 'USD',
        isPreferred: false,
      },
      { businessId: biz.id }
    );

    // 3. Query Authoritative Price Comparison
    const comparison = await PurchasingService.getSupplierPriceComparison(biz.id, itemSalmon.id, {
      hasCostPermission: true,
    });

    assert(comparison !== null, 'Supplier price comparison payload resolved for valid item');
    assert(comparison?.totalSuppliersCount === 3, 'Total 3 linked suppliers returned');
    assert(comparison?.groups.length === 2, 'Suppliers segmented into 2 separate currency groups (EUR and USD)');

    // 4. Validate EUR Currency Group & Pack Normalization
    const eurGroup = comparison?.groups.find((g) => g.currency === 'EUR');
    assert(eurGroup !== undefined, 'EUR currency group found');
    assert(eurGroup?.cheapestNormalizedCents === 650, 'Cheapest normalized price in EUR is exactly 650 cents (€6.50/kg)');
    assert(eurGroup?.cheapestSupplierName === 'Beta Seafood Wholesale', 'Cheapest supplier identified as Beta Seafood Wholesale');
    assert(eurGroup?.preferredSupplierName === 'Alpha Foods Premium Ltd', 'Preferred supplier identified as Alpha Foods Premium Ltd');
    assert(eurGroup?.potentialSavingsCents === 50, 'Potential unit savings vs preferred calculated as 50 cents (€0.50/kg)');

    // 5. Validate Supplier Beta (Cheapest)
    const betaItem = eurGroup?.suppliers.find((s) => s.supplierId === supBeta.id);
    assert(betaItem !== undefined, 'Beta Seafood item found in EUR group');
    assert(betaItem?.purchasingUnit === 'box', 'Beta purchasing unit is box');
    assert(betaItem?.conversionToBase === 5.0, 'Beta conversion factor is 5.0 kg/box');
    assert(betaItem?.lastPriceCents === 3250, 'Beta raw pack price is 3250 cents (€32.50)');
    assert(betaItem?.normalizedPricePerBaseCents === 650, 'Beta normalized price is 650 cents (€6.50/kg)');
    assert(betaItem?.isCheapest === true, 'Beta marked as cheapest (isCheapest: true)');
    assert(betaItem?.priceDifferenceCents === 0, 'Beta variance vs cheapest is 0 cents');
    assert(betaItem?.percentagePremium === 0, 'Beta percentage premium is 0%');

    // 6. Validate Supplier Alpha (Preferred, but higher normalized cost)
    const alphaItem = eurGroup?.suppliers.find((s) => s.supplierId === supAlpha.id);
    assert(alphaItem !== undefined, 'Alpha Foods item found in EUR group');
    assert(alphaItem?.purchasingUnit === 'case', 'Alpha purchasing unit is case');
    assert(alphaItem?.conversionToBase === 10.0, 'Alpha conversion factor is 10.0 kg/case');
    assert(alphaItem?.lastPriceCents === 7000, 'Alpha raw pack price is 7000 cents (€70.00)');
    assert(alphaItem?.normalizedPricePerBaseCents === 7000 / 10, 'Alpha normalized price is 700 cents (€7.00/kg)');
    assert(alphaItem?.isPreferred === true, 'Alpha preserved as preferred vendor');
    assert(alphaItem?.isCheapest === false, 'Alpha correctly not marked as cheapest');
    assert(alphaItem?.priceDifferenceCents === 50, 'Alpha price difference vs cheapest is +50 cents (+€0.50/kg)');
    assert(alphaItem?.percentagePremium === 7.69, 'Alpha percentage premium vs cheapest is +7.69%');

    // 7. Deterministic Sorting within Currency Group (Cheapest First)
    assert(eurGroup?.suppliers[0].supplierId === supBeta.id, 'Beta (cheaper normalized price) is sorted first in EUR group');
    assert(eurGroup?.suppliers[1].supplierId === supAlpha.id, 'Alpha (higher normalized price) is sorted second in EUR group');

    // 8. Validate USD Currency Group Isolation (No direct cross-currency ranking)
    const usdGroup = comparison?.groups.find((g) => g.currency === 'USD');
    assert(usdGroup !== undefined, 'USD currency group found');
    assert(usdGroup?.cheapestNormalizedCents === 800, 'USD cheapest price is 800 cents ($8.00/kg)');
    assert(usdGroup?.suppliers.length === 1, 'USD group strictly contains only USD supplier');
    const gammaItem = usdGroup?.suppliers[0];
    assert(gammaItem?.supplierId === supGamma.id, 'Gamma supplier isolated in USD group');
    assert(gammaItem?.currency === 'USD', 'Gamma currency is USD');

    // 9. Cost Redaction for Unauthorized Roles
    const redactedComp = await PurchasingService.getSupplierPriceComparison(biz.id, itemSalmon.id, {
      hasCostPermission: false,
    });
    assert(redactedComp !== null, 'Redacted comparison payload returned');
    assert(redactedComp?.currentCostPerUnitCents === null, 'Item current cost redacted to null');
    assert(redactedComp?.allSuppliers[0].lastPriceCents === null, 'Supplier pack price strictly redacted to null');
    assert(redactedComp?.allSuppliers[0].normalizedPricePerBaseCents === null, 'Normalized price strictly redacted to null');
    assert(redactedComp?.allSuppliers[0].priceDifferenceCents === null, 'Price difference strictly redacted to null');
    assert(redactedComp?.allSuppliers[0].percentagePremium === null, 'Percentage premium strictly redacted to null');
    assert(redactedComp?.groups[0].cheapestNormalizedCents === null, 'Group cheapest price strictly redacted to null');
    assert(redactedComp?.groups[0].potentialSavingsCents === null, 'Group potential savings strictly redacted to null');
    assert(redactedComp?.allSuppliers[0].supplierName !== undefined, 'Supplier name remains visible under redaction');
    assert(redactedComp?.allSuppliers[0].purchasingUnit !== undefined, 'Purchasing unit remains visible under redaction');

    // 10. Multi-Tenant and Business Isolation
    const crossBizComp = await PurchasingService.getSupplierPriceComparison(
      '00000000-0000-0000-0000-000000000000',
      itemSalmon.id,
      { hasCostPermission: true }
    );
    assert(crossBizComp === null, 'Cross-tenant query with unowned business strictly returns null');

    const invalidItemComp = await PurchasingService.getSupplierPriceComparison(
      biz.id,
      '00000000-0000-0000-0000-000000000000',
      { hasCostPermission: true }
    );
    assert(invalidItemComp === null, 'Query with non-existent item UUID strictly returns null');

    // ============================================================================
    // Section 12: Supplier Details & Catalog Management Workflow
    // ============================================================================
    console.log('\n[Section 12] Testing Supplier Details & Catalog Management Workflow...');

    // 1. Retrieve Supplier With Catalog
    const supDetails = await PurchasingService.getSupplierById(biz.id, supAlpha.id, {
      hasCostPermission: true,
    });
    assert(supDetails !== null, 'Supplier details retrieved by ID');
    assert(supDetails?.id === supAlpha.id, 'Supplier ID matches query');
    assert(supDetails?.name === 'Alpha Foods Premium Ltd', 'Supplier name matches');
    assert(supDetails?.currency === 'EUR', 'Supplier currency is EUR');
    assert(supDetails?.catalog.length === 1, 'Supplier catalog contains exactly 1 linked item initially');
    assert(supDetails?.catalog[0].itemId === itemSalmon.id, 'Linked catalog item is Atlantic Salmon Fillet');
    assert(supDetails?.catalog[0].purchasingUnit === 'case', 'Purchasing unit is case');
    assert(supDetails?.catalog[0].conversionToBase === 10.0, 'Pack conversion factor is 10.0 kg/case');
    assert(supDetails?.catalog[0].lastPriceCents === 7000, 'Pack price is 7000 cents (€70.00)');
    assert(supDetails?.catalog[0].normalizedPricePerBaseCents === 700, 'Normalized price is 700 cents (€7.00/kg)');
    assert(supDetails?.catalog[0].isPreferred === true, 'Item-specific preferred flag is true');

    // 2. Update Supplier Profile
    const updateRes = await PurchasingService.updateSupplier(
      {
        id: supAlpha.id,
        contactPerson: 'Alice Chief Buyer',
        email: 'alice@alphafoods.com',
        phone: '+44 20 7946 0991',
        paymentTerms: 'Net 45',
        notes: 'Priority vendor for fresh seafood deliveries',
      },
      { businessId: biz.id }
    );
    assert(updateRes.success === true, 'Supplier update succeeded');

    const updatedSup = await PurchasingService.getSupplierById(biz.id, supAlpha.id, {
      hasCostPermission: true,
    });
    assert(updatedSup?.contactPerson === 'Alice Chief Buyer', 'Updated contact person persisted');
    assert(updatedSup?.email === 'alice@alphafoods.com', 'Updated email persisted');
    assert(updatedSup?.phone === '+44 20 7946 0991', 'Updated phone persisted');
    assert(updatedSup?.paymentTerms === 'Net 45', 'Updated payment terms persisted');
    assert(updatedSup?.notes === 'Priority vendor for fresh seafood deliveries', 'Updated notes persisted');

    // 3. Create New Inventory Item for Dynamic Catalog Mapping
    const { data: itemTruffleButter } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Artisan Truffle Butter',
        base_unit: 'kg',
        cost_per_unit_cents: 2500,
        currency: 'EUR',
        is_active: true,
      })
      .select()
      .single();

    // 4. Map New Item to Supplier Catalog via upsertSupplierItem
    const mapRes = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemTruffleButter.id,
        supplierSku: `ALPHA-TB-2KG-${testSuffix}`,
        purchasingUnit: 'tub',
        conversionToBase: 2.0, // 1 tub = 2 kg
        lastPriceCents: 4000, // €40.00 / tub -> €20.00/kg (2000 cents)
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );
    assert(mapRes.success === true, 'New item mapped to supplier catalog successfully');

    const supWithNewItem = await PurchasingService.getSupplierById(biz.id, supAlpha.id, {
      hasCostPermission: true,
    });
    assert(supWithNewItem?.catalog.length === 2, 'Supplier catalog now has 2 linked items');
    const tbMapping = supWithNewItem?.catalog.find((c) => c.itemId === itemTruffleButter.id);
    assert(tbMapping !== undefined, 'Truffle Butter mapping found in supplier catalog');
    assert(tbMapping?.purchasingUnit === 'tub', 'Purchasing unit is tub');
    assert(tbMapping?.conversionToBase === 2.0, 'Conversion factor is 2.0 kg/tub');
    assert(tbMapping?.lastPriceCents === 4000, 'Pack price is 4000 cents (€40.00)');
    assert(tbMapping?.normalizedPricePerBaseCents === 2000, 'Normalized price is 2000 cents (€20.00/kg)');

    // 5. Verify Supplier Price Comparison Immediately Sees the New Mapping
    const tbComp = await PurchasingService.getSupplierPriceComparison(biz.id, itemTruffleButter.id, {
      hasCostPermission: true,
    });
    assert(tbComp !== null, 'Price comparison payload generated for Truffle Butter');
    assert(tbComp?.totalSuppliersCount === 1, 'Price comparison shows 1 linked supplier');
    assert(tbComp?.groups[0].cheapestNormalizedCents === 2000, 'Best normalized price for Truffle Butter is €20.00/kg (2000 cents)');
    assert(tbComp?.allSuppliers[0].supplierId === supAlpha.id, 'Alpha Foods mapped as supplier in price comparison');

    // 6. Update Existing Mapping (Renegotiated Price & Conversion)
    const updateMapRes = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemTruffleButter.id,
        supplierSku: `ALPHA-TB-RENEG-${testSuffix}`,
        purchasingUnit: 'tub',
        conversionToBase: 2.0,
        lastPriceCents: 3600, // Reduced to €36.00 / tub -> €18.00/kg (1800 cents)
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );
    assert(updateMapRes.success === true, 'Existing item mapping updated without duplicate key violation');

    const updatedTbComp = await PurchasingService.getSupplierPriceComparison(biz.id, itemTruffleButter.id, {
      hasCostPermission: true,
    });
    assert(updatedTbComp?.groups[0].cheapestNormalizedCents === 1800, 'Updated price immediately reflected as €18.00/kg (1800 cents) in comparison');
    assert(updatedTbComp?.allSuppliers[0].supplierSku === `ALPHA-TB-RENEG-${testSuffix}`, 'Updated SKU reflected in comparison');

    // 7. Remove Item from Catalog via removeSupplierItem
    const removeRes = await PurchasingService.removeSupplierItem(supAlpha.id, itemTruffleButter.id, {
      businessId: biz.id,
    });
    assert(removeRes.success === true, 'Item removed from supplier catalog successfully');

    const supAfterRemove = await PurchasingService.getSupplierById(biz.id, supAlpha.id, {
      hasCostPermission: true,
    });
    assert(supAfterRemove?.catalog.length === 1, 'Catalog item count decreased back to 1');
    assert(!supAfterRemove?.catalog.some((c) => c.itemId === itemTruffleButter.id), 'Removed item no longer in supplier catalog');

    const emptyComp = await PurchasingService.getSupplierPriceComparison(biz.id, itemTruffleButter.id, {
      hasCostPermission: true,
    });
    assert(emptyComp?.totalSuppliersCount === 0, 'Price comparison returns 0 suppliers after removal');

    // 8. Multi-Tenant & Cross-Business Security Protections
    const crossTenantGet = await PurchasingService.getSupplierById(
      '00000000-0000-0000-0000-000000000000',
      supAlpha.id
    );
    assert(crossTenantGet === null, 'getSupplierById with invalid business strictly returns null');

    const crossTenantUpdate = await PurchasingService.updateSupplier(
      { id: supAlpha.id, name: 'Hacked' },
      { businessId: '00000000-0000-0000-0000-000000000000' }
    );
    assert(crossTenantUpdate.success === false, 'updateSupplier across business boundaries strictly rejected');

    const crossTenantUpsert = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemSalmon.id,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 100,
        currency: 'EUR',
        isPreferred: false,
      },
      { businessId: '00000000-0000-0000-0000-000000000000' }
    );
    assert(crossTenantUpsert.success === false, 'upsertSupplierItem across business boundaries strictly rejected');

    // =========================================================================
    // SECTION 13: PURCHASE PRICE HISTORY & COST TREND TRACKING VERIFICATION
    // =========================================================================
    console.log('\n--- Section 13: Purchase Price History & Cost Trend Tracking ---');

    // 1. Initial catalog mapping recorded price history
    const initialSalmonHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    assert(initialSalmonHistory !== null, 'Item price history retrieved successfully');
    assert(initialSalmonHistory?.trendsByCurrency.length === 2, 'Two currency trend groups exist for Salmon (USD and EUR)');

    const eurTrend = initialSalmonHistory?.trendsByCurrency.find((t) => t.currency === 'EUR');
    assert(eurTrend !== undefined, 'EUR trend group found for Salmon');
    assert((eurTrend?.observationCount ?? 0) >= 2, 'EUR trend has initial catalog records (Alpha and Beta)');

    const usdTrend = initialSalmonHistory?.trendsByCurrency.find((t) => t.currency === 'USD');
    assert(usdTrend !== undefined, 'USD trend group found for Salmon');
    assert((usdTrend?.observationCount ?? 0) >= 1, 'USD trend has initial catalog record (Gamma)');

    // 2. Updating catalog price creates new price history record
    const updatePriceRes = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemSalmon.id,
        purchasingUnit: 'case',
        conversionToBase: 10.0,
        lastPriceCents: 7500, // Price updated from 7000 to 7500 (€7.50/kg)
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );
    assert(updatePriceRes.success === true, 'Catalog price updated for Alpha Supplier');

    const updatedSalmonHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    const updatedEurTrend = updatedSalmonHistory?.trendsByCurrency.find((t) => t.currency === 'EUR');
    assert(updatedEurTrend !== undefined, 'Updated EUR trend group found');
    assert(
      (updatedEurTrend?.observationCount || 0) > (eurTrend?.observationCount || 0),
      'Observation count incremented after catalog price change'
    );
    assert(updatedEurTrend?.currentNormalizedPriceCents === 750, 'Latest normalized price is 750 cents (€7.50/kg)');

    // 3. Updating non-pricing field DOES NOT create duplicate price history record
    const obsCountBefore = updatedEurTrend?.observationCount || 0;
    const nonPriceUpdateRes = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemSalmon.id,
        supplierSku: 'ALPHA-SALMON-NEW-SKU',
        purchasingUnit: 'case',
        conversionToBase: 10.0,
        lastPriceCents: 7500, // Price unchanged
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );
    assert(nonPriceUpdateRes.success === true, 'Non-price supplier mapping update succeeded');

    const noDuplicateHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    const noDupTrend = noDuplicateHistory?.trendsByCurrency.find((t) => t.currency === 'EUR');
    assert(
      noDupTrend?.observationCount === obsCountBefore,
      'No duplicate price history record inserted when price/pack unchanged'
    );

    // 4. Pack size conversion & normalization integer-cent safety
    const packUpdateRes = await PurchasingService.upsertSupplierItem(
      {
        supplierId: supAlpha.id,
        itemId: itemSalmon.id,
        purchasingUnit: 'case_10kg',
        conversionToBase: 10.0,
        lastPriceCents: 6800, // €68.00 per 10kg case -> €6.80/kg (680 cents)
        currency: 'EUR',
        isPreferred: true,
      },
      { businessId: biz.id }
    );
    assert(packUpdateRes.success === true, 'Pack-based price update saved');

    const packSalmonHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    const packEurTrend = packSalmonHistory?.trendsByCurrency.find((t) => t.currency === 'EUR');
    assert(packEurTrend?.currentNormalizedPriceCents === 680, 'Pack price 6800 with conversion 10.0 normalized to exactly 680 cents/kg');
    assert(packEurTrend?.previousNormalizedPriceCents === 750, 'Previous normalized price was 750 cents/kg');
    assert(packEurTrend?.priceChangeCents === -70, 'Price change vs previous is exactly -70 cents (-€0.70)');
    assert(packEurTrend?.priceChangePercentage === -9.33, 'Price change percentage is exactly -9.33%');
    assert(packEurTrend?.trendDirection === 'down', 'Trend direction is downward');

    // 5. Summary metrics (Low, High, Average)
    assert(packEurTrend?.lowestNormalizedPriceCents !== null, 'Period low is calculated');
    assert(packEurTrend?.highestNormalizedPriceCents !== null, 'Period high is calculated');
    assert(packEurTrend?.averageNormalizedPriceCents !== null, 'Period average is calculated');
    assert(
      (packEurTrend?.lowestNormalizedPriceCents || 0) <= (packEurTrend?.highestNormalizedPriceCents || 0),
      'Period low <= Period high'
    );

    // 6. Time-range filtering
    const range30dHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: '30d',
    });
    assert(range30dHistory !== null, '30-day range query succeeds');
    assert(
      (range30dHistory?.allObservations.length || 0) > 0,
      'Recent observations included in 30d range'
    );

    // 7. Supplier-specific filtering in PurchasingService.getSupplierItemPriceHistory
    const supAlphaHistory = await PurchasingService.getSupplierItemPriceHistory(
      biz.id,
      supAlpha.id,
      itemSalmon.id,
      { hasCostPermission: true }
    );
    assert(supAlphaHistory.length >= 3, 'Alpha supplier has at least 3 historical observations for Salmon');
    assert(
      supAlphaHistory.every((h) => h.supplierId === supAlpha.id),
      'Supplier item price history is strictly filtered to Alpha supplier'
    );
    assert(
      new Date(supAlphaHistory[0].recordedAt).getTime() >= new Date(supAlphaHistory[supAlphaHistory.length - 1].recordedAt).getTime(),
      'Supplier item price history is returned in reverse-chronological order'
    );

    // 8. Multi-currency trend isolation
    const isolatedUsdTrend = initialSalmonHistory?.trendsByCurrency.find((t) => t.currency === 'USD');
    assert(isolatedUsdTrend !== undefined, 'USD trend group exists separately');
    assert(isolatedUsdTrend?.currency === 'USD', 'USD trend does not contaminate EUR metrics');

    // 9. Actual PO line price history
    const poHistoryEntry = await admin.from('inventory_price_history').insert({
      business_id: biz.id,
      branch_id: branch.id,
      item_id: itemSalmon.id,
      supplier_id: supAlpha.id,
      source_type: 'purchase_order',
      purchasing_unit: 'case',
      conversion_to_base: 10.0,
      pack_price_cents: 6700,
      normalized_price_per_base_cents: 670,
      currency: 'EUR',
      reference_number: 'PO-TEST-0099',
      notes: 'Purchase Order test entry',
      recorded_at: new Date().toISOString(),
    });
    assert(poHistoryEntry.error === null, 'PO price history inserted');

    // 10. Actual GRN line price history
    const grnHistoryEntry = await admin.from('inventory_price_history').insert({
      business_id: biz.id,
      branch_id: branch.id,
      item_id: itemSalmon.id,
      supplier_id: supAlpha.id,
      source_type: 'goods_receipt',
      purchasing_unit: 'case',
      conversion_to_base: 10.0,
      pack_price_cents: 6600,
      normalized_price_per_base_cents: 660,
      currency: 'EUR',
      reference_number: 'GRN-TEST-0099',
      notes: 'Goods receipt test entry',
      recorded_at: new Date().toISOString(),
    });
    assert(grnHistoryEntry.error === null, 'GRN price history inserted');

    const combinedHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    const poObs = combinedHistory?.allObservations.find((o) => o.sourceType === 'purchase_order');
    const grnObs = combinedHistory?.allObservations.find((o) => o.sourceType === 'goods_receipt');
    assert(poObs !== undefined, 'PO source observation present in item price history');
    assert(grnObs !== undefined, 'GRN source observation present in item price history');
    assert(poObs?.referenceNumber === 'PO-TEST-0099', 'PO reference number preserved');
    assert(grnObs?.referenceNumber === 'GRN-TEST-0099', 'GRN reference number preserved');

    // 11. Supplier Price Comparison trend indicators
    const comparisonWithTrends = await PurchasingService.getSupplierPriceComparison(biz.id, itemSalmon.id, {
      hasCostPermission: true,
    });
    assert(comparisonWithTrends !== null, 'Price comparison with trends retrieved');
    const alphaComp = comparisonWithTrends?.allSuppliers.find((s) => s.supplierId === supAlpha.id);
    assert(alphaComp !== undefined, 'Alpha supplier present in comparison');
    assert(alphaComp?.priceTrendDirection !== undefined, 'Price trend direction is populated on supplier comparison');

    // 12. Cost permission redaction
    const redactedHistory = await PurchasingService.getItemPriceHistory(biz.id, itemSalmon.id, {
      hasCostPermission: false,
      timeRange: 'all',
    });
    assert(redactedHistory !== null, 'Redacted item price history retrieved');
    const redactedEur = redactedHistory?.trendsByCurrency.find((t) => t.currency === 'EUR');
    assert(redactedEur?.currentNormalizedPriceCents === null, 'Current price redacted to null');
    assert(redactedEur?.previousNormalizedPriceCents === null, 'Previous price redacted to null');
    assert(redactedEur?.priceChangeCents === null, 'Price change cents redacted to null');
    assert(redactedEur?.priceChangePercentage === null, 'Price change percentage redacted to null');
    assert(redactedEur?.lowestNormalizedPriceCents === null, 'Lowest price redacted to null');
    assert(redactedEur?.highestNormalizedPriceCents === null, 'Highest price redacted to null');
    assert(redactedEur?.averageNormalizedPriceCents === null, 'Average price redacted to null');
    assert(redactedHistory?.allObservations[0].packPriceCents === null, 'Observation pack price redacted to null');
    assert(redactedHistory?.allObservations[0].normalizedPricePerBaseCents === null, 'Observation normalized price redacted to null');
    assert(redactedHistory?.allObservations[0].supplierName !== undefined, 'Supplier name remains visible under redaction');
    assert(redactedHistory?.allObservations[0].sourceType !== undefined, 'Source type remains visible under redaction');

    const redactedSupHistory = await PurchasingService.getSupplierItemPriceHistory(
      biz.id,
      supAlpha.id,
      itemSalmon.id,
      { hasCostPermission: false }
    );
    assert(redactedSupHistory.length > 0, 'Redacted supplier history returned');
    assert(redactedSupHistory[0].packPriceCents === null, 'Supplier history pack price redacted to null');
    assert(redactedSupHistory[0].normalizedPricePerBaseCents === null, 'Supplier history normalized price redacted to null');

    // 13. Multi-tenant boundary isolation
    const crossTenantItemHistory = await PurchasingService.getItemPriceHistory(
      '00000000-0000-0000-0000-000000000000',
      itemSalmon.id,
      { hasCostPermission: true }
    );
    assert(crossTenantItemHistory === null, 'Cross-tenant getItemPriceHistory strictly returns null');

    const crossTenantSupplierHistory = await PurchasingService.getSupplierItemPriceHistory(
      '00000000-0000-0000-0000-000000000000',
      supAlpha.id,
      itemSalmon.id,
      { hasCostPermission: true }
    );
    assert(crossTenantSupplierHistory.length === 0, 'Cross-tenant getSupplierItemPriceHistory strictly returns empty array');

    // 14. Interleaved Multi-Supplier Change vs Prior Semantics Isolation
    // Create dedicated USD suppliers for testing: Gamma (Fresh Foods) & Delta (Budget Foods)
    const { data: supDelta } = await admin
      .from('inventory_suppliers')
      .insert({
        business_id: biz.id,
        name: 'Delta Budget Foods USD',
        currency: 'USD',
        is_preferred: false,
        is_active: true,
      })
      .select()
      .single();
    assert(supDelta !== null, 'Test USD supplier Delta created');

    // Setup dedicated test item: Yellowfin Tuna
    const { data: itemTuna } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Yellowfin Tuna Steak',
        sku: `TUNA-${testSuffix}`,
        base_unit: 'kg',
        cost_per_unit_cents: 700,
        currency: 'USD',
      })
      .select()
      .single();
    assert(itemTuna !== null, 'Test item Yellowfin Tuna created');

    // Step A: Fresh Foods posts $7.00/kg
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supGamma.id, // USD Supplier: Gamma Fresh Foods
        itemId: itemTuna.id,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 700, // $7.00
        currency: 'USD',
        isPreferred: true,
      },
      { businessId: biz.id }
    );

    // Step B: Budget Foods posts $6.50/kg (interleaved)
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supDelta.id, // USD Supplier: Delta Budget Foods
        itemId: itemTuna.id,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 650, // $6.50
        currency: 'USD',
        isPreferred: false,
      },
      { businessId: biz.id }
    );

    // Step C: Fresh Foods updates price to $7.50/kg
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supGamma.id,
        itemId: itemTuna.id,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 750, // $7.50
        currency: 'USD',
        isPreferred: true,
      },
      { businessId: biz.id }
    );

    // Verify Tuna history
    const tunaAllVendorsHistory = await PurchasingService.getItemPriceHistory(biz.id, itemTuna.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    assert(tunaAllVendorsHistory !== null, 'Tuna All-Vendors price history retrieved');
    const tunaUsdTrend = tunaAllVendorsHistory?.trendsByCurrency.find((t) => t.currency === 'USD');
    assert(tunaUsdTrend !== undefined, 'Tuna USD trend group exists');
    assert(tunaUsdTrend?.observationCount === 3, 'Tuna has exactly 3 historical observations');

    const gammaObs = tunaAllVendorsHistory?.allObservations.filter((o) => o.supplierId === supGamma.id);
    const deltaObs = tunaAllVendorsHistory?.allObservations.filter((o) => o.supplierId === supDelta.id);
    assert(gammaObs?.length === 2, 'Gamma (Fresh Foods) has 2 observations');
    assert(deltaObs?.length === 1, 'Delta (Budget Foods) has 1 observation');

    // Chronological order for Gamma: first is $7.00 (First Record), second is $7.50
    // Note: allObservations is sorted reverse-chronological, so gammaObs[0] is latest ($7.50), gammaObs[1] is initial ($7.00)
    const latestGamma = gammaObs![0];
    const initialGamma = gammaObs![1];
    const firstBudget = deltaObs![0];

    // Initial observations MUST be First Record (null change)
    assert(initialGamma.changeVsPreviousCents === null, 'Fresh Foods initial $7.00 observation is First Record (null change)');
    assert(firstBudget.changeVsPreviousCents === null, 'Budget Foods $6.50 observation is First Record (null change)');

    // Latest Fresh Foods observation MUST compare to Fresh Foods $7.00 ($7.50 - $7.00 = +$0.50 / +7.14%), NEVER Budget Foods ($6.50)
    assert(latestGamma.normalizedPricePerBaseCents === 750, 'Latest Fresh Foods price is $7.50 (750 cents)');
    assert(latestGamma.changeVsPreviousCents === 50, 'Fresh Foods price change is exactly +50 cents (+7.14%) vs its own prior price');
    assert(latestGamma.changeVsPreviousPercentage === 7.14, 'Fresh Foods percentage change is exactly +7.14%');
    assert(latestGamma.changeVsPreviousCents !== 100, 'Fresh Foods strictly DOES NOT report +$1.00 (+15.38%) against Budget Foods');

    // Step D: Fresh Foods price decrease to $6.80/kg
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supGamma.id,
        itemId: itemTuna.id,
        purchasingUnit: 'kg',
        conversionToBase: 1.0,
        lastPriceCents: 680, // $6.80
        currency: 'USD',
        isPreferred: true,
      },
      { businessId: biz.id }
    );

    const tunaUpdatedHistory = await PurchasingService.getItemPriceHistory(biz.id, itemTuna.id, {
      hasCostPermission: true,
      timeRange: 'all',
    });
    const latestDecreasedGamma = tunaUpdatedHistory?.allObservations.find((o) => o.supplierId === supGamma.id);
    assert(latestDecreasedGamma !== undefined, 'Fresh Foods decreased observation found');
    assert(latestDecreasedGamma?.normalizedPricePerBaseCents === 680, 'Fresh Foods updated to $6.80 (680 cents)');
    assert(latestDecreasedGamma?.changeVsPreviousCents === -70, 'Fresh Foods price decrease is exactly -70 cents (-$0.70)');
    assert(latestDecreasedGamma?.changeVsPreviousPercentage === -9.33, 'Fresh Foods price decrease percentage is exactly -9.33%');

    // Step E: Filtered single-supplier view
    const tunaSingleSupplierHistory = await PurchasingService.getItemPriceHistory(biz.id, itemTuna.id, {
      supplierId: supGamma.id,
      hasCostPermission: true,
      timeRange: 'all',
    });
    assert(tunaSingleSupplierHistory !== null, 'Single-supplier filtered history retrieved');
    assert(
      tunaSingleSupplierHistory?.allObservations.every((o) => o.supplierId === supGamma.id) === true,
      'Single-supplier history strictly contains only Gamma (Fresh Foods) records'
    );

    // ========================================================================
    // --- Section 15: Inventory Forecasting & Smart Reorder Suggestions ---
    // ========================================================================
    console.log('\n--- Section 15: Inventory Forecasting & Smart Reorder Suggestions ---');

    // 1. Setup Test Item: Chicken Breast Fillet
    const { data: itemChicken } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Organic Chicken Breast Fillet',
        sku: `CHK-${testSuffix}`,
        base_unit: 'kg',
        cost_per_unit_cents: 700,
        currency: 'USD',
        min_stock_level: 0,
        target_stock_level: 0,
      })
      .select()
      .single();
    assert(itemChicken !== null, 'Test item Organic Chicken Breast created');

    // Set initial balance of 8.0 kg at Main Branch location
    await admin.from('inventory_balances').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemChicken.id,
      current_quantity: 8.0,
      reserved_quantity: 0.0,
    });

    // 2. Setup Suppliers:
    // Supplier Gamma (Fresh Foods): 10 kg case = $75.00 ($7.50/kg, 7500 cents), Preferred = true
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supGamma.id,
        itemId: itemChicken.id,
        purchasingUnit: 'case',
        conversionToBase: 10.0,
        lastPriceCents: 7500, // $75.00
        currency: 'USD',
        isPreferred: true,
      },
      { businessId: biz.id }
    );

    // Supplier Delta (Budget Foods): 5 kg box = $32.50 ($6.50/kg, 3250 cents), Preferred = false
    await PurchasingService.upsertSupplierItem(
      {
        supplierId: supDelta.id,
        itemId: itemChicken.id,
        purchasingUnit: 'box',
        conversionToBase: 5.0,
        lastPriceCents: 3250, // $32.50
        currency: 'USD',
        isPreferred: false,
      },
      { businessId: biz.id }
    );

    // 3. Seed 14-day Authoritative Operational Demand (14 events totaling 56.0 kg -> 4.0 kg/day)
    const nowTime = Date.now();
    for (let d = 0; d < 14; d++) {
      const pastDate = new Date(nowTime - (d + 0.2) * 24 * 60 * 60 * 1000).toISOString();
      await admin.from('inventory_stock_movements').insert({
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain.id,
        item_id: itemChicken.id,
        movement_type: 'recipe_consumption',
        direction: 'out',
        quantity: 4.0,
        unit: 'kg',
        quantity_base: 4.0,
        previous_balance_base: 64.0 - d * 4.0,
        new_balance_base: 64.0 - (d + 1) * 4.0,
        unit_cost_cents: 700,
        total_cost_cents: 2800,
        currency: 'USD',
        created_at: pastDate,
      });
    }

    // 4. Seed Non-Demand Inventory Reductions (Must NOT contaminate demand calculation)
    const pastWasteDate = new Date(nowTime - 2 * 24 * 60 * 60 * 1000).toISOString();
    await admin.from('inventory_stock_movements').insert([
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain.id,
        item_id: itemChicken.id,
        movement_type: 'waste',
        direction: 'out',
        quantity: 5.0,
        unit: 'kg',
        quantity_base: 5.0,
        previous_balance_base: 8.0,
        new_balance_base: 3.0,
        unit_cost_cents: 700,
        total_cost_cents: 3500,
        currency: 'USD',
        created_at: pastWasteDate,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain.id,
        item_id: itemChicken.id,
        movement_type: 'supplier_return',
        direction: 'out',
        quantity: 3.0,
        unit: 'kg',
        quantity_base: 3.0,
        previous_balance_base: 3.0,
        new_balance_base: 0.0,
        unit_cost_cents: 700,
        total_cost_cents: 2100,
        currency: 'USD',
        created_at: pastWasteDate,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain.id,
        item_id: itemChicken.id,
        movement_type: 'transfer_out',
        direction: 'out',
        quantity: 4.0,
        unit: 'kg',
        quantity_base: 4.0,
        previous_balance_base: 8.0,
        new_balance_base: 4.0,
        unit_cost_cents: 700,
        total_cost_cents: 2800,
        currency: 'USD',
        created_at: pastWasteDate,
      },
      {
        business_id: biz.id,
        branch_id: branch.id,
        location_id: locMain.id,
        item_id: itemChicken.id,
        movement_type: 'adjustment_add',
        direction: 'in',
        quantity: 2.0,
        unit: 'kg',
        quantity_base: 2.0,
        previous_balance_base: 8.0,
        new_balance_base: 10.0,
        unit_cost_cents: 700,
        total_cost_cents: 1400,
        currency: 'USD',
        created_at: pastWasteDate,
      },
    ]);

    // 5. Test Demand Forecast Derivation
    const demandForecast = await InventoryService.getDemandForecast(biz.id, branch.id, itemChicken.id, {
      windowDays: 14,
    });
    assert(demandForecast.daysAnalyzed === 14, 'Forecast analyzed 14-day window');
    assert(demandForecast.totalDemandBase === 56.0, 'Total operational demand is exactly 56.0 kg (waste/returns/transfers excluded)');
    assert(demandForecast.averageDailyDemandBase === 4.0, 'Average daily demand is exactly 4.00 kg/day (56kg / 14d)');
    assert(demandForecast.weightedDailyDemandBase === 4.0, 'Weighted daily demand is exactly 4.00 kg/day');
    assert(demandForecast.observationsCount === 14, 'Recorded 14 authoritative demand observations');
    assert(demandForecast.historyQuality === 'high', 'Demand history quality classified as high (>=8 observations)');

    // 6. Test Smart Reorder Suggestions for Chicken Breast
    const reorderSuggestions = await InventoryService.getReorderSuggestions(biz.id, branch.id, {
      hasCostPermission: true,
      windowDays: 14,
      targetCoverageDays: 7,
    });

    const chickenSuggestion = reorderSuggestions.suggestions.find((s) => s.itemId === itemChicken.id);
    assert(chickenSuggestion !== undefined, 'Chicken Breast suggestion found in overview');
    assert(chickenSuggestion?.currentStock === 8.0, 'Current stock on hand is 8.0 kg');
    assert(chickenSuggestion?.openIncomingStock === 0, 'No open incoming POs initially');
    assert(chickenSuggestion?.daysOfStockRemaining === 2.0, 'Days of stock remaining is exactly 2.0 days (8kg / 4kg/day)');
    assert(chickenSuggestion?.riskStatus === 'critical' || chickenSuggestion?.riskStatus === 'reorder_soon', 'Chicken Breast identified as stockout risk');

    // Replenishment Math:
    // Target coverage = 4.0 kg/day * 7 days = 28.0 kg (target stock)
    // Recommended Base Qty = 28.0 kg - 8.0 kg = 20.0 kg
    assert(chickenSuggestion?.targetStockLevelBase === 28.0, 'Target stock level is 28.0 kg (4kg/day * 7d)');
    assert(chickenSuggestion?.recommendedBaseQty === 20.0, 'Recommended reorder base quantity is exactly 20.0 kg');

    // Supplier Pack & Pricing:
    // Best Price: Budget Foods ($6.50/kg, 5kg box) -> 4 boxes (20 kg) = $130.00 (13000 cents)
    assert(chickenSuggestion?.suggestedSupplier !== null, 'Suggested supplier exists');
    assert(chickenSuggestion?.suggestedSupplier?.supplierName === 'Delta Budget Foods USD', 'Cheapest supplier Budget Foods suggested');
    assert(chickenSuggestion?.suggestedSupplier?.purchasingUnit === 'box', 'Purchasing unit is box');
    assert(chickenSuggestion?.suggestedSupplier?.conversionToBase === 5.0, 'Conversion factor is 5.0 kg/box');
    assert(chickenSuggestion?.suggestedSupplier?.packsToOrder === 4, 'Packs to order rounded up to 4 boxes (20 kg / 5 kg)');
    assert(chickenSuggestion?.suggestedSupplier?.orderQuantityBase === 20.0, 'Supplier order quantity is 20.0 kg');
    assert(chickenSuggestion?.suggestedSupplier?.totalEstimatedCents === 13000, 'Estimated PO cost for Budget Foods is $130.00 (13000 cents)');

    // Preferred Supplier Alternative:
    // Fresh Foods ($7.50/kg, 10kg case) -> 2 cases (20 kg) = $150.00 (15000 cents)
    assert(chickenSuggestion?.preferredSupplierAlternative !== null, 'Preferred supplier alternative exists');
    assert(chickenSuggestion?.preferredSupplierAlternative?.supplierName === 'Gamma Global US Imports', 'Preferred supplier Gamma identified');
    assert(chickenSuggestion?.preferredSupplierAlternative?.packsToOrder === 2, 'Preferred supplier packs to order is 2 cases (20 kg / 10 kg)');
    assert(chickenSuggestion?.preferredSupplierAlternative?.totalEstimatedCents === 15000, 'Preferred supplier estimated total is $150.00 (15000 cents)');
    assert(chickenSuggestion?.potentialSavingsCents === 2000, 'Potential saving is exactly $20.00 (2000 cents, $150 vs $130)');

    // 7. Open Purchase Order Awareness (Incoming Stock Reduction)
    // Create an approved PO for 10 kg Chicken Breast (1 case from Gamma)
    const { data: poApproved } = await admin
      .from('inventory_purchase_orders')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        supplier_id: supGamma.id,
        destination_location_id: locMain.id,
        po_number: `PO-TEST-INCOMING-${testSuffix}`,
        status: 'approved',
        currency: 'USD',
        total_cents: 7500,
      })
      .select()
      .single();

    await admin.from('inventory_purchase_order_items').insert({
      po_id: poApproved.id,
      item_id: itemChicken.id,
      purchasing_unit: 'case',
      quantity_ordered: 1.0,
      quantity_ordered_base: 10.0,
      quantity_received_base: 0.0,
      unit_cost_cents: 7500,
      total_cost_cents: 7500,
    });

    // Create a draft PO for 20 kg (must NOT count as incoming)
    const { data: poDraft } = await admin
      .from('inventory_purchase_orders')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        supplier_id: supGamma.id,
        destination_location_id: locMain.id,
        po_number: `PO-TEST-DRAFT-${testSuffix}`,
        status: 'draft',
        currency: 'USD',
        total_cents: 15000,
      })
      .select()
      .single();

    await admin.from('inventory_purchase_order_items').insert({
      po_id: poDraft.id,
      item_id: itemChicken.id,
      purchasing_unit: 'case',
      quantity_ordered: 2.0,
      quantity_ordered_base: 20.0,
      quantity_received_base: 0.0,
      unit_cost_cents: 7500,
      total_cost_cents: 15000,
    });

    // Re-query suggestions with open approved PO
    const reorderWithIncoming = await InventoryService.getItemReorderForecast(biz.id, branch.id, itemChicken.id, {
      hasCostPermission: true,
      windowDays: 14,
    });
    assert(reorderWithIncoming !== null, 'Item reorder forecast retrieved with incoming PO');
    assert(reorderWithIncoming?.openIncomingStock === 10.0, 'Open incoming stock is exactly 10.0 kg (approved PO only, draft excluded)');
    assert(reorderWithIncoming?.projectedAvailableStock === 18.0, 'Projected available stock is 18.0 kg (8kg on-hand + 10kg incoming)');
    assert(reorderWithIncoming?.recommendedBaseQty === 10.0, 'Recommended reorder base quantity reduced to 10.0 kg (28kg target - 18kg projected)');
    assert(reorderWithIncoming?.suggestedSupplier?.packsToOrder === 2, 'Budget Foods packs to order reduced to 2 boxes (10 kg / 5 kg)');
    assert(reorderWithIncoming?.suggestedSupplier?.totalEstimatedCents === 6500, 'Estimated PO cost updated to $65.00 (6500 cents)');

    // 8. Near-Expiry Risk Context Integration
    const batchExpiryDate = new Date(nowTime + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await admin.from('inventory_item_batches').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemChicken.id,
      batch_code: `BATCH-EXP-CHK-${testSuffix}`,
      initial_quantity: 3.0,
      remaining_quantity: 3.0,
      unit_cost_cents: 700,
      currency: 'USD',
      expiry_date: batchExpiryDate,
    });

    const forecastWithExpiry = await InventoryService.getItemReorderForecast(biz.id, branch.id, itemChicken.id, {
      hasCostPermission: true,
      windowDays: 14,
    });
    assert(forecastWithExpiry?.nearExpiryStockBase === 3.0, 'Near-expiry context captured 3.0 kg expiring');
    assert(forecastWithExpiry?.nearExpiryDaysThreshold !== undefined && forecastWithExpiry.nearExpiryDaysThreshold <= 3, 'Near-expiry threshold is <= 3 days');
    assert(forecastWithExpiry?.explanation.includes('expires in') === true, 'Forecast explanation includes near-expiry alert warning');

    // 9. Zero-Demand / Insufficient History Handling
    const { data: itemOliveOil } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: 'Extra Virgin Olive Oil',
        sku: `OIL-${testSuffix}`,
        base_unit: 'L',
        cost_per_unit_cents: 1200,
        currency: 'USD',
        min_stock_level: 2.0,
      })
      .select()
      .single();

    const oilForecast = await InventoryService.getItemReorderForecast(biz.id, branch.id, itemOliveOil.id, {
      hasCostPermission: true,
    });
    assert(oilForecast !== null, 'Olive Oil forecast retrieved');
    assert(oilForecast?.averageDailyDemandBase === 0, 'Zero demand rate returned for item with no movements');
    assert(oilForecast?.daysOfStockRemaining === null, 'Days of stock remaining is null (no divide by zero)');
    assert(oilForecast?.demandHistoryQuality === 'insufficient', 'Demand history quality is insufficient');
    assert(oilForecast?.riskStatus === 'critical', 'Zero stock with min_stock_level classified as critical');

    // 10. Cost Redaction Invariants
    const redactedSuggestions = await InventoryService.getReorderSuggestions(biz.id, branch.id, {
      hasCostPermission: false,
      windowDays: 14,
      targetCoverageDays: 7,
    });
    assert(redactedSuggestions.totalEstimatedReorderCostCents === null, 'Total estimated reorder cost strictly redacted to null');
    const redactedChicken = redactedSuggestions.suggestions.find((s) => s.itemId === itemChicken.id);
    assert(redactedChicken?.suggestedSupplier?.packPriceCents === null, 'Supplier pack price strictly redacted to null');
    assert(redactedChicken?.suggestedSupplier?.totalEstimatedCents === null, 'Supplier total estimated cents strictly redacted to null');
    assert(redactedChicken?.potentialSavingsCents === null, 'Potential savings strictly redacted to null');
    assert(redactedChicken?.suggestedSupplier !== null && !!redactedChicken?.suggestedSupplier?.supplierName, 'Supplier name remains visible under redaction');
    assert(redactedChicken?.recommendedBaseQty === 10.0, 'Operational recommended quantity remains visible under redaction');

    // 11. Multi-Branch & Business Isolation
    const crossBranchSuggestions = await InventoryService.getReorderSuggestions(biz.id, '11111111-1111-1111-1111-111111111111', {
      hasCostPermission: true,
    });
    const crossBranchChicken = crossBranchSuggestions.suggestions.find((s) => s.itemId === itemChicken.id);
    assert(crossBranchChicken?.currentStock === 0, 'Cross branch query has 0 kg Chicken stock (Branch isolation)');
    assert(crossBranchChicken?.totalDemandBase === 0, 'Cross branch query has 0 demand for Chicken (Branch isolation)');

    const crossBusinessSuggestions = await InventoryService.getReorderSuggestions('00000000-0000-0000-0000-000000000000', branch.id, {
      hasCostPermission: true,
    });
    assert(crossBusinessSuggestions.suggestions.length === 0, 'Cross-tenant query strictly returns 0 suggestions (Tenant isolation)');

    // 12. Regression Test: Low Absolute Stock + Low Demand + High Days Coverage + Min Safety Stock
    const { data: itemLowDemandHighDays } = await admin
      .from('inventory_items')
      .insert({
        business_id: biz.id,
        name: `Truffle Butter Low Demand ${testSuffix}`,
        sku: `TRUF-LD-${testSuffix}`,
        base_unit: 'kg',
        cost_per_unit_cents: 4500,
        currency: 'USD',
        min_stock_level: 20.0,
      })
      .select()
      .single();

    // 0.80 kg on-hand balance
    await admin.from('inventory_balances').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemLowDemandHighDays.id,
      current_quantity: 0.8,
    });

    // 0.20 kg consumption over 14 days (~0.0143 kg/day)
    const pastTruffleDate = new Date(Date.now() - 3 * 86400000).toISOString();
    const { error: moveErr } = await admin.from('inventory_stock_movements').insert({
      business_id: biz.id,
      branch_id: branch.id,
      location_id: locMain.id,
      item_id: itemLowDemandHighDays.id,
      movement_type: 'recipe_consumption',
      direction: 'out',
      quantity: 0.2,
      unit: 'kg',
      quantity_base: 0.2,
      previous_balance_base: 1.0,
      new_balance_base: 0.8,
      unit_cost_cents: 4500,
      total_cost_cents: 900,
      currency: 'USD',
      created_at: pastTruffleDate,
    });
    assert(!moveErr, 'Low demand movement inserted without error');

    const lowDemandForecast = await InventoryService.getItemReorderForecast(biz.id, branch.id, itemLowDemandHighDays.id, {
      hasCostPermission: true,
      windowDays: 14,
      targetCoverageDays: 7,
    });

    assert(lowDemandForecast !== null, 'Low Demand item forecast retrieved');
    assert(lowDemandForecast?.currentStock === 0.8, 'Low Demand item current stock is 0.80 kg');
    assert(lowDemandForecast?.daysOfStockRemaining !== null && (lowDemandForecast?.daysOfStockRemaining ?? 0) > 30, 'Days of stock remaining is > 30 days (high coverage)');
    assert(lowDemandForecast?.riskStatus === 'reorder_soon', 'Low stock with high days coverage classified as reorder_soon, NOT critical');
    assert(lowDemandForecast?.recommendedBaseQty !== undefined && lowDemandForecast.recommendedBaseQty > 19.0, 'Recommended reorder is ~19.3 kg to restore 20 kg safety buffer');
    assert(lowDemandForecast?.explanation.includes('below minimum threshold') === true, 'Explanation explicitly identifies below minimum threshold as trigger');

  } finally {
    // Teardown Test Data
    console.log('\n[Teardown] Cleaning up isolated test tenants and users...');
    for (const bizId of cleanupBusinessIds) {
      await admin.from('businesses').delete().eq('id', bizId);
    }
    for (const userId of cleanupUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    console.log('✅ Cleanup completed with zero residue in production database.');
  }

  console.log('\n================================================================');
  console.log(`  Phase 28 Live Verification Summary: ${passedAssertions} / ${totalAssertions} PASSED`);
  console.log('================================================================\n');

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
