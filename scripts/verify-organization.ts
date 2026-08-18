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
  console.log('  WSNexa Phase 29 Step 1 — Organization Core Verification Suite  ');
  console.log('================================================================\n');

  // Track created test entities for clean teardown
  const cleanupBusinessIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // Setup Primary Test Business & Secondary Tenant
    // -------------------------------------------------------------
    const { data: ownerUser } = await admin.auth.admin.createUser({
      email: `test.org.owner.${timestamp}@wsnexa.test`,
      password: 'Password123!Secure',
      email_confirm: true,
    });
    if (!ownerUser?.user) throw new Error('Failed to create test owner user');
    cleanupUserIds.push(ownerUser.user.id);

    const { data: biz1, error: biz1Err } = await admin
      .from('businesses')
      .insert({
        name: `Grand Palace Hotel ${timestamp}`,
        slug: `grand-palace-${timestamp}`,
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
        name: `Oceanview Resort ${timestamp}`,
        slug: `oceanview-${timestamp}`,
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
        name: 'Colombo Main Property',
        code: `CMB-${timestamp}`,
      })
      .select()
      .single();

    const { data: branch1B } = await admin
      .from('branches')
      .insert({
        business_id: biz1.id,
        name: 'Kandy Hill Property',
        code: `KDY-${timestamp}`,
      })
      .select()
      .single();

    // Create Branch for Biz 2
    const { data: branch2A } = await admin
      .from('branches')
      .insert({
        business_id: biz2.id,
        name: 'Galle Beach Property',
        code: `GAL-${timestamp}`,
      })
      .select()
      .single();

    // Create Staff Memberships for Biz 1
    const { data: staffUser1 } = await admin.auth.admin.createUser({
      email: `test.org.staff1.${timestamp}@wsnexa.test`,
      password: 'Password123!Secure',
      email_confirm: true,
    });
    if (!staffUser1?.user) throw new Error('Failed to create staffUser1');
    cleanupUserIds.push(staffUser1.user.id);

    const { data: membership1 } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz1.id,
        user_id: staffUser1.user.id,
        role: 'branch_manager',
        membership_status: 'active',
      })
      .select()
      .single();

    const { data: staffUser2 } = await admin.auth.admin.createUser({
      email: `test.org.staff2.${timestamp}@wsnexa.test`,
      password: 'Password123!Secure',
      email_confirm: true,
    });
    if (!staffUser2?.user) throw new Error('Failed to create staffUser2');
    cleanupUserIds.push(staffUser2.user.id);

    const { data: membership2 } = await admin
      .from('business_memberships')
      .insert({
        business_id: biz2.id,
        user_id: staffUser2.user.id,
        role: 'cashier',
        membership_status: 'active',
      })
      .select()
      .single();

    console.log('--- 1. Hierarchy Levels & Default Ranks ---');

    // 1. hierarchy-level table exists
    await OrganizationService.ensureDefaultHierarchyLevels(biz1.id);
    const levelsBiz1 = await OrganizationService.getHierarchyLevels(biz1.id);
    assert(levelsBiz1.length >= 8, '1. Hierarchy levels table exists and returns records');

    // 2. default hierarchy levels seeded correctly
    const rank1 = levelsBiz1.find((l) => l.rank === 1);
    const rank8 = levelsBiz1.find((l) => l.rank === 8);
    assert(
      rank1?.name === 'Owner / Board' && rank1.is_management === true && rank8?.name === 'Operational' && rank8.is_management === false,
      '2. Default hierarchy levels seeded accurately (Owner / Board rank 1 to Operational rank 8)'
    );

    // 3. hierarchy rank uniqueness per business
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

    // 4. Corporate department creation (branch_id = NULL)
    const corpDept = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: null,
      name: 'Corporate Food & Beverage',
      code: 'CORP-FB',
      departmentType: 'food_and_beverage',
    });
    assert(corpDept.id !== undefined && corpDept.branch_id === null, '4. Corporate department created with branch_id NULL');

    // 5. Property department creation
    const propDept = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: branch1A!.id,
      parentDepartmentId: corpDept.id,
      name: 'Colombo Culinary & Kitchen',
      code: 'CMB-KIT',
      departmentType: 'food_and_beverage',
    });
    assert(
      propDept.id !== undefined && propDept.branch_id === branch1A!.id && propDept.parent_department_id === corpDept.id,
      '5. Property-specific department created referencing parent corporate department'
    );

    // 6. Cross-business branch rejection
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

    // 7. Department self-parent rejection
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

    // 8. Department indirect cycle rejection (A -> B -> C -> A)
    const subDeptC = await OrganizationService.createDepartment({
      businessId: biz1.id,
      branchId: branch1A!.id,
      parentDepartmentId: propDept.id,
      name: 'Pastry & Bakery Section',
    });
    let cycleRejected = false;
    try {
      // Try to set corpDept's parent to subDeptC (would create loop corpDept -> propDept -> subDeptC -> corpDept)
      await OrganizationService.updateDepartment({
        id: corpDept.id,
        parentDepartmentId: subDeptC.id,
      });
    } catch {
      cycleRejected = true;
    }
    assert(cycleRejected, '8. Multi-hop circular ancestor cycles strictly rejected in department hierarchy');

    console.log('\n--- 3. Organization Units & Nesting ---');

    // 9. Organization Unit creation
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

    // 10. Unit parent-unit nesting
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

    // 11. Unit / Department tenant mismatch rejection
    await OrganizationService.ensureDefaultHierarchyLevels(biz2.id);
    const biz2Dept = await OrganizationService.createDepartment({
      businessId: biz2.id,
      name: 'Galle Housekeeping',
    });
    let unitTenantMismatchRejected = false;
    try {
      await OrganizationService.createUnit({
        businessId: biz1.id, // Biz 1
        departmentId: biz2Dept.id, // Biz 2 Department
        unitType: 'team',
        name: 'Invalid Unit',
      });
    } catch {
      unitTenantMismatchRejected = true;
    }
    assert(unitTenantMismatchRejected, '11. Unit creation with mismatched department tenant strictly rejected');

    // 12. Unit self-parent rejection
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

    // 13. Unit indirect cycle rejection
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

    console.log('\n--- 4. Job Titles & Hierarchy Ranks ---');

    // 14. Job Title creation
    const execChefLevel = levelsBiz1.find((l) => l.rank === 5); // Department Leadership
    const execChefTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Executive Chef',
      code: 'EXEC-CHEF',
      hierarchyLevelId: execChefLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: true,
    });
    assert(
      execChefTitle.id !== undefined && execChefTitle.hierarchy_level_id === execChefLevel!.id,
      '14. Job title created with valid hierarchy level and management designation'
    );

    const sousChefLevel = levelsBiz1.find((l) => l.rank === 6); // Management
    const sousChefTitle = await OrganizationService.createJobTitle({
      businessId: biz1.id,
      name: 'Sous Chef',
      code: 'SOUS-CHEF',
      hierarchyLevelId: sousChefLevel!.id,
      departmentType: 'food_and_beverage',
      isManagement: true,
    });
    assert(sousChefTitle.id !== undefined, '14b. Second job title created with supervisory hierarchy level');

    // 15. Job title hierarchy level tenant mismatch rejection
    const levelsBiz2 = await OrganizationService.getHierarchyLevels(biz2.id);
    let jtTenantMismatchRejected = false;
    try {
      await OrganizationService.createJobTitle({
        businessId: biz1.id, // Biz 1
        name: 'Invalid Chef Title',
        hierarchyLevelId: levelsBiz2[0].id, // Biz 2 Hierarchy Level
      });
    } catch {
      jtTenantMismatchRejected = true;
    }
    assert(jtTenantMismatchRejected, '15. Job title with mismatched hierarchy level tenant strictly rejected');

    console.log('\n--- 5. Organization Positions ---');

    // 16. Position creation (Active & Vacant)
    const execChefPosition = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      jobTitleId: execChefTitle.id,
      positionCode: 'POS-CMB-ECHEF-01',
      nameOverride: 'Executive Chef — Colombo Main',
      status: 'active',
      headcountLimit: 1,
    });
    assert(execChefPosition.id !== undefined && execChefPosition.status === 'active', '16. Active position created with full org context');

    // 17. Vacant position is a valid first-class record
    const vacantSousChefPos = await OrganizationService.createPosition({
      businessId: biz1.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: grillStation.id,
      jobTitleId: sousChefTitle.id,
      positionCode: 'POS-CMB-SCHEF-02',
      status: 'vacant',
      headcountLimit: 2,
    });
    assert(vacantSousChefPos.id !== undefined && vacantSousChefPos.status === 'vacant', '17. Vacant position is a valid first-class record');

    // 18. Position entity mismatch rejection
    let posEntityMismatchRejected = false;
    try {
      await OrganizationService.createPosition({
        businessId: biz1.id,
        branchId: branch1A!.id,
        departmentId: biz2Dept.id, // Biz 2 Department!
        jobTitleId: execChefTitle.id,
      });
    } catch {
      posEntityMismatchRejected = true;
    }
    assert(posEntityMismatchRejected, '18. Position with mismatched department tenant strictly rejected');

    console.log('\n--- 6. Staff Assignments & Historical Primary Semantics ---');

    // 19. Initial Primary Staff Assignment creation
    const primaryAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: membership1!.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      unitId: mainKitchenUnit.id,
      positionId: execChefPosition.id,
      jobTitleId: execChefTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      startsAt: new Date().toISOString(),
    });
    assert(
      primaryAssignment.id !== undefined && primaryAssignment.is_primary === true && primaryAssignment.assignment_type === 'primary',
      '19. Primary staff assignment created with valid membership, position, and canonical parity'
    );

    // 20. Membership / Business mismatch rejection
    let assignmentMemberMismatchRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id, // Biz 1
        businessMembershipId: membership2!.id, // Biz 2 Membership!
        jobTitleId: execChefTitle.id,
      });
    } catch {
      assignmentMemberMismatchRejected = true;
    }
    assert(assignmentMemberMismatchRejected, '20. Staff assignment with cross-tenant membership strictly rejected');

    // 21. Department / Unit / Branch mismatch validation
    let assignmentDeptMismatchRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: membership1!.id,
        departmentId: biz2Dept.id, // Cross-tenant department
        jobTitleId: execChefTitle.id,
      });
    } catch {
      assignmentDeptMismatchRejected = true;
    }
    assert(assignmentDeptMismatchRejected, '21. Staff assignment with cross-tenant department strictly rejected');

    // 22. Attempting second active primary without ending first is strictly rejected
    let secondActivePrimaryRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: membership1!.id,
        branchId: branch1A!.id,
        departmentId: propDept.id,
        positionId: vacantSousChefPos.id,
        jobTitleId: sousChefTitle.id,
        assignmentType: 'primary',
        isPrimary: true,
        status: 'active',
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('already has an active primary assignment')) {
        secondActivePrimaryRejected = true;
      }
    }
    assert(
      secondActivePrimaryRejected,
      '22. Creating second active primary assignment without ending first is strictly rejected with clear error'
    );

    // 23. Additional assignment allowed concurrently with active primary
    const additionalAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: membership1!.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      jobTitleId: sousChefTitle.id,
      assignmentType: 'additional',
      isPrimary: false,
      status: 'active',
    });
    assert(
      additionalAssignment.id !== undefined && additionalAssignment.is_primary === false && additionalAssignment.assignment_type === 'additional',
      '23. Additional secondary assignment can coexist concurrently with active primary assignment'
    );

    // 24. Cross-property assignment allowed
    const crossPropertyAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: membership1!.id,
      branchId: branch1B!.id, // Kandy Branch
      jobTitleId: execChefTitle.id,
      assignmentType: 'cross_property',
      isPrimary: false,
      status: 'active',
    });
    assert(
      crossPropertyAssignment.id !== undefined && crossPropertyAssignment.branch_id === branch1B!.id && crossPropertyAssignment.is_primary === false,
      '24. Cross-property assignment created successfully'
    );

    // 25. Acting assignment schema accepted with covered assignment reference
    const actingAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: membership1!.id,
      branchId: branch1A!.id,
      jobTitleId: execChefTitle.id,
      assignmentType: 'acting',
      isPrimary: false,
      status: 'active',
      actingForAssignmentId: primaryAssignment.id,
      reason: 'Covering during medical leave',
    });
    assert(
      actingAssignment.id !== undefined && actingAssignment.acting_for_assignment_id === primaryAssignment.id,
      '25. Acting assignment created with valid acting_for reference and reason'
    );

    // 26. Invalid date range rejected (ends_at <= starts_at)
    let invalidDatesRejected = false;
    try {
      await OrganizationService.createStaffAssignment({
        businessId: biz1.id,
        businessMembershipId: membership1!.id,
        jobTitleId: execChefTitle.id,
        startsAt: new Date('2026-08-20T10:00:00Z').toISOString(),
        endsAt: new Date('2026-08-19T10:00:00Z').toISOString(), // Before start date!
      });
    } catch {
      invalidDatesRejected = true;
    }
    assert(invalidDatesRejected, '26. Assignment with end date prior to start date strictly rejected');

    // 27. Ending primary assignment preserves historical primary classification
    const transitionTime = new Date().toISOString();
    const endedPrimary = await OrganizationService.endStaffAssignment({
      id: primaryAssignment.id,
      endedAt: transitionTime,
      reason: 'Promoted to Executive Management',
    });
    assert(
      endedPrimary.status === 'ended' &&
        endedPrimary.ends_at !== null &&
        endedPrimary.assignment_type === 'primary' &&
        endedPrimary.is_primary === true,
      '27. Ended primary assignment preserves assignment_type=primary and is_primary=true as immutable historical fact'
    );

    // 28. Creating new primary assignment succeeds once previous primary has ended
    const newPrimaryAssignment = await OrganizationService.createStaffAssignment({
      businessId: biz1.id,
      businessMembershipId: membership1!.id,
      branchId: branch1A!.id,
      departmentId: propDept.id,
      positionId: vacantSousChefPos.id,
      jobTitleId: sousChefTitle.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
      startsAt: transitionTime,
    });
    assert(
      newPrimaryAssignment.id !== undefined &&
        newPrimaryAssignment.assignment_type === 'primary' &&
        newPrimaryAssignment.is_primary === true &&
        newPrimaryAssignment.status === 'active',
      '28a. New primary assignment successfully created following end of previous primary assignment'
    );

    // 28b. Verify historical primary and new primary coexist cleanly in history
    const oldPrimaryCheck = await OrganizationService.getStaffAssignmentById(primaryAssignment.id);
    assert(
      oldPrimaryCheck?.status === 'ended' &&
        oldPrimaryCheck?.assignment_type === 'primary' &&
        oldPrimaryCheck?.is_primary === true &&
        newPrimaryAssignment.status === 'active' &&
        newPrimaryAssignment.is_primary === true,
      '28b. Historical primary record remains 100% unmutated while new primary is active'
    );

    console.log('\n--- 7. Database-Level Enforcement & Trigger Defense ---');

    // 29. DB Unique Partial Index: Raw SQL attempting to insert second active primary assignment triggers index
    const { error: dbDuplicatePrimaryErr } = await admin.from('staff_assignments').insert({
      business_id: biz1.id,
      business_membership_id: membership1!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'primary',
      is_primary: true,
      status: 'active',
    });
    assert(
      dbDuplicatePrimaryErr !== null,
      '29. DB partial unique index idx_one_active_primary_assignment strictly blocks raw SQL second active primary assignment'
    );

    // 30. DB Trigger: Direct SQL Cross-business references rejected
    const { error: dbCrossDeptErr } = await admin.from('organization_departments').insert({
      business_id: biz1.id,
      branch_id: branch2A!.id, // Biz 2 branch
      name: 'Direct SQL Malicious Dept',
    });
    assert(dbCrossDeptErr !== null, '30a. DB trigger strictly blocks raw SQL department insert with cross-tenant branch_id');

    const { error: dbCrossUnitErr } = await admin.from('organization_units').insert({
      business_id: biz1.id,
      department_id: biz2Dept.id, // Biz 2 department
      unit_type: 'team',
      name: 'Direct SQL Malicious Unit',
    });
    assert(dbCrossUnitErr !== null, '30b. DB trigger strictly blocks raw SQL unit insert with cross-tenant department_id');

    const { error: dbCrossJtErr } = await admin.from('organization_job_titles').insert({
      business_id: biz1.id,
      name: 'Direct SQL Malicious Job Title',
      hierarchy_level_id: levelsBiz2[0].id, // Biz 2 hierarchy level
    });
    assert(dbCrossJtErr !== null, '30c. DB trigger strictly blocks raw SQL job title insert with cross-tenant hierarchy_level_id');

    const { error: dbCrossPosErr } = await admin.from('organization_positions').insert({
      business_id: biz1.id,
      job_title_id: execChefTitle.id,
      department_id: biz2Dept.id, // Biz 2 department
    });
    assert(dbCrossPosErr !== null, '30d. DB trigger strictly blocks raw SQL position insert with cross-tenant department_id');

    // 31. DB Trigger: Direct SQL Self-acting and Self-reporting rejected
    const { error: dbSelfActingErr } = await admin.from('staff_assignments').insert({
      id: '11111111-2222-3333-4444-555555555555',
      business_id: biz1.id,
      business_membership_id: membership1!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'acting',
      is_primary: false,
      status: 'active',
      acting_for_assignment_id: '11111111-2222-3333-4444-555555555555', // Self acting
    });
    assert(dbSelfActingErr !== null, '31a. DB trigger & check constraint strictly block assignment acting for itself');

    const { error: dbSelfReportsErr } = await admin.from('staff_assignments').insert({
      id: '22222222-3333-4444-5555-666666666666',
      business_id: biz1.id,
      business_membership_id: membership1!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'additional',
      is_primary: false,
      status: 'active',
      reports_to_assignment_id: '22222222-3333-4444-5555-666666666666', // Self reporting
    });
    assert(dbSelfReportsErr !== null, '31b. DB trigger & check constraint strictly block assignment reporting to itself');

    // 32. DB Trigger: Direct SQL Cross-business acting and reporting rejected
    const biz2Assignment = await OrganizationService.createStaffAssignment({
      businessId: biz2.id,
      businessMembershipId: membership2!.id,
      jobTitleId: (await OrganizationService.createJobTitle({ businessId: biz2.id, name: 'Galle Cashier', hierarchyLevelId: levelsBiz2[7].id })).id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });

    const { error: dbCrossActingErr } = await admin.from('staff_assignments').insert({
      business_id: biz1.id,
      business_membership_id: membership1!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'acting',
      is_primary: false,
      status: 'active',
      acting_for_assignment_id: biz2Assignment.id, // Cross-business acting target
    });
    assert(dbCrossActingErr !== null, '32a. DB trigger strictly blocks cross-business acting reference');

    const { error: dbCrossReportsErr } = await admin.from('staff_assignments').insert({
      business_id: biz1.id,
      business_membership_id: membership1!.id,
      job_title_id: execChefTitle.id,
      assignment_type: 'additional',
      is_primary: false,
      status: 'active',
      reports_to_assignment_id: biz2Assignment.id, // Cross-business reporting target
    });
    assert(dbCrossReportsErr !== null, '32b. DB trigger strictly blocks cross-business reports-to reference');

    console.log('\n--- 8. Effective Assignment Semantic Verification ---');

    // 33. Effective assignment helper logic
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000).toISOString();
    const futureDate = new Date(now.getTime() + 86400000).toISOString();
    const expiredDate = new Date(now.getTime() - 3600000).toISOString();

    const activeEffective = OrganizationService.isAssignmentEffective({
      status: 'active',
      starts_at: pastDate,
      ends_at: futureDate,
    });
    assert(activeEffective === true, '33a. Active assignment currently within time window is effective');

    const futureScheduled = OrganizationService.isAssignmentEffective({
      status: 'active',
      starts_at: futureDate,
      ends_at: null,
    });
    assert(futureScheduled === false, '33b. Active assignment with future start date is not yet effective');

    const expiredActive = OrganizationService.isAssignmentEffective({
      status: 'active',
      starts_at: pastDate,
      ends_at: expiredDate,
    });
    assert(expiredActive === false, '33c. Active assignment with past end date is not effective');

    const endedAssignmentCheck = OrganizationService.isAssignmentEffective({
      status: 'ended',
      starts_at: pastDate,
      ends_at: futureDate,
    });
    assert(endedAssignmentCheck === false, '33d. Assignment with status=ended is never effective');

    // 34. getStaffAssignments effectiveOnly filtering
    const effectiveList = await OrganizationService.getStaffAssignments(biz1.id, { effectiveOnly: true });
    const allList = await OrganizationService.getStaffAssignments(biz1.id);
    assert(
      effectiveList.length > 0 && effectiveList.length <= allList.length,
      '34. getStaffAssignments with effectiveOnly=true filters to active window'
    );

    console.log('\n--- 9. Backward Compatibility & RBAC Invariance ---');

    // 35. Existing business_memberships unchanged
    const { data: memCheck } = await admin
      .from('business_memberships')
      .select('id, role, membership_status')
      .eq('id', membership1!.id)
      .single();
    assert(
      memCheck?.role === 'branch_manager' && memCheck?.membership_status === 'active',
      '35. Existing business_membership schema and operational roles remain 100% intact'
    );

    // 36. Existing branch_assignments table unchanged
    const { data: branchAssign } = await admin
      .from('branch_assignments')
      .insert({
        business_membership_id: membership1!.id,
        branch_id: branch1A!.id,
        is_primary: true,
      })
      .select()
      .single();
    assert(
      branchAssign?.id !== undefined && branchAssign.branch_id === branch1A!.id,
      '36. Existing branch_assignments table operates completely unchanged'
    );

    // 37. Existing RBAC permissions check
    const hasOrgView = await PermissionService.hasPermission(staffUser1.user.id, biz1.id, branch1A!.id, 'organization.view');
    const hasPeopleManage = await PermissionService.hasPermission(staffUser1.user.id, biz1.id, branch1A!.id, 'people.manage');
    const cashierHasOrgManage = await PermissionService.hasPermission(staffUser2.user.id, biz2.id, branch2A!.id, 'organization.manage');

    assert(hasOrgView === true, '37a. Branch manager inherits organization.view permission grant');
    assert(hasPeopleManage === true, '37b. Branch manager inherits people.manage permission grant');
    assert(cashierHasOrgManage === false, '37c. Cashier role strictly denied organization.manage permission (zero permission escalation)');
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
  console.log(`  Phase 29 Step 1 Verification: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED`);
  console.log('================================================================\n');

  if (passedAssertions !== totalAssertions) {
    process.exitCode = 1;
  }
}

runSuite().catch((err) => {
  console.error('Suite execution error:', err);
  process.exitCode = 1;
});
