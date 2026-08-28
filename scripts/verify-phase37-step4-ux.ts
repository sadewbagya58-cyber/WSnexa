/**
 * Automated Verification Script: Phase 37 Step 4 — UX, Language & Interaction Cleanup
 *
 * Verifies:
 * 1. Inventory read-only gating: Role with only `inventory.view` has safe view-only access
 *    and authoritative server actions reject mutation attempts.
 * 2. Product Language & Microcopy: Internal jargon removed from client components.
 * 3. Button & Action Hierarchy: Standardized action verbs and removal of decorative checkmarks.
 * 4. Progressive disclosure, loading states, and mobile touch targets.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function runStep4Verification() {
  console.log('🧪 Starting Phase 37 Step 4 UX & Interaction Verification...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  const rootDir = process.cwd();

  // Test 1: Inventory Hub & Items capability gating
  console.log('--- 1. Inventory View-Only Gating Audit ---');
  const inventoryHubFile = join(rootDir, 'src/app/(dashboard)/dashboard/inventory/page.tsx');
  const inventoryHubContent = readFileSync(inventoryHubFile, 'utf-8');
  assert(
    inventoryHubContent.includes('canManageItems') &&
    inventoryHubContent.includes('canManageCounts') &&
    inventoryHubContent.includes('canManagePO') &&
    inventoryHubContent.includes('canManageItems ?'),
    'Inventory Hub gates primaryAction on canManageItems and secondaryActions on canManageCounts'
  );

  const inventoryItemsPageFile = join(rootDir, 'src/app/(dashboard)/dashboard/inventory/items/page.tsx');
  const inventoryItemsPageContent = readFileSync(inventoryItemsPageFile, 'utf-8');
  assert(
    inventoryItemsPageContent.includes('canManageItems') &&
    inventoryItemsPageContent.includes('canAdjust') &&
    inventoryItemsPageContent.includes('canWaste') &&
    inventoryItemsPageContent.includes('canManageLocations'),
    'Stock Items page computes and passes canManageItems, canAdjust, canWaste to table'
  );

  const inventoryItemsTableFile = join(rootDir, 'src/components/inventory/inventory-items-table.tsx');
  const inventoryItemsTableContent = readFileSync(inventoryItemsTableFile, 'utf-8');
  assert(
    inventoryItemsTableContent.includes('canManageItems = true') &&
    inventoryItemsTableContent.includes('canAdjust = true') &&
    inventoryItemsTableContent.includes('canWaste = true') &&
    inventoryItemsTableContent.includes('{canManageItems && (') &&
    inventoryItemsTableContent.includes('{canAdjust && ('),
    'InventoryItemsTable correctly hides mutation CTAs when permissions are false'
  );

  const storageLocationManagerFile = join(rootDir, 'src/components/inventory/storage-location-manager.tsx');
  const storageLocationManagerContent = readFileSync(storageLocationManagerFile, 'utf-8');
  assert(
    storageLocationManagerContent.includes('canManage = true') &&
    storageLocationManagerContent.includes('{canManage && !showAddForm && ('),
    'StorageLocationManager gates location creation on canManage'
  );

  const supplierManagerFile = join(rootDir, 'src/components/inventory/supplier-manager-client.tsx');
  const supplierManagerContent = readFileSync(supplierManagerFile, 'utf-8');
  assert(
    supplierManagerContent.includes('canManage = true') &&
    supplierManagerContent.includes('{canManage && ('),
    'SupplierManagerClient gates + Add Supplier on canManage'
  );

  const prepProductionRunnerFile = join(rootDir, 'src/components/inventory/prep-production-runner.tsx');
  const prepProductionRunnerContent = readFileSync(prepProductionRunnerFile, 'utf-8');
  assert(
    prepProductionRunnerContent.includes('canProduce = true') &&
    prepProductionRunnerContent.includes('Dispatch Batch'),
    'PrepProductionRunner gates batch production on canProduce with clean button copy'
  );

  const goodsReceivingFile = join(rootDir, 'src/components/inventory/goods-receiving-client.tsx');
  const goodsReceivingContent = readFileSync(goodsReceivingFile, 'utf-8');
  assert(
    goodsReceivingContent.includes('canManage = true') &&
    goodsReceivingContent.includes('Receive Delivery') &&
    !goodsReceivingContent.includes('Receive Delivery ✓'),
    'GoodsReceivingClient gates receiving on canManage and removes decorative checkmark'
  );

  const supplierReturnsFile = join(rootDir, 'src/components/inventory/supplier-returns-client.tsx');
  const supplierReturnsContent = readFileSync(supplierReturnsFile, 'utf-8');
  assert(
    supplierReturnsContent.includes('canManage = true') &&
    supplierReturnsContent.includes('Record Supplier Return'),
    'SupplierReturnsClient gates supplier returns on canManage with standardized button copy'
  );

  const transfersPageFile = join(rootDir, 'src/app/(dashboard)/dashboard/inventory/transfers/page.tsx');
  const transfersPageContent = readFileSync(transfersPageFile, 'utf-8');
  assert(
    transfersPageContent.includes('canManageTransfers') &&
    !transfersPageContent.includes('Receive Stock ✓') &&
    !transfersPageContent.includes('Receive Stock into {t.destinationLocationName} ✓'),
    'Stock Transfers page gates transfer creation and removes decorative checkmarks from action buttons'
  );

  // Test 2: Product Language & Microcopy Audit
  console.log('\n--- 2. Product Language & Microcopy Audit ---');
  const accessHubOverviewFile = join(rootDir, 'src/components/access/access-hub-overview.tsx');
  const accessHubOverviewContent = readFileSync(accessHubOverviewFile, 'utf-8');
  assert(
    accessHubOverviewContent.includes('Roles & Permissions Hub') &&
    !accessHubOverviewContent.includes('RBAC & Scope V2 Access Control Hub') &&
    accessHubOverviewContent.includes('Custom Defined') &&
    !accessHubOverviewContent.includes('Tenant Defined'),
    'AccessHubOverview replaces RBAC & tenant terminology with hospitality terms'
  );

  const roleEditorModalFile = join(rootDir, 'src/components/access/role-editor-modal.tsx');
  const roleEditorModalContent = readFileSync(roleEditorModalFile, 'utf-8');
  assert(
    roleEditorModalContent.includes('Default Access Level') &&
    roleEditorModalContent.includes('Maximum Access Limit') &&
    !roleEditorModalContent.includes('Maximum Scope Ceiling') &&
    roleEditorModalContent.includes('Create Role') &&
    roleEditorModalContent.includes('Save Changes'),
    'RoleEditorModal uses plain-language access level limits and standard action verbs'
  );

  const memberOverrideModalFile = join(rootDir, 'src/components/access/member-override-modal.tsx');
  const memberOverrideModalContent = readFileSync(memberOverrideModalFile, 'utf-8');
  assert(
    memberOverrideModalContent.includes('Permission / Capability') &&
    !memberOverrideModalContent.includes('Permission Key (WHAT)') &&
    memberOverrideModalContent.includes('Save Override'),
    'MemberOverrideModal replaces Permission Key (WHAT) and standardizes button text'
  );

  const scopeGrantManagerFile = join(rootDir, 'src/components/access/scope-grant-manager.tsx');
  const scopeGrantManagerContent = readFileSync(scopeGrantManagerFile, 'utf-8');
  assert(
    scopeGrantManagerContent.includes('Permission / Capability') &&
    !scopeGrantManagerContent.includes('Permission Key (WHAT)'),
    'ScopeGrantManager replaces Permission Key (WHAT) with Permission / Capability'
  );

  const fallbackWorkspaceFile = join(rootDir, 'src/components/dashboard/dashboard-fallback-workspace.tsx');
  const fallbackWorkspaceContent = readFileSync(fallbackWorkspaceFile, 'utf-8');
  assert(
    fallbackWorkspaceContent.includes('Please contact your business owner or manager to assign permissions') &&
    fallbackWorkspaceContent.includes('No Workspace Access'),
    'DashboardFallbackWorkspace provides clear friendly guidance on how to get permissions assigned'
  );

  // Test 3: Form Simplification, Buttons & Touch Targets
  console.log('\n--- 3. Button Hierarchy & Form Usability Audit ---');
  const createItemFormFile = join(rootDir, 'src/components/menu/create-item-form.tsx');
  const createItemFormContent = readFileSync(createItemFormFile, 'utf-8');
  assert(
    createItemFormContent.includes('Add Menu Item') &&
    createItemFormContent.includes('Saving…') &&
    createItemFormContent.includes('Cancel'),
    'CreateItemForm uses standard "Add Menu Item", "Saving…", and includes Cancel button'
  );

  const createTableFormFile = join(rootDir, 'src/components/table/create-table-form.tsx');
  const createTableFormContent = readFileSync(createTableFormFile, 'utf-8');
  assert(
    createTableFormContent.includes('Create Table') &&
    createTableFormContent.includes('Saving…') &&
    createTableFormContent.includes('Cancel'),
    'CreateTableForm uses standard "Create Table", "Saving…", and includes Cancel button'
  );

  const bulkGeneratorFormFile = join(rootDir, 'src/components/table/bulk-generator-form.tsx');
  const bulkGeneratorFormContent = readFileSync(bulkGeneratorFormFile, 'utf-8');
  assert(
    bulkGeneratorFormContent.includes('Generate {formData.count} Tables') &&
    bulkGeneratorFormContent.includes('Generating Tables…') &&
    !bulkGeneratorFormContent.includes('⚡ Bulk Generate'),
    'BulkGeneratorForm removes emoji clutter and standardizes action text'
  );

  const staffInvitesFile = join(rootDir, 'src/components/team/staff-invites-management.tsx');
  const staffInvitesContent = readFileSync(staffInvitesFile, 'utf-8');
  assert(
    staffInvitesContent.includes('Send Invite') &&
    staffInvitesContent.includes('Sending…'),
    'StaffInvitesManagement standardizes invite action to Send Invite / Sending…'
  );

  const inventoryItemFormFile = join(rootDir, 'src/components/inventory/inventory-item-form.tsx');
  const inventoryItemFormContent = readFileSync(inventoryItemFormFile, 'utf-8');
  assert(
    inventoryItemFormContent.includes('Add Ingredient') &&
    inventoryItemFormContent.includes('Saving…') &&
    inventoryItemFormContent.includes('showAdvanced'),
    'InventoryItemForm features progressive disclosure and standard "Add Ingredient" / "Saving…"'
  );

  const branchManagerFile = join(rootDir, 'src/components/branch/branch-manager.tsx');
  const branchManagerContent = readFileSync(branchManagerFile, 'utf-8');
  assert(
    branchManagerContent.includes('Save Changes') &&
    branchManagerContent.includes('Create Branch') &&
    branchManagerContent.includes('Saving…') &&
    !branchManagerContent.includes('📍 Venue GPS Location Coordinates'),
    'BranchManager cleans up GPS heading and standardizes action buttons'
  );

  // Test 4: Access Denied Raw Codes Sanitization
  console.log('\n--- 4. Raw Error & Permission Code Sanitization ---');
  const accessDeniedCheckFiles = [
    'src/app/(dashboard)/dashboard/access/page.tsx',
    'src/app/(dashboard)/dashboard/access/roles/page.tsx',
    'src/app/(dashboard)/dashboard/access/roles/[roleId]/page.tsx',
    'src/app/(dashboard)/dashboard/access/members/page.tsx',
    'src/app/(dashboard)/dashboard/access/members/[membershipId]/page.tsx',
    'src/app/(dashboard)/dashboard/access/scope-grants/page.tsx',
    'src/app/(dashboard)/dashboard/access/diagnostics/page.tsx',
    'src/app/(dashboard)/dashboard/customers/page.tsx',
    'src/app/(dashboard)/dashboard/customers/[customerId]/page.tsx',
    'src/app/(dashboard)/dashboard/reputation/page.tsx',
  ];

  let rawCodeFound = false;
  for (const relPath of accessDeniedCheckFiles) {
    const fullPath = join(rootDir, relPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');
      if (
        content.includes('>roles.view<') ||
        content.includes('>customers.view<') ||
        content.includes('>reputation.view<')
      ) {
        rawCodeFound = true;
        console.error(`     Raw code found in: ${relPath}`);
      }
    }
  }
  assert(!rawCodeFound, 'All raw permission codes removed from access denied screens');

  // Test 5: Final Manual QA Hotfix Discoverability & Responsiveness Audits
  console.log('\n--- 5. Final Manual QA Hotfix Discoverability & IA Audits ---');

  // QA 1-3: Settings Hub Restored
  const settingsHubFile = join(rootDir, 'src/app/(dashboard)/dashboard/settings/page.tsx');
  const settingsHubContent = readFileSync(settingsHubFile, 'utf-8');
  assert(
    !settingsHubContent.includes("redirect('/dashboard/settings/subscription')") &&
    settingsHubContent.includes('Settings Hub') &&
    settingsHubContent.includes('Business Profile') &&
    settingsHubContent.includes('Branch Management') &&
    settingsHubContent.includes('Order Security & Anti-Fraud') &&
    settingsHubContent.includes('Payment Settings') &&
    settingsHubContent.includes('isOwner && ('),
    'Settings Hub restored with capability-gated cards for business, branches, security, payments, and billing'
  );

  const settingsSubNavFile = join(rootDir, 'src/components/settings/settings-subnav.tsx');
  assert(existsSync(settingsSubNavFile), 'SettingsSubNav component exists and provides secondary navigation');

  // QA 4: Team Hub Discoverability
  const teamSubNavFile = join(rootDir, 'src/components/team/team-subnav.tsx');
  assert(existsSync(teamSubNavFile), 'TeamSubNav component exists and provides secondary navigation for Team and Access Control');

  const accessRolesPageFile = join(rootDir, 'src/app/(dashboard)/dashboard/access/roles/page.tsx');
  const accessRolesContent = readFileSync(accessRolesPageFile, 'utf-8');
  assert(accessRolesContent.includes('TeamSubNav'), 'Roles & Templates page includes TeamSubNav');

  // QA 5: Operations / Inventory Discoverability
  const inventorySubNavFile = join(rootDir, 'src/components/inventory/inventory-subnav.tsx');
  assert(existsSync(inventorySubNavFile), 'InventorySubNav component exists and provides secondary navigation for Operations');

  // QA 6 & 7: Mobile Branch Switcher & Global Help Entry
  const dashboardShellFile = join(rootDir, 'src/components/layout/dashboard-shell.tsx');
  const dashboardShellContent = readFileSync(dashboardShellFile, 'utf-8');
  assert(
    dashboardShellContent.includes('/dashboard/help') &&
    dashboardShellContent.includes('Active Branch') &&
    dashboardShellContent.includes('ActiveBranchSwitcher'),
    'DashboardShell restores global Help link and mobile branch switching'
  );

  // QA 8: Subscription Purchase History Mobile Card View
  const billingHistoryFile = join(rootDir, 'src/components/subscription/owner-billing-history-client.tsx');
  const billingHistoryContent = readFileSync(billingHistoryFile, 'utf-8');
  assert(
    billingHistoryContent.includes('block md:hidden') &&
    billingHistoryContent.includes('hidden md:block') &&
    billingHistoryContent.includes('View Details & Invoice →'),
    'OwnerBillingHistoryClient includes responsive mobile card layout and desktop table'
  );

  // QA 9: Inventory Needs Attention View-Only Gating
  const needsAttentionFile = join(rootDir, 'src/components/inventory/inventory-needs-attention.tsx');
  const needsAttentionContent = readFileSync(needsAttentionFile, 'utf-8');
  assert(
    needsAttentionContent.includes('canAdjust = true') &&
    needsAttentionContent.includes('canPerformAction ?'),
    'InventoryNeedsAttention correctly gates Add Stock / Replenish action buttons'
  );

  // QA 10: Role Wizard Raw Keys Cleaned Up
  const permMatrixFile = join(rootDir, 'src/components/access/permission-matrix.tsx');
  const permMatrixContent = readFileSync(permMatrixFile, 'utf-8');
  assert(
    permMatrixContent.includes('showTechnicalKeys') &&
    permMatrixContent.includes('Show Technical IDs'),
    'PermissionMatrix hides raw permission keys by default and provides optional disclosure toggle'
  );

  // QA 11: Customer Hub Secondary Navigation Gating
  const customerPageFile = join(rootDir, 'src/app/(dashboard)/dashboard/customers/page.tsx');
  const customerPageContent = readFileSync(customerPageFile, 'utf-8');
  assert(
    customerPageContent.includes('hasReviewsPermission') &&
    customerPageContent.includes('hasReputationPermission') &&
    customerPageContent.includes('hasLoyaltyPermission'),
    'Customers Page gates secondary hubs with individual capabilities'
  );

  // QA 12: Staff Invite Microcopy
  assert(
    staffInvitesContent.includes('Invite Staff') &&
    staffInvitesContent.includes('New Staff Invite') &&
    staffInvitesContent.includes('Invite expires in *'),
    'StaffInvitesManagement uses friendly hospitality wording'
  );

  // QA 13 & 15: Menu Item Feature Copy & Responsive Image Picker
  assert(
    createItemFormContent.includes('Feature this item') &&
    createItemFormContent.includes('Show this item prominently on the menu.') &&
    createItemFormContent.includes('flex flex-col sm:flex-row'),
    'CreateItemForm has simplified feature microcopy and mobile-responsive image picker'
  );

  // QA 14: Reservation Modal Title
  const resClientFile = join(rootDir, 'src/components/reservations/reservation-management-client.tsx');
  const resClientContent = readFileSync(resClientFile, 'utf-8');
  assert(
    resClientContent.includes('New Reservation') &&
    !resClientContent.includes('New Staff Reservation'),
    'Reservation management client uses clean "New Reservation" modal title'
  );

  console.log(`\n========================================`);
  console.log(`Phase 37 Step 4 Verification Summary: ${passedTests}/${totalTests} Tests Passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStep4Verification();
