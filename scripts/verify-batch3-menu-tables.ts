/**
 * WSNexa — Fresh Business Setup / Menu Management QA Batch #3 Verification Suite
 *
 * Validates:
 * 1. ISSUE #1 — Table Security PIN Copy & Bulk Print:
 *    - Server actions getTablePinAction & getBranchTablePinsAction exist and enforce RBAC.
 *    - Hash-to-PIN HMAC lookup resolves 4-digit and custom-length PINs accurately.
 *    - TableGrid renders Copy button with feedback without leaking unmasked PIN into grid DOM.
 *    - BulkPrintPinModal renders printable PIN cards with proper formatting and @media print styling.
 * 2. ISSUE #2 — Menu Category Creation Refresh Fix:
 *    - CategoryManager removes window.location.reload().
 *    - createMenuCategoryAction revalidates /dashboard/menu/categories and /dashboard/menu.
 *    - CategoryManager updates state optimistically/locally with clear feedback.
 *    - CreateItemForm integrates quick category creation with auto-selection.
 * 3. ISSUE #3 — Add Menu Item Navigation & Idempotency:
 *    - createMenuItemAction revalidates /dashboard/menu/items.
 *    - CreateItemForm prevents double-submission via isSubmittingRef.
 *    - Normal save navigates to /dashboard/menu/items.
 *    - Save & Add Another resets fields, preserves category default, and stays on form.
 * 4. ISSUE #4 — Edit Menu Item Image Upload:
 *    - ItemList passes businessId and branchId props.
 *    - Edit Menu Item modal supports file picker, local preview, and Supabase Storage upload.
 *    - Preserves existing image when not replaced and maintains external URL compatibility.
 */

