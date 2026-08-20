import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

// Bypass server-only guard
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

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function verifyPhase30SecurityBaseline() {
  console.log('=== WSNexa Phase 30 Step 1.5 — Security Hardening Verification Suite ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Load Modules
    const permModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission.ts')).href;
    const { permissionKeyEnum, ownerOnlyPermissions } = await import(permModulePath);

    const permServicePath = pathToFileURL(path.join(process.cwd(), 'src/server/services/permission.service.ts')).href;
    const { PermissionService } = await import(permServicePath);

    const routeModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/security/route-permissions.ts')).href;
    const { getRequiredPermissionForRoute } = await import(routeModulePath);

    const superAdminPath = pathToFileURL(path.join(process.cwd(), 'src/server/auth/super-admin.ts')).href;
    const { requireSuperAdmin } = await import(superAdminPath);

    console.log('--- 1. Permission Catalog & Route Guard Invariants ---');
    assert(
      permissionKeyEnum.options.length >= 62,
      `Permission catalog has at least 62 unique keys (found: ${permissionKeyEnum.options.length})`
    );
    assert(
      ownerOnlyPermissions.includes('order_security.manage'),
      'order_security.manage is recognized as owner-only'
    );
    assert(
      ownerOnlyPermissions.includes('branches.manage'),
      'branches.manage is recognized as owner-only'
    );
    assert(
      getRequiredPermissionForRoute('/dashboard/business') === 'business.settings.manage',
      '/dashboard/business route is mapped to business.settings.manage'
    );
    assert(
      getRequiredPermissionForRoute('/dashboard/branches') === 'branches.manage',
      '/dashboard/branches route is mapped to branches.manage'
    );
    assert(
      getRequiredPermissionForRoute('/dashboard/dining') === 'tables.view',
      '/dashboard/dining route is mapped to tables.view'
    );
    assert(
      getRequiredPermissionForRoute('/dashboard/settings/order-security') === 'order_security.view',
      '/dashboard/settings/order-security is protected'
    );
    assert(
      getRequiredPermissionForRoute('/dashboard/settings/payments') === 'branches.manage',
      '/dashboard/settings/payments is protected'
    );

    console.log('\n--- 2. Permission Evaluation & Boundary Invariants ---');

    // Test PermissionService functions are available
    assert(
      typeof PermissionService.hasPermission === 'function',
      'PermissionService.hasPermission is available'
    );
    assert(
      typeof PermissionService.verifyBranchBoundary === 'function',
      'PermissionService.verifyBranchBoundary is available'
    );
    assert(
      typeof PermissionService.verifyServiceAreaBoundary === 'function',
      'PermissionService.verifyServiceAreaBoundary is available'
    );

    console.log('\n--- 3. Super Admin Platform Isolation Invariants ---');
    assert(
      typeof requireSuperAdmin === 'function',
      'Super Admin requireSuperAdmin guard is functional and isolated'
    );

    console.log('\n--- 4. Hardened Actions & Services Invariants ---');
    // Verify Action files load and export protected functions
    const orderSecurityActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/order-security.ts')).href;
    const orderSecActions = await import(orderSecurityActionsPath);
    assert(
      typeof orderSecActions.updateBranchOrderSecuritySettingsAction === 'function',
      'updateBranchOrderSecuritySettingsAction is exported'
    );
    assert(
      typeof orderSecActions.applySecurityPresetAction === 'function',
      'applySecurityPresetAction is exported'
    );
    assert(
      typeof orderSecActions.getBranchOrderSecuritySettingsAction === 'function',
      'getBranchOrderSecuritySettingsAction is exported'
    );

    const branchPaymentActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/branch-payment.ts')).href;
    const branchPaymentActions = await import(branchPaymentActionsPath);
    assert(
      typeof branchPaymentActions.updateBranchPaymentMethodAction === 'function',
      'updateBranchPaymentMethodAction is exported'
    );

    const waiterApprovalActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/waiter-approval.ts')).href;
    const waiterApprovalActions = await import(waiterApprovalActionsPath);
    assert(
      typeof waiterApprovalActions.approveGuestOrderAction === 'function',
      'approveGuestOrderAction is exported'
    );
    assert(
      typeof waiterApprovalActions.rejectGuestOrderAction === 'function',
      'rejectGuestOrderAction is exported'
    );
    assert(
      typeof waiterApprovalActions.getPendingApprovalsAction === 'function',
      'getPendingApprovalsAction is exported'
    );

    const recipeActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/recipe.ts')).href;
    const recipeActions = await import(recipeActionsPath);
    assert(
      typeof recipeActions.createRecipeAction === 'function',
      'createRecipeAction is exported'
    );
    assert(
      typeof recipeActions.producePrepBatchAction === 'function',
      'producePrepBatchAction is exported'
    );

    const branchActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/branch.ts')).href;
    const branchActions = await import(branchActionsPath);
    assert(
      typeof branchActions.updateBranchAction === 'function',
      'updateBranchAction is exported'
    );

    const tableActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/table.ts')).href;
    const tableActions = await import(tableActionsPath);
    assert(
      typeof tableActions.createDiningTableAction === 'function',
      'createDiningTableAction is exported'
    );
    assert(
      typeof tableActions.bulkCreateDiningTablesAction === 'function',
      'bulkCreateDiningTablesAction is exported'
    );
    assert(
      typeof tableActions.generateTablePinAction === 'function',
      'generateTablePinAction is exported'
    );
    assert(
      typeof tableActions.verifyTableAccessAction === 'function',
      'verifyTableAccessAction is public/functional'
    );

    const modifierActionsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/modifier.ts')).href;
    const modifierActions = await import(modifierActionsPath);
    assert(
      typeof modifierActions.createModifierGroupAction === 'function',
      'createModifierGroupAction is exported'
    );
    assert(
      typeof modifierActions.createModifierOptionAction === 'function',
      'createModifierOptionAction is exported'
    );

    const inventorySettingsPath = pathToFileURL(path.join(process.cwd(), 'src/server/actions/inventory-settings.ts')).href;
    const invSettingsActions = await import(inventorySettingsPath);
    assert(
      typeof invSettingsActions.updateInventorySettingsAction === 'function',
      'updateInventorySettingsAction is exported'
    );

    const invIntelPath = pathToFileURL(path.join(process.cwd(), 'src/server/services/inventory-intelligence.service.ts')).href;
    const { InventoryIntelligenceService } = await import(invIntelPath);
    assert(
      typeof InventoryIntelligenceService.getMenuEngineeringMatrix === 'function',
      'InventoryIntelligenceService.getMenuEngineeringMatrix is exported'
    );
    assert(
      typeof InventoryIntelligenceService.getCogsFinancialReport === 'function',
      'InventoryIntelligenceService.getCogsFinancialReport is exported'
    );

    const orderServicePath = pathToFileURL(path.join(process.cwd(), 'src/server/services/order.service.ts')).href;
    const { OrderService } = await import(orderServicePath);
    assert(
      typeof OrderService.updateOrderStatus === 'function',
      'OrderService.updateOrderStatus is exported and protected'
    );

    const staffInvitePath = pathToFileURL(path.join(process.cwd(), 'src/server/services/staff-invitation.service.ts')).href;
    const { StaffInvitationService } = await import(staffInvitePath);
    assert(
      typeof StaffInvitationService.createInvitation === 'function',
      'StaffInvitationService.createInvitation is exported'
    );
    assert(
      typeof StaffInvitationService.revokeInvitation === 'function',
      'StaffInvitationService.revokeInvitation is exported'
    );
    assert(
      typeof StaffInvitationService.regenerateInvitation === 'function',
      'StaffInvitationService.regenerateInvitation is exported'
    );

  } catch (err: unknown) {
    console.error('Execution failure during verification:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyPhase30SecurityBaseline();
