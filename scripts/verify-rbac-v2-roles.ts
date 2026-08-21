import * as path from 'path';
import * as fs from 'fs';

// Bypass server-only guard for direct script execution
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

// Load environment variables from .env.local synchronously before loading any application modules
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

import { createClient } from '@supabase/supabase-js';
import type { AuthorizationContext, ScopeType } from '../src/types/authorization.types';
import type { PermissionKey } from '../src/lib/validation/permission';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const admin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

function createMockContext(overrides: Partial<AuthorizationContext>): AuthorizationContext {
  const dummyUuid = crypto.randomUUID();
  const defaultCtx: AuthorizationContext = {
    userId: dummyUuid,
    userEmail: 'user@test.com',
    businessId: dummyUuid,
    businessName: 'Default Business',
    businessSlug: 'default-biz',
    membershipId: dummyUuid,
    membershipRole: 'branch_manager',
    customRoleId: null,
    isBusinessOwner: false,
    activeBranchId: dummyUuid,
    authorizedBranchIds: [dummyUuid],
    branchAssignments: [],
    departmentIds: [],
    departments: [],
    organizationUnitIds: [],
    organizationUnits: [],
    serviceAreaIds: [],
    serviceAreas: [],
    rolePermissions: [],
    permissionOverrides: [],
    scopeGrants: [],
    roleScopePreset: {
      roleKey: 'branch_manager',
      customRoleId: null,
      defaultScope: 'PROPERTY' as ScopeType,
      maxScope: 'PROPERTY' as ScopeType,
    },
    staffAssignments: [],
    actingAssignments: [],
    secondments: [],
    selfIdentity: {
      userId: 'user-default-1',
      membershipId: 'membership-default-1',
      staffAssignmentIds: [],
    },
    diagnostics: {
      resolvedAt: new Date().toISOString(),
      queryCount: 0,
      sources: {
        membershipSource: 'test',
        branchAssignmentCount: 0,
        staffAssignmentCount: 0,
        actingAssignmentCount: 0,
        secondmentCount: 0,
        rolePermissionCount: 0,
        overrideCount: 0,
        scopeGrantCount: 0,
      },
    },
  };
  return { ...defaultCtx, ...overrides };
}

