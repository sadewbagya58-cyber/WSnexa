import { createAdminClient } from '@/lib/supabase/server';
import {
  generateInvitationCode,
  hashInvitationCode,
  normalizeInvitationCode,
  decryptInvitationCode,
} from '@/lib/security/invite-token';
import { CreateInvitationInput, StaffRole } from '@/lib/validation/staff-invitation';

export interface FormattedInvitation {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  invitationType: 'manager' | 'staff';
  assignedRole: StaffRole;
  customRoleId?: string | null;
  customRoleName?: string | null;
  scopeType?: 'ORGANIZATION' | 'PROPERTY' | 'DEPARTMENT' | 'AREA_TEAM' | 'SELF' | null;
  departmentId?: string | null;
  departmentName?: string | null;
  positionId?: string | null;
  positionCode?: string | null;
  positionName?: string | null;
  jobTitleId?: string | null;
  jobTitleName?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  assignmentLabel?: string;
  invitedEmail: string | null;
  tokenPrefix: string;
  rawCode?: string | null;
  status: 'pending' | 'claimed' | 'expired' | 'revoked';
  createdBy: string;
  claimedBy: string | null;
  claimedByName?: string | null;
  expiresAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  serviceAreaIds?: string[];
  serviceAreaNames?: string[];
}

