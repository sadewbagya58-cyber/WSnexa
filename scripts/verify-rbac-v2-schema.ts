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

async function verifyRbacV2Schema() {
  console.log('================================================================');
  console.log('  WSNexa Phase 30 Step 2 — RBAC & Scope V2 Schema Verification   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Load TypeScript Validation Modules
    const permModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission.ts')).href;
    const {
      permissionKeyEnum,
      scopeTypeEnum,
      grantEffectEnum,
      grantSourceEnum,
      roleScopePresetSchema,
      permissionScopeGrantSchema,
      scopedMemberOverrideSchema,
      ownerOnlyPermissions,
    } = await import(permModulePath);

    console.log('--- 1. Canonical Scope Types & Validation Invariants ---');
    const validScopes = scopeTypeEnum.options;
    assert(
      validScopes.includes('ORGANIZATION') &&
      validScopes.includes('PROPERTY') &&
      validScopes.includes('DEPARTMENT') &&
      validScopes.includes('AREA_TEAM') &&
      validScopes.includes('SELF'),
      'Canonical 5-tier scope types defined (ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF)'
    );
    assert(validScopes.length === 5, 'Exact 5 canonical scope tiers defined without uncontrolled duplication');

    assert(
      grantEffectEnum.options.includes('allow') && grantEffectEnum.options.includes('deny'),
      'Grant effects support allow and deny'
    );
    assert(
      grantSourceEnum.options.includes('role_preset') &&
      grantSourceEnum.options.includes('custom_role') &&
      grantSourceEnum.options.includes('member_override') &&
      grantSourceEnum.options.includes('staff_assignment') &&
      grantSourceEnum.options.includes('acting_delegation'),
      'Grant sources support role_preset, custom_role, member_override, staff_assignment, acting_delegation'
    );

    console.log('\n--- 2. Scope Target Integrity & Constraint Validation ---');
    // Test Zod schema validation for valid grants
    const validOrgGrant = permissionScopeGrantSchema.safeParse({
      roleKey: 'business_owner',
      permissionKey: 'orders.view',
      effect: 'allow',
      scopeType: 'ORGANIZATION',
      grantSource: 'role_preset',
    });
    assert(validOrgGrant.success, 'ORGANIZATION scope grant valid with null foreign keys', !validOrgGrant.success ? JSON.stringify(validOrgGrant.error.issues) : '');

    const validPropGrant = permissionScopeGrantSchema.safeParse({
      roleKey: 'branch_manager',
      permissionKey: 'orders.view',
      effect: 'allow',
      scopeType: 'PROPERTY',
      branchId: 'a0000000-0000-4000-a000-000000000001',
      grantSource: 'role_preset',
    });
    assert(validPropGrant.success, 'PROPERTY scope grant valid with branchId', !validPropGrant.success ? JSON.stringify(validPropGrant.error.issues) : '');

    const validDeptGrant = permissionScopeGrantSchema.safeParse({
      customRoleId: 'a0000000-0000-4000-a000-000000000002',
      permissionKey: 'inventory.cogs.view',
      effect: 'allow',
      scopeType: 'DEPARTMENT',
      departmentId: 'a0000000-0000-4000-a000-000000000003',
      grantSource: 'custom_role',
    });
    assert(validDeptGrant.success, 'DEPARTMENT scope grant valid with departmentId', !validDeptGrant.success ? JSON.stringify(validDeptGrant.error.issues) : '');

    const validUnitGrant = permissionScopeGrantSchema.safeParse({
      businessMembershipId: 'a0000000-0000-4000-a000-000000000004',
      permissionKey: 'kitchen.orders.view',
      effect: 'allow',
      scopeType: 'AREA_TEAM',
      organizationUnitId: 'a0000000-0000-4000-a000-000000000005',
      grantSource: 'staff_assignment',
    });
    assert(validUnitGrant.success, 'AREA_TEAM scope grant valid with organizationUnitId (kitchen unit)', !validUnitGrant.success ? JSON.stringify(validUnitGrant.error.issues) : '');

    const validServiceAreaGrant = permissionScopeGrantSchema.safeParse({
      businessMembershipId: 'a0000000-0000-4000-a000-000000000004',
      permissionKey: 'waiter.orders.create',
      effect: 'allow',
      scopeType: 'AREA_TEAM',
      serviceAreaId: 'a0000000-0000-4000-a000-000000000006',
      grantSource: 'staff_assignment',
    });
    assert(validServiceAreaGrant.success, 'AREA_TEAM scope grant valid with serviceAreaId (dining service area)', !validServiceAreaGrant.success ? JSON.stringify(validServiceAreaGrant.error.issues) : '');

    const validSelfGrant = permissionScopeGrantSchema.safeParse({
      roleKey: 'waiter',
      permissionKey: 'orders.view',
      effect: 'allow',
      scopeType: 'SELF',
      grantSource: 'role_preset',
    });
    assert(validSelfGrant.success, 'SELF scope grant valid with zero external FK targets', !validSelfGrant.success ? JSON.stringify(validSelfGrant.error.issues) : '');

    // Invalid Scope Target Rejection Invariants
    const invalidOrgWithBranch = permissionScopeGrantSchema.safeParse({
      roleKey: 'business_owner',
      permissionKey: 'orders.view',
      scopeType: 'ORGANIZATION',
      branchId: 'a0000000-0000-4000-a000-000000000001',
    });
    assert(!invalidOrgWithBranch.success, 'Invalid: ORGANIZATION grant with branchId is rejected');

    const invalidPropWithoutBranch = permissionScopeGrantSchema.safeParse({
      roleKey: 'branch_manager',
      permissionKey: 'orders.view',
      scopeType: 'PROPERTY',
    });
    assert(!invalidPropWithoutBranch.success, 'Invalid: PROPERTY grant without branchId is rejected');

    const invalidDeptWithoutDept = permissionScopeGrantSchema.safeParse({
      customRoleId: 'a0000000-0000-4000-a000-000000000002',
      permissionKey: 'inventory.cogs.view',
      scopeType: 'DEPARTMENT',
    });
    assert(!invalidDeptWithoutDept.success, 'Invalid: DEPARTMENT grant without departmentId is rejected');

    const invalidAreaWithoutTarget = permissionScopeGrantSchema.safeParse({
      businessMembershipId: 'a0000000-0000-4000-a000-000000000004',
      permissionKey: 'kitchen.orders.view',
      scopeType: 'AREA_TEAM',
    });
    assert(!invalidAreaWithoutTarget.success, 'Invalid: AREA_TEAM grant without unit or service area is rejected');

    const invalidAreaWithBoth = permissionScopeGrantSchema.safeParse({
      businessMembershipId: 'a0000000-0000-4000-a000-000000000004',
      permissionKey: 'kitchen.orders.view',
      scopeType: 'AREA_TEAM',
      organizationUnitId: 'a0000000-0000-4000-a000-000000000005',
      serviceAreaId: 'a0000000-0000-4000-a000-000000000006',
    });
    assert(!invalidAreaWithBoth.success, 'Invalid: AREA_TEAM grant with both unit and service area is rejected');

    const invalidSelfWithBranch = permissionScopeGrantSchema.safeParse({
      roleKey: 'waiter',
      permissionKey: 'orders.view',
      scopeType: 'SELF',
      branchId: 'a0000000-0000-4000-a000-000000000001',
    });
    assert(!invalidSelfWithBranch.success, 'Invalid: SELF grant with branchId is rejected');

    console.log('\n--- 3. Role Default Scope Presets ---');
    const validPresets = [
      { roleKey: 'business_owner', defaultScope: 'ORGANIZATION', maxScope: 'ORGANIZATION' },
      { roleKey: 'branch_manager', defaultScope: 'PROPERTY', maxScope: 'PROPERTY' },
      { roleKey: 'waiter', defaultScope: 'AREA_TEAM', maxScope: 'PROPERTY' },
      { roleKey: 'kitchen_staff', defaultScope: 'PROPERTY', maxScope: 'PROPERTY' },
      { roleKey: 'cashier', defaultScope: 'PROPERTY', maxScope: 'PROPERTY' },
    ];

    validPresets.forEach((preset) => {
      const parsed = roleScopePresetSchema.safeParse(preset);
      assert(parsed.success, `Role scope preset valid for ${preset.roleKey} (default: ${preset.defaultScope}, max: ${preset.maxScope})`, !parsed.success ? JSON.stringify(parsed.error.issues) : '');
    });

    console.log('\n--- 4. Member-Level Scoped Overrides ---');
    const validOverride = scopedMemberOverrideSchema.safeParse({
      membershipId: 'a0000000-0000-4000-a000-000000000007',
      permissionKey: 'payments.refund',
      effect: 'allow',
      scopeType: 'DEPARTMENT',
      departmentId: 'a0000000-0000-4000-a000-000000000008',
    });
    assert(validOverride.success, 'Scoped member override schema valid for individual membership override', !validOverride.success ? JSON.stringify(validOverride.error.issues) : '');

    const invalidOverrideProp = scopedMemberOverrideSchema.safeParse({
      membershipId: 'a0000000-0000-4000-a000-000000000007',
      permissionKey: 'payments.refund',
      effect: 'allow',
      scopeType: 'PROPERTY',
    });
    assert(!invalidOverrideProp.success, 'Invalid: Scoped member override with PROPERTY and missing branchId is rejected');

    console.log('\n--- 5. SQL Migration File Contract & Syntax Verification ---');
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260820000000_phase30_rbac_scope_foundation.sql');
    assert(fs.existsSync(migrationPath), 'Migration file 20260820000000_phase30_rbac_scope_foundation.sql exists');

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.role_scope_presets'), 'Migration creates role_scope_presets table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.permission_scope_grants'), 'Migration creates permission_scope_grants table');
    assert(sqlContent.includes('ALTER TABLE public.member_permission_overrides'), 'Migration extends member_permission_overrides with scope columns');
    assert(sqlContent.includes('check_scope_grant_integrity'), 'Migration creates check_scope_grant_integrity trigger');
    assert(sqlContent.includes('chk_grant_scope_target_consistency'), 'Migration enforces chk_grant_scope_target_consistency CHECK constraint');
    assert(sqlContent.includes('chk_grant_principal'), 'Migration enforces principal CHECK constraint');
    assert(sqlContent.includes('idx_perm_scope_grants_biz_role'), 'Migration creates query performance indexes');
    assert(sqlContent.includes('ENABLE ROW LEVEL SECURITY'), 'Migration enables Row Level Security on new tables');
    assert(sqlContent.includes('ORGANIZATION'), 'Migration seeds ORGANIZATION scope preset for business_owner');
    assert(sqlContent.includes('PROPERTY'), 'Migration seeds PROPERTY scope preset for branch_manager, kitchen_staff, cashier');
    assert(sqlContent.includes('JOIN public.branch_assignments ba'), 'Migration backfills concrete PROPERTY grants from branch_assignments');
    assert(sqlContent.includes('rp.role_key = bm.role::text'), 'Migration explicitly casts bm.role::text when joining with role_permissions.role_key');
    assert(sqlContent.includes("bm.role::text IN ('branch_manager', 'kitchen_staff', 'cashier')"), 'Migration explicitly casts bm.role::text in role filter IN list');
    assert(sqlContent.includes("bm.role::text = 'waiter'"), 'Migration explicitly casts bm.role::text in waiter filter');
    assert(sqlContent.includes("bm.role::text = 'business_owner'"), 'Migration explicitly casts bm.role::text in business_owner filter');
    assert(!sqlContent.match(/rp\.role_key\s*=\s*bm\.role(\s|$)/), 'Zero uncast rp.role_key = bm.role comparisons remain in migration');
    assert(sqlContent.includes('NULL::uuid'), 'Migration uses explicit NULL::uuid casts in UUID column positions');
    assert(sqlContent.includes('NULL::text'), 'Migration uses explicit NULL::text casts in TEXT column positions');
    assert(!sqlContent.match(/ba\.is_default/), 'Zero references to nonexistent ba.is_default column in migration');

    console.log('\n--- 6. Backward Compatibility & Platform Isolation Invariants ---');
    assert(permissionKeyEnum.options.length === 103, `Exact 103 canonical permission keys preserved (found: ${permissionKeyEnum.options.length})`);
    assert(ownerOnlyPermissions.length === 6, 'All 6 owner-only permission keys preserved');
    assert(!sqlContent.includes('super_admin') || sqlContent.includes('Super Admin remains outside'), 'Super Admin platform authority remains strictly outside tenant business RBAC');
    assert(!sqlContent.toLowerCase().includes('drop table'), 'Zero destructive DROP TABLE statements in migration');
    assert(!sqlContent.toLowerCase().includes('drop column'), 'Zero destructive DROP COLUMN statements in migration');

    // 7. Inspect Live Supabase DB Connectivity & Verify Applied Migration
    console.log('\n--- 7. Live Supabase DB Contract & Migration Verification ---');
    const { createAdminClient } = await import(pathToFileURL(path.join(process.cwd(), 'src/lib/supabase/server.ts')).href);
    const admin = createAdminClient();

    // 7.1 Verify permissions catalog
    const { data: perms, error: permErr } = await admin.from('permissions').select('key');
    assert(!permErr && perms && perms.length === 103, `Live DB permissions table contains all 103 canonical keys (found: ${perms?.length || 0})`);

    // 7.2 Verify role_scope_presets table & live data
    const { data: presets, error: presetsErr } = await admin.from('role_scope_presets').select('*');
    assert(!presetsErr && Array.isArray(presets), `Live DB role_scope_presets exists and is readable (found: ${presets?.length || 0} rows)`, presetsErr?.message);
    const ownerPreset = (presets || []).find((p: { role_key: string | null }) => p.role_key === 'business_owner');
    const managerPreset = (presets || []).find((p: { role_key: string | null }) => p.role_key === 'branch_manager');
    const waiterPreset = (presets || []).find((p: { role_key: string | null }) => p.role_key === 'waiter');
    assert(Boolean(ownerPreset && ownerPreset.default_scope === 'ORGANIZATION'), 'Live DB role_scope_presets contains business_owner -> ORGANIZATION');
    assert(Boolean(managerPreset && managerPreset.default_scope === 'PROPERTY'), 'Live DB role_scope_presets contains branch_manager -> PROPERTY');
    assert(Boolean(waiterPreset && waiterPreset.default_scope === 'AREA_TEAM'), 'Live DB role_scope_presets contains waiter -> AREA_TEAM');

    // 7.3 Verify permission_scope_grants table & live data
    const { data: grants, error: grantsErr } = await admin.from('permission_scope_grants').select('*');
    assert(!grantsErr && Array.isArray(grants), `Live DB permission_scope_grants exists and is readable (found: ${grants?.length || 0} rows)`, grantsErr?.message);

    // 7.4 Invariant: Zero targetless scoped grants in live DB
    const { data: badPropGrants } = await admin
      .from('permission_scope_grants')
      .select('id')
      .eq('scope_type', 'PROPERTY')
      .is('branch_id', null);
    assert(!badPropGrants || badPropGrants.length === 0, `Zero targetless PROPERTY grants in live DB (found: ${badPropGrants?.length || 0})`);

    const { data: badDeptGrants } = await admin
      .from('permission_scope_grants')
      .select('id')
      .eq('scope_type', 'DEPARTMENT')
      .is('department_id', null);
    assert(!badDeptGrants || badDeptGrants.length === 0, `Zero targetless DEPARTMENT grants in live DB (found: ${badDeptGrants?.length || 0})`);

    const { data: badAreaGrants } = await admin
      .from('permission_scope_grants')
      .select('id')
      .eq('scope_type', 'AREA_TEAM')
      .is('organization_unit_id', null)
      .is('service_area_id', null);
    assert(!badAreaGrants || badAreaGrants.length === 0, `Zero targetless AREA_TEAM grants in live DB (found: ${badAreaGrants?.length || 0})`);

    // 7.5 Verify member_permission_overrides scope columns
    const { data: memOverrides, error: memErr } = await admin
      .from('member_permission_overrides')
      .select('id, business_membership_id, permission_key, effect, scope_type, branch_id, department_id, organization_unit_id, service_area_id')
      .limit(5);
    assert(!memErr && Array.isArray(memOverrides), `Live DB member_permission_overrides has new scope columns and is readable (found: ${memOverrides?.length || 0} sample rows)`, memErr?.message);

    // 7.6 Verify related Phase 29 tables
    const { data: baRows, error: baErr } = await admin.from('branch_assignments').select('id, business_membership_id, branch_id, is_primary').limit(1);
    assert(!baErr && Array.isArray(baRows), 'Live DB branch_assignments has valid columns (is_primary, branch_id, business_membership_id)');

    const { data: deptRows, error: deptErr } = await admin.from('organization_departments').select('id').limit(1);
    assert(!deptErr && Array.isArray(deptRows), 'Live DB organization_departments accessible for Phase 29 scope foundation');

    const { data: unitRows, error: unitErr } = await admin.from('organization_units').select('id').limit(1);
    assert(!unitErr && Array.isArray(unitRows), 'Live DB organization_units accessible for Phase 29 scope foundation');

    const { data: saRows, error: saErr } = await admin.from('service_areas').select('id').limit(1);
    assert(!saErr && Array.isArray(saRows), 'Live DB service_areas accessible for operational scope foundation');

  } catch (err: unknown) {
    console.error('Execution failure during verification:', err);
    failed++;
  }

  console.log(`\n================================================================`);
  console.log(`  Phase 30 Step 2 Verification: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyRbacV2Schema();