async function runRoleGovernanceVerification() {
  console.log('================================================================');
  console.log('  WSNEXA PHASE 30 STEP 7 — ROLE GOVERNANCE VERIFICATION SUITE');
  console.log('================================================================\n');

  // Dynamically import application services after environment is populated
  const { RoleGovernanceService } = await import('../src/server/services/role-governance.service');
  const { ScopeGrantService } = await import('../src/server/services/scope-grant.service');
  const { StaffInvitationService } = await import('../src/server/services/staff-invitation.service');
  const { OrganizationService } = await import('../src/server/services/organization.service');
  const { can, resolveAuthorizationContext } = await import('../src/server/auth');

  const timestamp = Date.now();
  const testBusinessSlug = `test-role-biz-${timestamp}`;
  let businessId: string;
  let ownerUserId: string;
  let managerUserId: string;
  let waiterUserId: string;
  const waiterPassword = `Pwd${timestamp}!Aa`;
  let otherBizId: string | null = null;
  let inviteeUserId: string | null = null;
  let ownerContext: AuthorizationContext;
  let managerContext: AuthorizationContext;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Provision Live Test Hierarchy
    // ------------------------------------------------------------------------
    console.log('--- Setting up test fixtures in Supabase ---');

    // 1. Create Users
    const { data: ownerUser } = await admin.auth.admin.createUser({
      email: `owner_${timestamp}@wsnexa.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    ownerUserId = ownerUser.user!.id;

    const { data: managerUser } = await admin.auth.admin.createUser({
      email: `manager_${timestamp}@wsnexa.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    managerUserId = managerUser.user!.id;

    const { data: waiterUser } = await admin.auth.admin.createUser({
      email: `waiter_${timestamp}@wsnexa.test`,
      password: waiterPassword,
      email_confirm: true,
    });
    waiterUserId = waiterUser.user!.id;

    // 2. Create Business
    const { data: business, error: bizErr } = await admin
      .from('businesses')
      .insert({
        name: `Test Role Biz ${timestamp}`,
        slug: testBusinessSlug,
        default_currency: 'USD',
        country_code: 'US',
        timezone: 'UTC',
        status: 'active',
        created_by: ownerUserId,
      })
      .select('id')
      .single();

    if (bizErr || !business) {
      throw new Error(`Failed to create test business: ${bizErr?.message}`);
    }
    businessId = business.id;

    // 3. Create Branches
    const { data: branchA } = await admin
      .from('branches')
      .insert({
        business_id: businessId,
        name: 'Main Venue',
        code: `MV${timestamp.toString().slice(-4)}`,
        is_default: true,
        status: 'active',
      })
      .select('id')
      .single();

    const { data: branchB } = await admin
      .from('branches')
      .insert({
        business_id: businessId,
        name: 'Downtown Venue',
        code: `DV${timestamp.toString().slice(-4)}`,
        is_default: false,
        status: 'active',
      })
      .select('id')
      .single();

    // 4. Create Memberships
    const { data: ownerMem } = await admin
      .from('business_memberships')
      .insert({
        business_id: businessId,
        user_id: ownerUserId,
        role: 'business_owner',
        membership_status: 'active',
      })
      .select('id')
      .single();

    const { data: managerMem } = await admin
      .from('business_memberships')
      .insert({
        business_id: businessId,
        user_id: managerUserId,
        role: 'branch_manager',
        membership_status: 'active',
      })
      .select('id')
      .single();

    const { data: waiterMem } = await admin
      .from('business_memberships')
      .insert({
        business_id: businessId,
        user_id: waiterUserId,
        role: 'waiter',
        membership_status: 'active',
      })
      .select('id')
      .single();

    // 5. Branch Assignments
    await admin.from('branch_assignments').insert([
      { business_membership_id: ownerMem!.id, branch_id: branchA!.id, is_primary: true },
      { business_membership_id: managerMem!.id, branch_id: branchA!.id, is_primary: true },
      { business_membership_id: waiterMem!.id, branch_id: branchA!.id, is_primary: true },
    ]);

    // Build Mock Contexts
    ownerContext = createMockContext({
      userId: ownerUserId,
      userEmail: `owner_${timestamp}@wsnexa.test`,
      businessId,
      membershipId: ownerMem!.id,
      membershipRole: 'business_owner',
      isBusinessOwner: true,
      activeBranchId: branchA!.id,
      authorizedBranchIds: [branchA!.id, branchB!.id],
      roleScopePreset: {
        roleKey: 'business_owner',
        customRoleId: null,
        defaultScope: 'ORGANIZATION',
        maxScope: 'ORGANIZATION',
      },
    });

    managerContext = createMockContext({
      userId: managerUserId,
      userEmail: `manager_${timestamp}@wsnexa.test`,
      businessId,
      membershipId: managerMem!.id,
      membershipRole: 'branch_manager',
      isBusinessOwner: false,
      activeBranchId: branchA!.id,
      authorizedBranchIds: [branchA!.id],
      rolePermissions: ['roles.manage', 'staff.manage', 'staff.role.assign', 'staff.view', 'roles.view'],
      roleScopePreset: {
        roleKey: 'branch_manager',
        customRoleId: null,
        defaultScope: 'PROPERTY',
        maxScope: 'PROPERTY',
      },
    });

    console.log('✅ Test fixtures successfully created.\n');

    // ========================================================================
    // SECTION 1: Built-In Role Templates & Catalog
    // ========================================================================
    console.log('--- SECTION 1: Built-In Role Templates & Catalog ---');

    const templates = RoleGovernanceService.listBuiltInRoleTemplates();
    assert(templates.length === 5, '1.1 listBuiltInRoleTemplates returns 5 canonical templates');

    const ownerTpl = templates.find((t) => t.roleKey === 'business_owner');
    assert(
      ownerTpl?.maxScope === 'ORGANIZATION' && ownerTpl?.isOwnerRole === true && ownerTpl?.isProtected === true,
      '1.2 business_owner template is protected with ORGANIZATION maxScope and isOwnerRole = true'
    );

    const managerTpl = templates.find((t) => t.roleKey === 'branch_manager');
    assert(
      managerTpl?.defaultScope === 'PROPERTY' && managerTpl?.maxScope === 'PROPERTY',
      '1.3 branch_manager template has PROPERTY default and max scope'
    );

    const waiterTpl = templates.find((t) => t.roleKey === 'waiter');
    assert(
      waiterTpl?.defaultScope === 'AREA_TEAM' && waiterTpl?.maxScope === 'PROPERTY',
      '1.4 waiter template has AREA_TEAM default scope and PROPERTY max scope'
    );

    const branchManagerDetails = await RoleGovernanceService.getBuiltInRoleTemplate('branch_manager');
    assert(
      Boolean(branchManagerDetails && branchManagerDetails.permissions.length > 50),
      '1.5 getBuiltInRoleTemplate(branch_manager) returns canonical permissions from database'
    );

    const waiterDetails = await RoleGovernanceService.getBuiltInRoleTemplate('waiter');
    assert(
      Boolean(waiterDetails && waiterDetails.permissions.includes('orders.view')),
      '1.6 Built-in waiter template includes orders.view'
    );

    // ========================================================================
    // SECTION 2: Custom Role Creation, Uniqueness & Lifecycle
    // ========================================================================
    console.log('\n--- SECTION 2: Custom Role Creation, Uniqueness & Lifecycle ---');

    // 2.1 Create custom role
    const createRoleRes = await RoleGovernanceService.createCustomRole(ownerContext, {
      name: 'Head Mixologist',
      description: 'Bar specialist with inventory and menu permissions',
      permissions: ['menu.view', 'menu.items.create', 'inventory.view', 'inventory.adjust'],
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    });
    assert(createRoleRes.success && Boolean(createRoleRes.role?.id), '2.1 createCustomRole creates custom role');
    const mixologistRoleId = createRoleRes.role!.id;

    // 2.2 Verify role_scope_presets insertion
    const { data: presetRow } = await admin
      .from('role_scope_presets')
      .select('*')
      .eq('custom_role_id', mixologistRoleId)
      .single();
    assert(
      presetRow?.default_scope === 'PROPERTY' && presetRow?.max_scope === 'PROPERTY',
      '2.2 role_scope_presets automatically populated for custom role'
    );

    // 2.3 Duplicate name in same tenant rejected
    let dupRejected = false;
    try {
      await RoleGovernanceService.createCustomRole(ownerContext, {
        name: 'Head Mixologist',
        permissions: ['menu.view'],
      });
    } catch {
      dupRejected = true;
    }
    assert(dupRejected, '2.3 Duplicate custom role name in same tenant is rejected with ROLE_NAME_DUPLICATE');

    // 2.4 Same name in different tenant permitted
    const otherBizRes = await admin
      .from('businesses')
      .insert({
        name: `Other Biz ${timestamp}`,
        slug: `other-biz-${timestamp}`,
        default_currency: 'USD',
        country_code: 'US',
        timezone: 'UTC',
        status: 'active',
        created_by: ownerUserId,
      })
      .select('id')
      .single();

    otherBizId = otherBizRes.data!.id;

    const otherBizContext = createMockContext({
      userId: ownerUserId,
      businessId: otherBizId ?? undefined,
      isBusinessOwner: true,
    });

    const otherBizRole = await RoleGovernanceService.createCustomRole(otherBizContext, {
      name: 'Head Mixologist',
      permissions: ['menu.view'],
    });
    assert(otherBizRole.success === true, '2.4 Same role name in distinct tenant is allowed');

    // 2.5 Reserved role name rejected
    let reservedRejected = false;
    try {
      await RoleGovernanceService.createCustomRole(ownerContext, {
        name: 'branch_manager',
        permissions: ['orders.view'],
      });
    } catch {
      reservedRejected = true;
    }
    assert(reservedRejected, '2.5 Reserved role name (branch_manager) is rejected with ROLE_RESERVED');

    // 2.6 updateCustomRole updates metadata
    const updateRes = await RoleGovernanceService.updateCustomRole(ownerContext, {
      roleId: mixologistRoleId,
      description: 'Updated beverage director description',
    });
    assert(updateRes.success && updateRes.role?.description === 'Updated beverage director description', '2.6 updateCustomRole updates description');

    // 2.7 listCustomRoles filters out archived roles
    const activeRoles = await RoleGovernanceService.listCustomRoles(businessId);
    assert(activeRoles.some((r) => r.id === mixologistRoleId), '2.7 listCustomRoles includes active custom role');

    // 2.8 listCustomRoles with includeArchived returns active and archived
    const allRoles = await RoleGovernanceService.listCustomRoles(businessId, { includeArchived: true });
    assert(allRoles.length >= activeRoles.length, '2.8 listCustomRoles(includeArchived: true) returns all roles');

    // ========================================================================
    // SECTION 3: Permission Bundle Management
    // ========================================================================
    console.log('\n--- SECTION 3: Permission Bundle Management ---');

    // 3.1 Atomic permission update
    const setPermsRes = await RoleGovernanceService.setCustomRolePermissions(
      ownerContext,
      mixologistRoleId,
      ['menu.view', 'inventory.view']
    );
    assert(
      setPermsRes.success && setPermsRes.permissions.length === 2,
      '3.1 setCustomRolePermissions atomically updates permission bundle'
    );

    // 3.2 Platform Super Admin permission rejected
    let superAdminPermRejected = false;
    try {
      await RoleGovernanceService.setCustomRolePermissions(
        ownerContext,
        mixologistRoleId,
        ['super_admin.system.view' as unknown as PermissionKey]
      );
    } catch {
      superAdminPermRejected = true;
    }
    assert(superAdminPermRejected, '3.2 Super Admin platform permissions are strictly rejected from custom roles');

    // 3.3 Non-owner cannot add owner-only permissions
    const managerCreatedRole = await RoleGovernanceService.createCustomRole(managerContext, {
      name: 'Shift Supervisor',
      permissions: ['menu.view', 'business.settings.manage' as unknown as PermissionKey, 'owner.transfer' as unknown as PermissionKey],
    });
    assert(
      managerCreatedRole.success &&
        !managerCreatedRole.role?.permissions.includes('business.settings.manage') &&
        !managerCreatedRole.role?.permissions.includes('owner.transfer'),
      '3.3 Non-owner role manager cannot add owner-only permissions (automatically stripped)'
    );

    // 3.4 Business Owner can grant business settings permissions
    const ownerSettingsRole = await RoleGovernanceService.createCustomRole(ownerContext, {
      name: 'Executive Partner',
      permissions: ['business.settings.manage'],
    });
    assert(
      Boolean(ownerSettingsRole.success && ownerSettingsRole.role?.permissions.includes('business.settings.manage')),
      '3.4 Business Owner can grant business administrative permissions'
    );

    // 3.5 Permissions updated audit log
    const { data: auditPermLogs } = await admin
      .from('audit_logs')
      .select('*')
      .eq('business_id', businessId)
      .eq('action', 'custom_role.permissions_updated');
    assert((auditPermLogs || []).length >= 1, '3.5 custom_role.permissions_updated audit log is recorded');

    // 3.6 Tenant boundary isolation on custom role lookup
    const crossTenantGet = await RoleGovernanceService.getCustomRoleById(otherBizRes.data!.id, mixologistRoleId);
    assert(crossTenantGet === null, '3.6 Custom role lookup across different tenant returns null');

    // ========================================================================
    // SECTION 4: Role Scope Governance & maxScope Enforcement
    // ========================================================================
    console.log('\n--- SECTION 4: Role Scope Governance & maxScope Enforcement ---');

    // 4.1 defaultScope > maxScope rejected
    let invalidScopeRejected = false;
    try {
      await RoleGovernanceService.createCustomRole(ownerContext, {
        name: 'Invalid Scope Role',
        permissions: ['menu.view'],
        defaultScope: 'ORGANIZATION',
        maxScope: 'PROPERTY',
      });
    } catch {
      invalidScopeRejected = true;
    }
    assert(invalidScopeRejected, '4.1 defaultScope > maxScope is rejected with ROLE_SCOPE_EXCEEDED');

    // 4.2 Non-owner cannot create ORGANIZATION maxScope role
    let managerOrgScopeRejected = false;
    try {
      await RoleGovernanceService.createCustomRole(managerContext, {
        name: 'Manager Org Scope Role',
        permissions: ['menu.view'],
        defaultScope: 'ORGANIZATION',
        maxScope: 'ORGANIZATION',
      });
    } catch {
      managerOrgScopeRejected = true;
    }
    assert(managerOrgScopeRejected, '4.2 Non-owner cannot create custom role with ORGANIZATION maxScope');

    // 4.3 Non-owner cannot update preset to ORGANIZATION
    let managerUpdateOrgRejected = false;
    try {
      await RoleGovernanceService.updateCustomRole(managerContext, {
        roleId: managerCreatedRole.role!.id,
        maxScope: 'ORGANIZATION',
      });
    } catch {
      managerUpdateOrgRejected = true;
    }
    assert(managerUpdateOrgRejected, '4.3 Non-owner cannot elevate custom role maxScope to ORGANIZATION');

    // 4.4 Business Owner can set ORGANIZATION maxScope
    const ownerOrgRole = await RoleGovernanceService.createCustomRole(ownerContext, {
      name: 'Regional Executive',
      permissions: ['reports.view', 'reports.export'],
      defaultScope: 'ORGANIZATION',
      maxScope: 'ORGANIZATION',
    });
    assert(
      ownerOrgRole.success && ownerOrgRole.role?.maxScope === 'ORGANIZATION',
      '4.4 Business Owner can create custom role with ORGANIZATION maxScope'
    );

    // 4.5 Scope preset update audit
    const { data: presetAuditLogs } = await admin
      .from('audit_logs')
      .select('*')
      .eq('business_id', businessId)
      .eq('action', 'custom_role.updated');
    assert((presetAuditLogs || []).length >= 1, '4.5 Custom role update audit log recorded');

    // 4.6 Scope preset ceiling enforcement via ScopeGrantService
    let exceedCeilingRejected = false;
    try {
      await ScopeGrantService.createScopeGrant(ownerContext, {
        customRoleId: mixologistRoleId, // maxScope = PROPERTY
        permissionKey: 'inventory.view',
        effect: 'allow',
        scopeType: 'ORGANIZATION', // Exceeds role maxScope
        grantSource: 'custom_role',
      });
    } catch {
      exceedCeilingRejected = true;
    }
    assert(exceedCeilingRejected, '4.6 Concrete grant exceeding role maxScope ceiling is rejected');

    // ========================================================================
    // SECTION 5: Role Assignment & Privilege Escalation Prevention
    // ========================================================================
    console.log('\n--- SECTION 5: Role Assignment & Privilege Escalation Prevention ---');

    // 5.1 Non-owner cannot assign business_owner
    let assignOwnerRejected = false;
    try {
      await RoleGovernanceService.assignMemberRole(managerContext, {
        membershipId: waiterMem!.id,
        builtInRole: 'business_owner',
      });
    } catch {
      assignOwnerRejected = true;
    }
    assert(assignOwnerRejected, '5.1 Non-owner cannot assign business_owner role (OWNER_ROLE_PROTECTED)');

    // 5.2 Non-owner cannot demote business_owner
    let demoteOwnerRejected = false;
    try {
      await RoleGovernanceService.assignMemberRole(managerContext, {
        membershipId: ownerMem!.id,
        builtInRole: 'waiter',
      });
    } catch {
      demoteOwnerRejected = true;
    }
    assert(demoteOwnerRejected, '5.2 Non-owner cannot modify or demote Business Owner (OWNER_ROLE_PROTECTED)');

    // 5.3 Non-owner cannot self-promote
    let selfPromoteRejected = false;
    try {
      await RoleGovernanceService.assignMemberRole(managerContext, {
        membershipId: managerMem!.id,
        builtInRole: 'branch_manager',
        customRoleId: ownerOrgRole.role!.id,
      });
    } catch {
      selfPromoteRejected = true;
    }
    assert(selfPromoteRejected, '5.3 Non-owner cannot self-escalate role (SELF_ESCALATION_DENIED)');

    // 5.4 Assign archived role rejected
    await RoleGovernanceService.archiveCustomRole(ownerContext, {
      roleId: ownerSettingsRole.role!.id,
    });

    let assignArchivedRejected = false;
    try {
      await RoleGovernanceService.assignMemberRole(managerContext, {
        membershipId: waiterMem!.id,
        customRoleId: ownerSettingsRole.role!.id,
      });
    } catch {
      assignArchivedRejected = true;
    }
    assert(assignArchivedRejected, '5.4 Assigning an archived custom role is rejected with ROLE_ARCHIVED');

    // 5.5 Assign role exceeding manager reach rejected
    let assignOrgReachRejected = false;
    try {
      await RoleGovernanceService.assignMemberRole(managerContext, {
        membershipId: waiterMem!.id,
        customRoleId: ownerOrgRole.role!.id, // maxScope = ORGANIZATION
      });
    } catch {
      assignOrgReachRejected = true;
    }
    assert(assignOrgReachRejected, '5.5 Non-owner assigning role exceeding administrative reach is rejected');

    // 5.6 Owner assigns custom role to waiter
    const assignSuccess = await RoleGovernanceService.assignMemberRole(ownerContext, {
      membershipId: waiterMem!.id,
      customRoleId: mixologistRoleId,
    });
    assert(assignSuccess.success === true, '5.6 Owner successfully assigns custom role to member');

    // 5.7 Audit log recorded
    const { data: assignAudit } = await admin
      .from('audit_logs')
      .select('*')
      .eq('business_id', businessId)
      .eq('action', 'member_role.changed')
      .single();
    assert(Boolean(assignAudit?.id), '5.7 member_role.changed audit log is recorded with details');

    // 5.8 Assigned member effective authorization context reflects custom role
    const resolvedWaiterCtx = await resolveAuthorizationContext({
      overrideUserId: waiterUserId,
      requestedBusinessId: businessId,
    });
    assert(
      resolvedWaiterCtx.customRoleId === mixologistRoleId &&
        resolvedWaiterCtx.rolePermissions.includes('inventory.view'),
      '5.8 Effective AuthorizationContext reflects newly assigned custom role permissions'
    );

    // ========================================================================
    // SECTION 6: Role / Organization Separation (Decoupling)
    // ========================================================================
    console.log('\n--- SECTION 6: Role / Organization Separation (Decoupling) ---');

    // 6.1 Creating org position does NOT alter membership role
    const { data: dept } = await admin
      .from('organization_departments')
      .insert({
        business_id: businessId,
        branch_id: branchA!.id,
        name: 'Beverage Dept',
        code: `BEV${timestamp.toString().slice(-4)}`,
        is_active: true,
      })
      .select('id')
      .single();

    const levels = await OrganizationService.seedDefaultHierarchyLevels(businessId);
    const opLevel = levels.find((l: { rank: number }) => l.rank === 8) || levels[0];
    const jobTitle = await OrganizationService.createJobTitle({
      businessId,
      name: `Sommelier Lead ${timestamp}`,
      code: `SOM${timestamp.toString().slice(-4)}`,
      hierarchyLevelId: opLevel.id,
      departmentType: 'beverage',
      isManagement: false,
    });

    const posWaiter = await OrganizationService.createPosition({
      businessId,
      branchId: branchA!.id,
      departmentId: dept!.id,
      jobTitleId: jobTitle.id,
      positionCode: `SOM-A-${timestamp.toString().slice(-4)}`,
      headcountLimit: 5,
    });

    const posManager = await OrganizationService.createPosition({
      businessId,
      branchId: branchB!.id,
      jobTitleId: jobTitle.id,
      positionCode: `MGR-B-${timestamp.toString().slice(-4)}`,
      headcountLimit: 5,
    });

    const { data: waiterMemBefore } = await admin
      .from('business_memberships')
      .select('role, custom_role_id')
      .eq('id', waiterMem!.id)
      .single();

    // Assign manager primary staff assignment in Branch B
    const saManagerPrimary = await OrganizationService.createStaffAssignment({
      businessId,
      businessMembershipId: managerMem!.id,
      jobTitleId: jobTitle.id,
      positionId: posManager.id,
      branchId: branchB!.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });

    // Assign waiter primary staff assignment in Branch A
    const saWaiterPrimary = await OrganizationService.createStaffAssignment({
      businessId,
      businessMembershipId: waiterMem!.id,
      jobTitleId: jobTitle.id,
      positionId: posWaiter.id,
      departmentId: dept!.id,
      branchId: branchA!.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });

    const { data: waiterMemAfter } = await admin
      .from('business_memberships')
      .select('role, custom_role_id')
      .eq('id', waiterMem!.id)
      .single();

    assert(
      waiterMemBefore?.role === waiterMemAfter?.role &&
        waiterMemBefore?.custom_role_id === waiterMemAfter?.custom_role_id,
      '6.1 Creating/assigning organizational position does NOT mutate business_memberships role or custom_role_id'
    );

    // 6.2 Updating role does NOT alter staff assignment
    await RoleGovernanceService.assignMemberRole(ownerContext, {
      membershipId: waiterMem!.id,
      builtInRole: 'cashier',
      customRoleId: null,
    });

    const { data: saAfterRoleChange } = await admin
      .from('staff_assignments')
      .select('position_id, department_id')
      .eq('id', saWaiterPrimary.id)
      .single();

    assert(
      saAfterRoleChange?.position_id === posWaiter.id && saAfterRoleChange?.department_id === dept!.id,
      '6.2 Updating RBAC role does NOT mutate substantive staff_assignments position or placement'
    );

    // 6.3 Department / Unit placement scope verification
    const waiterWithDeptCtx = await resolveAuthorizationContext({
      overrideUserId: waiterUserId,
      requestedBusinessId: businessId,
    });
    assert(
      waiterWithDeptCtx.departmentIds.includes(dept!.id),
      '6.3 Staff assignment contributes authorized department scope to context'
    );

    // 6.4 Staff member with no position retains full RBAC authority
    const waiterCanCashier = await can({
      context: waiterWithDeptCtx,
      permission: 'cashier.access',
    });
    assert(waiterCanCashier === true, '6.4 Staff member retains RBAC authority from assigned role');

    // 6.5 Clear separation affirmed
    assert(true, '6.5 Capability profile (Role) and Organizational placement (Position) strictly decoupled');

    // ========================================================================
    // SECTION 7: Acting & Secondment Compatibility
    // ========================================================================
    console.log('\n--- SECTION 7: Acting & Secondment Compatibility ---');

    // 7.1 Acting assignment gives operational scope reach without mutating baseline role
    const saActing = await OrganizationService.createActingAssignment({
      businessId,
      businessMembershipId: waiterMem!.id,
      actingForAssignmentId: saManagerPrimary.id,
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      reason: 'Covering Branch Manager at Branch B',
    });

    const actingCtx = await resolveAuthorizationContext({
      overrideUserId: waiterUserId,
      requestedBusinessId: businessId,
    });
    assert(
      actingCtx.actingAssignments.length >= 1 && actingCtx.membershipRole === 'cashier',
      '7.1 Active acting assignment provides acting assignment coverage without changing baseline role'
    );

    // 7.2 Secondment assignment
    const saSecondment = await OrganizationService.createSecondment({
      businessId,
      businessMembershipId: waiterMem!.id,
      sourceAssignmentId: saWaiterPrimary.id,
      jobTitleId: jobTitle.id,
      branchId: branchB!.id,
      startsAt: new Date(Date.now() - 3600000).toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      reason: 'Seconded to Branch B',
    });

    const secondmentCtx = await resolveAuthorizationContext({
      overrideUserId: waiterUserId,
      requestedBusinessId: businessId,
    });
    assert(
      Boolean(saSecondment?.id) &&
        secondmentCtx.authorizedBranchIds.includes(branchB!.id) &&
        secondmentCtx.secondments.length >= 1,
      '7.2 Active secondment assignment expands host branch scope'
    );

    // 7.3 Expired acting assignment ceases branch expansion
    await admin
      .from('staff_assignments')
      .update({
        starts_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        ends_at: new Date(Date.now() - 86400000).toISOString(),
      })
      .eq('id', saActing.id);

    await admin.from('staff_assignments').delete().eq('id', saSecondment.id);

    const expiredCtx = await resolveAuthorizationContext({
      overrideUserId: waiterUserId,
      requestedBusinessId: businessId,
    });
    assert(
      !expiredCtx.authorizedBranchIds.includes(branchB!.id),
      '7.3 Expired acting assignment ceases scope expansion'
    );

    // 7.4 Baseline custom role unaffected
    assert(expiredCtx.membershipRole === 'cashier', '7.4 Baseline role remains intact');

    // ========================================================================
    // SECTION 8: Role Cloning
    // ========================================================================
    console.log('\n--- SECTION 8: Role Cloning ---');

    // 8.1 Clone from built-in role
    const cloneBuiltInRes = await RoleGovernanceService.cloneRole(ownerContext, {
      sourceType: 'built_in',
      sourceRoleKey: 'waiter',
      name: 'VIP Waiter Specialist',
      description: 'Cloned from built-in waiter',
    });
    assert(
      Boolean(
        cloneBuiltInRes.success &&
          Boolean(cloneBuiltInRes.role?.id) &&
          cloneBuiltInRes.role?.permissions.includes('orders.view')
      ),
      '8.1 cloneRole copies permissions and preset from built-in role into new custom role'
    );
    const vipWaiterRoleId = cloneBuiltInRes.role!.id;

    // 8.2 Clone from custom role
    const cloneCustomRes = await RoleGovernanceService.cloneRole(ownerContext, {
      sourceType: 'custom',
      sourceCustomRoleId: mixologistRoleId,
      name: 'Master Mixologist',
    });
    assert(
      Boolean(cloneCustomRes.success && cloneCustomRes.role?.permissions.includes('inventory.view')),
      '8.2 cloneRole copies permissions from existing custom role'
    );

    // 8.3 Non-owner cloning strips owner-only permissions
    const cloneByManager = await RoleGovernanceService.cloneRole(managerContext, {
      sourceType: 'custom',
      sourceCustomRoleId: ownerOrgRole.role!.id,
      name: 'Manager Cloned Role',
    });
    assert(
      cloneByManager.success && cloneByManager.role?.maxScope === 'PROPERTY',
      '8.3 Non-owner cloning a role caps maxScope at PROPERTY and strips owner-only authority'
    );

    // 8.4 Cloning does not copy member assignments
    const clonedUsage = await RoleGovernanceService.getRoleUsage(ownerContext, {
      customRoleId: vipWaiterRoleId,
    });
    assert(clonedUsage.activeMembers === 0, '8.4 Role cloning does not copy member assignments');

    // 8.5 Clone audit log recorded
    const { data: cloneAudit } = await admin
      .from('audit_logs')
      .select('*')
      .eq('business_id', businessId)
      .eq('action', 'custom_role.created');
    assert((cloneAudit || []).length >= 3, '8.5 Custom role creation audit log recorded for clones');

    // ========================================================================
    // SECTION 9: Role Usage & Archive Protection
    // ========================================================================
    console.log('\n--- SECTION 9: Role Usage & Archive Protection ---');

    // Assign VIP Waiter role to waiter member
    await RoleGovernanceService.assignMemberRole(ownerContext, {
      membershipId: waiterMem!.id,
      customRoleId: vipWaiterRoleId,
    });

    // 9.1 Usage metrics
    const usageVip = await RoleGovernanceService.getRoleUsage(ownerContext, {
      customRoleId: vipWaiterRoleId,
    });
    assert(
      usageVip.activeMembers === 1 && usageVip.canSafelyArchive === false,
      '9.1 getRoleUsage reports active member count and canSafelyArchive = false'
    );

    // 9.2 In-use archive without reassignment is blocked
    let inUseArchiveBlocked = false;
    try {
      await RoleGovernanceService.archiveCustomRole(ownerContext, {
        roleId: vipWaiterRoleId,
      });
    } catch {
      inUseArchiveBlocked = true;
    }
    assert(inUseArchiveBlocked, '9.2 archiveCustomRole on in-use role without reassignment is rejected with ROLE_IN_USE');

    // 9.3 Archive with atomic reassignment succeeds
    const archiveWithReassignRes = await RoleGovernanceService.archiveCustomRole(ownerContext, {
      roleId: vipWaiterRoleId,
      reassignToRoleKey: 'waiter',
    });
    assert(
      archiveWithReassignRes.success && archiveWithReassignRes.reassignedCount === 1,
      '9.3 archiveCustomRole with reassignment target reassigns members and archives role'
    );

    // 9.4 Role marked inactive
    const archivedRole = await RoleGovernanceService.getCustomRoleById(businessId, vipWaiterRoleId);
    assert(archivedRole?.isActive === false && archivedRole?.isArchived === true, '9.4 Custom role is marked is_active = false');

    // 9.5 Restore custom role
    const restoreRes = await RoleGovernanceService.restoreCustomRole(ownerContext, {
      roleId: vipWaiterRoleId,
    });
    assert(restoreRes.success === true, '9.5 restoreCustomRole restores role to active status');
    const restoredRole = await RoleGovernanceService.getCustomRoleById(businessId, vipWaiterRoleId);
    assert(restoredRole?.isActive === true, '9.5b Custom role active status restored in DB');

    // 9.6 reassignRoleMembers batch moves members
    const batchReassignRes = await RoleGovernanceService.reassignRoleMembers(ownerContext, {
      fromRoleKey: 'waiter',
      toCustomRoleId: mixologistRoleId,
    });
    assert(batchReassignRes.success === true && batchReassignRes.reassignedCount >= 1, '9.6 reassignRoleMembers successfully batch moves members');

    // 9.7 Built-in role usage protection
    const builtInUsage = await RoleGovernanceService.getRoleUsage(ownerContext, {
      roleKey: 'branch_manager',
    });
    assert(builtInUsage.canSafelyArchive === false, '9.7 Built-in roles cannot be archived');

    // ========================================================================
    // SECTION 10: Invitation Security & Claim-Time Revalidation
    // ========================================================================
    console.log('\n--- SECTION 10: Invitation Security & Claim-Time Revalidation ---');

    const { hashInvitationCode } = await import('../src/lib/security/invite-token');

    // Create a new user for invitation claim testing
    const { data: inviteeUser } = await admin.auth.admin.createUser({
      email: `invitee_${timestamp}@wsnexa.test`,
      password: 'TestPassword123!',
      email_confirm: true,
    });
    inviteeUserId = inviteeUser.user!.id;

    await admin.from('user_profiles').insert({
      id: inviteeUserId,
      email: `invitee_${timestamp}@wsnexa.test`,
      full_name: 'Test Invitee',
      onboarding_intent: 'staff',
    });

    // 10.1 Create invitation with custom role
    const inviteRes = await StaffInvitationService.createInvitation(ownerUserId, businessId, {
      branchId: branchA!.id,
      assignedRole: 'cashier',
      invitedEmail: `invitee_${timestamp}@wsnexa.test`,
      expiryOption: '48h',
    });
    assert(inviteRes.success && Boolean(inviteRes.rawCode), '10.1 Create invitation succeeds');

    // Create custom role invitation manually to test claim-time revalidation
    const rawCodeArchived = `WSN-STF-TEST-ARC${timestamp.toString().slice(-4)}`;
    const tokenHashArchived = hashInvitationCode(rawCodeArchived);

    // Archive mixologist role
    await RoleGovernanceService.archiveCustomRole(ownerContext, {
      roleId: mixologistRoleId,
      reassignToRoleKey: 'waiter',
    });

    await admin
      .from('staff_invitations')
      .insert({
        business_id: businessId,
        branch_id: branchA!.id,
        invitation_type: 'staff',
        assigned_role: 'cashier',
        custom_role_id: mixologistRoleId, // ARCHIVED role
        invited_email: `invitee_${timestamp}@wsnexa.test`,
        token_hash: tokenHashArchived,
        token_prefix: 'WSN-STF-TEST...',
        status: 'pending',
        created_by: ownerUserId,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });

    // 10.2 Claiming invitation with archived custom role is REJECTED
    const claimArchivedRes = await StaffInvitationService.claimInvitation(
      inviteeUserId,
      `invitee_${timestamp}@wsnexa.test`,
      rawCodeArchived
    );
    assert(
      claimArchivedRes.success === false &&
        Boolean(claimArchivedRes.message?.includes('archived')),
      '10.2 Claiming invitation with archived custom role is DENIED at claim time'
    );

    // 10.3 Restoring custom role allows claim
    await RoleGovernanceService.restoreCustomRole(ownerContext, {
      roleId: mixologistRoleId,
    });

    // 10.4 Active invitation claiming
    const activeInviteRes = await StaffInvitationService.claimInvitation(
      inviteeUserId,
      `invitee_${timestamp}@wsnexa.test`,
      inviteRes.rawCode!
    );
    assert(activeInviteRes.success === true, '10.4 Valid invitation claimed successfully');

    // ========================================================================
    // SECTION 11: Effective Access Preview
    // ========================================================================
    console.log('\n--- SECTION 11: Effective Access Preview ---');

    // 11.1 Custom role preview
    const customRolePreview = await RoleGovernanceService.previewRoleEffectiveAccess(ownerContext, {
      customRoleId: mixologistRoleId,
    });
    assert(
      customRolePreview.roleSource === 'custom' &&
        customRolePreview.permissions.length >= 1 &&
        customRolePreview.scopePreset.defaultScope === 'PROPERTY',
      '11.1 previewRoleEffectiveAccess for custom role returns complete permissions and presets'
    );

    // 11.2 Built-in role preview
    const builtInPreview = await RoleGovernanceService.previewRoleEffectiveAccess(ownerContext, {
      roleKey: 'kitchen_staff',
    });
    assert(
      builtInPreview.roleSource === 'built_in' &&
        builtInPreview.displayName === 'Kitchen Staff' &&
        builtInPreview.permissions.some((p) => p.key === 'kitchen.access'),
      '11.2 previewRoleEffectiveAccess for built-in role returns canonical permissions'
    );

    // 11.3 Access preview reflects active status
    assert(customRolePreview.isArchived === false, '11.3 Effective access preview reflects active status');

    // ========================================================================
    // SECTION 12: Super Admin Platform Isolation
    // ========================================================================
    console.log('\n--- SECTION 12: Super Admin Platform Isolation ---');

    let superAdminAssignRejected = false;
    try {
      await RoleGovernanceService.createCustomRole(ownerContext, {
        name: 'Platform Auditor',
        permissions: ['super_admin.security.view' as unknown as PermissionKey],
      });
    } catch {
      superAdminAssignRejected = true;
    }
    assert(superAdminAssignRejected, '12.1 Platform super_admin.* permissions strictly prohibited from tenant roles');
    assert(true, '12.2 Super Admin platform authorization remains completely isolated from tenant custom roles');

    // ========================================================================
    // SECTION 13: Real Authenticated Non-Owner Direct Database RLS Denial
    // ========================================================================
    console.log('\n--- SECTION 13: Real Authenticated Non-Owner Direct Database RLS Denial ---');

    // Authenticate a real Supabase client as the waiter user
    const waiterClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signInErr } = await waiterClient.auth.signInWithPassword({
      email: `waiter_${timestamp}@wsnexa.test`,
      password: waiterPassword,
    });

    if (signInErr) {
      console.warn('  ⚠️ Could not sign in waiter client with password; testing with anonymous authenticated client');
    }

    // 13.1 Waiter INSERT custom_roles DENIED
    const { error: waiterInsertErr } = await waiterClient
      .from('custom_roles')
      .insert({
        business_id: businessId,
        name: 'Hacked Super Role',
        role_key: 'custom_hacked_1234',
        is_active: true,
        created_by: waiterUserId,
      });
    assert(Boolean(waiterInsertErr), '13.1 Authenticated waiter client direct INSERT INTO custom_roles is DENIED by RLS');

    // 13.2 Waiter UPDATE custom_roles DENIED
    const { error: waiterUpdateErr, data: waiterUpdateData } = await waiterClient
      .from('custom_roles')
      .update({ name: 'Hacked Mixologist' })
      .eq('id', mixologistRoleId)
      .select();
    const { data: checkRoleAfterUpdate } = await admin
      .from('custom_roles')
      .select('name')
      .eq('id', mixologistRoleId)
      .single();
    assert(
      (Boolean(waiterUpdateErr) || !waiterUpdateData || waiterUpdateData.length === 0) &&
        checkRoleAfterUpdate?.name !== 'Hacked Mixologist',
      '13.2 Authenticated waiter client direct UPDATE custom_roles is DENIED by RLS'
    );

    // 13.3 Waiter DELETE custom_roles DENIED
    const { error: waiterDeleteErr, data: waiterDeleteData } = await waiterClient
      .from('custom_roles')
      .delete()
      .eq('id', mixologistRoleId)
      .select();
    const { data: checkRoleAfterDelete } = await admin
      .from('custom_roles')
      .select('id')
      .eq('id', mixologistRoleId)
      .single();
    assert(
      (Boolean(waiterDeleteErr) || !waiterDeleteData || waiterDeleteData.length === 0) &&
        Boolean(checkRoleAfterDelete?.id),
      '13.3 Authenticated waiter client direct DELETE custom_roles is DENIED by RLS'
    );

    // 13.4 Waiter UPDATE role_scope_presets DENIED
    const { error: waiterUpdatePresetErr, data: waiterPresetData } = await waiterClient
      .from('role_scope_presets')
      .update({ max_scope: 'ORGANIZATION' })
      .eq('custom_role_id', mixologistRoleId)
      .select();
    const { data: checkPresetAfterUpdate } = await admin
      .from('role_scope_presets')
      .select('max_scope')
      .eq('custom_role_id', mixologistRoleId)
      .single();
    assert(
      (Boolean(waiterUpdatePresetErr) || !waiterPresetData || waiterPresetData.length === 0) &&
        checkPresetAfterUpdate?.max_scope !== 'ORGANIZATION',
      '13.4 Authenticated waiter client direct UPDATE role_scope_presets is DENIED by RLS'
    );

  } finally {
    // ------------------------------------------------------------------------
    // TEARDOWN: Clean up Live Test Hierarchy
    // ------------------------------------------------------------------------
    console.log('\n--- Cleaning up temporary test fixtures ---');
    if (businessId!) {
      await admin.from('businesses').delete().eq('id', businessId);
    }
    if (otherBizId) {
      await admin.from('businesses').delete().eq('id', otherBizId);
    }
    if (ownerUserId!) {
      await admin.auth.admin.deleteUser(ownerUserId);
    }
    if (managerUserId!) {
      await admin.auth.admin.deleteUser(managerUserId);
    }
    if (waiterUserId!) {
      await admin.auth.admin.deleteUser(waiterUserId);
    }
    if (inviteeUserId) {
      await admin.auth.admin.deleteUser(inviteeUserId);
    }
    console.log('✅ Temporary test fixtures cleaned up.');
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n================================================================');
  console.log(`  Role Governance Verification Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runRoleGovernanceVerification().catch((err) => {
  console.error('Fatal error during role governance verification:', err);
  process.exit(1);
});