export class StaffInvitationService {
  /**
   * Creates a cryptographically secure, scope-aware manager or staff invitation code.
   */
  static async createInvitation(
    userId: string,
    businessId: string,
    input: CreateInvitationInput
  ): Promise<{
    success: boolean;
    message?: string;
    rawCode?: string;
    tokenPrefix?: string;
    invitation?: FormattedInvitation;
  }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    const { validateMaxScope, validateAdministrativeReach } = await import('@/server/auth/scope-target-validator');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext({ overrideUserId: userId, requestedBusinessId: businessId });
    } catch {
      return { success: false, message: 'Unauthorized session.' };
    }

    if (!authContext || authContext.businessId !== businessId) {
      return { success: false, message: 'Unauthorized business context.' };
    }

    const branchResource = input.branchId ? { type: 'branch' as const, id: input.branchId } : undefined;
    const canInvite =
      (await can({ context: authContext, permission: 'staff.invite', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'staff.manage', resource: branchResource }));

    if (!canInvite) {
      return { success: false, message: 'Forbidden. Staff invitation permission required.' };
    }

    const { SubscriptionService } = await import('./subscription.service');
    const limitRes = await SubscriptionService.validateLimit(businessId, 'staff');
    if (!limitRes.allowed) {
      return {
        success: false,
        message: limitRes.message || `Active staff limit reached (${limitRes.effectiveLimit}). Upgrade your plan to invite more staff.`,
      };
    }

    const admin = createAdminClient();

    // 2. Custom Role & Scope Preset Resolution
    let customRoleName: string | null = null;
    let effectiveScope: 'ORGANIZATION' | 'PROPERTY' | 'DEPARTMENT' | 'AREA_TEAM' | 'SELF' = 'PROPERTY';
    let targetMaxScope: 'ORGANIZATION' | 'PROPERTY' | 'DEPARTMENT' | 'AREA_TEAM' | 'SELF' = 'PROPERTY';

    if (input.customRoleId) {
      const { data: customRole } = await admin
        .from('custom_roles')
        .select('id, name, is_active, role_scope_presets(default_scope, max_scope)')
        .eq('id', input.customRoleId)
        .eq('business_id', businessId)
        .maybeSingle();

      if (!customRole) {
        return { success: false, message: 'Custom role not found in this business.' };
      }

      if (!customRole.is_active) {
        return { success: false, message: 'Cannot invite with an archived or inactive custom role.' };
      }

      customRoleName = customRole.name;
      const preset = (customRole.role_scope_presets && customRole.role_scope_presets[0]) || {
        default_scope: 'PROPERTY' as const,
        max_scope: 'PROPERTY' as const,
      };

      targetMaxScope = preset.max_scope;
      effectiveScope = input.scopeType || preset.default_scope || 'PROPERTY';

      // Enforce role maximum scope ceiling
      try {
        validateMaxScope(targetMaxScope, effectiveScope);
      } catch (err: unknown) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Requested scope exceeds custom role maximum allowed scope.',
        };
      }
    } else {
      effectiveScope = input.scopeType || 'PROPERTY';
    }

    // 2b. Validate Inviter Authority (Administrative Reach)
    try {
      validateAdministrativeReach({
        actorContext: authContext,
        requestedScope: effectiveScope,
        targetBranchId: input.branchId || undefined,
        targetDepartmentId: input.departmentId || undefined,
        targetServiceAreaId: input.serviceAreaIds?.[0],
      });
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Forbidden: Actor lacks authority to delegate the requested scope.',
      };
    }

    // 3. Resolve Target Branch & Department
    let effectiveBranchId = input.branchId || null;
    let effectiveBranchName = 'Organization Wide';
    let departmentName: string | null = null;

    if (effectiveScope === 'ORGANIZATION') {
      if (effectiveBranchId) {
        const { data: b } = await admin
          .from('branches')
          .select('id, name')
          .eq('id', effectiveBranchId)
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .maybeSingle();
        if (!b) {
          return { success: false, message: 'Invalid branch selected.' };
        }
        effectiveBranchName = b.name;
      } else {
        const { data: defaultBranch } = await admin
          .from('branches')
          .select('id, name')
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!defaultBranch) {
          return { success: false, message: 'No active branch found in business.' };
        }
        effectiveBranchId = defaultBranch.id;
        effectiveBranchName = 'All Branches';
      }
    } else if (effectiveScope === 'DEPARTMENT') {
      if (!input.departmentId) {
        return { success: false, message: 'Department is required for department-scoped invitations.' };
      }
      const { data: dept } = await admin
        .from('organization_departments')
        .select('id, name, branch_id, is_active')
        .eq('id', input.departmentId)
        .eq('business_id', businessId)
        .is('archived_at', null)
        .maybeSingle();

      if (!dept || !dept.is_active) {
        return { success: false, message: 'Invalid or inactive department selected.' };
      }
      departmentName = dept.name;

      if (dept.branch_id) {
        if (effectiveBranchId && effectiveBranchId !== dept.branch_id) {
          return { success: false, message: 'Department does not belong to the selected branch.' };
        }
        effectiveBranchId = dept.branch_id;
      }

      if (!effectiveBranchId) {
        const { data: defaultBranch } = await admin
          .from('branches')
          .select('id, name')
          .eq('business_id', businessId)
          .is('deleted_at', null)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();
        effectiveBranchId = defaultBranch?.id || null;
      }

      const { data: b } = await admin
        .from('branches')
        .select('name')
        .eq('id', effectiveBranchId!)
        .maybeSingle();
      effectiveBranchName = b?.name || 'Assigned Branch';
    } else {
      // PROPERTY, AREA_TEAM, or built-in operational role
      if (!effectiveBranchId) {
        return { success: false, message: 'Please select a branch.' };
      }
      const { data: b } = await admin
        .from('branches')
        .select('id, name')
        .eq('id', effectiveBranchId)
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!b) {
        return { success: false, message: 'Invalid or deleted branch selected.' };
      }
      effectiveBranchName = b.name;
    }

    // 3b. Organization Position Validation & Resolution
    let positionId: string | null = null;
    let positionCode: string | null = null;
    let positionJobTitleId: string | null = null;
    let positionJobTitleName: string | null = null;
    let positionUnitId: string | null = null;
    let positionUnitName: string | null = null;

    if (input.positionId) {
      const { data: pos } = await admin
        .from('organization_positions')
        .select(`
          id,
          position_code,
          name_override,
          branch_id,
          department_id,
          unit_id,
          job_title_id,
          status,
          headcount_limit,
          is_active,
          job_title:organization_job_titles(id, name, code),
          department:organization_departments(id, name),
          unit:organization_units(id, name),
          branch:branches(id, name)
        `)
        .eq('id', input.positionId)
        .eq('business_id', businessId)
        .is('archived_at', null)
        .maybeSingle();

      if (!pos || !pos.is_active) {
        return { success: false, message: 'Invalid, archived, or inactive organization position selected.' };
      }

      if (pos.status === 'frozen' || pos.status === 'archived') {
        return { success: false, message: `Target position is ${pos.status} and cannot accept new staff assignments.` };
      }

      // Check position occupancy
      const { OrganizationService } = await import('./organization.service');
      const occ = await OrganizationService.getPositionOccupancy(pos.id);
      if (occ.isFull) {
        return {
          success: false,
          message: `Target position ${pos.position_code || ''} has reached maximum headcount limit (${occ.occupiedCount} / ${occ.headcountLimit} occupied).`,
        };
      }

      positionId = pos.id;
      positionCode = pos.position_code || null;
      const jt = (Array.isArray(pos.job_title) ? pos.job_title[0] : pos.job_title) as { id?: string; name?: string } | null;
      const dept = (Array.isArray(pos.department) ? pos.department[0] : pos.department) as { id?: string; name?: string } | null;
      const unit = (Array.isArray(pos.unit) ? pos.unit[0] : pos.unit) as { id?: string; name?: string } | null;
      const b = (Array.isArray(pos.branch) ? pos.branch[0] : pos.branch) as { id?: string; name?: string } | null;

      positionJobTitleId = pos.job_title_id;
      positionJobTitleName = jt?.name || null;
      positionUnitId = pos.unit_id || null;
      positionUnitName = unit?.name || null;

      if (pos.department_id) {
        input.departmentId = pos.department_id;
        departmentName = dept?.name || departmentName;
      }
      if (pos.branch_id) {
        effectiveBranchId = pos.branch_id;
        effectiveBranchName = b?.name || effectiveBranchName;
      }
    }

    // 4. Service Area Validation
    let reqAreas = input.serviceAreaIds;
    if (input.assignedRole === 'waiter' && !input.customRoleId) {
      if (reqAreas && reqAreas.length === 0) {
        return { success: false, message: 'At least one Service Area is required when inviting a Waiter.' };
      }
      if (!reqAreas && effectiveBranchId) {
        const { data: existingAreas } = await admin
          .from('service_areas')
          .select('id')
          .eq('business_id', businessId)
          .eq('branch_id', effectiveBranchId)
          .eq('is_active', true)
          .is('deleted_at', null);

        if (existingAreas && existingAreas.length > 0) {
          reqAreas = existingAreas.map((a: { id: string }) => a.id);
        } else {
          const { data: defaultArea } = await admin
            .from('service_areas')
            .insert({
              business_id: businessId,
              branch_id: effectiveBranchId,
              name: 'Main Area',
              code: `MAIN_${Date.now().toString(36).slice(-4)}`,
              is_active: true,
            })
            .select('id')
            .single();
          if (defaultArea) {
            reqAreas = [defaultArea.id];
          }
        }
      }
    }
    const finalAreas = reqAreas || [];

    if (finalAreas.length > 0 && effectiveBranchId) {
      const { data: validAreas } = await admin
        .from('service_areas')
        .select('id, name')
        .in('id', finalAreas)
        .eq('business_id', businessId)
        .eq('branch_id', effectiveBranchId)
        .is('deleted_at', null);

      if (!validAreas || validAreas.length !== finalAreas.length) {
        return {
          success: false,
          message: 'One or more invalid or cross-branch Service Areas selected.',
        };
      }
    }

    // 5. Compute expiry timestamp
    const now = new Date();
    let hours = 48;
    if (input.expiryOption === '24h') hours = 24;
    if (input.expiryOption === '48h') hours = 48;
    if (input.expiryOption === '7d') hours = 168;

    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    const invitationType = input.assignedRole === 'branch_manager' ? 'manager' : 'staff';
    const { rawCode, tokenHash, tokenPrefix, encryptedCode } = generateInvitationCode(invitationType);

    const invitedEmail = input.invitedEmail && input.invitedEmail.trim().length > 0
      ? input.invitedEmail.trim().toLowerCase()
      : null;

    // 6. Insert into staff_invitations
    const { data: inviteRow, error: insertErr } = await admin
      .from('staff_invitations')
      .insert({
        business_id: businessId,
        branch_id: effectiveBranchId!,
        department_id: input.departmentId || null,
        position_id: positionId || null,
        unit_id: positionUnitId || null,
        job_title_id: positionJobTitleId || null,
        invitation_type: invitationType,
        assigned_role: input.assignedRole,
        custom_role_id: input.customRoleId || null,
        invited_email: invitedEmail,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_code: encryptedCode,
        status: 'pending',
        created_by: userId,
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select('*')
      .single();

    if (insertErr || !inviteRow) {
      return { success: false, message: `Failed to create invitation: ${insertErr?.message || 'DB error'}` };
    }

    // 7. Insert service area mappings if any
    let assignedAreaNames: string[] = [];
    if (finalAreas.length > 0) {
      const inviteAreaRows = finalAreas.map((areaId) => ({
        invitation_id: inviteRow.id,
        service_area_id: areaId,
        business_id: businessId,
        branch_id: effectiveBranchId!,
      }));
      const { error: inviteAreaErr } = await admin.from('staff_invitation_areas').insert(inviteAreaRows);
      if (inviteAreaErr) {
        console.error('Failed to insert staff_invitation_areas:', inviteAreaErr.message);
      }

      const { data: areaRows } = await admin
        .from('service_areas')
        .select('name')
        .in('id', finalAreas);
      assignedAreaNames = areaRows?.map((a: { name: string }) => a.name) || [];
    }

    // 8. Log audit event with comprehensive scope and position metadata
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'invitation.created',
      target_type: 'staff_invitation',
      target_id: inviteRow.id,
      payload: {
        branch_id: effectiveBranchId,
        scope_type: effectiveScope,
        department_id: input.departmentId || null,
        department_name: departmentName,
        position_id: positionId,
        position_code: positionCode,
        job_title_id: positionJobTitleId,
        job_title_name: positionJobTitleName,
        unit_id: positionUnitId,
        unit_name: positionUnitName,
        assigned_role: input.assignedRole,
        custom_role_id: input.customRoleId || null,
        invited_email: invitedEmail,
        token_prefix: tokenPrefix,
        expires_at: expiresAt,
        service_area_ids: finalAreas,
      },
    });

    let assignmentLabel = effectiveBranchName;
    if (effectiveScope === 'ORGANIZATION') {
      assignmentLabel = 'Organization Wide';
    } else if (positionCode) {
      assignmentLabel = `${effectiveBranchName} · ${positionCode}${positionJobTitleName ? ` (${positionJobTitleName})` : ''}`;
    } else if (departmentName) {
      assignmentLabel = `${effectiveBranchName} · ${departmentName}`;
    } else if (assignedAreaNames.length > 0) {
      assignmentLabel = `${effectiveBranchName} · ${assignedAreaNames.join(', ')}`;
    }

    const formatted: FormattedInvitation = {
      id: inviteRow.id,
      businessId: inviteRow.business_id,
      branchId: inviteRow.branch_id,
      branchName: effectiveBranchName,
      invitationType: inviteRow.invitation_type,
      assignedRole: inviteRow.assigned_role,
      customRoleId: inviteRow.custom_role_id || null,
      customRoleName,
      scopeType: effectiveScope,
      departmentId: input.departmentId || null,
      departmentName,
      positionId,
      positionCode,
      positionName: positionJobTitleName,
      jobTitleId: positionJobTitleId,
      jobTitleName: positionJobTitleName,
      unitId: positionUnitId,
      unitName: positionUnitName,
      assignmentLabel,
      invitedEmail: inviteRow.invited_email,
      tokenPrefix: inviteRow.token_prefix,
      rawCode: rawCode,
      status: 'pending',
      createdBy: inviteRow.created_by,
      claimedBy: null,
      expiresAt: inviteRow.expires_at,
      claimedAt: null,
      revokedAt: null,
      createdAt: inviteRow.created_at,
      serviceAreaIds: finalAreas,
      serviceAreaNames: assignedAreaNames,
    };

    return {
      success: true,
      rawCode,
      tokenPrefix,
      invitation: formatted,
    };
  }

  /**
   * Atomically claims an invitation code for an authenticated user.
   */
  static async claimInvitation(
    userId: string,
    userEmail: string,
    rawCode: string
  ): Promise<{
    success: boolean;
    message?: string;
    targetRoute?: string;
    role?: StaffRole;
    mismatchIntent?: boolean;
    targetIntentNeeded?: 'branch_manager' | 'staff';
  }> {
    const admin = createAdminClient();
    const normalized = normalizeInvitationCode(rawCode);

    if (!normalized || normalized.length < 6) {
      return { success: false, message: 'Invalid or missing invitation code.' };
    }

    const tokenHash = hashInvitationCode(normalized);

    // 1. Lookup invitation by SHA-256 token_hash
    const { data: invite, error: fetchErr } = await admin
      .from('staff_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (fetchErr || !invite) {
      return { success: false, message: 'Invalid or expired invitation code.' };
    }

    // 2. Validate Status
    if (invite.status !== 'pending') {
      if (invite.status === 'claimed') {
        return { success: false, message: 'This invitation code has already been claimed.' };
      }
      if (invite.status === 'revoked') {
        return { success: false, message: 'This invitation code has been revoked by the business owner.' };
      }
      if (invite.status === 'expired') {
        return { success: false, message: 'This invitation code has expired.' };
      }
      return { success: false, message: 'This invitation code is no longer valid.' };
    }

    // 3. Validate Expiry
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      await admin
        .from('staff_invitations')
        .update({ status: 'expired', updated_at: now.toISOString() })
        .eq('id', invite.id);
      return { success: false, message: 'This invitation code has expired.' };
    }

    // 4. Validate Email Binding if present
    if (invite.invited_email && invite.invited_email.trim().length > 0) {
      if (invite.invited_email.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
        return { success: false, message: 'This invitation cannot be claimed by this account.' };
      }
    }

    // 5. Check if target user is already a Business Owner (reject downgrade)
    const { data: existingOwnerMem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .eq('role', 'business_owner')
      .limit(1);

    if (existingOwnerMem && existingOwnerMem.length > 0) {
      return { success: false, message: 'Business Owners cannot claim staff or manager roles.' };
    }

    // 5b. Check user onboarding intent against invitation role (CRITICAL SECURITY RULE)
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('onboarding_intent')
      .eq('id', userId)
      .single();

    const userIntent = userProfile?.onboarding_intent;
    const inviteRole = (invite.assigned_role || invite.role) as string;

    if (userIntent) {
      // Rule A: Branch Manager intent MUST ONLY claim Branch Manager invitations
      if (userIntent === 'branch_manager') {
        if (inviteRole !== 'branch_manager') {
          return {
            success: false,
            message: 'This invitation is for a different account type.',
            mismatchIntent: true,
            targetIntentNeeded: 'staff',
          };
        }
      }

      // Rule B: Staff intent MUST NOT claim Branch Manager or Business Owner invitations
      if (userIntent === 'staff') {
        if (inviteRole === 'branch_manager' || inviteRole === 'business_owner') {
          return {
            success: false,
            message: 'This invitation is for a different account type.',
            mismatchIntent: true,
            targetIntentNeeded: 'branch_manager',
          };
        }
      }
    }

    // 5c. Revalidate Custom Role if invitation specifies one (Claim-time revalidation)
    if (invite.custom_role_id) {
      const { data: customRole } = await admin
        .from('custom_roles')
        .select('id, is_active, business_id')
        .eq('id', invite.custom_role_id)
        .eq('business_id', invite.business_id)
        .maybeSingle();

      if (!customRole || !customRole.is_active) {
        return {
          success: false,
          message: 'The custom role associated with this invitation has been archived or is no longer available.',
        };
      }
    }

    // 6. ATOMIC CLAIM LOCK: Mark invitation as claimed FIRST to prevent race conditions
    const { data: claimedRow, error: claimErr } = await admin
      .from('staff_invitations')
      .update({
        status: 'claimed',
        claimed_by: userId,
        claimed_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', invite.id)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (claimErr || !claimedRow) {
      return { success: false, message: 'This invitation code has already been claimed or is being claimed.' };
    }

    // 7. MEMBERSHIP & BRANCH ASSIGNMENT CREATION
    // Check if user has an existing membership in this business
    const { data: existingMem } = await admin
      .from('business_memberships')
      .select('id, role, membership_status')
      .eq('business_id', invite.business_id)
      .eq('user_id', userId)
      .single();

    let membershipId: string;

    if (existingMem) {
      // Update existing membership — reset role and custom_role_id fully
      const { data: updatedMem, error: updateMemErr } = await admin
        .from('business_memberships')
        .update({
          role: invite.assigned_role,
          custom_role_id: invite.custom_role_id || null,
          membership_status: 'active',
          updated_at: now.toISOString(),
        })
        .eq('id', existingMem.id)
        .select('id')
        .single();

      if (updateMemErr || !updatedMem) {
        return { success: false, message: 'Failed to update business membership.' };
      }
      membershipId = updatedMem.id;

      // SECURITY: Clear all old member-level permission overrides and scope grants
      // when a staff member is reassigned a new role through a fresh invitation.
      // Old overrides belonged to the previous role tenure and must not persist
      // into the new role assignment. This prevents accidental privilege escalation
      // (e.g. old explicit ALLOW cashier.access override surviving a custom-role claim).
      await admin
        .from('member_permission_overrides')
        .delete()
        .eq('business_membership_id', membershipId);

      // Also clear any membership-level (not role-key/custom-role-level) scope grants
      await admin
        .from('permission_scope_grants')
        .delete()
        .eq('business_membership_id', membershipId)
        .is('role_key', null)
        .is('custom_role_id', null);
    } else {
      // Insert new membership
      const { data: newMem, error: insertMemErr } = await admin
        .from('business_memberships')
        .insert({
          business_id: invite.business_id,
          user_id: userId,
          role: invite.assigned_role,
          custom_role_id: invite.custom_role_id || null,
          membership_status: 'active',
          joined_at: now.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select('id')
        .single();

      if (insertMemErr || !newMem) {
        return { success: false, message: `Failed to create business membership: ${insertMemErr?.message}` };
      }
      membershipId = newMem.id;
    }

    // Ensure branch_assignments record exists for this branch
    const { data: existingBranchAssign } = await admin
      .from('branch_assignments')
      .select('id')
      .eq('business_membership_id', membershipId)
      .eq('branch_id', invite.branch_id)
      .single();

    if (!existingBranchAssign) {
      await admin.from('branch_assignments').insert({
        business_membership_id: membershipId,
        branch_id: invite.branch_id,
        is_primary: true,
        created_at: now.toISOString(),
      });
    }

    // 8. STAFF AREA & DEPARTMENT ASSIGNMENTS CREATION
    let targetAreaIds: string[] = [];
    const { data: inviteAreas, error: fetchAreasErr } = await admin
      .from('staff_invitation_areas')
      .select('service_area_id')
      .eq('invitation_id', invite.id);

    if (!fetchAreasErr && inviteAreas && inviteAreas.length > 0) {
      targetAreaIds = inviteAreas.map((ia) => ia.service_area_id);
    }

    // Query audit_logs for scope metadata (department_id, service_area_ids)
    const { data: auditLog } = await admin
      .from('audit_logs')
      .select('payload')
      .eq('target_id', invite.id)
      .eq('action', 'invitation.created')
      .maybeSingle();

    const payloadData = auditLog?.payload as {
      service_area_ids?: string[];
      department_id?: string;
      scope_type?: string;
      position_id?: string;
      unit_id?: string;
      job_title_id?: string;
    } | null;
    if (targetAreaIds.length === 0 && Array.isArray(payloadData?.service_area_ids)) {
      targetAreaIds = payloadData.service_area_ids;
    }

    if (targetAreaIds.length > 0) {
      // Clear old area assignments for membership
      await admin
        .from('staff_area_assignments')
        .delete()
        .eq('business_membership_id', membershipId);

      const areaRowsToInsert = targetAreaIds.map((areaId) => ({
        business_id: invite.business_id,
        branch_id: invite.branch_id,
        service_area_id: areaId,
        business_membership_id: membershipId,
        assigned_by: invite.created_by,
        created_at: now.toISOString(),
      }));

      const { error: areaInsertErr } = await admin.from('staff_area_assignments').insert(areaRowsToInsert);
      if (areaInsertErr) {
        console.error('Failed to insert staff_area_assignments on claim:', areaInsertErr.message);
      }
    }

    // 8b. Create/Link Organization Substantive Position Assignment
    const effectivePositionId = (invite.position_id as string | undefined) || payloadData?.position_id || null;
    const effectiveDepartmentId = (invite.department_id as string | undefined) || payloadData?.department_id || null;
    const effectiveUnitId = (invite.unit_id as string | undefined) || payloadData?.unit_id || null;
    let effectiveJobTitleId = (invite.job_title_id as string | undefined) || payloadData?.job_title_id || null;

    if (effectivePositionId) {
      const { data: pos } = await admin
        .from('organization_positions')
        .select(`
          id,
          position_code,
          job_title_id,
          department_id,
          unit_id,
          branch_id,
          status,
          headcount_limit
        `)
        .eq('id', effectivePositionId)
        .eq('business_id', invite.business_id)
        .maybeSingle();

      if (pos) {
        effectiveJobTitleId = pos.job_title_id;
        const targetBranchId = pos.branch_id || invite.branch_id;
        const targetDeptId = pos.department_id || effectiveDepartmentId;
        const targetUnitId = pos.unit_id || effectiveUnitId;

        // Check if member already has an active primary assignment (idempotency guard)
        const { data: existingPrimary } = await admin
          .from('staff_assignments')
          .select('id')
          .eq('business_membership_id', membershipId)
          .eq('is_primary', true)
          .eq('status', 'active')
          .maybeSingle();

        if (existingPrimary) {
          await admin
            .from('staff_assignments')
            .update({
              business_id: invite.business_id,
              position_id: pos.id,
              job_title_id: pos.job_title_id,
              branch_id: targetBranchId,
              department_id: targetDeptId,
              unit_id: targetUnitId,
              assignment_type: 'primary',
              status: 'active',
              updated_at: now.toISOString(),
            })
            .eq('id', existingPrimary.id);
        } else {
          const { OrganizationService } = await import('./organization.service');
          try {
            await OrganizationService.createStaffAssignment(
              {
                businessId: invite.business_id,
                businessMembershipId: membershipId,
                jobTitleId: pos.job_title_id,
                branchId: targetBranchId,
                departmentId: targetDeptId,
                unitId: targetUnitId,
                positionId: pos.id,
                assignmentType: 'primary',
                isPrimary: true,
                status: 'active',
                startsAt: now.toISOString(),
                reason: 'Automatic primary assignment from staff invitation claim',
              },
              invite.created_by
            );
          } catch (assignErr) {
            console.error('Failed to create substantive staff assignment via service on claim:', assignErr);
            // Fallback direct insert
            await admin.from('staff_assignments').insert({
              business_id: invite.business_id,
              business_membership_id: membershipId,
              job_title_id: pos.job_title_id,
              branch_id: targetBranchId,
              department_id: targetDeptId,
              unit_id: targetUnitId,
              position_id: pos.id,
              assignment_type: 'primary',
              is_primary: true,
              status: 'active',
              starts_at: now.toISOString(),
              reason: 'Automatic primary assignment from staff invitation claim',
              created_at: now.toISOString(),
              updated_at: now.toISOString(),
            });
          }
        }
      }
    } else if (effectiveDepartmentId) {
      // Assign department if invitation was department-scoped
      const { data: existingStaffAssign } = await admin
        .from('staff_assignments')
        .select('id')
        .eq('business_membership_id', membershipId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingStaffAssign) {
        await admin
          .from('staff_assignments')
          .update({
            department_id: effectiveDepartmentId,
            branch_id: invite.branch_id,
            updated_at: now.toISOString(),
          })
          .eq('id', existingStaffAssign.id);
      }
    }

    // Update user_profiles workspace preference.
    // For custom-role invitations the base role ('cashier') must NOT become the onboarding_intent
    // because that would route the user to /dashboard/cashier on next login via resolveAccountRoute.
    // Use 'staff' as a neutral intent for custom-role members; their landing is resolved
    // dynamically by effective permissions in AccountService.resolveAccountRoute.
    const intentValue = invite.custom_role_id ? 'staff' : invite.assigned_role;
    await admin
      .from('user_profiles')
      .update({
        onboarding_intent: intentValue,
        preferred_workspace: 'dashboard',
      })
      .eq('id', userId);

    // Audit log
    await admin.from('audit_logs').insert({
      business_id: invite.business_id,
      actor_id: userId,
      action: 'invitation.claimed',
      target_type: 'staff_invitation',
      target_id: invite.id,
      payload: {
        branch_id: invite.branch_id,
        assigned_role: invite.assigned_role,
        custom_role_id: invite.custom_role_id || null,
        claimed_by_email: userEmail,
        department_id: payloadData?.department_id || null,
        previous_overrides_cleared: existingMem ? true : false,
      },
    });

    // Resolve target route.
    // For custom-role invitations, route to /dashboard and let permission-based
    // landing logic in resolveDashboardHomeModel determine the correct workspace CTA.
    // Do NOT route directly to /dashboard/cashier solely because base role is 'cashier'.
    let targetRoute = '/dashboard';
    if (!invite.custom_role_id) {
      switch (invite.assigned_role) {
        case 'business_owner':
        case 'branch_manager':
          targetRoute = '/dashboard';
          break;
        case 'cashier':
          targetRoute = '/dashboard/cashier';
          break;
        case 'kitchen_staff':
          targetRoute = '/dashboard/kitchen';
          break;
        case 'waiter':
          targetRoute = '/dashboard/waiter';
          break;
        default:
          targetRoute = '/dashboard';
      }
    }

    return {
      success: true,
      message: 'Invitation claimed successfully.',
      targetRoute,
      role: invite.assigned_role as StaffRole,
    };
  }

  /**
   * Helper to verify if an actor is authorized to manage staff invitations.
   */
  static async verifyStaffManagementAccess(
    userId: string,
    businessId: string
  ): Promise<{ authorized: boolean; error?: string }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext({ overrideUserId: userId, requestedBusinessId: businessId });
    } catch {
      return { authorized: false, error: 'Unauthorized session.' };
    }

    if (!authContext || authContext.businessId !== businessId) {
      return { authorized: false, error: 'Unauthorized business context.' };
    }

    const canManage =
      authContext.isBusinessOwner ||
      (await can({ context: authContext, permission: 'staff.manage' })) ||
      (await can({ context: authContext, permission: 'staff.invite' })) ||
      (await can({ context: authContext, permission: 'invitations.manage' }));

    if (!canManage) {
      return { authorized: false, error: 'Forbidden: Missing permission to manage staff.' };
    }
    return { authorized: true };
  }

  /**
   * Revokes an existing pending invitation.
   */
  static async revokeInvitation(
    userId: string,
    businessId: string,
    invitationId: string
  ): Promise<{ success: boolean; message?: string }> {
    const { authorized, error } = await this.verifyStaffManagementAccess(userId, businessId);
    if (!authorized) {
      return { success: false, message: error || 'Unauthorized to revoke invitations.' };
    }

    const admin = createAdminClient();

    const now = new Date().toISOString();
    const { error: updateErr } = await admin
      .from('staff_invitations')
      .update({
        status: 'revoked',
        revoked_at: now,
        revoked_by: userId,
        updated_at: now,
      })
      .eq('id', invitationId)
      .eq('business_id', businessId)
      .eq('status', 'pending');

    if (updateErr) {
      return { success: false, message: `Failed to revoke invitation: ${updateErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'invitation.revoked',
      target_type: 'staff_invitation',
      target_id: invitationId,
    });

    return { success: true };
  }

  /**
   * Regenerates a pending invitation token, invalidating the previous code immediately.
   */
  static async regenerateInvitation(
    userId: string,
    businessId: string,
    invitationId: string
  ): Promise<{
    success: boolean;
    message?: string;
    rawCode?: string;
    tokenPrefix?: string;
  }> {
    const { authorized, error } = await this.verifyStaffManagementAccess(userId, businessId);
    if (!authorized) {
      return { success: false, message: error || 'Unauthorized to regenerate invitations.' };
    }

    const admin = createAdminClient();

    const { data: invite } = await admin
      .from('staff_invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('business_id', businessId)
      .single();

    if (!invite || invite.status !== 'pending') {
      return { success: false, message: 'Only pending invitations can be regenerated.' };
    }

    const invitationType = invite.invitation_type;
    const { rawCode, tokenHash, tokenPrefix, encryptedCode } = generateInvitationCode(invitationType);
    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('staff_invitations')
      .update({
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        encrypted_code: encryptedCode,
        last_regenerated_at: now,
        updated_at: now,
      })
      .eq('id', invitationId)
      .eq('status', 'pending');

    if (updateErr) {
      return { success: false, message: `Failed to regenerate invitation token: ${updateErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'invitation.regenerated',
      target_type: 'staff_invitation',
      target_id: invitationId,
      payload: {
        token_prefix: tokenPrefix,
      },
      created_at: now,
    });

    return {
      success: true,
      rawCode,
      tokenPrefix,
    };
  }

  /**
   * Fetches formatted list of invitations for business dashboard with branch isolation.
   */
  static async listInvitations(businessId: string, branchId?: string | null): Promise<FormattedInvitation[]> {
      const admin = createAdminClient();

      let query = admin
        .from('staff_invitations')
        .select(`
          *,
          branches(name),
          custom_roles(id, name),
          organization_positions(
            id,
            position_code,
            name_override,
            department_id,
            unit_id,
            job_title:organization_job_titles(id, name),
            department:organization_departments(id, name),
            unit:organization_units(id, name)
          )
        `)
        .eq('business_id', businessId);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data: rows } = await query.order('created_at', { ascending: false });

      if (!rows || rows.length === 0) return [];

      const inviteIds = rows.map((r) => r.id as string);
      const [areaRowsRes, auditLogsRes] = await Promise.all([
        admin
          .from('staff_invitation_areas')
          .select('invitation_id, service_area_id, service_areas(id, name)')
          .in('invitation_id', inviteIds),
        admin
          .from('audit_logs')
          .select('target_id, payload')
          .in('target_id', inviteIds)
          .eq('action', 'invitation.created'),
      ]);

      const inviteAreaMap = new Map<string, { ids: string[]; names: string[] }>();
      if (!areaRowsRes.error && areaRowsRes.data && areaRowsRes.data.length > 0) {
        for (const ar of areaRowsRes.data) {
          const invId = ar.invitation_id as string;
          const sa = (Array.isArray(ar.service_areas) ? ar.service_areas[0] : ar.service_areas) as { id?: string; name?: string } | null;
          if (!inviteAreaMap.has(invId)) {
            inviteAreaMap.set(invId, { ids: [], names: [] });
          }
          if (sa?.id && sa?.name) {
            const entry = inviteAreaMap.get(invId)!;
            entry.ids.push(sa.id);
            entry.names.push(sa.name);
          }
        }
      }

      const inviteScopeMap = new Map<
        string,
        {
          scopeType?: string;
          departmentId?: string;
          departmentName?: string;
          positionId?: string;
          positionCode?: string;
          jobTitleName?: string;
          unitName?: string;
        }
      >();
      if (auditLogsRes.data) {
        for (const log of auditLogsRes.data) {
          const invId = log.target_id;
          const payload = log.payload as {
            scope_type?: string;
            department_id?: string;
            department_name?: string;
            position_id?: string;
            position_code?: string;
            job_title_name?: string;
            unit_name?: string;
          } | null;
          if (invId && payload) {
            inviteScopeMap.set(invId, {
              scopeType: payload.scope_type,
              departmentId: payload.department_id,
              departmentName: payload.department_name,
              positionId: payload.position_id,
              positionCode: payload.position_code,
              jobTitleName: payload.job_title_name,
              unitName: payload.unit_name,
            });
          }
        }
      }

      const now = new Date();

      return rows.map((r) => {
        const b = r.branches as { name?: string } | null;
        const cr = r.custom_roles as { id?: string; name?: string } | null;
        const pos = r.organization_positions as {
          id?: string;
          position_code?: string;
          name_override?: string | null;
          job_title?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
          department?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
          unit?: { id?: string; name?: string } | { id?: string; name?: string }[] | null;
        } | null;

        const posJt = (Array.isArray(pos?.job_title) ? pos?.job_title[0] : pos?.job_title) as { id?: string; name?: string } | null;
        const posDept = (Array.isArray(pos?.department) ? pos?.department[0] : pos?.department) as { id?: string; name?: string } | null;
        const posUnit = (Array.isArray(pos?.unit) ? pos?.unit[0] : pos?.unit) as { id?: string; name?: string } | null;

        const areaInfo = inviteAreaMap.get(r.id as string) || { ids: [], names: [] };
        const scopeInfo = inviteScopeMap.get(r.id as string);
        const isExpired = new Date(r.expires_at) <= now;
        const isValidPending = r.status === 'pending' && !isExpired;

        let decryptedCode: string | null = null;
        if (isValidPending && r.encrypted_code) {
          decryptedCode = decryptInvitationCode(r.encrypted_code);
        }

        const scopeType = (scopeInfo?.scopeType || (r.custom_role_id ? 'PROPERTY' : 'PROPERTY')) as 'ORGANIZATION' | 'PROPERTY' | 'DEPARTMENT' | 'AREA_TEAM' | 'SELF';

        const positionId = (r.position_id as string | null) || pos?.id || scopeInfo?.positionId || null;
        const positionCode = pos?.position_code || scopeInfo?.positionCode || null;
        const jobTitleName = posJt?.name || scopeInfo?.jobTitleName || null;
        const departmentName = posDept?.name || scopeInfo?.departmentName || null;
        const unitName = posUnit?.name || scopeInfo?.unitName || null;

        let assignmentLabel = b?.name || 'Assigned Branch';
        if (scopeType === 'ORGANIZATION') {
          assignmentLabel = 'Organization Wide';
        } else if (positionCode) {
          assignmentLabel = `${b?.name || 'Branch'} · ${positionCode}${jobTitleName ? ` (${jobTitleName})` : ''}`;
        } else if (departmentName) {
          assignmentLabel = `${b?.name || 'Branch'} · ${departmentName}`;
        } else if (areaInfo.names.length > 0) {
          assignmentLabel = `${b?.name || 'Branch'} · ${areaInfo.names.join(', ')}`;
        }

        return {
          id: r.id as string,
          businessId: r.business_id as string,
          branchId: r.branch_id as string,
          branchName: b?.name || 'Assigned Branch',
          invitationType: r.invitation_type as 'manager' | 'staff',
          assignedRole: r.assigned_role as StaffRole,
          customRoleId: (r.custom_role_id as string) || cr?.id || null,
          customRoleName: cr?.name || null,
          scopeType,
          departmentId: (r.department_id as string | null) || scopeInfo?.departmentId || null,
          departmentName,
          positionId,
          positionCode,
          positionName: pos?.name_override || jobTitleName,
          jobTitleId: (r.job_title_id as string | null) || posJt?.id || null,
          jobTitleName,
          unitId: (r.unit_id as string | null) || posUnit?.id || null,
          unitName,
          assignmentLabel,
          invitedEmail: (r.invited_email as string) || null,
          tokenPrefix: r.token_prefix as string,
          rawCode: decryptedCode,
          status: (isExpired && r.status === 'pending' ? 'expired' : r.status) as 'pending' | 'claimed' | 'expired' | 'revoked',
          createdBy: r.created_by as string,
          claimedBy: (r.claimed_by as string) || null,
          expiresAt: r.expires_at as string,
          claimedAt: (r.claimed_at as string) || null,
          revokedAt: (r.revoked_at as string) || null,
          createdAt: r.created_at as string,
          serviceAreaIds: areaInfo.ids,
          serviceAreaNames: areaInfo.names,
        };
      });
    }
  }
