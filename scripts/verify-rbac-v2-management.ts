import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

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

import { createClient } from '@supabase/supabase-js';
import type { AuthorizationContext, ScopeGrantDetail, RoleScopePresetDetail } from '../src/types/authorization.types';

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

async function runManagementVerification() {
  console.log('================================================================');
  console.log('  WSNexa Phase 30 Step 6 — RBAC V2 Scope Management Test Suite  ');
  console.log('================================================================\n');

  // Dynamic module imports
  const {
    validateScopeTarget,
    validateMaxScope,
    validateAdministrativeReach,
  } = await import(pathToFileURL(path.join(process.cwd(), 'src/server/auth/scope-target-validator.ts')).href);

  const { ScopeGrantService } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/services/scope-grant.service.ts')).href
  );

  const { PermissionService } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/server/services/permission.service.ts')).href
  );

  const { SCOPE_RANK } = await import(
    pathToFileURL(path.join(process.cwd(), 'src/types/authorization.types.ts')).href
  );

  // Set up live temporary business and entities for verification
  const suffix = Date.now().toString(36);
  const testBusinessName = `ScopeMgmt Biz ${suffix}`;
  const testSlug = `scopemgmt-${suffix}`;

  // Create test user first
  const testUserEmail = `staff.${suffix}@test.wsnexa.com`;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: testUserEmail,
    password: 'Password123!',
    email_confirm: true,
  });

  if (authErr || !authUser?.user) {
    console.error('Failed to create test user:', authErr);
    process.exit(1);
  }

  const testUserId = authUser.user.id;

  const { data: testBiz, error: bizErr } = await admin
    .from('businesses')
    .insert({
      name: testBusinessName,
      slug: testSlug,
      default_currency: 'LKR',
      created_by: testUserId,
    })
    .select('id')
    .single();

  if (bizErr || !testBiz) {
    console.error('Failed to create test business for management audit:', bizErr);
    process.exit(1);
  }

  const businessId = testBiz.id;

  // Create branches
  const { data: branchA, error: brAErr } = await admin
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Colombo Branch A',
      code: `CBA-${suffix}`,
      status: 'active',
      is_default: true,
    })
    .select('id')
    .single();

  if (brAErr || !branchA) {
    console.error('Failed to create Branch A:', brAErr);
    process.exit(1);
  }

  const { data: branchB, error: brBErr } = await admin
    .from('branches')
    .insert({
      business_id: businessId,
      name: 'Kandy Branch B',
      code: `KBB-${suffix}`,
      status: 'active',
      is_default: false,
    })
    .select('id')
    .single();

  if (brBErr || !branchB) {
    console.error('Failed to create Branch B:', brBErr);
    process.exit(1);
  }

  // Create department & unit
  const { data: deptKitchen, error: deptErr } = await admin
    .from('organization_departments')
    .insert({
      business_id: businessId,
      branch_id: branchA.id,
      name: 'Kitchen Dept',
      code: `KD-${suffix}`,
      department_type: 'operational',
    })
    .select('id')
    .single();

  if (deptErr || !deptKitchen) {
    console.error('Failed to create Department:', deptErr);
    process.exit(1);
  }

  const { data: unitPastry, error: unitErr } = await admin
    .from('organization_units')
    .insert({
      business_id: businessId,
      branch_id: branchA.id,
      department_id: deptKitchen.id,
      name: 'Pastry Unit',
      code: `PU-${suffix}`,
      unit_type: 'section',
    })
    .select('id')
    .single();

  if (unitErr || !unitPastry) {
    console.error('Failed to create Unit:', unitErr);
    process.exit(1);
  }

  const { data: areaBar, error: areaErr } = await admin
    .from('service_areas')
    .insert({
      business_id: businessId,
      branch_id: branchA.id,
      name: 'Bar Area',
      code: `BAR-${suffix}`,
    })
    .select('id')
    .single();

  if (areaErr || !areaBar) {
    console.error('Failed to create Service Area:', areaErr);
    process.exit(1);
  }

  // Create custom role
  const { data: customRole, error: crErr } = await admin
    .from('custom_roles')
    .insert({
      business_id: businessId,
      name: 'Head Mixologist',
      role_key: `mixologist_${suffix}`,
      created_by: testUserId,
    })
    .select('id')
    .single();

  if (crErr || !customRole) {
    console.error('Failed to create Custom Role:', crErr);
    process.exit(1);
  }

  const { data: membership } = await admin
    .from('business_memberships')
    .insert({
      business_id: businessId,
      user_id: testUserId,
      role: 'waiter',
      membership_status: 'active',
    })
    .select('id')
    .single();

  const membershipId = membership!.id;

  try {
    // ========================================================================
    // SECTION 1: Scope Target Validator Assertions
    // ========================================================================
    console.log('--- SECTION 1: Scope Target Validator Assertions ---');

    // 1.1 Valid ORGANIZATION scope target
    const orgTarget = await validateScopeTarget({
      businessId,
      scopeType: 'ORGANIZATION',
    });
    assert(orgTarget.valid && orgTarget.scopeType === 'ORGANIZATION', '1.1 Valid ORGANIZATION target passes validation');

    // 1.2 ORGANIZATION with FK must fail
    let orgFkFailed = false;
    try {
      await validateScopeTarget({
        businessId,
        scopeType: 'ORGANIZATION',
        branchId: branchA!.id,
      });
    } catch {
      orgFkFailed = true;
    }
    assert(orgFkFailed, '1.2 ORGANIZATION target specifying branchId is rejected');

    // 1.3 Valid PROPERTY target
    const propTarget = await validateScopeTarget({
      businessId,
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
    });
    assert(propTarget.valid && propTarget.branchId === branchA!.id, '1.3 Valid PROPERTY target with branchId passes');

    // 1.4 PROPERTY without branchId must fail
    let propNoBranchFailed = false;
    try {
      await validateScopeTarget({
        businessId,
        scopeType: 'PROPERTY',
      });
    } catch {
      propNoBranchFailed = true;
    }
    assert(propNoBranchFailed, '1.4 PROPERTY target without branchId is rejected');

    // 1.5 Cross-tenant branch must fail
    let crossTenantBranchFailed = false;
    try {
      await validateScopeTarget({
        businessId: '00000000-0000-0000-0000-000000000000',
        scopeType: 'PROPERTY',
        branchId: branchA!.id,
      });
    } catch {
      crossTenantBranchFailed = true;
    }
    assert(crossTenantBranchFailed, '1.5 Cross-tenant branch target is rejected');

    // 1.6 Valid DEPARTMENT target
    const deptTarget = await validateScopeTarget({
      businessId,
      scopeType: 'DEPARTMENT',
      departmentId: deptKitchen!.id,
    });
    assert(deptTarget.valid && deptTarget.departmentId === deptKitchen!.id, '1.6 Valid DEPARTMENT target passes');

    // 1.7 Valid AREA_TEAM target with organizationUnitId
    const unitTarget = await validateScopeTarget({
      businessId,
      scopeType: 'AREA_TEAM',
      organizationUnitId: unitPastry!.id,
    });
    assert(unitTarget.valid && unitTarget.organizationUnitId === unitPastry!.id, '1.7 Valid AREA_TEAM with unit passes');

    // 1.8 Valid AREA_TEAM target with serviceAreaId
    const areaTarget = await validateScopeTarget({
      businessId,
      scopeType: 'AREA_TEAM',
      serviceAreaId: areaBar!.id,
    });
    assert(areaTarget.valid && areaTarget.serviceAreaId === areaBar!.id, '1.8 Valid AREA_TEAM with service area passes');

    // 1.9 AREA_TEAM with both unit and service area must fail (XOR violation)
    let areaBothFailed = false;
    try {
      await validateScopeTarget({
        businessId,
        scopeType: 'AREA_TEAM',
        organizationUnitId: unitPastry!.id,
        serviceAreaId: areaBar!.id,
      });
    } catch {
      areaBothFailed = true;
    }
    assert(areaBothFailed, '1.9 AREA_TEAM with BOTH unit and service area is rejected');

    // 1.10 Valid SELF target
    const selfTarget = await validateScopeTarget({
      businessId,
      scopeType: 'SELF',
    });
    assert(selfTarget.valid && selfTarget.scopeType === 'SELF', '1.10 Valid SELF target passes');

    // ========================================================================
    // SECTION 2: Max Scope Enforcement & Rank Logic
    // ========================================================================
    console.log('\n--- SECTION 2: Max Scope Enforcement & Rank Logic ---');

    assert(
      SCOPE_RANK['SELF'] === 1 &&
      SCOPE_RANK['AREA_TEAM'] === 2 &&
      SCOPE_RANK['DEPARTMENT'] === 3 &&
      SCOPE_RANK['PROPERTY'] === 4 &&
      SCOPE_RANK['ORGANIZATION'] === 5,
      '2.1 SCOPE_RANK reflects canonical hierarchy (SELF < AREA_TEAM < DEPARTMENT < PROPERTY < ORGANIZATION)'
    );

    // Valid lower scope
    let maxScopePass = true;
    try {
      validateMaxScope('PROPERTY', 'AREA_TEAM');
      validateMaxScope('PROPERTY', 'PROPERTY');
      validateMaxScope('ORGANIZATION', 'PROPERTY');
    } catch {
      maxScopePass = false;
    }
    assert(maxScopePass, '2.2 Scope within or equal to maxScope passes');

    // Escalation beyond maxScope must fail
    let maxScopeEscalationFail = false;
    try {
      validateMaxScope('PROPERTY', 'ORGANIZATION');
    } catch {
      maxScopeEscalationFail = true;
    }
    assert(maxScopeEscalationFail, '2.3 Requesting ORGANIZATION grant on PROPERTY maxScope is rejected');

    let deptToPropEscalationFail = false;
    try {
      validateMaxScope('DEPARTMENT', 'PROPERTY');
    } catch {
      deptToPropEscalationFail = true;
    }
    assert(deptToPropEscalationFail, '2.4 Requesting PROPERTY grant on DEPARTMENT maxScope is rejected');

    // ========================================================================
    // SECTION 3: Administrative Reach & Privilege Escalation Prevention
    // ========================================================================
    console.log('\n--- SECTION 3: Administrative Reach & Privilege Escalation Prevention ---');

    const ownerContext = createMockContext({
      userId: testUserId,
      businessId,
      membershipRole: 'business_owner',
      isBusinessOwner: true,
      rolePermissions: ['roles.manage', 'business.settings.manage'],
    });

    const propManagerContext = createMockContext({
      userId: testUserId,
      businessId,
      membershipRole: 'branch_manager',
      isBusinessOwner: false,
      rolePermissions: ['roles.manage', 'orders.view'],
      authorizedBranchIds: [branchA.id],
      roleScopePreset: {
        roleKey: 'branch_manager',
        customRoleId: null,
        defaultScope: 'PROPERTY',
        maxScope: 'PROPERTY',
      },
    });

    const plainStaffContext = createMockContext({
      userId: testUserId,
      businessId,
      membershipRole: 'waiter',
      isBusinessOwner: false,
      rolePermissions: ['orders.view'],
      authorizedBranchIds: [branchA.id],
    });

    // 3.1 Owner has full reach over tenant
    let ownerReachPass = true;
    try {
      validateAdministrativeReach({
        actorContext: ownerContext,
        requestedScope: 'ORGANIZATION',
        permissionKey: 'orders.cancel',
      });
    } catch {
      ownerReachPass = false;
    }
    assert(ownerReachPass, '3.1 Business Owner has full organization administrative reach');

    // 3.2 Property manager cannot grant ORGANIZATION scope
    let propMgrOrgFail = false;
    try {
      validateAdministrativeReach({
        actorContext: propManagerContext,
        requestedScope: 'ORGANIZATION',
        permissionKey: 'orders.cancel',
      });
    } catch {
      propMgrOrgFail = true;
    }
    assert(propMgrOrgFail, '3.2 Property manager CANNOT grant ORGANIZATION scope (Escalation blocked)');

    // 3.3 Property manager cannot grant on unassigned Branch B
    let propMgrBranchBFail = false;
    try {
      validateAdministrativeReach({
        actorContext: propManagerContext,
        requestedScope: 'PROPERTY',
        targetBranchId: branchB!.id,
        permissionKey: 'orders.cancel',
      });
    } catch {
      propMgrBranchBFail = true;
    }
    assert(propMgrBranchBFail, '3.3 Property manager CANNOT grant on unassigned Branch B target');

    // 3.4 Property manager CAN grant on assigned Branch A
    let propMgrBranchAPass = true;
    try {
      validateAdministrativeReach({
        actorContext: propManagerContext,
        requestedScope: 'PROPERTY',
        targetBranchId: branchA!.id,
        permissionKey: 'orders.cancel',
      });
    } catch {
      propMgrBranchAPass = false;
    }
    assert(propMgrBranchAPass, '3.4 Property manager CAN grant on assigned Branch A target');

    // 3.5 Non-owner cannot grant sensitive owner-only permissions
    let propMgrSensitiveFail = false;
    try {
      validateAdministrativeReach({
        actorContext: propManagerContext,
        requestedScope: 'PROPERTY',
        targetBranchId: branchA!.id,
        permissionKey: 'business.settings.manage',
      });
    } catch {
      propMgrSensitiveFail = true;
    }
    assert(propMgrSensitiveFail, '3.5 Non-owner manager CANNOT grant sensitive owner-only permissions');

    // 3.6 Plain staff without roles.manage is completely denied
    let plainStaffFail = false;
    try {
      validateAdministrativeReach({
        actorContext: plainStaffContext,
        requestedScope: 'PROPERTY',
        targetBranchId: branchA!.id,
        permissionKey: 'orders.cancel',
      });
    } catch {
      plainStaffFail = true;
    }
    assert(plainStaffFail, '3.6 Plain staff without roles.manage is denied grant management');

    // 3.7 Super admin platform permission cannot be granted in tenant RBAC
    let superAdminPermFail = false;
    try {
      validateAdministrativeReach({
        actorContext: ownerContext,
        requestedScope: 'ORGANIZATION',
        permissionKey: 'super_admin.venues.manage',
      });
    } catch {
      superAdminPermFail = true;
    }
    assert(superAdminPermFail, '3.7 Platform Super Admin permission cannot be granted via tenant RBAC');

    // ========================================================================
    // SECTION 4: Scope Grant Service CRUD Assertions
    // ========================================================================
    console.log('\n--- SECTION 4: Scope Grant Service CRUD Assertions ---');

    // 4.1 Create grant on built-in role
    const createRoleGrantRes = await ScopeGrantService.createScopeGrant(ownerContext, {
      roleKey: 'waiter',
      permissionKey: 'orders.cancel',
      effect: 'allow',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
      grantSource: 'role_preset',
    });
    assert(createRoleGrantRes.success && Boolean(createRoleGrantRes.grant?.id), '4.1 Create scope grant on roleKey succeeds');
    const roleGrantId = createRoleGrantRes.grant!.id;

    // 4.2 Create grant on custom role
    const createCustomRoleGrantRes = await ScopeGrantService.createScopeGrant(ownerContext, {
      customRoleId: customRole!.id,
      permissionKey: 'recipes.manage',
      effect: 'allow',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
      grantSource: 'custom_role',
    });
    assert(createCustomRoleGrantRes.success && Boolean(createCustomRoleGrantRes.grant?.id), '4.2 Create scope grant on customRole succeeds');

    // 4.3 Create grant on business membership
    const createMemberGrantRes = await ScopeGrantService.createScopeGrant(ownerContext, {
      businessMembershipId: membershipId,
      permissionKey: 'inventory.adjust',
      effect: 'allow',
      scopeType: 'AREA_TEAM',
      organizationUnitId: unitPastry!.id,
      grantSource: 'member_override',
    });
    assert(createMemberGrantRes.success && Boolean(createMemberGrantRes.grant?.id), '4.3 Create scope grant on membership succeeds');
    const memberGrantId = createMemberGrantRes.grant!.id;

    // 4.4 List scope grants with filters
    const listedGrants = await ScopeGrantService.listScopeGrants({
      businessId,
      roleKey: 'waiter',
    });
    assert(listedGrants.length >= 1 && listedGrants.some((g: ScopeGrantDetail) => g.id === roleGrantId), '4.4 List grants by roleKey returns created grant');

    // 4.5 Update scope grant effect
    const updateGrantRes = await ScopeGrantService.updateScopeGrant(ownerContext, {
      grantId: roleGrantId,
      effect: 'deny',
    });
    assert(updateGrantRes.success && updateGrantRes.grant?.effect === 'deny', '4.5 Update scope grant effect to deny succeeds');

    // 4.6 Revoke scope grant
    const revokeRes = await ScopeGrantService.revokeScopeGrant(ownerContext, memberGrantId);
    assert(revokeRes.success === true, '4.6 Revoke scope grant succeeds');

    const checkRevoked = await ScopeGrantService.getScopeGrantById(businessId, memberGrantId);
    assert(checkRevoked === null, '4.7 Revoked scope grant is no longer retrievable');

    // 4.8 Duplicate grant handling
    const dupRes = await ScopeGrantService.createScopeGrant(ownerContext, {
      roleKey: 'waiter',
      permissionKey: 'orders.cancel',
      effect: 'deny',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
      grantSource: 'role_preset',
    });
    assert(dupRes.success === true, '4.8 Duplicate semantic grant returns cleanly without database collision');

    // ========================================================================
    // SECTION 5: Scoped Member Overrides & Legacy Conversion
    // ========================================================================
    console.log('\n--- SECTION 5: Scoped Member Overrides & Legacy Conversion ---');

    // 5.1 Create scoped ALLOW override
    const setScopedAllowRes = await PermissionService.setScopedMemberOverride(ownerContext, {
      membershipId,
      permissionKey: 'kitchen.update',
      effect: 'allow',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
    });
    assert(setScopedAllowRes.success === true, '5.1 Set scoped ALLOW override succeeds');

    // 5.2 Create scoped DENY override
    const setScopedDenyRes = await PermissionService.setScopedMemberOverride(ownerContext, {
      membershipId,
      permissionKey: 'orders.cancel',
      effect: 'deny',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
    });
    assert(setScopedDenyRes.success === true, '5.2 Set scoped DENY override succeeds');

    // 5.3 Verify legacy unscoped override insertion & preservation
    const { error: legacyInsertErr } = await admin
      .from('member_permission_overrides')
      .upsert(
        {
          business_membership_id: membershipId,
          permission_key: 'menu.items.create',
          effect: 'allow',
          scope_type: null,
          branch_id: null,
          created_by: testUserId,
        },
        { onConflict: 'business_membership_id,permission_key' }
      );
    assert(!legacyInsertErr, '5.3 Legacy unscoped override row exists with scope_type = NULL');

    // 5.4 Explicit legacy conversion to V2 scoped override
    const convertRes = await PermissionService.convertLegacyOverride(ownerContext, {
      membershipId,
      permissionKey: 'menu.items.create',
      scopeType: 'PROPERTY',
      branchId: branchA!.id,
    });
    assert(convertRes.success === true, '5.4 Explicit conversion of legacy override to V2 scoped override succeeds');

    // 5.5 Remove member override
    const removeOvRes = await PermissionService.removeMemberOverride(
      ownerContext,
      membershipId,
      'menu.items.create'
    );
    assert(removeOvRes.success === true, '5.5 Remove member override succeeds');

    // ========================================================================
    // SECTION 6: Role Scope Preset Management
    // ========================================================================
    console.log('\n--- SECTION 6: Role Scope Preset Management ---');

    const presets = await ScopeGrantService.listRoleScopePresets(businessId);
    assert(presets.length >= 5, '6.1 listRoleScopePresets returns built-in role presets');

    const ownerPreset = presets.find((p: RoleScopePresetDetail) => p.roleKey === 'business_owner');
    assert(
      ownerPreset?.maxScope === 'ORGANIZATION' && ownerPreset?.isSystemProtected === true,
      '6.2 Business owner preset is protected with maxScope = ORGANIZATION'
    );

    // Update custom role preset
    const updateCustomPresetRes = await ScopeGrantService.updateRoleScopePreset(ownerContext, {
      customRoleId: customRole!.id,
      defaultScope: 'PROPERTY',
      maxScope: 'PROPERTY',
    });
    assert(updateCustomPresetRes.success && Boolean(updateCustomPresetRes.preset), '6.3 Update custom role scope preset succeeds');

    // ========================================================================
    // SECTION 7: Effective Access Preview
    // ========================================================================
    console.log('\n--- SECTION 7: Effective Access Preview ---');

    const preview = await ScopeGrantService.previewMemberEffectiveAccess(businessId, membershipId);
    assert(
      preview !== null &&
      preview.membershipId === membershipId &&
      preview.scopedOverrides.length >= 1 &&
      preview.effectiveSummary.length >= 1,
      '7.1 previewMemberEffectiveAccess aggregates role permissions, scope grants, and scoped overrides'
    );

    // ========================================================================
    // SECTION 8: Audit Trail Verification
    // ========================================================================
    console.log('\n--- SECTION 8: Audit Trail Verification ---');

    const { data: auditEntries } = await admin
      .from('audit_logs')
      .select('action, target_type')
      .eq('business_id', businessId);

    const actions = (auditEntries || []).map((a) => a.action);
    assert(actions.includes('scope_grant.created'), '8.1 Audit log recorded scope_grant.created');
    assert(actions.includes('scope_grant.updated'), '8.2 Audit log recorded scope_grant.updated');
    assert(actions.includes('scope_grant.revoked'), '8.3 Audit log recorded scope_grant.revoked');
    assert(actions.includes('member_override.updated'), '8.4 Audit log recorded member_override.updated');
    assert(actions.includes('legacy_override.converted'), '8.5 Audit log recorded legacy_override.converted');
    assert(actions.includes('role_scope_preset.updated'), '8.6 Audit log recorded role_scope_preset.updated');
  } finally {
    // Teardown live test fixtures
    console.log('\n--- Cleaning up temporary test fixtures ---');
    await admin.from('businesses').delete().eq('id', businessId);
    if (testUserId) {
      await admin.auth.admin.deleteUser(testUserId);
    }
    console.log('✅ Temporary test fixtures cleaned up.');
  }

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log('\n================================================================');
  console.log(`  Scope Management Verification Complete: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runManagementVerification().catch((err) => {
  console.error('Fatal error during management verification:', err);
  process.exit(1);
});