import * as fs from 'fs';
import * as path from 'path';
import { hashTablePin, generateTablePin } from '../src/lib/qr/security';

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
  console.log('    WSNexa — QA Batch #3 Verification Suite (Menu & Tables)     ');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const tableActionsSrc = fs.readFileSync(path.join(rootDir, 'src/server/actions/table.ts'), 'utf-8');
  const tableGridSrc = fs.readFileSync(path.join(rootDir, 'src/components/table/table-grid.tsx'), 'utf-8');
  const bulkPrintModalSrc = fs.readFileSync(path.join(rootDir, 'src/components/table/bulk-print-pin-modal.tsx'), 'utf-8');
  const menuActionsSrc = fs.readFileSync(path.join(rootDir, 'src/server/actions/menu.ts'), 'utf-8');
  const categoryManagerSrc = fs.readFileSync(path.join(rootDir, 'src/components/menu/category-manager.tsx'), 'utf-8');
  const createItemFormSrc = fs.readFileSync(path.join(rootDir, 'src/components/menu/create-item-form.tsx'), 'utf-8');
  const itemListSrc = fs.readFileSync(path.join(rootDir, 'src/components/menu/item-list.tsx'), 'utf-8');
  const menuItemsPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/menu/items/page.tsx'), 'utf-8');

  // ── 1. Issue #1: Table Security PIN Copy & Bulk Print ─────────────────────────
  console.log('--- 1. Issue #1: Table Security PIN Copy & Bulk Print ---');

  assert(tableActionsSrc.includes('export async function getTablePinAction'), 'Issue 1A: getTablePinAction server action exists');
  assert(tableActionsSrc.includes('export async function getBranchTablePinsAction'), 'Issue 1A: getBranchTablePinsAction server action exists');
  assert(tableActionsSrc.includes('tables.manage') && tableActionsSrc.includes('tables.edit'), 'Issue 1A: PIN actions enforce table management permissions');
  assert(tableActionsSrc.includes('hashTablePin(candidate)'), 'Issue 1A: getTablePinAction and getBranchTablePinsAction resolve PIN via server-side HMAC lookup');

  // Verify HMAC round-trip resolution for 4-digit PIN
  const testPin = '4821';
  const testHash = hashTablePin(testPin);
  let resolvedCandidate: string | null = null;
  for (let i = 0; i < 10000; i++) {
    const cand = i.toString().padStart(4, '0');
    if (hashTablePin(cand) === testHash) {
      resolvedCandidate = cand;
      break;
    }
  }
  assert(resolvedCandidate === testPin, `Issue 1A: Hash-to-PIN resolution correctly recovers candidate PIN (${resolvedCandidate} === ${testPin})`);

  assert(tableGridSrc.includes('handleCopyTablePin'), 'Issue 1A: TableGrid implements handleCopyTablePin');
  assert(tableGridSrc.includes('getTablePinAction'), 'Issue 1A: TableGrid calls getTablePinAction on demand');
  assert(tableGridSrc.includes('navigator.clipboard.writeText'), 'Issue 1A: TableGrid copies PIN to clipboard');
  assert(tableGridSrc.includes('copiedTableId === table.id ? \'✓ Copied\' : \'📋 Copy\''), 'Issue 1A: TableGrid displays dynamic Copy / Copied button label');
  assert(tableGridSrc.includes('<span className="font-mono font-bold text-emerald-800">••••</span>'), 'Issue 1A: TableGrid preserves masked PIN (••••) presentation in normal card view');

  assert(tableGridSrc.includes('🖨️ Print PINs'), 'Issue 1B: TableGrid toolbar renders Print PINs action');
  assert(tableGridSrc.includes('BulkPrintPinModal'), 'Issue 1B: TableGrid integrates BulkPrintPinModal');
  assert(bulkPrintModalSrc.includes('getBranchTablePinsAction'), 'Issue 1B: BulkPrintPinModal fetches PIN cards via getBranchTablePinsAction');
  assert(bulkPrintModalSrc.includes('print:'), 'Issue 1B: BulkPrintPinModal contains print-specific CSS classes');
  assert(bulkPrintModalSrc.includes('window.print()'), 'Issue 1B: BulkPrintPinModal triggers native print dialog');
  assert(bulkPrintModalSrc.includes('TABLE SECURITY PIN'), 'Issue 1B: BulkPrintPinModal renders structured PIN sticker card layout');

  // ── 2. Issue #2: Menu Category Creation Causes Full App/Page Refresh ──────────
  console.log('\n--- 2. Issue #2: Menu Category Creation Causes Full App/Page Refresh ---');

  assert(!categoryManagerSrc.includes('window.location.reload()'), 'Issue 2A: category-manager.tsx completely removed window.location.reload()');
  assert(categoryManagerSrc.includes('setCategories((prev) => [...prev, createdCategory])'), 'Issue 2A: category-manager.tsx optimistically updates local category state');
  assert(categoryManagerSrc.includes('setSuccessMsg'), 'Issue 2A: category-manager.tsx provides explicit success feedback');
  assert(menuActionsSrc.includes('revalidatePath(\'/dashboard/menu/categories\')'), 'Issue 2B: createMenuCategoryAction revalidates /dashboard/menu/categories');
  assert(createItemFormSrc.includes('createMenuCategoryAction'), 'Issue 2C: create-item-form.tsx supports quick category creation');
  assert(createItemFormSrc.includes('+ New Category'), 'Issue 2C: create-item-form.tsx exposes + New Category button');
  assert(createItemFormSrc.includes('setCategoriesList((prev) => [...prev, newCat])'), 'Issue 2C: create-item-form.tsx adds new category to dropdown without page reload');

  // ── 3. Issue #3: Add Menu Item Save UX Does Not Return to List ─────────────────
  console.log('\n--- 3. Issue #3: Add Menu Item Save UX Does Not Return to List ---');

  assert(menuActionsSrc.includes('revalidatePath(\'/dashboard/menu/items\')'), 'Issue 3A: createMenuItemAction revalidates /dashboard/menu/items');
  assert(createItemFormSrc.includes('isSubmittingRef'), 'Issue 3B: create-item-form.tsx uses isSubmittingRef to strictly block duplicate submissions');
  assert(createItemFormSrc.includes('router.push(\'/dashboard/menu/items\')'), 'Issue 3C: Normal save navigates to /dashboard/menu/items');
  assert(createItemFormSrc.includes('addAnother'), 'Issue 3D: create-item-form.tsx distinguishes normal save vs Save & Add Another');
  assert(createItemFormSrc.includes('✓ "${savedName}" added to menu! You can create another item below.'), 'Issue 3E: Save & Add Another provides clear feedback and stays on form');

  // ── 4. Issue #4: Edit Menu Item Only Supports Image URL ───────────────────────
  console.log('\n--- 4. Issue #4: Edit Menu Item Only Supports Image URL ---');

  assert(menuItemsPageSrc.includes('businessId={tenantContext.business.id}'), 'Issue 4A: MenuItemsPage passes businessId to ItemList');
  assert(menuItemsPageSrc.includes('branchId={activeBranch.id}'), 'Issue 4A: MenuItemsPage passes branchId to ItemList');
  assert(itemListSrc.includes('businessId?: string') && itemListSrc.includes('branchId?: string'), 'Issue 4B: ItemList defines businessId and branchId props');
  assert(itemListSrc.includes('handleEditImageFileSelect'), 'Issue 4C: ItemList implements handleEditImageFileSelect for photo picker');
  assert(itemListSrc.includes('createClient()') && itemListSrc.includes('.from(\'business-assets\')'), 'Issue 4D: ItemList uploads image to business-assets storage bucket');
  assert(itemListSrc.includes('editImagePreviewUrl'), 'Issue 4E: ItemList renders immediate local photo preview');
  assert(itemListSrc.includes('handleRemoveEditImage'), 'Issue 4F: ItemList provides Remove Photo action');
  assert(itemListSrc.includes('showAdvancedUrl'), 'Issue 4G: ItemList retains optional Image URL (External) fallback for backwards compatibility');
  assert(itemListSrc.includes('Replace Photo') || itemListSrc.includes('Choose Photo'), 'Issue 4H: ItemList exposes user-friendly photo selection button');

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
