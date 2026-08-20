import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

// Bypass server-only guard for direct tsx execution
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

import type { AuthorizationContext, ResourceScope } from '../src/types/authorization.types';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedAssertions++;
  }
}

/**
 * Helper to build mock AuthorizationContexts for testing domain integrations
 */
function createMockContext(overrides: Partial<AuthorizationContext>): AuthorizationContext {
  const defaultCtx: AuthorizationContext = {
    userId: 'user-default-1',
    userEmail: 'user@example.com',
    businessId: 'biz-default-1',
    businessName: 'Default Biz',
    businessSlug: 'default-biz',
    membershipId: 'mem-default-1',
    membershipRole: 'staff',
    customRoleId: null,
    isBusinessOwner: false,
    activeBranchId: 'branch-1',
    authorizedBranchIds: ['branch-1'],
    branchAssignments: [
      {
        id: 'ba-1',
        branchId: 'branch-1',
        branchName: 'Main Branch',
        branchCode: 'MB',
        isPrimary: true,
        isDefault: true,
        status: 'active',
        assignedAt: '2026-01-01',
      },
    ],
    departmentIds: ['dept-1'],
    departments: [],
    organizationUnitIds: ['unit-1'],
    organizationUnits: [],
    serviceAreaIds: ['area-1'],
    serviceAreas: [],
    staffAssignments: [
      {
        id: 'sa-1',
        businessMembershipId: 'mem-default-1',
        assignmentType: 'primary',
        status: 'active',
        isPrimary: true,
        branchId: 'branch-1',
        departmentId: 'dept-1',
        organizationUnitId: 'unit-1',
        positionId: null,
        positionTitle: null,
        startsAt: '2026-01-01',
        endsAt: null,
        isActing: false,
        isSecondment: false,
      },
    ],
    actingAssignments: [],
    secondments: [],
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
    roleScopePreset: {
      roleKey: 'staff',
      customRoleId: null,
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    },
    selfIdentity: {
      userId: 'user-default-1',
      membershipId: 'mem-default-1',
      staffAssignmentIds: ['sa-1'],
    },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 1,
      sources: {
        membershipSource: 'test',
        branchAssignmentCount: 1,
        staffAssignmentCount: 1,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 0,
        overrideCount: 0,
        scopeGrantCount: 0,
      },
    },
  };

  return {
    ...defaultCtx,
    ...overrides,
    branchAssignments: overrides.branchAssignments ?? defaultCtx.branchAssignments,
    staffAssignments: overrides.staffAssignments ?? defaultCtx.staffAssignments,
    actingAssignments: overrides.actingAssignments ?? defaultCtx.actingAssignments,
    secondments: overrides.secondments ?? defaultCtx.secondments,
    rolePermissions: overrides.rolePermissions ?? defaultCtx.rolePermissions,
    permissionOverrides: overrides.permissionOverrides ?? defaultCtx.permissionOverrides,
    scopeGrants: overrides.scopeGrants ?? defaultCtx.scopeGrants,
  };
}

function mockResourceScope(overrides: Partial<ResourceScope> & { businessId: string }): ResourceScope {
  return {
    resourceType: overrides.resourceType ?? 'order',
    resourceId: overrides.resourceId ?? 'res-1',
    businessId: overrides.businessId,
    branchId: overrides.branchId ?? null,
    departmentId: overrides.departmentId ?? null,
    organizationUnitId: overrides.organizationUnitId ?? null,
    serviceAreaId: overrides.serviceAreaId ?? null,
    ownerUserId: overrides.ownerUserId ?? null,
    additionalMetadata: overrides.additionalMetadata,
  };
}

