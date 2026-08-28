// Bypass server-only guard for tsx execution
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
  const { StaffInvitationService } = await import('../src/server/services/staff-invitation.service');
  const { OrganizationService } = await import('../src/server/services/organization.service');

  console.log('================================================================');
  console.log('  WSNexa E2E — Organization Staff Assignment & Invite Linkage   ');
  console.log('================================================================\n');

  const cleanupBusinessIds: string[] = [];
  const cleanupUserIds: string[] = [];

  try {
    const testSuffix = Date.now().toString().slice(-6);

    // 1. Create Test Owner User
    const { data: ownerUser, error: ownerErr } = await admin.auth.admin.createUser({
      email: `test_org_owner_${testSuffix}@wsnexa.test`,
      password: `TestPassword_${testSuffix}!@#`,
      email_confirm: true,
      user_metadata: { first_name: 'Nexa', last_name: 'Owner' },
    });
    if (ownerErr || !ownerUser?.user) throw new Error(`Failed to create owner user: ${ownerErr?.message}`);
    cleanupUserIds.push(ownerUser.user.id);

    await admin.from('user_profiles').upsert({
      id: ownerUser.user.id,
      email: ownerUser.user.email,
      first_name: 'Nexa',
      last_name: 'Owner',
      onboarding_intent: 'business_owner',
      preferred_workspace: 'dashboard',
    });

    // 2. Create Business
    const { data: biz, error: bizErr } = await admin
      .from('businesses')
      .insert({
        name: `Nexa Grand Hotel ${testSuffix}`,
        slug: `nexa-grand-hotel-${testSuffix}`,
        created_by: ownerUser.user.id,
      })
      .select()
      .single();
    if (bizErr || !biz) throw new Error(`Failed to create business: ${bizErr?.message}`);
    cleanupBusinessIds.push(biz.id);

    // Add Owner Membership
    await admin.from('business_memberships').insert({
      business_id: biz.id,
      user_id: ownerUser.user.id,
      role: 'business_owner',
      membership_status: 'active',
    });

    // 3. Create Primary Branch (Property)
    const { data: branch, error: branchErr } = await admin
      .from('branches')
      .insert({
        business_id: biz.id,
        name: 'Colombo Main Hotel',
        code: `CMB_${testSuffix}`,
        is_default: true,
      })
      .select()
      .single();
    if (branchErr || !branch) throw new Error(`Failed to create branch: ${branchErr?.message}`);

    // 4. Create Department
    const dept = await OrganizationService.createDepartment({
      businessId: biz.id,
      name: 'Food & Beverage',
      code: `FB_${testSuffix}`,
      branchId: branch.id,
    });

    // 5. Create Unit
    const unit = await OrganizationService.createOrganizationUnit({
      businessId: biz.id,
      departmentId: dept.id,
      name: 'Main Dining Service',
      code: `MDS_${testSuffix}`,
      unitType: 'operational_unit',
    });

    // 6. Create Service Area
    const { data: serviceArea, error: saErr } = await admin
      .from('service_areas')
      .insert({
        business_id: biz.id,
        branch_id: branch.id,
        name: 'Main Dining',
        code: `MD_${testSuffix}`,
        is_active: true,
      })
      .select()
      .single();
    if (saErr || !serviceArea) throw new Error(`Failed to create service area: ${saErr?.message}`);

    // 7. Get Seeded Hierarchy Level & Create Job Title
    const levels = await OrganizationService.getHierarchyLevels(biz.id);
    const waiterLevel = levels.find((l) => l.rank >= 7) || levels[levels.length - 1];
    if (!waiterLevel) throw new Error('No hierarchy level found in business');

    const jobTitle = await OrganizationService.createJobTitle({
      businessId: biz.id,
      name: 'Waiter',
      code: `WTR_${testSuffix}`,
      hierarchyLevelId: waiterLevel.id,
      isManagement: false,
    });

    // 8. Create Organization Position
    const position = await OrganizationService.createPosition({
      businessId: biz.id,
      jobTitleId: jobTitle.id,
      branchId: branch.id,
      departmentId: dept.id,
      unitId: unit.id,
      positionCode: `POS-WTR-MDS-${testSuffix}`,
      headcountLimit: 3,
      status: 'vacant',
    });

    console.log('\n--- Section 1: Initial Position State ---');
    const initialOcc = await OrganizationService.getPositionOccupancy(position.id);
    assert(initialOcc.occupiedCount === 0, 'Initial position occupancy is 0');
    assert(initialOcc.headcountLimit === 3, 'Position headcount limit is 3');
    assert(initialOcc.availableSlots === 3, 'Position available slots is 3');
    assert(initialOcc.isFull === false, 'Position is not full');

    console.log('\n--- Section 2: Staff Invitation Creation with Organization Position ---');
    const inviteRes = await StaffInvitationService.createInvitation(ownerUser.user.id, biz.id, {
      branchId: branch.id,
      assignedRole: 'waiter',
      serviceAreaIds: [serviceArea.id],
      positionId: position.id,
      expiryOption: '48h',
    });

    assert(inviteRes.success === true, 'Staff invitation created successfully with position', inviteRes.message);
    assert(Boolean(inviteRes.rawCode), 'Raw invitation code generated');
    assert(inviteRes.invitation?.positionId === position.id, 'Invitation metadata contains positionId');
    assert(inviteRes.invitation?.positionCode === position.position_code, 'Invitation metadata contains positionCode');
    assert(inviteRes.invitation?.jobTitleName === 'Waiter', 'Invitation metadata contains jobTitleName');

    // Verify DB record
    const { data: dbInvite } = await admin
      .from('staff_invitations')
      .select('position_id, department_id, unit_id, job_title_id, branch_id')
      .eq('id', inviteRes.invitation!.id)
      .single();

    assert(dbInvite?.position_id === position.id, 'DB column staff_invitations.position_id persisted');
    assert(dbInvite?.department_id === dept.id, 'DB column staff_invitations.department_id derived and persisted');
    assert(dbInvite?.unit_id === unit.id, 'DB column staff_invitations.unit_id derived and persisted');
    assert(dbInvite?.job_title_id === jobTitle.id, 'DB column staff_invitations.job_title_id derived and persisted');

    // Verify listInvitations
    const listInvites = await StaffInvitationService.listInvitations(biz.id, branch.id);
    const listedInvite = listInvites.find((i) => i.id === inviteRes.invitation!.id);
    assert(Boolean(listedInvite), 'Invitation listed in listInvitations');
    assert(listedInvite?.positionCode === position.position_code, 'Listed invitation contains positionCode');
    assert(listedInvite?.jobTitleName === 'Waiter', 'Listed invitation contains jobTitleName');

    console.log('\n--- Section 3: Headcount Ceiling Gating ---');
    // Create single-slot position
    const singlePos = await OrganizationService.createPosition({
      businessId: biz.id,
      jobTitleId: jobTitle.id,
      branchId: branch.id,
      positionCode: `POS-CAP1-${testSuffix}`,
      headcountLimit: 1,
      status: 'vacant',
    });

    // Occupy singlePos
    await OrganizationService.createStaffAssignment({
      businessId: biz.id,
      businessMembershipId: (await admin.from('business_memberships').select('id').eq('business_id', biz.id).single()).data!.id,
      jobTitleId: jobTitle.id,
      branchId: branch.id,
      positionId: singlePos.id,
      assignmentType: 'primary',
      isPrimary: true,
      status: 'active',
    });

    const fullOcc = await OrganizationService.getPositionOccupancy(singlePos.id);
    assert(fullOcc.isFull === true, 'Single slot position is now full (1/1)');

    const blockedInviteRes = await StaffInvitationService.createInvitation(ownerUser.user.id, biz.id, {
      branchId: branch.id,
      assignedRole: 'waiter',
      serviceAreaIds: [serviceArea.id],
      positionId: singlePos.id,
      expiryOption: '48h',
    });
    assert(blockedInviteRes.success === false, 'Invitation creation rejected for full position');
    assert(
      Boolean(blockedInviteRes.message?.includes('headcount limit')),
      'Rejection message clearly identifies headcount limit ceiling'
    );

    console.log('\n--- Section 4: Staff Invitation Claim & Automatic Primary Assignment ---');
    // Create Staff User 1
    const { data: staffUser1, error: staff1Err } = await admin.auth.admin.createUser({
      email: `waiter_staff1_${testSuffix}@wsnexa.test`,
      password: `TestPassword_${testSuffix}!@#`,
      email_confirm: true,
      user_metadata: { first_name: 'Kamal', last_name: 'Perera' },
    });
    if (staff1Err || !staffUser1?.user) throw new Error(`Failed to create staff user 1: ${staff1Err?.message}`);
    cleanupUserIds.push(staffUser1.user.id);

    await admin.from('user_profiles').upsert({
      id: staffUser1.user.id,
      email: staffUser1.user.email,
      first_name: 'Kamal',
      last_name: 'Perera',
      onboarding_intent: 'staff',
      preferred_workspace: 'dashboard',
    });

    const claimRes = await StaffInvitationService.claimInvitation(
      staffUser1.user.id,
      staffUser1.user.email!,
      inviteRes.rawCode!
    );

    assert(claimRes.success === true, 'Staff invitation claimed successfully', claimRes.message);

    // Verify Business Membership
    const { data: membership1 } = await admin
      .from('business_memberships')
      .select('id, role, membership_status')
      .eq('business_id', biz.id)
      .eq('user_id', staffUser1.user.id)
      .single();

    assert(Boolean(membership1), 'Business membership created for claimed staff');
    assert(membership1?.membership_status === 'active', 'Membership status is active');
    assert(membership1?.role === 'waiter', 'Membership role is waiter');

    // Verify Branch Assignment
    const { data: branchAssign } = await admin
      .from('branch_assignments')
      .select('id, branch_id, is_primary')
      .eq('business_membership_id', membership1!.id)
      .single();
    assert(branchAssign?.branch_id === branch.id, 'Branch assignment linked to Colombo Main Hotel');
    assert(branchAssign?.is_primary === true, 'Branch assignment is primary');

    // Verify Staff Area Assignment
    const { data: areaAssign } = await admin
      .from('staff_area_assignments')
      .select('id, service_area_id')
      .eq('business_membership_id', membership1!.id)
      .single();
    assert(areaAssign?.service_area_id === serviceArea.id, 'Service area assigned to Main Dining');

    // Verify Primary Staff Assignment in Organization Model
    const { data: primaryAssign } = await admin
      .from('staff_assignments')
      .select('*')
      .eq('business_membership_id', membership1!.id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .single();

    assert(Boolean(primaryAssign), 'Primary staff assignment created in organization model');
    assert(primaryAssign?.position_id === position.id, 'Primary assignment linked to POS-WTR-MDS-01');
    assert(primaryAssign?.job_title_id === jobTitle.id, 'Primary assignment linked to Waiter job title');
    assert(primaryAssign?.branch_id === branch.id, 'Primary assignment linked to Colombo Main Hotel');
    assert(primaryAssign?.department_id === dept.id, 'Primary assignment linked to Food & Beverage');
    assert(primaryAssign?.unit_id === unit.id, 'Primary assignment linked to Main Dining Service');
    assert(primaryAssign?.assignment_type === 'primary', 'Assignment type is primary');

    console.log('\n--- Section 5: Position Occupancy Live Update ---');
    const updatedOcc = await OrganizationService.getPositionOccupancy(position.id);
    assert(updatedOcc.occupiedCount === 1, 'Position occupancy updated from 0/3 to 1/3');
    assert(updatedOcc.availableSlots === 2, 'Position available slots is now 2');
    assert(updatedOcc.isFull === false, 'Position is still accepting assignments (1/3)');

    const positionsWithCoverage = await OrganizationService.listAllPositionsWithCoverage(biz.id);
    const posInList = positionsWithCoverage.find((p) => p.id === position.id);
    assert(posInList?.occupiedCount === 1, 'listAllPositionsWithCoverage reflects 1/3 occupied count');

    console.log('\n--- Section 6: People Directory & Org Chart Discovery ---');
    const staffDirectory = await OrganizationService.listOrganizationStaff(biz.id, { branchId: branch.id });
    const directoryPerson = staffDirectory.find((s) => s.membershipId === membership1!.id);

    assert(Boolean(directoryPerson), 'Claimed staff member appears in People Directory for branch');
    assert(directoryPerson?.fullName === 'Kamal Perera', 'Staff full name is Kamal Perera');
    assert(directoryPerson?.isUnassigned === false, 'Staff is marked as assigned (isUnassigned = false)');
    assert(directoryPerson?.hasPrimaryAssignment === true, 'Staff has primary assignment (hasPrimaryAssignment = true)');
    assert(
      (directoryPerson?.primaryAssignment?.job_title as unknown as { name: string })?.name === 'Waiter',
      'Directory shows primary job title Waiter'
    );
    assert(
      (directoryPerson?.primaryAssignment?.department as unknown as { name: string })?.name === 'Food & Beverage',
      'Directory shows department Food & Beverage'
    );
    assert(
      (directoryPerson?.primaryAssignment?.unit as unknown as { name: string })?.name === 'Main Dining Service',
      'Directory shows unit Main Dining Service'
    );

    const reportingTree = await OrganizationService.getReportingTree(undefined, biz.id);
    assert(reportingTree.length > 0, 'Visual org reporting tree generated');

    console.log('\n--- Section 7: Idempotency & Safe Claim Retry ---');
    // Ensure re-claiming a claimed invite fails gracefully
    const retryClaim = await StaffInvitationService.claimInvitation(
      staffUser1.user.id,
      staffUser1.user.email!,
      inviteRes.rawCode!
    );
    assert(retryClaim.success === false, 'Re-claiming claimed invitation fails safely');

    // Ensure no duplicate assignments exist
    const { data: assignmentsForMem } = await admin
      .from('staff_assignments')
      .select('id')
      .eq('business_membership_id', membership1!.id)
      .eq('is_primary', true)
      .eq('status', 'active');
    assert(assignmentsForMem?.length === 1, 'Exactly one active primary assignment exists (no duplicates)');

    console.log('\n--- Section 8: Unassigned Staff Fallback ---');
    // Create invite without position
    const unassignedInviteRes = await StaffInvitationService.createInvitation(ownerUser.user.id, biz.id, {
      branchId: branch.id,
      assignedRole: 'cashier',
      expiryOption: '48h',
    });
    assert(unassignedInviteRes.success === true, 'Unassigned position invitation created successfully');

    // Create Staff User 2
    const { data: staffUser2, error: staff2Err } = await admin.auth.admin.createUser({
      email: `cashier_staff2_${testSuffix}@wsnexa.test`,
      password: `TestPassword_${testSuffix}!@#`,
      email_confirm: true,
      user_metadata: { first_name: 'Sunil', last_name: 'Silva' },
    });
    if (staff2Err || !staffUser2?.user) throw new Error(`Failed to create staff user 2: ${staff2Err?.message}`);
    cleanupUserIds.push(staffUser2.user.id);

    await admin.from('user_profiles').upsert({
      id: staffUser2.user.id,
      email: staffUser2.user.email,
      first_name: 'Sunil',
      last_name: 'Silva',
      onboarding_intent: 'staff',
      preferred_workspace: 'dashboard',
    });

    const unassignedClaimRes = await StaffInvitationService.claimInvitation(
      staffUser2.user.id,
      staffUser2.user.email!,
      unassignedInviteRes.rawCode!
    );
    assert(unassignedClaimRes.success === true, 'Unassigned invitation claimed successfully');

    const { data: membership2 } = await admin
      .from('business_memberships')
      .select('id')
      .eq('business_id', biz.id)
      .eq('user_id', staffUser2.user.id)
      .single();

    const unassignedStaffList = await OrganizationService.listOrganizationStaff(biz.id, { branchId: 'unassigned' });
    const unassignedPerson = unassignedStaffList.find((s) => s.membershipId === membership2!.id);
    assert(Boolean(unassignedPerson), 'Unassigned staff member appears in unassigned directory list');
    assert(unassignedPerson?.isUnassigned === true, 'Staff marked as isUnassigned = true');

  } finally {
    // Teardown
    console.log('\n--- Cleaning up test entities ---');
    for (const bizId of cleanupBusinessIds) {
      await admin.from('businesses').delete().eq('id', bizId);
    }
    for (const userId of cleanupUserIds) {
      await admin.auth.admin.deleteUser(userId);
    }
  }

  console.log(`\n================================================================`);
  console.log(`  Tests: ${passedAssertions} / ${totalAssertions} Passed`);
  console.log(`================================================================\n`);

  if (passedAssertions !== totalAssertions) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
