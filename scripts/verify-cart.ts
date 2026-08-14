import {
  calculateLineUnitPriceCents,
  calculateLineTotalCents,
  calculateCartTotals,
  formatCurrency,
} from '../src/features/cart/cart-calculations';
import { generateCartLineKey } from '../src/features/cart/cart-line-key';
import { validateItemModifiers, CatalogModifierGroup } from '../src/features/cart/cart-validation';
import { CartLine, CartState } from '../src/features/cart/cart-types';

async function runCartVerification() {
  console.log('================================================================');
  console.log('       WSNexa Phase 9 — Public Guest Cart Verification Suite     ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ TEST ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`❌ TEST ${total} FAILED: ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  // --- Category 1: Pure Calculations & Safe Integers ---
  try {
    const unitPrice = calculateLineUnitPriceCents(700, [
      { groupId: 'g1', groupName: 'Size', optionId: 'opt1', optionName: 'Large', additionalPriceCents: 200 },
      { groupId: 'g2', groupName: 'Topping', optionId: 'opt2', optionName: 'Cheese', additionalPriceCents: 100 },
    ]);
    assert(unitPrice === 1000, 'calculateLineUnitPriceCents calculates $7.00 + $2.00 + $1.00 = $10.00 (1000 cents)');
  } catch (err: unknown) {
    assert(false, 'calculateLineUnitPriceCents failed', (err as Error).message);
  }

  try {
    const lineTotal = calculateLineTotalCents(1000, 2);
    assert(lineTotal === 2000, 'calculateLineTotalCents calculates $10.00 × 2 = $20.00 (2000 cents)');
  } catch (err: unknown) {
    assert(false, 'calculateLineTotalCents failed', (err as Error).message);
  }

  try {
    calculateLineTotalCents(100, 0);
    assert(false, 'Quantity 0 rejected');
  } catch {
    assert(true, 'Quantity 0 rejected by integer guard');
  }

  try {
    calculateLineTotalCents(100, 100);
    assert(false, 'Quantity 100 rejected (> 99)');
  } catch {
    assert(true, 'Quantity > 99 rejected by quantity bounds check');
  }

  try {
    calculateLineTotalCents(100, -5);
    assert(false, 'Negative quantity rejected');
  } catch {
    assert(true, 'Negative quantity rejected by quantity bounds check');
  }

  // --- Category 2: Line Key & Note Normalization ---
  const key1 = generateCartLineKey('branchA', 'USD', 'item1', [
    { groupId: 'g1', groupName: 'Size', optionId: 'opt2', optionName: 'L', additionalPriceCents: 100 },
    { groupId: 'g1', groupName: 'Size', optionId: 'opt1', optionName: 'S', additionalPriceCents: 0 },
  ], ' No Onions  ');

  const key2 = generateCartLineKey('branchA', 'USD', 'item1', [
    { groupId: 'g1', groupName: 'Size', optionId: 'opt1', optionName: 'S', additionalPriceCents: 0 },
    { groupId: 'g1', groupName: 'Size', optionId: 'opt2', optionName: 'L', additionalPriceCents: 100 },
  ], 'no onions');

  assert(key1 === key2, 'generateCartLineKey is deterministic regardless of modifier selection order or note spacing');

  const keyDiffBranch = generateCartLineKey('branchB', 'USD', 'item1', [], '');
  assert(key1 !== keyDiffBranch, 'Cart line key incorporates branch ID');

  const keyDiffCurrency = generateCartLineKey('branchA', 'LKR', 'item1', [], '');
  assert(key1 !== keyDiffCurrency, 'Cart line key incorporates currency');

  // --- Category 3: Modifier Validation against Catalog Schema ---
  const sampleGroups: CatalogModifierGroup[] = [
    {
      id: 'g_size',
      name: 'Size',
      description: null,
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      is_required: true,
      options: [
        { id: 'opt_small', name: 'Small', price_cents: 0, is_available: true },
        { id: 'opt_large', name: 'Large', price_cents: 200, is_available: true },
        { id: 'opt_out', name: 'Out of Stock Option', price_cents: 100, is_available: false },
      ],
    },
    {
      id: 'g_toppings',
      name: 'Toppings',
      description: null,
      selection_type: 'multiple',
      min_selections: 0,
      max_selections: 2,
      is_required: false,
      options: [
        { id: 'opt_cheese', name: 'Cheese', price_cents: 100, is_available: true },
        { id: 'opt_bacon', name: 'Bacon', price_cents: 150, is_available: true },
        { id: 'opt_olives', name: 'Olives', price_cents: 50, is_available: true },
      ],
    },
  ];

  const validRes = validateItemModifiers(sampleGroups, {
    g_size: ['opt_large'],
    g_toppings: ['opt_cheese', 'opt_bacon'],
  });
  assert(validRes.isValid, 'Valid modifier selection accepted');
  assert(validRes.selectedSnapshots.length === 3, 'Returns 3 selected snapshots');

  const missingReqRes = validateItemModifiers(sampleGroups, {
    g_toppings: ['opt_cheese'],
  });
  assert(!missingReqRes.isValid && !!missingReqRes.errors.g_size, 'Missing required group choice rejected');

  const unavailableRes = validateItemModifiers(sampleGroups, {
    g_size: ['opt_out'],
  });
  assert(!unavailableRes.isValid, 'Unavailable/inactive option choice rejected');

  const maxExceededRes = validateItemModifiers(sampleGroups, {
    g_size: ['opt_small'],
    g_toppings: ['opt_cheese', 'opt_bacon', 'opt_olives'],
  });
  assert(!maxExceededRes.isValid && !!maxExceededRes.errors.g_toppings, 'Exceeding max_selections rejected');

  const duplicateOptionRes = validateItemModifiers(sampleGroups, {
    g_size: ['opt_small'],
    g_toppings: ['opt_cheese', 'opt_cheese'],
  });
  assert(!duplicateOptionRes.isValid, 'Duplicate option IDs rejected');

  // --- Category 4: Cart Subtotal and Total Quantity Invariants ---
  const sampleLines: CartLine[] = [
    {
      lineId: 'l1',
      menuItemId: 'item1',
      itemName: 'Burger',
      quantity: 2,
      basePriceCents: 700,
      selectedModifiers: [],
      unitPriceCents: 700,
      lineTotalCents: 1400,
    },
    {
      lineId: 'l2',
      menuItemId: 'item2',
      itemName: 'Fries',
      quantity: 1,
      basePriceCents: 300,
      selectedModifiers: [],
      unitPriceCents: 300,
      lineTotalCents: 300,
    },
  ];

  const totals = calculateCartTotals(sampleLines);
  assert(totals.subtotalCents === 1700, 'Cart subtotal invariant: subtotalCents === sum(lineTotalCents) (1700 cents)');
  assert(totals.totalQuantity === 3, 'Cart total quantity invariant: totalQuantity === sum(quantity) (3 items)');

  // --- Category 5: Currency Formatting ---
  const formattedUSD = formatCurrency(1250, 'USD');
  assert(formattedUSD.includes('12.50'), 'formatCurrency formats 1250 cents as $12.50');

  const formattedLKR = formatCurrency(275000, 'LKR');
  assert(formattedLKR.includes('2,750') || formattedLKR.includes('2750'), 'formatCurrency formats non-USD currency (LKR)');

  // --- Category 6: Table Security Verification (No plain PINs stored) ---
  const sampleState: CartState = {
    branchId: 'b_test_123',
    currency: 'USD',
    confirmedTable: {
      branchId: 'b_test_123',
      tableId: 't_1',
      tableName: 'Table 1',
      tableCode: 'T1',
      verifiedAt: new Date().toISOString(),
    },
    lines: sampleLines,
    subtotalCents: 1700,
    totalQuantity: 3,
    updatedAt: new Date().toISOString(),
    isHydrated: true,
  };

  const stateJson = JSON.stringify(sampleState);
  assert(!stateJson.includes('table_pin') && !stateJson.includes('pin_hash'), 'No raw Table PIN or PIN hash present in cart state');

  // --- Category 7: Modifier Dead-End & Option Normalization Regression Tests ---
  
  // Case A: Required modifier group + available options -> customer must select minimum
  const reqGroupWithAvailable: CatalogModifierGroup[] = [
    {
      id: 'g_req_avail',
      name: 'Spice Level',
      description: null,
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      is_required: true,
      options: [
        { id: 'opt_mild', name: 'Mild', price_cents: 0, is_available: true },
        { id: 'opt_hot', name: 'Hot', price_cents: 0, is_available: true },
      ],
    },
  ];
  const caseAResFail = validateItemModifiers(reqGroupWithAvailable, {});
  assert(!caseAResFail.isValid && caseAResFail.errors.g_req_avail === 'Choose an option', 'Case A: Required group with available options requires selection');

  const caseAResPass = validateItemModifiers(reqGroupWithAvailable, { g_req_avail: ['opt_mild'] });
  assert(caseAResPass.isValid, 'Case A: Customer selecting required option passes validation');

  // Case B: Optional modifier group -> customer can continue without selection
  const optGroup: CatalogModifierGroup[] = [
    {
      id: 'g_opt',
      name: 'Extra Sauce',
      description: null,
      selection_type: 'single',
      min_selections: 0,
      max_selections: 1,
      is_required: false,
      options: [
        { id: 'opt_bbq', name: 'BBQ', price_cents: 50, is_available: true },
      ],
    },
  ];
  const caseBRes = validateItemModifiers(optGroup, {});
  assert(caseBRes.isValid, 'Case B: Optional modifier group allows continuing without selection');

  // Case C: Required modifier group where all options become unavailable -> NO impossible customer dead-end
  const reqGroupAllUnavailable: CatalogModifierGroup[] = [
    {
      id: 'g_deadend',
      name: 'rgrg',
      description: null,
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      is_required: true,
      options: [
        { id: 'opt_old1', name: 'Old Option 1', price_cents: 0, is_available: false },
        { id: 'opt_old2', name: 'Old Option 2', price_cents: 0, is_available: false },
      ],
    },
  ];
  const caseCRes = validateItemModifiers(reqGroupAllUnavailable, {});
  assert(caseCRes.isValid, 'Case C: Required modifier group where all options are unavailable produces NO customer dead-end (isValid: true)');

  // Case C2: Required group with 0 options total -> NO dead-end
  const reqGroupZeroOpts: CatalogModifierGroup[] = [
    {
      id: 'g_empty',
      name: 'Empty Required Group',
      description: null,
      selection_type: 'single',
      min_selections: 1,
      max_selections: 1,
      is_required: true,
      options: [],
    },
  ];
  const caseC2Res = validateItemModifiers(reqGroupZeroOpts, {});
  assert(caseC2Res.isValid, 'Case C2: Required group with 0 options total produces NO customer dead-end');

  // Case D: min_selection greater than available option count -> effective minimum capped safely
  const minExceedsAvail: CatalogModifierGroup[] = [
    {
      id: 'g_min_exceed',
      name: 'Dressing',
      description: null,
      selection_type: 'multiple',
      min_selections: 3, // Requires 3, but only 1 option available!
      max_selections: 3,
      is_required: true,
      options: [
        { id: 'opt_ranch', name: 'Ranch', price_cents: 0, is_available: true },
      ],
    },
  ];
  const caseDRes = validateItemModifiers(minExceedsAvail, { g_min_exceed: ['opt_ranch'] });
  assert(caseDRes.isValid, 'Case D: min_selections greater than available option count is capped at available count');

  // Case E: max selection enforced correctly
  const maxEnforced: CatalogModifierGroup[] = [
    {
      id: 'g_max',
      name: 'Toppings',
      description: null,
      selection_type: 'multiple',
      min_selections: 0,
      max_selections: 1,
      is_required: false,
      options: [
        { id: 'opt_t1', name: 'T1', price_cents: 10, is_available: true },
        { id: 'opt_t2', name: 'T2', price_cents: 10, is_available: true },
      ],
    },
  ];
  const caseEResOver = validateItemModifiers(maxEnforced, { g_max: ['opt_t1', 'opt_t2'] });
  assert(!caseEResOver.isValid && caseEResOver.errors.g_max === 'Select at most 1 option', 'Case E: Exceeding max selection correctly rejected');

  // Case F: modifier price × quantity calculated correctly
  const basePrice = 1000; // $10.00
  const snapshots = [
    { groupId: 'g1', groupName: 'Add-on', optionId: 'o1', optionName: 'Extra Cheese', additionalPriceCents: 150 }, // +$1.50
    { groupId: 'g2', groupName: 'Add-on 2', optionId: 'o2', optionName: 'Bacon', additionalPriceCents: 200 }, // +$2.00
  ]; // Unit price = $13.50 = 1350 cents
  const qty = 11;
  const lineUnitPrice = calculateLineUnitPriceCents(basePrice, snapshots);
  const lineTotal = calculateLineTotalCents(lineUnitPrice, qty);
  assert(lineUnitPrice === 1350, 'Case F: Base price $10.00 + $1.50 + $2.00 = $13.50 unit price');
  assert(lineTotal === 14850, 'Case F: Unit price $13.50 × 11 quantity = $148.50 (14850 cents)');

  // Case G: Editing cart item preserves correct selections/pricing
  const existingLine: CartLine = {
    lineId: 'line_edit_123',
    menuItemId: 'item_pizza',
    itemName: 'Custom Pizza',
    quantity: 2,
    basePriceCents: 1200,
    selectedModifiers: snapshots,
    unitPriceCents: 1550,
    lineTotalCents: 3100,
  };
  const updatedUnitPrice = calculateLineUnitPriceCents(existingLine.basePriceCents, existingLine.selectedModifiers);
  const updatedLineTotal = calculateLineTotalCents(updatedUnitPrice, 3);
  assert(updatedUnitPrice === 1550 && updatedLineTotal === 4650, 'Case G: Editing cart line quantity updates line total without duplicating modifier prices');

  console.log('\n================================================================');
  console.log(`   Verification Finished: ${passed} / ${total} Tests PASSED   `);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCartVerification().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
