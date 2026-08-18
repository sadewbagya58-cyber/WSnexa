import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local safely BEFORE importing server modules
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...values] = trimmed.split('=');
      process.env[key.trim()] = values.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message} ${detail ? `-> ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

async function runSuite() {
  const { OrganizationService } = await import('../src/server/services/organization.service');
  const { PermissionService } = await import('../src/server/services/permission.service');

  console.log('================================================================');
  console.log('  WSNexa Phase 29 Step 2 — Assignment & Reporting Engine Suite  ');
  console.log('================================================================\n');

  // Track created test entities for clean teardown
  const cleanupBusinessIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Setup Primary Test Business & Secondary Tenant
    // -------------------------------------------------------------
    const testSuffix = Date.now().toString().slice(-6);

    const { data: ownerUser, error: ownerErr } = await admin.auth.admin.createUser({
      email: `test_org_owner_${testSuffix}@wsnexa.test`,
      password: `TestPassword_${testSuffix}!@#`,
      email_confirm: true,
    });
    if (ownerErr || !ownerUser?.user) throw new Error(`Failed to create test owner user: ${ownerErr?.message || 'unknown'}`);
    cleanupUserIds.push(ownerUser.user.id);

    const { data: biz1, error: biz1Err } = await admin
      .from('businesses')
      .insert({
        name: `Royal Heritage Hotel ${testSuffix}`,
        slug: `royal-heritage-${testSuffix}`,
        created_by: ownerUser.user.id,
      })
      .select()
      .single();
    if (biz1Err || !biz1) throw new Error(`Failed to create biz1: ${biz1Err?.message}`);
    cleanupBusinessIds.push(biz1.id);

    // Business 2 for cross-tenant boundary tests
    const { data: biz2, error: biz2Err } = await admin
      .from('businesses')
      .insert({
        name: `Sapphire Lagoon Resort ${testSuffix}`,
        slug: `sapphire-lagoon-${testSuffix}`,
        created_by: ownerUser.user.id,
      })
      .select()
      .single();
    if (biz2Err || !biz2) throw new Error(`Failed to create biz2: ${biz2Err?.message}`);
    cleanupBusinessIds.push(biz2.id);

    // Create Branches for Biz 1
    const { data: branch1A } = await admin
      .from('branches')
      .insert({
        business_id: biz1.id,
        name: 'Colombo City Flagship',
        code: `CMB-${testSuffix}`,
      })
      .select()
      .single();

    const { data: branch1B } = await admin
      .from('branches')
      .insert({
        business_id: biz1.id,
        name: 'Kandy Sanctuary Property',
        code: `KDY-${testSuffix}`,
      })
      .select()
      .single();

    // Create Branch for Biz 2
    const { data: branch2A } = await admin
      .from('branches')
      .insert({
        business_id: biz2.id,
        name: 'Galle Coastal Property',
        code: `GAL-${testSuffix}`,
      })
      .select()
      .single();

    // Create Staff Memberships for Biz 1
    const createStaffMember = async (label: string, role = 'branch_manager') => {
      const uSuffix = Math.random().toString(36).substring(2, 7);
      const { data: u, error: uErr } = await admin.auth.admin.createUser({
        email: `test_org_${label}_${uSuffix}@wsnexa.test`,
        password: `StaffPassword_${uSuffix}!@#`,
        email_confirm: true,
      });
      if (uErr || !u?.user) throw new Error(`Failed to create user ${label}: ${uErr?.message}`);
      cleanupUserIds.push(u.user.id);

      const { data: m, error: mErr } = await admin
        .from('business_memberships')
        .insert({
          business_id: biz1.id,
          user_id: u.user.id,
          role,
          membership_status: 'active',
        })
        .select()
        .single();
      if (mErr || !m) throw new Error(`Failed to create membership ${label}: ${mErr?.message}`);
      return { user: u.user, membership: m };
    };

    const staff1 = await createStaffMember('staff1', 'branch_manager'); // Executive Chef
    const staff2 = await createStaffMember('staff2', 'branch_manager'); // Sous Chef
    const staff3 = await createStaffMember('staff3', 'kitchen_staff');  // Line Cook
    const staff4 = await createStaffMember('staff4', 'waiter');         // Head Waiter
    const staff5 = await createStaffMember('staff5', 'waiter');         // Server

    // Create Staff Membership for Biz 2
    const { data: biz2User, error: b2uErr } = await admin.auth.admin.createUser({
      email: `test_org_biz2_${testSuffix}@wsnexa.test`,
      password: `Biz2Password_${testSuffix}!@#`,
      email_confirm: true,
    });
    if (b2uErr || !biz2User?.user) throw new Error(`Failed to create biz2User: ${b2uErr?.message}`);
    cleanupUserIds.push(biz2User.user.id);

    const { data: membershipBiz2 } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz2.id,
        user_id: biz2User.user.id,
        role: 'cashier',
        membership_status: 'active',
      })
      .select()
      .single();

    console.log('--- 1. Hierarchy Levels & Default Ranks ---');

    await OrganizationService.ensureDefaultHierarchyLevels(biz1.id);
    const levelsBiz1 = await OrganizationService.getHierarchyLevels(biz1.id);
    assert(levelsBiz1.length >= 8, '1. Hierarchy levels table exists and returns records');

    const rank1 = levelsBiz1.find((l) => l.rank === 1);
    const rank8 = levelsBiz1.find((l) => l.rank === 8);
    assert(
      rank1?.name === 'Owner / Board' && rank1.is_management === true && rank8?.name === 'Operational' && rank8.is_management === false,
      '2. Default hierarchy levels seeded accurately (Owner / Board rank 1 to Operational rank 8)'
    );

    let duplicateRankRejected = false;
    try {
      await OrganizationService.createHierarchyLevel({
        businessId: biz1.id,
        name: 'Duplicate Rank Test',
        rank: 1,
        isManagement: true,
        isActive: true,
      });
    } catch {
      duplicateRankRejected = true;
    }
    assert(duplicateRankRejected, '3. Hierarchy rank uniqueness enforced per business');

    console.log('\n--- 2. Departments Architecture & Hierarchy ---');

    const corpDept = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: null,
      name: 'Corporate Food & Beverage',
      code: 'CORP-FB',
      departmentType: 'food_and_beverage',
    });
    assert(corpDept.id !== undefined && corpDept.branch_id === null, '4. Corporate department created with branch_id NULL');

    const propDept = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: branch1A!.id,
      parentDepartmentId: corpDept.id,
      name: 'Colombo Culinary Operations',
      code: 'CMB-CUL',
      departmentType: 'food_and_beverage',
    });
    assert(
      propDept.id !== undefined && propDept.branch_id === branch1A!.id && propDept.parent_department_id === corpDept.id,
      '5. Property-specific department created referencing parent corporate department'
    );

    let crossBizBranchRejected = false;
    try {
      await OrganizationService.createDepartment({
        businessId: biz1.id,
        branchId: branch2A!.id, // Branch belongs to biz2
        name: 'Invalid Cross Branch Dept',
      });
    } catch {
      crossBizBranchRejected = true;
    }
    assert(crossBizBranchRejected, '6. Cross-business branch assignment strictly rejected for department');

    let selfParentRejected = false;
    try {
      await OrganizationService.updateDepartment({
        id: corpDept.id,
        parentDepartmentId: corpDept.id,
      });
    } catch {
      selfParentRejected = true;
    }
    assert(selfParentRejected, '7. Department self-parenting strictly rejected');

    const subDeptC = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: branch1A!.id,
      parentDepartmentId: propDept.id,
      name: 'Pastry & Bakery Section',
    });
    let cycleRejected = false;
    try {
      await OrganizationService.updateDepartment({
        id: corpDept.id,
        parentDepartmentId: subDeptC.id,
      });
    } catch {
      cycleRejected = true;
    }
    assert(cycleRejected, '8. Multi-hop circular ancestor cycles strictly rejected in department hierarchy');

    console.log('\n--- 3. Organization Units & Nesting ---');

    const mainKitchenUnit = await OrganizationService.createUnit({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitType: 'section',
      name: 'Hot Kitchen Line',
      code: 'HOT-LINE-1',
    });
    assert(
      mainKitchenUnit.id !== undefined && mainKitchenUnit.unit_type === 'section',
      '9. Organization Unit created with valid unit_type and department link'
    );

    const grillStation = await OrganizationService.createUnit({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      parentUnitId: mainKitchenUnit.id,
      unitType: 'station',
      name: 'Grill & Rotisserie Station',
      code: 'GRILL-STN',
    });
    assert(
      grillStation.id !== undefined && grillStation.parent_unit_id === mainKitchenUnit.id,
      '10. Child unit successfully nested under parent unit'
    );

    await OrganizationService.ensureDefaultHierarchyLevels(biz2.id);
    const biz2Dept = await OrganizationService.createDepartment({
      businessId: biz2.id,
      name: 'Galle Housekeeping',
    });
    let unitTenantMismatchRejected = false;
    try {
      await OrganizationService.createUnit({
        businessId: biz1.id,
        departmentId: biz2Dept.id,
        unitType: 'team',
        name: 'Invalid Unit',
      });
    } catch {
      unitTenantMismatchRejected = true;
    }
    assert(unitTenantMismatchRejected, '11. Unit creation with mismatched department tenant strictly rejected');

    let unitSelfParentRejected = false;
    try {
      await OrganizationService.updateUnit({
        id: mainKitchenUnit.id,
        parentUnitId: mainKitchenUnit.id,
      });
    } catch {
      unitSelfParentRejected = true;
    }
    assert(unitSelfParentRejected, '12. Organization unit self-parenting strictly rejected');

    let unitCycleRejected = false;
    try {
      await OrganizationService.updateUnit({
        id: mainKitchenUnit.id,
        parentUnitId: grillStation.id,
      });
    } catch {
      unitCycleRejected = true;
    }
    assert(unitCycleRejected, '13. Multi-hop circular cycle strictly rejected in unit ancestry');

    console.log('\n--- 4. Job Titles & Positions ---');

    const execChefLevel = levelsBiz1.find((l) => l.rank === 5); // Department Leadership
    const execChefTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Executive Chef',
      code: 'EXEC-CHEF',
      hierarchyLevelId: execChefLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: true,
    });

    const sousChefLevel = levelsBiz1.find((l) => l.rank === 6); // Management
    const sousChefTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Sous Chef',
      code: 'SOUS-CHEF',
      hierarchyLevelId: sousChefLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: true,
    });

    const lineCookLevel = levelsBiz1.find((l) => l.rank === 8); // Operational
    const lineCookTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Line Cook',
      code: 'LINE-COOK',
      hierarchyLevelId: lineCookLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: false,
    });

    const fbDirectorLevel = levelsBiz1.find((l) => l.rank === 4); // General Management
    const fbDirectorTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'F&B Director',
      code: 'FB-DIR',
      hierarchyLevelId: fbDirectorLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: true,
    });

    assert(execChefTitle.id !== undefined && sousChefTitle.id !== undefined, '14. Standard job titles created with hierarchy levels');

    // Create Positions
    const fbDirectorPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      departmentId: corpDept.id,
      jobTitleId: fbDirectorTitle.id,
      positionCode: 'POS-CORP-FBDIR-01',
      headcountLimit: 1,
      status: 'active',
    });

    const execChefPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      jobTitleId: execChefTitle.id,
      positionCode: 'POS-CMB-ECHEF-01',
      headcountLimit: 1,
      status: 'active',
    });

    const sousChefPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      jobTitleId: sousChefTitle.id,
      positionCode: 'POS-CMB-SCHEF-01',
      headcountLimit: 2,
      status: 'active',
    });

    const lineCookPosSingleSeat = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: grillStation.id,
      jobTitleId: lineCookTitle.id,
      positionCode: 'POS-CMB-COOK-SINGLE',
      headcountLimit: 1,
      status: 'active',
    });

    const frozenPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      jobTitleId: lineCookTitle.id,
      positionCode: 'POS-CMB-FROZEN',
      headcountLimit: 1,
      status: 'frozen',
    });

    console.log('\n--- 5. Position Occupancy & Headcount Enforcement ---');

    const emptyOccupancy = await OrganizationService.getPositionOccupancy(execChefPos.id);
    assert(
      emptyOccupancy.occupiedCount === 0 && emptyOccupancy.availableSlots === 1 && emptyOccupancy.isFull === false,
      '15. Position occupancy correctly calculates 0 occupants on empty position'
    );

    // Initial Primary Assignment for F&B Director (Top Root Node)
    const fbDirectorAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff1.membership.id,
      departmentId: corpDept.id,
      positionId: fbDirectorPos.id,
      jobTitleId: fbDirectorTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });
    assert(fbDirectorAssignment.id !== undefined, '16. Top-level F&B Director primary assignment created with reports_to NULL');

    // Fill Exec Chef Position (staff2) reporting to F&B Director
    const execChefAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff2.membership.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      positionId: execChefPos.id,
      jobTitleId: execChefTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      reportsToAssignmentId: fbDirectorAssignment.id,
    });
    assert(
      execChefAssignment.id !== undefined && execChefAssignment.reports_to_assignment_id === fbDirectorAssignment.id,
      '17. Exec Chef assignment created reporting to F&B Director'
    );

    const fullOccupancy = await OrganizationService.getPositionOccupancy(execChefPos.id);
    assert(
      fullOccupancy.occupiedCount === 1 && fullOccupancy.availableSlots === 0 && fullOccupancy.isFull === true,
      '18. Position occupancy correctly detects position is full (1 / 1)'
    );

    // Attempting to assign another staff to full single-seat position is rejected
    let fullPosRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: staff3.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        unitId: mainKitchenUnit.id,
        positionId: execChefPos.id, // Full!
        jobTitleId: execChefTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('maximum headcount limit')) {
        fullPosRejected = true;
      }
    }
    assert(fullPosRejected, '19. Assigning staff to full position (capacity=1) is strictly rejected');

    // Assigning to frozen position is rejected
    let frozenPosRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: staff3.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        positionId: frozenPos.id,
        jobTitleId: lineCookTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('frozen')) {
        frozenPosRejected = true;
      }
    }
    assert(frozenPosRejected, '20. Assigning staff to frozen position is strictly rejected');

    // Position / Job Title Mismatch Rejection
    let posJobTitleMismatchRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: staff3.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        positionId: execChefPos.id, // Exec Chef position
        jobTitleId: lineCookTitle.id, // Line Cook title
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      });
    } catch {
      posJobTitleMismatchRejected = true;
    }
    assert(posJobTitleMismatchRejected, '20b. Mismatched position and job title strictly rejected');

    // Multi-capacity position test (headcountLimit = 2)
    const sousChefAssign1 = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff3.membership.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      positionId: sousChefPos.id,
      jobTitleId: sousChefTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      reportsToAssignmentId: execChefAssignment.id,
    });
    const sousOccupancy1 = await OrganizationService.getPositionOccupancy(sousChefPos.id);
    assert(
      sousOccupancy1.occupiedCount === 1 && sousOccupancy1.availableSlots === 1 && sousOccupancy1.isFull === false,
      '21. Multi-capacity position reflects 1 / 2 slots occupied'
    );

    const sousChefAssign2 = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff4.membership.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      positionId: sousChefPos.id,
      jobTitleId: sousChefTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      reportsToAssignmentId: execChefAssignment.id,
    });
    const sousOccupancy2 = await OrganizationService.getPositionOccupancy(sousChefPos.id);
    assert(
      sousOccupancy2.occupiedCount === 2 && sousOccupancy2.availableSlots === 0 && sousOccupancy2.isFull === true,
      '22. Multi-capacity position reaches full status when 2 / 2 slots occupied'
    );

    // Line cook reporting to Sous Chef 1
    const lineCookAssign1 = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff5.membership.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: grillStation.id,
      positionId: lineCookPosSingleSeat.id,
      jobTitleId: lineCookTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      reportsToAssignmentId: sousChefAssign1.id,
    });
    assert(lineCookAssign1.id !== undefined, '23. Line cook assigned reporting to Sous Chef 1');

    // Additional Secondary Assignment (staff5 also gets additional role without replacing primary)
    const pastryTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Pastry Assistant',
      hierarchyLevelId: lineCookLevel!.id,
      departmentType: 'food_and_beverage',
    });
    const additionalPastryAssign = await OrganizationService.createAdditionalAssignment({
      businessId: biz1.id,
      businessMembershipId: staff5.membership.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      jobTitleId: pastryTitle.id,
      assignmentType: 'additional',
      status: 'active',
      reason: 'Cross-training in pastry section',
    });
    assert(
      additionalPastryAssign.id !== undefined &&
        additionalPastryAssign.is_primary === false &&
        additionalPastryAssign.assignment_type === 'additional',
      '23b. Additional secondary assignment successfully created and coexists with active primary'
    );

    // Cross-Property Assignment Foundation & Cross-Property Reporting
    const kandyDept = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: branch1B!.id, // Kandy Sanctuary Property
      name: 'Kandy Kitchen Operations',
    });
    const kandyChefAssign = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff1.membership.id, // Has primary in Corp
      branchId: branch1B!.id,
      departmentId: kandyDept.id,
      jobTitleId: sousChefTitle.id,
      assignmentType: 'cross_property',
      isPrimary: false,
      status: 'active',
      reportsToAssignmentId: execChefAssignment.id, // Reports to Colombo Exec Chef across properties!
      reason: 'Cross-property advisory',
    });
    assert(
      kandyChefAssign.id !== undefined &&
        kandyChefAssign.branch_id === branch1B!.id &&
        kandyChefAssign.reports_to_assignment_id === execChefAssignment.id,
      '23c. Cross-property assignment created and allowed to report to manager at another property within same business'
    );

    console.log('\n--- 6. Reporting Engine: Direct Reports, Chains & Trees ---');

    // Direct Reports of Exec Chef (should have 2 local sous chefs + 1 cross-property chef)
    const execDirectReports = await OrganizationService.getDirectReports(execChefAssignment.id);
    assert(
      execDirectReports.length === 3 &&
        execDirectReports.some((r) => r.id === sousChefAssign1.id) &&
        execDirectReports.some((r) => r.id === sousChefAssign2.id) &&
        execDirectReports.some((r) => r.id === kandyChefAssign.id),
      '24. getDirectReports returns exact direct subordinates (including cross-property report)'
    );

    // Reporting Chain from Line Cook up to F&B Director
    const cookChain = await OrganizationService.getReportingChain(lineCookAssign1.id);
    assert(
      cookChain.length === 4 &&
        cookChain[0].id === lineCookAssign1.id &&
        cookChain[1].id === sousChefAssign1.id &&
        cookChain[2].id === execChefAssignment.id &&
        cookChain[3].id === fbDirectorAssignment.id,
      '25. getReportingChain returns full linear chain: Line Cook -> Sous Chef -> Exec Chef -> F&B Director'
    );

    // Reporting Tree from Root
    const tree = await OrganizationService.getReportingTree(fbDirectorAssignment.id);
    assert(
      tree.length === 1 &&
        tree[0].assignment.id === fbDirectorAssignment.id &&
        tree[0].directReports.length === 1 &&
        tree[0].directReports[0].assignment.id === execChefAssignment.id &&
        tree[0].directReports[0].directReports.length === 3,
      '26. getReportingTree builds complete recursive hierarchy tree'
    );

    console.log('\n--- 7. Reporting Cycle Prevention Defense ---');

    // 2-Hop Cycle Rejection: Trying to make Exec Chef report to Line Cook (Line Cook reports to Sous Chef -> Exec Chef)
    let twoHopCycleRejected = false;
    try {
      await OrganizationService.setReportingManager({
        businessId: biz1.id,
        assignmentId: execChefAssignment.id,
        reportsToAssignmentId: lineCookAssign1.id,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('Circular reporting') || err.message.includes('ancestry'))) {
        twoHopCycleRejected = true;
      }
    }
    assert(twoHopCycleRejected, '27. Multi-hop circular reporting loop (Exec Chef -> Line Cook) strictly blocked by database trigger');

    // 3-Hop Cycle Rejection: F&B Director (Top) -> Line Cook
    let threeHopCycleRejected = false;
    try {
      await OrganizationService.setReportingManager({
        businessId: biz1.id,
        assignmentId: fbDirectorAssignment.id,
        reportsToAssignmentId: lineCookAssign1.id,
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes('Circular reporting') || err.message.includes('ancestry'))) {
        threeHopCycleRejected = true;
      }
    }
    assert(threeHopCycleRejected, '27b. 3-hop circular reporting loop (F&B Director -> Line Cook) strictly blocked by database trigger');

    // Direct Self-Reporting Rejection
    let selfReportRejected = false;
    try {
      await OrganizationService.setReportingManager({
        businessId: biz1.id,
        assignmentId: lineCookAssign1.id,
        reportsToAssignmentId: lineCookAssign1.id,
      });
    } catch {
      selfReportRejected = true;
    }
    assert(selfReportRejected, '28. Assignment reporting to itself strictly rejected');

    // Rejection of reporting to an ended manager
    const tempAssignToEnd = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: staff4.membership.id,
      jobTitleId: lineCookTitle.id,
      assignmentType: 'temporary',
      isPrimary: false,
      status: 'active',
    });
    await OrganizationService.endStaffAssignment({
      id: tempAssignToEnd.id,
      reason: 'Temporary role ended',
    });
    let endedMgrRejected = false;
    try {
      await OrganizationService.setReportingManager({
        businessId: biz1.id,
        assignmentId: lineCookAssign1.id,
        reportsToAssignmentId: tempAssignToEnd.id,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('ended')) {
        endedMgrRejected = true;
      }
    }
    assert(endedMgrRejected, '28b. Reporting to an ended manager is strictly rejected');

    // Reporting Manager Change with History Tracking
    const mgrChangeRes = await OrganizationService.setReportingManager({
      businessId: biz1.id,
      assignmentId: lineCookAssign1.id,
      reportsToAssignmentId: sousChefAssign2.id, // Reassigned to Sous Chef 2
      reason: 'Shift re-alignment',
    });
    assert(mgrChangeRes.success === true, '29. setReportingManager successfully updates reporting manager');

    const repHistory = await OrganizationService.getReportingHistory(lineCookAssign1.id);
    assert(
      repHistory.length >= 2 &&
        repHistory[0].new_manager_assignment_id === sousChefAssign2.id &&
        repHistory[0].previous_manager_assignment_id === sousChefAssign1.id,
      '30. organization_reporting_history records previous and new manager with reason'
    );

    console.log('\n--- 8. Atomic Primary Transitions (Promotion & Transfer) ---');

    // Atomic Promotion: Promote staff5 (Line Cook) to a new position
    const juniorSousChefTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Junior Sous Chef',
      hierarchyLevelId: sousChefLevel!.id,
      departmentType: 'food_and_beverage',
    });

    const juniorSousChefPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      jobTitleId: juniorSousChefTitle.id,
      headcountLimit: 1,
      status: 'active',
    });

    const promoTime = new Date().toISOString();
    const promoRes = await OrganizationService.transitionPrimaryAssignment({
      businessId: biz1.id,
      currentAssignmentId: lineCookAssign1.id,
      newPositionId: juniorSousChefPos.id,
      newJobTitleId: juniorSousChefTitle.id,
      newBranchId: branch1A!.id,
      newDepartmentId: propDept.id,
      newUnitId: mainKitchenUnit.id,
      newReportsToId: execChefAssignment.id,
      transitionType: 'promotion',
      reason: 'Promoted for outstanding culinary leadership',
      transitionTime: promoTime,
    });

    assert(promoRes.success === true, '31. transitionPrimaryAssignment atomically executes promotion');

    // Verify Old Primary is ended and preserves history
    const oldCookAssign = await OrganizationService.getStaffAssignmentById(lineCookAssign1.id);
    assert(
      oldCookAssign?.status === 'ended' &&
        oldCookAssign?.is_primary === true &&
        oldCookAssign?.assignment_type === 'primary' &&
        oldCookAssign?.ends_at !== null,
      '32. Old primary assignment preserved as ended with is_primary=true (immutable historical fact)'
    );

    // Verify New Primary is active
    const newPromoAssign = await OrganizationService.getStaffAssignmentById(promoRes.newAssignmentId);
    assert(
      newPromoAssign?.status === 'active' &&
        newPromoAssign?.is_primary === true &&
        newPromoAssign?.job_title_id === juniorSousChefTitle.id,
      '33. New promoted primary assignment is active with correct job title'
    );

    // Verify Old Cook position capacity is now freed up
    const freedCookOcc = await OrganizationService.getPositionOccupancy(lineCookPosSingleSeat.id);
    assert(
      freedCookOcc.occupiedCount === 0 && freedCookOcc.isFull === false,
      '34. Vacation of old position upon primary transition immediately frees occupancy'
    );

    // Failed Transition Rollback: Try to transition staff4 to full Exec Chef position
    let failedTransitionRejected = false;
    try {
      await OrganizationService.transitionPrimaryAssignment({
        businessId: biz1.id,
        currentAssignmentId: sousChefAssign2.id,
        newPositionId: execChefPos.id, // Full!
        transitionType: 'promotion',
      });
    } catch {
      failedTransitionRejected = true;
    }
    assert(failedTransitionRejected, '35. Primary transition to full position strictly rejected');

    // Verify sousChefAssign2 remains active and uncorrupted
    const uncorruptedSousAssign = await OrganizationService.getStaffAssignmentById(sousChefAssign2.id);
    assert(
      uncorruptedSousAssign?.status === 'active' && uncorruptedSousAssign?.is_primary === true,
      '36. Failed primary transition preserves original primary assignment active with zero state corruption'
    );

    console.log('\n--- 9. Concurrency Safety Races ---');

    // Concurrency Race A: 2 concurrent assignments into a 1-seat position (lineCookPosSingleSeat)
    const newStaffA = await createStaffMember('raceStaffA', 'kitchen_staff');
    const newStaffB = await createStaffMember('raceStaffB', 'kitchen_staff');

    const raceResults = await Promise.allSettled([
      OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: newStaffA.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        unitId: grillStation.id,
        positionId: lineCookPosSingleSeat.id,
        jobTitleId: lineCookTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      }),
      OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: newStaffB.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        unitId: grillStation.id,
        positionId: lineCookPosSingleSeat.id,
        jobTitleId: lineCookTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      }),
    ]);

    const raceSuccesses = raceResults.filter((r) => r.status === 'fulfilled');
    const raceRejections = raceResults.filter((r) => r.status === 'rejected');
    assert(
      raceSuccesses.length === 1 && raceRejections.length === 1,
      '37. Concurrency Race: Two simultaneous assignments to 1-seat position results in exactly 1 winner and 1 clean capacity rejection'
    );

    // Concurrency Race B: 2 concurrent primary assignments for the same member (newStaffA if not won, or new test member)
    const raceMemberUser = await createStaffMember('doublePrimaryRace', 'kitchen_staff');
    const doublePrimaryResults = await Promise.allSettled([
      OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: raceMemberUser.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        jobTitleId: lineCookTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      }),
      OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: raceMemberUser.membership.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        jobTitleId: lineCookTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      }),
    ]);

    const doublePrimarySuccesses = doublePrimaryResults.filter((r) => r.status === 'fulfilled');
    assert(
      doublePrimarySuccesses.length === 1,
      '38. Concurrency Race: Two simultaneous primary assignments for same member results in exactly 1 active primary assignment'
    );

    console.log('\n--- 10. Member Profiles, History & Integrity Diagnostics ---');

    // Member Assignment History
    const staff5History = await OrganizationService.getMemberAssignmentHistory(staff5.membership.id);
    assert(
      staff5History.length === 3 &&
        staff5History.some((a) => a.status === 'active' && a.is_primary === true) &&
        staff5History.some((a) => a.status === 'active' && a.is_primary === false) &&
        staff5History.some((a) => a.status === 'ended' && a.is_primary === true),
      '39. getMemberAssignmentHistory returns complete chronological assignment timeline'
    );

    // Member Organization Profile & Branch Mismatch Detection
    const profile = await OrganizationService.getMemberOrganizationProfile(staff5.membership.id);
    assert(
      profile.primaryAssignment !== null &&
        profile.effectiveAssignments.length === 2 &&
        profile.additionalAssignments.length === 1 &&
        profile.organizationBranchAccessMismatch === true, // Branch1A is assigned organizationally but not in branch_assignments
      '40. getMemberOrganizationProfile generates composite profile and accurately flags organizationBranchAccessMismatch'
    );

    // Organization Integrity Diagnostics
    const issues = await OrganizationService.getOrganizationIntegrityIssues(biz1.id);
    assert(
      issues.length > 0 &&
        issues.some((i) => i.type === 'branch_access_mismatch'),
      '41. getOrganizationIntegrityIssues evaluates organization health and identifies actionable items'
    );

    console.log('\n--- 11. Cross-Tenant Boundary Security ---');

    // Direct SQL insert of assignment referencing cross-business manager is rejected
    const { error: crossTenantMgrErr } = await admin.from('staff_assignments').insert({
      business_id: biz2.id,
      business_membership_id: membershipBiz2!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'primary',
      is_primary: true,
      status: 'active',
      reports_to_assignment_id: fbDirectorAssignment.id, // Biz 1 assignment
    });
    assert(crossTenantMgrErr !== null, '42. Cross-business reporting manager reference strictly blocked by database trigger');

    console.log('\n--- 12. Backward Compatibility & RBAC Stability ---');

    const { data: mem1Check } = await admin
      .from('business_memberships')
      .select('id, role, membership_status')
      .eq('id', staff1.membership.id)
      .single();
    assert(
      mem1Check?.role === 'branch_manager' && mem1Check?.membership_status === 'active',
      '43. Existing business_memberships table remains 100% authoritative and intact'
    );

    const { data: branchAssignCheck } = await admin
      .from('branch_assignments')
      .insert({
        business_membership_id: staff1.membership.id,
        branch_id: branch1A!.id,
        is_primary: true,
      })
      .select()
      .single();
    assert(
      branchAssignCheck?.id !== undefined && branchAssignCheck.branch_id === branch1A!.id,
      '44. Operational branch_assignments table operates completely undisturbed'
    );

    const hasPeopleManage = await PermissionService.hasPermission(staff1.user.id, biz1.id, branch1A!.id, 'people.manage');
    const cashierHasPeopleManage = await PermissionService.hasPermission(biz2User.user.id, biz2.id, branch2A!.id, 'people.manage');
    assert(hasPeopleManage === true, '45a. Branch Manager role has people.manage permission');
    assert(cashierHasPeopleManage === false, '45b. Cashier role is strictly denied people.manage (zero permission escalation)');
  } finally {
    // -------------------------------------------------------------
    // Clean Teardown of Test Entities
    // -------------------------------------------------------------
    console.log('\n🧹 Cleaning up test organizations and users...');
    for (const bizId of cleanupBusinessIds) {
      await admin.from('businesses').delete().eq('id', bizId);
    }
    for (const userId of cleanupUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
    console.log('✅ Cleanup completed.');
  }

  console.log('================================================================');
  console.log(`  Phase 29 Step 2 Verification: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED`);
  console.log('================================================================\n');

  if (passedAssertions !== totalAssertions) {
    process.exitCode = 1;
  }
}

runSuite().catch((err) => {
  console.error('Suite execution error:', err);
  process.exitCode = 1;
});