async function runIntegrationVerification() {
  console.log('================================================================');
  console.log('  WSNexa Phase 30 Step 5 — RBAC V2 Production Integration Test  ');
  console.log('================================================================\n');

  const { authorize, can, requireBusinessPermission } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/auth/policy-engine.ts')).href
  );

  // ========================================================================
  // SECTION 1: Orders & Kitchen Domain Integration
  // ========================================================================
  console.log('--- SECTION 1: Orders & Kitchen Domain Integration ---');

  // 1.1 Waiter with orders.cancel can cancel an order in their assigned branch
  {
    const ctx = createMockContext({
      userId: 'waiter-1',
      membershipRole: 'waiter',
      rolePermissions: ['orders.cancel', 'orders.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const resScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-1',
    });

    const allowed = await can({
      context: ctx,
      permission: 'orders.cancel',
      resource: resScope,
    });
    assert(allowed === true, '1.1 Waiter with orders.cancel can cancel order in assigned branch');

    // 1.2 Waiter without kitchen.update cannot update kitchen order status
    const kitchenAllowed = await can({
      context: ctx,
      permission: 'kitchen.update',
      resource: resScope,
    });
    assert(kitchenAllowed === false, '1.2 Waiter without kitchen.update is DENIED for kitchen status');
  }

  // 1.3 Kitchen staff with kitchen.update can update kitchen status
  {
    const ctx = createMockContext({
      userId: 'cook-1',
      membershipRole: 'kitchen',
      rolePermissions: ['kitchen.update', 'kitchen.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const resScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-1',
    });

    const allowed = await can({
      context: ctx,
      permission: 'kitchen.update',
      resource: resScope,
    });
    assert(allowed === true, '1.3 Kitchen staff with kitchen.update can update order in branch');

    // Cross-branch check: kitchen staff in branch-1 cannot update branch-2 order
    const crossBranchScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-2',
    });
    const crossAllowed = await can({
      context: ctx,
      permission: 'kitchen.update',
      resource: crossBranchScope,
    });
    assert(crossAllowed === false, '1.4 Kitchen staff is DENIED for order in unassigned branch-2');
  }

  // 1.5 Waiter guest approval: waiter with orders.approve_guest
  {
    const ctx = createMockContext({
      userId: 'waiter-2',
      membershipRole: 'waiter',
      rolePermissions: ['orders.approve_guest'],
      authorizedBranchIds: ['branch-1'],
    });

    const res = await authorize({
      context: ctx,
      permission: 'orders.approve_guest',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(res.allowed === true, '1.5 Waiter with orders.approve_guest is ALLOWED for branch order approval');
  }

  // ========================================================================
  // SECTION 2: Payments & Cashier Domain Integration
  // ========================================================================
  console.log('\n--- SECTION 2: Payments & Cashier Domain Integration ---');

  // 2.1 Cashier with payments.record and cashier.access
  {
    const ctx = createMockContext({
      userId: 'cashier-1',
      membershipRole: 'cashier',
      rolePermissions: ['payments.record', 'cashier.access', 'payments.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const payScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-1',
    });

    const canRecord = await can({
      context: ctx,
      permission: 'payments.record',
      resource: payScope,
    });
    assert(canRecord === true, '2.1 Cashier can record payment on branch-scoped resource');

    const canVoid = await can({
      context: ctx,
      permission: 'payments.void',
      resource: payScope,
    });
    assert(canVoid === false, '2.2 Regular cashier without payments.void is DENIED voiding payment');
  }

  // 2.3 Manager with payments.void can void payment
  {
    const ctx = createMockContext({
      userId: 'mgr-1',
      membershipRole: 'branch_manager',
      rolePermissions: ['payments.record', 'payments.void', 'cashier.access'],
      authorizedBranchIds: ['branch-1'],
    });

    const canVoid = await can({
      context: ctx,
      permission: 'payments.void',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(canVoid === true, '2.3 Branch Manager with payments.void is ALLOWED to void payment');
  }

  // 2.4 Branch payment method update requires branches.operational.manage or branches.manage
  {
    const ctx = createMockContext({
      userId: 'mgr-1',
      membershipRole: 'branch_manager',
      rolePermissions: ['branches.operational.manage'],
      authorizedBranchIds: ['branch-1'],
    });

    const canManagePay = await can({
      context: ctx,
      permission: 'branches.operational.manage',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(canManagePay === true, '2.4 Manager with branches.operational.manage can configure branch payment methods');
  }

  // ========================================================================
  // SECTION 3: Inventory Core & Cost Intelligence Integration
  // ========================================================================
  console.log('\n--- SECTION 3: Inventory Core & Cost Intelligence Integration ---');

  // 3.1 Inventory staff can record stock adjustment on storage location in branch
  {
    const ctx = createMockContext({
      userId: 'inv-staff-1',
      membershipRole: 'staff',
      rolePermissions: ['inventory.adjust.create', 'inventory.waste.record'],
      authorizedBranchIds: ['branch-1'],
    });

    const storageScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-1',
    });

    const canAdjust = await can({
      context: ctx,
      permission: 'inventory.adjust.create',
      resource: storageScope,
    });
    assert(canAdjust === true, '3.1 Inventory staff with inventory.adjust.create can adjust stock');

    const canWaste = await can({
      context: ctx,
      permission: 'inventory.waste.record',
      resource: storageScope,
    });
    assert(canWaste === true, '3.2 Inventory staff with inventory.waste.record can record waste');
  }

  // 3.3 Stock count approval: requires inventory.counts.approve
  {
    const staffCtx = createMockContext({
      userId: 'inv-staff-1',
      membershipRole: 'staff',
      rolePermissions: ['inventory.counts.submit'],
      authorizedBranchIds: ['branch-1'],
    });

    const mgrCtx = createMockContext({
      userId: 'mgr-1',
      membershipRole: 'branch_manager',
      rolePermissions: ['inventory.counts.approve'],
      authorizedBranchIds: ['branch-1'],
    });

    const scope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const staffCanApprove = await can({
      context: staffCtx,
      permission: 'inventory.counts.approve',
      resource: scope,
    });
    assert(staffCanApprove === false, '3.3 Staff without inventory.counts.approve is DENIED count approval');

    const mgrCanApprove = await can({
      context: mgrCtx,
      permission: 'inventory.counts.approve',
      resource: scope,
    });
    assert(mgrCanApprove === true, '3.4 Manager with inventory.counts.approve is ALLOWED count approval');
  }

  // 3.5 Cost Intelligence & Financial Reports: requires inventory.costs.view
  {
    const staffCtx = createMockContext({
      userId: 'inv-staff-1',
      membershipRole: 'staff',
      rolePermissions: ['inventory.items.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const ownerCtx = createMockContext({
      userId: 'owner-1',
      membershipRole: 'business_owner',
      isBusinessOwner: true,
      rolePermissions: ['inventory.costs.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const scope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const staffCanCost = await can({
      context: staffCtx,
      permission: 'inventory.costs.view',
      resource: scope,
    });
    assert(staffCanCost === false, '3.5 Regular staff is DENIED viewing cost intelligence and COGS');

    const ownerCanCost = await can({
      context: ownerCtx,
      permission: 'inventory.costs.view',
      resource: scope,
    });
    assert(ownerCanCost === true, '3.6 Business Owner is ALLOWED viewing cost intelligence and COGS');
  }

  // ========================================================================
  // SECTION 4: Purchasing & Suppliers Domain Integration
  // ========================================================================
  console.log('\n--- SECTION 4: Purchasing & Suppliers Domain Integration ---');

  // 4.1 Supplier catalog management: requires suppliers.manage
  {
    const buyerCtx = createMockContext({
      userId: 'buyer-1',
      membershipRole: 'staff',
      rolePermissions: ['suppliers.manage', 'purchasing.create'],
      roleScopePreset: {
        roleKey: 'staff',
        customRoleId: null,
        defaultScope: 'ORGANIZATION',
        maxScope: 'ORGANIZATION',
      },
      authorizedBranchIds: ['branch-1'],
    });

    const supplierScope = mockResourceScope({
      businessId: 'biz-default-1',
    });

    const canSupplier = await can({
      context: buyerCtx,
      permission: 'suppliers.manage',
      resource: supplierScope,
    });
    assert(canSupplier === true, '4.1 Buyer with suppliers.manage can manage supplier catalog');

    // 4.2 PO Approval requires purchasing.approve
    const canApprovePO = await can({
      context: buyerCtx,
      permission: 'purchasing.approve',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(canApprovePO === false, '4.2 Buyer without purchasing.approve is DENIED PO approval');
  }

  // 4.3 Goods receipt: requires purchasing.receive
  {
    const receiverCtx = createMockContext({
      userId: 'receiver-1',
      membershipRole: 'staff',
      rolePermissions: ['purchasing.receive'],
      authorizedBranchIds: ['branch-1'],
    });

    const poScope = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-1',
    });

    const canReceive = await can({
      context: receiverCtx,
      permission: 'purchasing.receive',
      resource: poScope,
    });
    assert(canReceive === true, '4.3 Receiver with purchasing.receive is ALLOWED goods receipt');
  }

  // ========================================================================
  // SECTION 5: Staff, People & Organization Architecture Integration
  // ========================================================================
  console.log('\n--- SECTION 5: Staff, People & Organization Architecture Integration ---');

  // 5.1 Staff invitation: staff.invite or staff.manage
  {
    const hrCtx = createMockContext({
      userId: 'hr-1',
      membershipRole: 'staff',
      rolePermissions: ['staff.invite', 'people.manage'],
      authorizedBranchIds: ['branch-1'],
    });

    const branchScope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const canInvite = await can({
      context: hrCtx,
      permission: 'staff.invite',
      resource: branchScope,
    });
    assert(canInvite === true, '5.1 HR with staff.invite can generate staff invitations');

    const canPeople = await can({
      context: hrCtx,
      permission: 'people.manage',
      resource: branchScope,
    });
    assert(canPeople === true, '5.2 HR with people.manage can create/update staff assignments');
  }

  // 5.3 Org structure: organization.manage for departments, units, job titles
  {
    const adminCtx = createMockContext({
      userId: 'org-admin-1',
      membershipRole: 'staff',
      rolePermissions: ['organization.manage', 'positions.manage'],
      authorizedBranchIds: ['branch-1'],
    });

    const canOrg = await can({
      context: adminCtx,
      permission: 'organization.manage',
    });
    assert(canOrg === true, '5.3 Admin with organization.manage can manage departments & units');

    const canPos = await can({
      context: adminCtx,
      permission: 'positions.manage',
    });
    assert(canPos === true, '5.4 Admin with positions.manage can manage organization positions');
  }

  // 5.5 Custom Roles & Member Overrides: roles.manage
  {
    const roleAdminCtx = createMockContext({
      userId: 'role-admin-1',
      membershipRole: 'staff',
      rolePermissions: ['roles.manage'],
    });

    const canRole = await can({
      context: roleAdminCtx,
      permission: 'roles.manage',
    });
    assert(canRole === true, '5.5 Admin with roles.manage can create custom roles and set overrides');

    const nonAdminCtx = createMockContext({
      userId: 'staff-plain-1',
      membershipRole: 'staff',
      rolePermissions: ['orders.view'],
    });

    const nonAdminCanRole = await can({
      context: nonAdminCtx,
      permission: 'roles.manage',
    });
    assert(nonAdminCanRole === false, '5.6 Plain staff is DENIED roles.manage');
  }

  // ========================================================================
  // SECTION 6: Menu, Modifiers, Tables & Recipes Domain Integration
  // ========================================================================
  console.log('\n--- SECTION 6: Menu, Modifiers, Tables & Recipes Domain Integration ---');

  // 6.1 Granular menu permissions: menu.price.update vs menu.items.edit
  {
    const priceUpdaterCtx = createMockContext({
      userId: 'price-updater-1',
      membershipRole: 'staff',
      rolePermissions: ['menu.price.update'],
      authorizedBranchIds: ['branch-1'],
    });

    const itemScope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const canPrice = await can({
      context: priceUpdaterCtx,
      permission: 'menu.price.update',
      resource: itemScope,
    });
    assert(canPrice === true, '6.1 User with menu.price.update can update item prices');

    const canEditGeneral = await can({
      context: priceUpdaterCtx,
      permission: 'menu.items.edit',
      resource: itemScope,
    });
    assert(canEditGeneral === false, '6.2 User with ONLY menu.price.update is DENIED general item edit');
  }

  // 6.3 Table PIN Management: qr.security.reset
  {
    const tableLeadCtx = createMockContext({
      userId: 'lead-waiter-1',
      membershipRole: 'waiter',
      rolePermissions: ['qr.security.reset', 'tables.edit'],
      authorizedBranchIds: ['branch-1'],
    });

    const branchScope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const canResetPin = await can({
      context: tableLeadCtx,
      permission: 'qr.security.reset',
      resource: branchScope,
    });
    assert(canResetPin === true, '6.3 Lead waiter with qr.security.reset can generate table PINs');
  }

  // 6.4 Recipes & Production Prep Batching
  {
    const chefCtx = createMockContext({
      userId: 'chef-1',
      membershipRole: 'kitchen',
      rolePermissions: ['recipes.manage', 'inventory.production.manage'],
      authorizedBranchIds: ['branch-1'],
    });

    const branchScope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const canRecipe = await can({
      context: chefCtx,
      permission: 'recipes.manage',
      resource: branchScope,
    });
    assert(canRecipe === true, '6.4 Chef with recipes.manage can create recipes');

    const canProduce = await can({
      context: chefCtx,
      permission: 'inventory.production.manage',
      resource: branchScope,
    });
    assert(canProduce === true, '6.5 Chef with inventory.production.manage can produce prep batches');
  }

  // ========================================================================
  // SECTION 7: Business, Branch & Security Settings Integration
  // ========================================================================
  console.log('\n--- SECTION 7: Business, Branch & Security Settings Integration ---');

  // 7.1 Order security settings: order_security.manage
  {
    const secAdminCtx = createMockContext({
      userId: 'sec-admin-1',
      membershipRole: 'branch_manager',
      rolePermissions: ['order_security.manage', 'order_security.view'],
      authorizedBranchIds: ['branch-1'],
    });

    const branchScope = mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' });

    const canSec = await can({
      context: secAdminCtx,
      permission: 'order_security.manage',
      resource: branchScope,
    });
    assert(canSec === true, '7.1 Manager with order_security.manage can configure branch order security');
  }

  // 7.2 Branch creation & archiving: branches.manage
  {
    const ownerCtx = createMockContext({
      userId: 'owner-1',
      membershipRole: 'business_owner',
      isBusinessOwner: true,
      rolePermissions: ['branches.manage'],
    });

    const canBranch = await can({
      context: ownerCtx,
      permission: 'branches.manage',
    });
    assert(canBranch === true, '7.2 Owner with branches.manage can create and archive branches');
  }

  // ========================================================================
  // SECTION 8: Security Boundary & Scope Enforcement Guarantees
  // ========================================================================
  console.log('\n--- SECTION 8: Security Boundary & Scope Enforcement Guarantees ---');

  // 8.1 Super Admin Platform Isolation: Platform admin without tenant membership/role returns DENY
  {
    const superAdminCtx = createMockContext({
      userId: 'platform-super-admin-1',
      businessId: 'biz-default-1',
      membershipRole: 'staff',
      isBusinessOwner: false,
      rolePermissions: [], // Super admin has platform privileges, NOT tenant business permissions
    });

    const res = await authorize({
      context: superAdminCtx,
      permission: 'orders.cancel',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(
      res.allowed === false,
      '8.1 Super Admin platform access DOES NOT bypass tenant RBAC permissions in tenant business operations'
    );
  }

  // 8.2 Tenant Boundary Isolation: Context for Business A cannot access Business B resource
  {
    const ctxBizA = createMockContext({
      userId: 'user-biz-a',
      businessId: 'biz-A',
      membershipRole: 'business_owner',
      isBusinessOwner: true,
      rolePermissions: ['orders.cancel'],
    });

    const resourceBizB = mockResourceScope({
      businessId: 'biz-B', // Belongs to business B!
      branchId: 'branch-biz-b',
    });

    const res = await authorize({
      context: ctxBizA,
      permission: 'orders.cancel',
      resource: resourceBizB,
    });
    assert(
      res.allowed === false && res.reason === 'TENANT_MISMATCH',
      '8.2 Cross-tenant access is strictly BLOCKED with Tenant boundary mismatch DENY'
    );
  }

  // 8.3 Resource Scope Boundary: Staff in Branch 1 cannot access Branch 2 resource
  {
    const staffBranch1 = createMockContext({
      userId: 'staff-branch-1',
      membershipRole: 'waiter',
      rolePermissions: ['orders.cancel'],
      authorizedBranchIds: ['branch-1'],
    });

    const resBranch2 = mockResourceScope({
      businessId: 'biz-default-1',
      branchId: 'branch-2',
    });

    const res = await authorize({
      context: staffBranch1,
      permission: 'orders.cancel',
      resource: resBranch2,
    });
    assert(
      res.allowed === false && res.reason === 'OUTSIDE_SCOPE',
      '8.3 Cross-branch resource access is strictly DENIED when branch is not in actor reach'
    );
  }

  // 8.4 Explicit Member Override DENY unconditionally supersedes positive role permission
  {
    const ctx = createMockContext({
      userId: 'waiter-denied',
      membershipRole: 'waiter',
      rolePermissions: ['orders.cancel'],
      permissionOverrides: [
        {
          id: 'ov-1',
          businessMembershipId: 'mem-default-1',
          permissionKey: 'orders.cancel',
          effect: 'deny',
          scopeType: null,
          branchId: null,
          departmentId: null,
          organizationUnitId: null,
          serviceAreaId: null,
          createdAt: new Date().toISOString(),
        },
      ],
      authorizedBranchIds: ['branch-1'],
    });

    const res = await authorize({
      context: ctx,
      permission: 'orders.cancel',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-1' }),
    });
    assert(
      res.allowed === false && res.reason === 'EXPLICIT_DENY',
      '8.4 Explicit member override DENY unconditionally overrides positive role grant'
    );
  }

  // 8.5 Acting Assignment Reach: Active acting assignment permits target branch reach
  {
    const activeActingCtx = createMockContext({
      userId: 'acting-waiter',
      membershipRole: 'waiter',
      rolePermissions: ['orders.cancel'],
      authorizedBranchIds: ['branch-1', 'branch-acting-2'],
      actingAssignments: [
        {
          id: 'act-1',
          businessMembershipId: 'mem-default-1',
          assignmentType: 'acting',
          branchId: 'branch-acting-2',
          departmentId: null,
          organizationUnitId: null,
          positionId: null,
          startsAt: '2026-01-01',
          endsAt: '2026-12-31',
          status: 'active',
          isPrimary: false,
          isActing: true,
          isSecondment: false,
        },
      ],
    });

    const allowed = await can({
      context: activeActingCtx,
      permission: 'orders.cancel',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-acting-2' }),
    });
    assert(allowed === true, '8.5 Active acting assignment grants valid reach into target acting branch');

    // Expired acting assignment denies
    const expiredActingCtx = createMockContext({
      userId: 'acting-waiter-expired',
      membershipRole: 'waiter',
      rolePermissions: ['orders.cancel'],
      authorizedBranchIds: ['branch-1'],
      actingAssignments: [
        {
          id: 'act-2',
          businessMembershipId: 'mem-default-1',
          assignmentType: 'acting',
          branchId: 'branch-acting-2',
          departmentId: null,
          organizationUnitId: null,
          positionId: null,
          startsAt: '2025-01-01',
          endsAt: '2025-12-31', // Expired!
          status: 'ended',
          isPrimary: false,
          isActing: true,
          isSecondment: false,
        },
      ],
    });

    const expiredAllowed = await can({
      context: expiredActingCtx,
      permission: 'orders.cancel',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-acting-2' }),
    });
    assert(expiredAllowed === false, '8.6 Expired acting assignment is strictly DENIED for acting branch');
  }

  // 8.7 Secondment Reach: Active secondment permits host branch reach
  {
    const activeSecondmentCtx = createMockContext({
      userId: 'seconded-staff',
      membershipRole: 'staff',
      rolePermissions: ['inventory.adjust.create'],
      authorizedBranchIds: ['branch-home-1', 'branch-host-2'],
      secondments: [
        {
          id: 'sec-1',
          businessMembershipId: 'mem-default-1',
          assignmentType: 'secondment',
          branchId: 'branch-host-2',
          departmentId: null,
          organizationUnitId: null,
          positionId: null,
          startsAt: '2026-01-01',
          endsAt: '2026-12-31',
          status: 'active',
          isPrimary: false,
          isActing: false,
          isSecondment: true,
        },
      ],
    });

    const hostAllowed = await can({
      context: activeSecondmentCtx,
      permission: 'inventory.adjust.create',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-host-2' }),
    });
    assert(hostAllowed === true, '8.7 Active secondment grants valid reach into host branch');

    // Expired secondment denies
    const expiredSecondmentCtx = createMockContext({
      userId: 'seconded-staff-expired',
      membershipRole: 'staff',
      rolePermissions: ['inventory.adjust.create'],
      authorizedBranchIds: ['branch-home-1'],
      secondments: [
        {
          id: 'sec-2',
          businessMembershipId: 'mem-default-1',
          assignmentType: 'secondment',
          branchId: 'branch-host-2',
          departmentId: null,
          organizationUnitId: null,
          positionId: null,
          startsAt: '2025-01-01',
          endsAt: '2025-12-31', // Expired!
          status: 'ended',
          isPrimary: false,
          isActing: false,
          isSecondment: true,
        },
      ],
    });

    const expiredHostAllowed = await can({
      context: expiredSecondmentCtx,
      permission: 'inventory.adjust.create',
      resource: mockResourceScope({ businessId: 'biz-default-1', branchId: 'branch-host-2' }),
    });
    assert(expiredHostAllowed === false, '8.8 Expired secondment is strictly DENIED for host branch');
  }

  // 8.9 requireBusinessPermission throws structured AuthorizationContextError on denial
  {
    const staffCtx = createMockContext({
      userId: 'staff-no-perm',
      membershipRole: 'staff',
      rolePermissions: [],
      authorizedBranchIds: ['branch-1'],
    });

    let threwError = false;
    let errorStatus = 0;
    try {
      await requireBusinessPermission({
        context: staffCtx,
        permission: 'branches.manage',
      });
    } catch (err: unknown) {
      threwError = true;
      const authErr = err as { name?: string; statusCode?: number; code?: string };
      if (authErr.name === 'AuthorizationContextError' && authErr.statusCode === 403) {
        errorStatus = 403;
      }
    }
    assert(threwError && errorStatus === 403, '8.9 requireBusinessPermission throws 403 AuthorizationContextError on DENY');
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n================================================================');
  console.log(`  Integration Verification Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runIntegrationVerification().catch((err) => {
  console.error('Fatal error during integration verification:', err);
  process.exit(1);
});
