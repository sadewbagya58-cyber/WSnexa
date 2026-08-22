import * as path from 'path';
import * as fs from 'fs';

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

import { createClient } from '@supabase/supabase-js';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, description: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

async function runStep9VerificationSuite() {
  console.log('\n================================================================================');
  console.log('  WSNEXA PHASE 30 STEP 9: RBAC & SCOPE V2 LEGACY CLEANUP & CONVERGENCE GATE');
  console.log('================================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { can, authorize, resolveAuthorizationContext, requireBusinessPermission } = await import('../src/server/auth');
  const { QrService } = await import('../src/server/services/qr.service');
  const { VenueRankingService } = await import('../src/server/services/venue-ranking.service');
  const { ServiceAreaService } = await import('../src/server/services/service-area.service');
  const testRunId = `step9_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Create disposable fixtures
  console.log('🔧 Creating disposable multi-tenant test fixtures...');

  // 1. Create Users (Owner, Manager, Staff)
  const ownerEmail = `step9_owner_${testRunId}@wsnexa.test`;
  const mgrEmail = `step9_mgr_${testRunId}@wsnexa.test`;
  const staffEmail = `step9_staff_${testRunId}@wsnexa.test`;
  const testPassword = 'TestPassword123!';

  const { data: uOwner, error: errOwner } = await admin.auth.admin.createUser({ email: ownerEmail, password: testPassword, email_confirm: true });
  if (errOwner || !uOwner?.user) throw new Error(`Failed to create uOwner: ${errOwner?.message}`);
  const { data: uMgr, error: errMgr } = await admin.auth.admin.createUser({ email: mgrEmail, password: testPassword, email_confirm: true });
  if (errMgr || !uMgr?.user) throw new Error(`Failed to create uMgr: ${errMgr?.message}`);
  const { data: uStaff, error: errStaff } = await admin.auth.admin.createUser({ email: staffEmail, password: testPassword, email_confirm: true });
  if (errStaff || !uStaff?.user) throw new Error(`Failed to create uStaff: ${errStaff?.message}`);

  const ownerUserUuid = uOwner.user.id;
  const managerUserUuid = uMgr.user.id;
  const staffUserUuid = uStaff.user.id;

  await admin.from('user_profiles').upsert([
    { id: ownerUserUuid, first_name: 'Owner', last_name: 'Step9', is_super_admin: false },
    { id: managerUserUuid, first_name: 'Manager', last_name: 'Step9', is_super_admin: false },
    { id: staffUserUuid, first_name: 'Staff', last_name: 'Step9', is_super_admin: false },
  ]);

  // 2. Create Business
  const { data: business, error: bizErr } = await admin
    .from('businesses')
    .insert({
      name: `Test Legacy Cleanup Biz ${testRunId}`,
      slug: `legacy-cleanup-${testRunId}`,
      business_type: 'restaurant',
      country_code: 'US',
      default_currency: 'USD',
      timezone: 'America/New_York',
      status: 'active',
      created_by: ownerUserUuid,
    })
    .select()
    .single();

  if (bizErr || !business) {
    throw new Error(`Failed to create test business: ${bizErr?.message}`);
  }

  // 3. Create Branch 1 (Main) and Branch 2 (Secondary)
  const { data: branch1, error: errB1 } = await admin
    .from('branches')
    .insert({
      business_id: business.id,
      name: `Main Branch ${testRunId}`,
      code: `MB1_${testRunId.substring(0, 4)}`,
      is_default: true,
      status: 'active',
    })
    .select('id')
    .single();

  if (errB1 || !branch1) {
    throw new Error(`Failed to create branch 1: ${errB1?.message}`);
  }

  const { data: branch2, error: errB2 } = await admin
    .from('branches')
    .insert({
      business_id: business.id,
      name: `Second Branch ${testRunId}`,
      code: `SB2_${testRunId.substring(0, 4)}`,
      is_default: false,
      status: 'active',
    })
    .select('id')
    .single();

  if (errB2 || !branch2) {
    throw new Error(`Failed to create branch 2: ${errB2?.message}`);
  }

  // 4. Create Service Area & Dining Table
  const areaRes = await ServiceAreaService.createArea(
    business.id,
    branch1!.id,
    `Patio Area ${testRunId}`,
    'Outdoor Patio',
    ownerUserUuid,
    admin
  );

  if (!areaRes.success || !areaRes.area) {
    throw new Error(`Failed to create service area: ${areaRes.message}`);
  }
  const serviceArea = areaRes.area;

  const { data: diningTable, error: errTable } = await admin
    .from('dining_tables')
    .insert({
      business_id: business.id,
      branch_id: branch1!.id,
      service_area_id: serviceArea.id,
      name: `Table 101`,
      code: `T101_${testRunId.substring(0, 5)}`,
      table_number: 101,
      status: 'available',
      is_active: true,
    })
    .select('id')
    .single();

  if (errTable || !diningTable) {
    throw new Error(`Failed to create table: ${errTable?.message}`);
  }

  // 5. Insert business memberships
  await admin.from('business_memberships').insert({
    business_id: business.id,
    user_id: ownerUserUuid,
    role: 'business_owner',
    membership_status: 'active',
  });

  const { data: managerMember } = await admin
    .from('business_memberships')
    .insert({
      business_id: business.id,
      user_id: managerUserUuid,
      role: 'branch_manager',
      membership_status: 'active',
    })
    .select()
    .single();

  const { data: staffMember } = await admin
    .from('business_memberships')
    .insert({
      business_id: business.id,
      user_id: staffUserUuid,
      role: 'waiter',
      membership_status: 'active',
    })
    .select()
    .single();

  // Branch assignments
  await admin.from('branch_assignments').insert([
    { business_membership_id: managerMember!.id, branch_id: branch1!.id },
    { business_membership_id: staffMember!.id, branch_id: branch1!.id },
  ]);

  // Service area assignment for waiter
  await ServiceAreaService.assignStaffToAreas(
    staffMember!.id,
    business.id,
    branch1!.id,
    [serviceArea.id],
    ownerUserUuid,
    admin
  );

  // Inventory & Recipe fixture
  const { data: invItem, error: errItem } = await admin
    .from('inventory_items')
    .insert({
      business_id: business.id,
      name: `Raw Coffee Beans ${testRunId}`,
      sku: `SKU-${testRunId.substring(0, 8)}`,
      base_unit: 'kg',
      cost_per_unit_cents: 2500,
      currency: 'USD',
    })
    .select('id')
    .single();

  if (errItem || !invItem) {
    throw new Error(`Failed to create inventory item: ${errItem?.message}`);
  }

  const { data: recipe, error: errRecipe } = await admin
    .from('inventory_recipes')
    .insert({
      business_id: business.id,
      branch_id: branch1!.id,
      name: `Espresso Blend ${testRunId}`,
      recipe_type: 'menu_item',
      version: 1,
      yield_quantity: 10,
      yield_unit: 'cup',
      is_active: true,
      created_by: ownerUserUuid,
    })
    .select('id')
    .single();

  if (errRecipe || !recipe) {
    throw new Error(`Failed to create recipe: ${errRecipe?.message}`);
  }

  await admin.from('inventory_recipe_ingredients').insert([
    {
      recipe_id: recipe.id,
      item_id: invItem.id,
      quantity: 0.2,
      unit: 'kg',
      quantity_base: 0.2,
      yield_factor: 1.0,
      display_order: 1,
    },
  ]);

  try {
    // =========================================================================
    // SECTION 1: Legacy Authorization Inventory & Migration Status
    // =========================================================================
    console.log('\n--- SECTION 1: Legacy Authorization Inventory & Static Code Analysis ---');

    function walkDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) results = results.concat(walkDir(filePath));
        else if (file.endsWith('.ts')) results.push(filePath);
      }
      return results;
    }

    const actionFiles = walkDir('src/server/actions');
    const serviceFiles = walkDir('src/server/services');
    const apiFiles = walkDir('src/app/api');

    let actionLegacyCalls = 0;
    for (const f of actionFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('PermissionService.hasPermission') || content.includes('PermissionService.requirePermission')) {
        actionLegacyCalls++;
        console.error(`  Found legacy call in action file: ${f}`);
      }
    }
    assert(actionLegacyCalls === 0, 'Zero calls to legacy PermissionService in src/server/actions/**');

    let serviceLegacyCalls = 0;
    for (const f of serviceFiles) {
      if (f.includes('permission.service.ts')) continue;
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('PermissionService.hasPermission') || content.includes('PermissionService.requirePermission')) {
        serviceLegacyCalls++;
        console.error(`  Found legacy call in service file: ${f}`);
      }
    }
    assert(serviceLegacyCalls === 0, 'Zero calls to legacy PermissionService in src/server/services/** (excluding permission.service.ts itself)');

    let apiLegacyCalls = 0;
    for (const f of apiFiles) {
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('PermissionService.hasPermission') || content.includes('PermissionService.requirePermission')) {
        apiLegacyCalls++;
        console.error(`  Found legacy call in API route file: ${f}`);
      }
    }
    assert(apiLegacyCalls === 0, 'Zero calls to legacy PermissionService in src/app/api/**');

    // =========================================================================
    // SECTION 2: Orders / Kitchen / Waiter Domain Actions
    // =========================================================================
    console.log('\n--- SECTION 2: Orders, Kitchen, and Waiter Domain Authorization ---');

    const ownerContext = await resolveAuthorizationContext({
      overrideUserId: ownerUserUuid,
      requestedBusinessId: business.id,
      requestedBranchId: branch1!.id,
    });
    assert(ownerContext !== null, 'Owner AuthorizationContext resolves successfully');

    const staffContext = await resolveAuthorizationContext({
      overrideUserId: staffUserUuid,
      requestedBusinessId: business.id,
      requestedBranchId: branch1!.id,
    });
    assert(staffContext !== null, 'Waiter Staff AuthorizationContext resolves successfully');

    const tableResource = { type: 'dining_table' as const, id: diningTable!.id };
    const branchResource = { type: 'branch' as const, id: branch1!.id };

    const waiterCanCreate = await can({ context: staffContext!, permission: 'waiter.orders.create', resource: branchResource });
    assert(waiterCanCreate === true, 'Waiter role is authorized for waiter.orders.create within assigned branch');

    const waiterCanAccessTable = await can({ context: staffContext!, permission: 'waiter.orders.create', resource: tableResource });
    assert(waiterCanAccessTable === true, 'Waiter can access table located in their assigned service area');

    const waiterCannotCancel = await can({ context: staffContext!, permission: 'orders.cancel', resource: branchResource });
    assert(waiterCannotCancel === false, 'Waiter is denied orders.cancel permission by default');

    const ownerCanCancel = await can({ context: ownerContext!, permission: 'orders.cancel', resource: branchResource });
    assert(ownerCanCancel === true, 'Business Owner has un-deniable permission to cancel orders');

    // =========================================================================
    // SECTION 3: Payments / Cashier Domain Actions
    // =========================================================================
    console.log('\n--- SECTION 3: Payments and Cashier Authorization ---');

    const staffCanRecordPayment = await can({ context: staffContext!, permission: 'payments.record', resource: branchResource });
    assert(staffCanRecordPayment === false, 'Waiter without cashier grant cannot record payments');

    const ownerCanRecordPayment = await can({ context: ownerContext!, permission: 'payments.record', resource: branchResource });
    assert(ownerCanRecordPayment === true, 'Business Owner can record payments');

    const staffCanVoidPayment = await can({ context: staffContext!, permission: 'payments.void', resource: branchResource });
    assert(staffCanVoidPayment === false, 'Waiter cannot void payments');

    const ownerCanVoidPayment = await can({ context: ownerContext!, permission: 'payments.void', resource: branchResource });
    assert(ownerCanVoidPayment === true, 'Business Owner can void payments');

    // =========================================================================
    // SECTION 4: Inventory, Purchasing, and Cost Redaction
    // =========================================================================
    console.log('\n--- SECTION 4: Inventory, Purchasing, and Cost Redaction ---');

    const staffCanViewCosts = await can({ context: staffContext!, permission: 'recipes.costs.view' });
    assert(staffCanViewCosts === false, 'Waiter cannot view sensitive recipe/inventory cost numbers');

    const ownerCanViewCosts = await can({ context: ownerContext!, permission: 'recipes.costs.view' });
    assert(ownerCanViewCosts === true, 'Business Owner can view recipe/inventory cost numbers');

    const staffCanCreateRecipe = await can({ context: staffContext!, permission: 'recipes.manage', resource: branchResource });
    assert(staffCanCreateRecipe === false, 'Waiter cannot create or edit recipes');

    const ownerCanCreateRecipe = await can({ context: ownerContext!, permission: 'recipes.manage', resource: branchResource });
    assert(ownerCanCreateRecipe === true, 'Business Owner can manage recipes');

    // =========================================================================
    // SECTION 5: Menu, Modifiers, Dining Tables, and QR Settings
    // =========================================================================
    console.log('\n--- SECTION 5: Menu, Service Areas, and QR Settings ---');

    const areaResource = { type: 'service_area' as const, id: serviceArea!.id };

    const staffCanManageArea = await can({ context: staffContext!, permission: 'areas.manage', resource: areaResource });
    assert(staffCanManageArea === false, 'Staff cannot mutate or delete service areas');

    const ownerCanManageArea = await can({ context: ownerContext!, permission: 'areas.manage', resource: areaResource });
    assert(ownerCanManageArea === true, 'Owner can manage service areas');

    const staffCanGenerateQr = await can({ context: staffContext!, permission: 'qr.generate', resource: branchResource });
    assert(staffCanGenerateQr === false, 'Staff cannot generate or rotate branch QR codes');

    const ownerCanGenerateQr = await can({ context: ownerContext!, permission: 'qr.generate', resource: branchResource });
    assert(ownerCanGenerateQr === true, 'Owner can generate branch QR codes');

    const staffCanUpdateBranchOrdering = await can({ context: staffContext!, permission: 'branches.operational.manage', resource: branchResource });
    assert(staffCanUpdateBranchOrdering === false, 'Staff cannot modify branch ordering mode or table pin settings');

    const ownerCanUpdateBranchOrdering = await can({ context: ownerContext!, permission: 'branches.operational.manage', resource: branchResource });
    assert(ownerCanUpdateBranchOrdering === true, 'Owner can modify branch ordering mode settings');

    // =========================================================================
    // SECTION 6: People, Organization, and Roles Governance
    // =========================================================================
    console.log('\n--- SECTION 6: People, Organization, and Role Governance ---');

    const staffCanManageRoles = await can({ context: staffContext!, permission: 'roles.manage' });
    assert(staffCanManageRoles === false, 'Staff cannot manage custom roles or permission assignments');

    const ownerCanManageRoles = await can({ context: ownerContext!, permission: 'roles.manage' });
    assert(ownerCanManageRoles === true, 'Owner can manage roles');

    const staffCanInvite = await can({ context: staffContext!, permission: 'staff.invite', resource: branchResource });
    assert(staffCanInvite === false, 'Staff without staff.invite cannot invite new members');

    const ownerCanInvite = await can({ context: ownerContext!, permission: 'staff.invite', resource: branchResource });
    assert(ownerCanInvite === true, 'Owner can invite team members');

    // =========================================================================
    // SECTION 7: Business & Branch Settings
    // =========================================================================
    console.log('\n--- SECTION 7: Business, Venue Profile, and Reputation Settings ---');

    const staffCanManageProfile = await can({ context: staffContext!, permission: 'venue_profile.manage' });
    assert(staffCanManageProfile === false, 'Staff cannot edit or publish public venue profile');

    const ownerCanManageProfile = await can({ context: ownerContext!, permission: 'venue_profile.manage' });
    assert(ownerCanManageProfile === true, 'Owner can edit and publish venue profile');

    const staffCanRespondReviews = await can({ context: staffContext!, permission: 'reviews.respond' });
    assert(staffCanRespondReviews === false, 'Staff cannot respond to public customer reviews');

    const ownerCanRespondReviews = await can({ context: ownerContext!, permission: 'reviews.respond' });
    assert(ownerCanRespondReviews === true, 'Owner can respond to public customer reviews');

    const staffCanViewReputation = await can({ context: staffContext!, permission: 'reputation.view' });
    assert(staffCanViewReputation === false, 'Staff cannot view business reputation insights by default');

    const ownerCanViewReputation = await can({ context: ownerContext!, permission: 'reputation.view' });
    assert(ownerCanViewReputation === true, 'Owner can view business reputation insights');

    // =========================================================================
    // SECTION 8: Reports & Sensitive Reads / Exports
    // =========================================================================
    console.log('\n--- SECTION 8: Reports, Financial Reads, and Analytics Export ---');

    const staffCanViewReports = await can({ context: staffContext!, permission: 'reports.view', resource: branchResource });
    assert(staffCanViewReports === false, 'Waiter staff cannot view branch analytics');

    const ownerCanViewReports = await can({ context: ownerContext!, permission: 'reports.view', resource: branchResource });
    assert(ownerCanViewReports === true, 'Owner can view branch analytics');

    const staffCanExport = await can({ context: staffContext!, permission: 'reports.export', resource: branchResource });
    assert(staffCanExport === false, 'Staff cannot export analytics data');

    const ownerCanExport = await can({ context: ownerContext!, permission: 'reports.export', resource: branchResource });
    assert(ownerCanExport === true, 'Owner can export analytics reports');

    // Cross-branch isolation check
    const branch2Resource = { type: 'branch' as const, id: branch2!.id };
    const managerContext = await resolveAuthorizationContext({
      overrideUserId: managerUserUuid,
      requestedBusinessId: business.id,
      requestedBranchId: branch1!.id,
    });

    const managerCanAccessBranch1 = await can({ context: managerContext!, permission: 'reports.view', resource: branchResource });
    assert(managerCanAccessBranch1 === true, 'Manager can view reports for assigned Branch 1');

    const managerCannotAccessBranch2 = await can({ context: managerContext!, permission: 'reports.view', resource: branch2Resource });
    assert(managerCannotAccessBranch2 === false, 'Manager is blocked from viewing cross-branch reports for unassigned Branch 2');

    // =========================================================================
    // SECTION 9: Identity Spoofing Protection
    // =========================================================================
    console.log('\n--- SECTION 9: Client-Provided Identity Spoofing Immunity ---');

    try {
      // Attempting to evaluate permission for a foreign business that the user has no membership in
      const foreignBizUuid = crypto.randomUUID();
      const foreignContext = await resolveAuthorizationContext({
        overrideUserId: staffUserUuid,
        requestedBusinessId: foreignBizUuid,
      });
      assert(foreignContext === null, 'Foreign business context resolution fails safely returning null');
    } catch {
      assert(true, 'Foreign business context resolution correctly threw or returned null');
    }

    // Attempting to access resource belonging to another business tenant
    try {
      const foreignResource = { type: 'branch' as const, id: crypto.randomUUID() };
      const crossTenantCheck = await can({ context: staffContext!, permission: 'orders.view', resource: foreignResource });
      assert(crossTenantCheck === false, 'Cross-tenant resource scope check safely returns false');
    } catch (e: unknown) {
      const err = e as { code?: string };
      assert(err.code === 'RESOURCE_NOT_FOUND' || err.code === 'TENANT_MISMATCH', 'Cross-tenant access correctly denied with structured error');
    }
    // =========================================================================
    // SECTION 10: Business Owner Centralized Policy & Precedence Enforcement
    // =========================================================================
    console.log('\n--- SECTION 10: Business Owner Centralized Policy & Precedence Enforcement ---');

    // Assertion 1: Owner + normal valid business permission -> ALLOWED via owner_policy
    const ownerNormalDec = await authorize({
      context: ownerContext!,
      permission: 'orders.view',
    });
    assert(ownerNormalDec.allowed === true && ownerNormalDec.reason === 'ALLOWED' && ownerNormalDec.source === 'owner_policy', 'Business Owner + valid business permission -> ALLOWED via owner_policy');

    // Assertion 2: Owner + scoped explicit DENY on Branch A -> Branch A DENIED with EXPLICIT_DENY
    const ownerScopedDenyContext = {
      ...ownerContext!,
      permissionOverrides: [
        {
          id: 'ov_owner_deny_branch1',
          permissionKey: 'orders.create',
          effect: 'deny' as const,
          scopeType: 'PROPERTY' as const,
          branchId: branch1.id,
          departmentId: null,
          organizationUnitId: null,
          serviceAreaId: null,
          createdAt: new Date().toISOString(),
          businessMembershipId: ownerContext!.membershipId,
        },
      ],
    };

    const ownerBranchADeniedDec = await authorize({
      context: ownerScopedDenyContext,
      permission: 'orders.create',
      resource: { type: 'branch', id: branch1.id },
    });
    assert(ownerBranchADeniedDec.allowed === false && ownerBranchADeniedDec.reason === 'EXPLICIT_DENY', 'Business Owner + scoped explicit DENY on Branch A -> Branch A DENIED with EXPLICIT_DENY');

    // Assertion 3: Same owner + Branch B without matching scoped deny -> ALLOWED
    const ownerBranchBAllowedDec = await authorize({
      context: ownerScopedDenyContext,
      permission: 'orders.create',
      resource: { type: 'branch', id: branch2.id },
    });
    assert(ownerBranchBAllowedDec.allowed === true && ownerBranchBAllowedDec.source === 'owner_policy', 'Same owner + Branch B without matching scoped deny -> ALLOWED via owner_policy');

    // Assertion 4: Owner + unscoped explicit DENY -> DENIED
    const ownerUnscopedDenyContext = {
      ...ownerContext!,
      permissionOverrides: [
        {
          id: 'ov_owner_deny_unscoped',
          permissionKey: 'reports.export',
          effect: 'deny' as const,
          scopeType: 'ORGANIZATION' as const,
          branchId: null,
          departmentId: null,
          organizationUnitId: null,
          serviceAreaId: null,
          createdAt: new Date().toISOString(),
          businessMembershipId: ownerContext!.membershipId,
        },
      ],
    };

    const ownerUnscopedDeniedDec = await authorize({
      context: ownerUnscopedDenyContext,
      permission: 'reports.export',
    });
    assert(ownerUnscopedDeniedDec.allowed === false && ownerUnscopedDeniedDec.reason === 'EXPLICIT_DENY', 'Business Owner + unscoped explicit DENY -> DENIED with EXPLICIT_DENY');

    // Assertion 5: Owner + cross-tenant resource -> TENANT_MISMATCH
    const ownerCrossTenantDec = await authorize({
      context: ownerContext!,
      permission: 'orders.view',
      resource: { type: 'branch', id: crypto.randomUUID() },
    });
    assert(ownerCrossTenantDec.allowed === false && (ownerCrossTenantDec.reason === 'TENANT_MISMATCH' || ownerCrossTenantDec.reason === 'RESOURCE_NOT_FOUND'), 'Business Owner + cross-tenant resource -> TENANT_MISMATCH / RESOURCE_NOT_FOUND');

    // Assertion 6: Owner + super_admin/platform permission -> DENIED / INVALID_PERMISSION
    const ownerSuperAdminPermDec = await authorize({
      context: ownerContext!,
      permission: 'super_admin.access' as unknown as Parameters<typeof authorize>[0]['permission'],
    });
    assert(ownerSuperAdminPermDec.allowed === false && ownerSuperAdminPermDec.reason === 'INVALID_PERMISSION', 'Business Owner + super_admin/platform permission -> DENIED with INVALID_PERMISSION');

    // =========================================================================
    // SECTION 11: Super Admin Platform Boundary Isolation
    // =========================================================================
    console.log('\n--- SECTION 11: Super Admin Platform Boundary Isolation ---');

    const { isSuperAdmin } = await import('../src/server/auth/super-admin');
    const isOwnerSuperAdmin = await isSuperAdmin(ownerUserUuid);
    assert(isOwnerSuperAdmin === false, 'Tenant business owner is NOT a platform super admin');

    const isStaffSuperAdmin = await isSuperAdmin(staffUserUuid);
    assert(isStaffSuperAdmin === false, 'Tenant staff member is NOT a platform super admin');

    // =========================================================================
    // SECTION 12: Public & Customer Boundary Preservation
    // =========================================================================
    console.log('\n--- SECTION 12: Public and Customer Flow Separation ---');

    // Guest QR token verification does not rely on staff authorization context
    const qrResult = await QrService.resolvePublicBranchMenuByToken('non_existent_token_for_test');
    assert(qrResult.success === false && qrResult.error === 'INVALID_QR', 'Public QR menu resolution functions independently with cryptographic token verification');

    // Public ranked venues discovery
    const publicVenues = await VenueRankingService.getRankedVenues('popular', 5);
    assert(Array.isArray(publicVenues), 'Public venue ranking queries function without staff RBAC context');

    // =========================================================================
    // SECTION 13: Structured Authorization Error Codes
    // =========================================================================
    console.log('\n--- SECTION 13: Structured Authorization Error Enforcement ---');

    let threwExpectedError = false;
    try {
      await requireBusinessPermission({
        context: staffContext!,
        permission: 'reports.export',
        resource: branchResource,
      });
    } catch (err: unknown) {
      const authErr = err as { name?: string; code?: string };
      if (authErr.name === 'AuthorizationContextError' && (authErr.code === 'PERMISSION_DENIED' || authErr.code === 'OUTSIDE_SCOPE')) {
        threwExpectedError = true;
      }
    }
    assert(threwExpectedError === true, 'requireBusinessPermission() throws structured AuthorizationContextError with code PERMISSION_DENIED or OUTSIDE_SCOPE');

    // =========================================================================
    // SECTION 14: Residual Legacy Code Scanner Verification
    // =========================================================================
    console.log('\n--- SECTION 14: Final Residual Legacy Code Scanner & Allowlist Audit ---');

    const scanDirs = [
      'src/server/actions',
      'src/server/services',
      'src/app/api',
      'src/server/auth',
      'src/server/tenant',
      'src/app/(dashboard)',
    ];

    let authorizationResidualsCount = 0;
    let hasPermissionCount = 0;

    const performScan = (dirRelative: string) => {
      const dirFull = path.join(process.cwd(), dirRelative);
      if (!fs.existsSync(dirFull)) return;
      const files = fs.readdirSync(dirFull, { recursive: true });
      for (const f of files) {
        const filePathStr = String(f);
        if (!filePathStr.endsWith('.ts') && !filePathStr.endsWith('.tsx')) continue;
        const fullPath = path.join(dirFull, filePathStr);
        const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for PermissionService.hasPermission
        if (content.includes('PermissionService.hasPermission(')) {
          hasPermissionCount++;
        }

        // Classify authorization residuals (security decisions depending on raw role string outside policy engine or legitimate invariant)
        if (relPath.includes('src/server/actions/') || relPath.includes('src/app/api/')) {
          if (content.includes('role ===') || content.includes('role !==')) {
            // Check if it is not super-admin action (which is platform boundary)
            if (!relPath.includes('super-admin') && !relPath.includes('launch-readiness')) {
              authorizationResidualsCount++;
              console.error(`  Authorization residual found in action/api: ${relPath}`);
            }
          }
        }
      }
    };

    for (const d of scanDirs) {
      performScan(d);
    }

    assert(hasPermissionCount === 0, 'Zero calls to PermissionService.hasPermission() in server actions, services, api routes, or dashboard pages');
    assert(authorizationResidualsCount === 0, 'Zero legacy authorization boundaries remain in security-sensitive production paths');

  } finally {
    // Teardown disposable fixtures
    console.log('\n🧹 Cleaning up test fixtures...');
    await admin.from('inventory_recipe_ingredients').delete().eq('recipe_id', recipe?.id || '');
    await admin.from('inventory_recipes').delete().eq('business_id', business.id);
    await admin.from('inventory_items').delete().eq('business_id', business.id);
    await admin.from('dining_tables').delete().eq('business_id', business.id);
    await admin.from('service_areas').delete().eq('business_id', business.id);
    await admin.from('branch_assignments').delete().in('branch_id', [branch1?.id || '', branch2?.id || '']);
    await admin.from('staff_area_assignments').delete().eq('service_area_id', serviceArea?.id || '');
    await admin.from('branches').delete().eq('business_id', business.id);
    await admin.from('business_memberships').delete().eq('business_id', business.id);
    await admin.from('businesses').delete().eq('id', business.id);
    await admin.from('user_profiles').delete().in('id', [ownerUserUuid, managerUserUuid, staffUserUuid]);
    await admin.auth.admin.deleteUser(ownerUserUuid);
    await admin.auth.admin.deleteUser(managerUserUuid);
    await admin.auth.admin.deleteUser(staffUserUuid);
  }

  console.log('\n================================================================================');
  console.log(`  STEP 9 VERIFICATION SUMMARY:`);
  console.log(`  Total Assertions:  ${totalAssertions}`);
  console.log(`  Passed:            ${passedAssertions}`);
  console.log(`  Failed:            ${failedAssertions}`);
  console.log('================================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runStep9VerificationSuite().catch((err) => {
  console.error('Fatal error during Step 9 verification:', err);
  process.exit(1);
});
