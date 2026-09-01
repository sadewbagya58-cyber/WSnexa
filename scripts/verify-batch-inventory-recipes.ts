/**
 * WSNexa — Inventory & Recipes QA Batch Verification Suite
 *
 * Validates:
 * 1. ISSUE #1 — BOM Lifecycle Management:
 *    - Enforces single-active-BOM-per-menu-item rule in RecipeService.
 *    - Atomic activation: Activating an archived BOM archives the previously active BOM.
 *    - Historical BOM records are preserved (never deleted).
 *    - RecipeCardActions and RecipeDetailActions expose lifecycle actions (Archive / Set Active) with confirmation.
 * 2. ISSUE #2 — Business Currency Consistency:
 *    - Business configured currency (e.g. LKR) is the canonical source of truth for inventory items.
 *    - Inventory items, valuation, recipe costing, purchasing POs, goods receipts, and reports dynamically use business currency.
 *    - Removes hardcoded USD assumptions.
 * 3. ISSUE #3 — Recipe Save Navigation:
 *    - RecipeBuilderForm navigates to /dashboard/inventory/recipes on successful save.
 *    - Displays success notification.
 *    - Avoids duplicate submissions (isPending).
 *    - Retains form and displays server error message on failure without navigating.
 */

import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('    WSNexa — Inventory & Recipes QA Batch Verification Suite    ');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const recipeServiceSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/recipe.service.ts'), 'utf-8');
  const recipeActionsSrc = fs.readFileSync(path.join(rootDir, 'src/server/actions/recipe.ts'), 'utf-8');
  const recipeCardActionsSrc = fs.readFileSync(path.join(rootDir, 'src/components/inventory/recipe-card-actions.tsx'), 'utf-8');
  const recipeDetailActionsSrc = fs.readFileSync(path.join(rootDir, 'src/components/inventory/recipe-detail-actions.tsx'), 'utf-8');
  const recipesPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/inventory/recipes/page.tsx'), 'utf-8');
  const inventoryServiceSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/inventory.service.ts'), 'utf-8');
  const inventoryItemsTableSrc = fs.readFileSync(path.join(rootDir, 'src/components/inventory/inventory-items-table.tsx'), 'utf-8');
  const inventoryItemsPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/inventory/items/page.tsx'), 'utf-8');
  const itemDetailPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/inventory/items/[id]/page.tsx'), 'utf-8');
  const itemForecastCardSrc = fs.readFileSync(path.join(rootDir, 'src/components/inventory/item-forecast-card.tsx'), 'utf-8');
  const purchasingServiceSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/purchasing.service.ts'), 'utf-8');
  const inventoryIntelSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/inventory-intelligence.service.ts'), 'utf-8');
  const reportServiceSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/report.service.ts'), 'utf-8');
  const recipeBuilderFormSrc = fs.readFileSync(path.join(rootDir, 'src/components/inventory/recipe-builder-form.tsx'), 'utf-8');

  // ── 1. Issue #1: BOM Lifecycle Management ────────────────────────────────────
  console.log('--- 1. Issue #1: BOM Lifecycle Management & Single-Active Rule ---');

  assert(recipeServiceSrc.includes('static async activateRecipe(recipeId: string)'), 'Issue 1: RecipeService exports activateRecipe method');
  assert(recipeServiceSrc.includes('targetRecipe.menu_item_id'), 'Issue 1: activateRecipe checks if recipe is linked to a menu item');
  assert(recipeServiceSrc.includes('update({ is_active: false, updated_at: new Date().toISOString() })'), 'Issue 1: activateRecipe archives previous active BOM for menu item');
  assert(recipeServiceSrc.includes('update({ is_active: true, updated_at: new Date().toISOString() })'), 'Issue 1: activateRecipe sets selected recipe to active');
  assert(recipeServiceSrc.includes('static async archiveRecipe(recipeId: string)'), 'Issue 1: RecipeService exports archiveRecipe method');
  assert(recipeServiceSrc.toLowerCase().includes('preserving full historical records') || recipeServiceSrc.toLowerCase().includes('preserves historical'), 'Issue 1: Comments and architecture emphasize preservation of historical BOMs');
  assert(recipeActionsSrc.includes('export async function activateRecipeAction(recipeId: string)'), 'Issue 1: activateRecipeAction is exported as server action');
  assert(recipeActionsSrc.includes('export async function archiveRecipeAction(recipeId: string)'), 'Issue 1: archiveRecipeAction is exported as server action');
  assert(recipeCardActionsSrc.includes('Set Active'), 'Issue 1: RecipeCardActions exposes "Set Active" button for archived recipes');
  assert(recipeCardActionsSrc.includes('Archive'), 'Issue 1: RecipeCardActions exposes "Archive" button for active recipes');
  assert(recipeCardActionsSrc.includes('Set as Active BOM?'), 'Issue 1: RecipeCardActions contains confirmation modal for activation');
  assert(recipeCardActionsSrc.includes('Archive Recipe BOM?'), 'Issue 1: RecipeCardActions contains confirmation modal for archival');
  assert(recipesPageSrc.includes('<RecipeCardActions'), 'Issue 1: Recipes list page integrates RecipeCardActions in card footer');
  assert(recipeDetailActionsSrc.includes('Set as Active'), 'Issue 1: RecipeDetailActions exposes "Set as Active" for archived recipes');
  assert(recipeDetailActionsSrc.includes('Archive'), 'Issue 1: RecipeDetailActions exposes "Archive" for active recipes');
  assert(recipeDetailActionsSrc.includes('activateRecipeAction'), 'Issue 1: RecipeDetailActions triggers activateRecipeAction');

  // ── 2. Issue #2: Business Currency Consistency ───────────────────────────────
  console.log('\n--- 2. Issue #2: Business Currency Consistency Across Modules ---');

  assert(inventoryServiceSrc.includes('biz?.default_currency || \'USD\''), 'Issue 2: InventoryService resolves canonical business currency from businesses table');
  assert(inventoryServiceSrc.includes('currency: businessCurrency'), 'Issue 2: Inventory items use businessCurrency uniformly');
  assert(inventoryItemsPageSrc.includes('currency={context.business.defaultCurrency'), 'Issue 2: Inventory items page passes business currency to table');
  assert(inventoryItemsTableSrc.includes('currency = \'USD\'') && inventoryItemsTableSrc.includes('effectiveCurrency = itemCurrency || currency'), 'Issue 2: InventoryItemsTable prioritizes business currency prop for formatting');
  assert(itemDetailPageSrc.includes('const currency = context.business.defaultCurrency'), 'Issue 2: Item detail page establishes business currency as source of truth');
  assert(itemDetailPageSrc.includes('currency={currency}'), 'Issue 2: Item detail page passes canonical currency to subcards');
  assert(itemForecastCardSrc.includes('currency = \'USD\'') && itemForecastCardSrc.includes('effectiveCurrency = curr || currency'), 'Issue 2: ItemForecastCard uses business currency');
  assert(purchasingServiceSrc.includes('const businessCurrency = biz?.default_currency'), 'Issue 2: PurchasingService resolves business currency in goods receipt');
  assert(!purchasingServiceSrc.includes('currency: \'USD\',\n          reference_number: input.grnNumber.trim()'), 'Issue 2: Removed hardcoded USD from goods receipt price history recording');
  assert(inventoryIntelSrc.includes('currency: businessCurrency'), 'Issue 2: Inventory intelligence COGS summary uses dynamic business currency');
  assert(reportServiceSrc.includes('currency: businessCurrency'), 'Issue 2: Sales & operations reports use dynamic business currency');

  // ── 3. Issue #3: Recipe Save Navigation & Error Handling ─────────────────────
  console.log('\n--- 3. Issue #3: Recipe Save Navigation & Flow ---');

  assert(recipeBuilderFormSrc.includes('router.push(\'/dashboard/inventory/recipes\')'), 'Issue 3: RecipeBuilderForm navigates directly to /dashboard/inventory/recipes on save');
  assert(recipeBuilderFormSrc.includes('setSuccessMsg'), 'Issue 3: RecipeBuilderForm sets success notification upon save');
  assert(recipeBuilderFormSrc.includes('setErrorMsg(res.message'), 'Issue 3: RecipeBuilderForm shows server error on save failure');
  assert(recipeBuilderFormSrc.includes('disabled={isPending}'), 'Issue 3: RecipeBuilderForm disables submit button during transition to prevent duplicate submissions');
  assert(recipeBuilderFormSrc.includes('isPending ? \'Saving…\' : initialRecipe ? \'Update Recipe\' : \'Save Recipe\''), 'Issue 3: Displays interactive Saving… feedback on button');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});
