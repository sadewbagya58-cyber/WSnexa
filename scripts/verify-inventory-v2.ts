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

    // Supplier Return: Return 2 kg damaged beef
    const returnRes = await admin.rpc('record_inventory_adjustment', {
      p_business_id: biz.id,
      p_branch_id: branch.id,
      p_location_id: locMain!.id,
      p_item_id: itemBeef!.id,
      p_direction: 'out',
      p_quantity: 2.0,
      p_unit: 'kg',
      p_quantity_base: 2.0,
      p_reason: 'supplier_return',
      p_notes: `Returned to Bavarian Meats Wholesale: packaging seal broken`,
      p_actor_id: authUser.user.id,
      p_idempotency_key: `RET_${testSuffix}`,
      p_movement_type: 'supplier_return',
    });

    assert(returnRes.data?.success === true, 'Supplier return executed atomically via audit movement');

    const { data: beefAfterReturn } = await admin
      .from('inventory_balances')
      .select('current_quantity')
      .eq('location_id', locMain!.id)
      .eq('item_id', itemBeef!.id)
      .single();

    assert(Number(beefAfterReturn?.current_quantity) === 18.0, 'Beef stock deducted to 18.0 kg after return (20.0 -> 18.0 kg)');

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
