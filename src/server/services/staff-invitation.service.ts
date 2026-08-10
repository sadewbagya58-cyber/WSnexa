import { createAdminClient } from '@/lib/supabase/server';
import {
  generateInvitationCode,
  hashInvitationCode,
  normalizeInvitationCode,
} from '@/lib/security/invite-token';
import { CreateInvitationInput, StaffRole } from '@/lib/validation/staff-invitation';

export interface FormattedInvitation {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  invitationType: 'manager' | 'staff';
  assignedRole: StaffRole;
  invitedEmail: string | null;
  tokenPrefix: string;
  status: 'pending' | 'claimed' | 'expired' | 'revoked';
  createdBy: string;
  claimedBy: string | null;
  claimedByName?: string | null;
  expiresAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export class StaffInvitationService {
  /**
   * Creates a cryptographically secure, branch-bound manager or staff invitation code.
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
    const admin = createAdminClient();

    // 1. Verify user is active Business Owner for businessId
    const { data: ownerMem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .single();

    if (!ownerMem || ownerMem.role !== 'business_owner') {
      return { success: false, message: 'Only Business Owners can generate staff invitations.' };
    }

    // 2. Verify branch belongs to the business
    const { data: branch } = await admin
      .from('branches')
      .select('id, name')
      .eq('id', input.branchId)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .single();

    if (!branch) {
      return { success: false, message: 'Invalid or deleted branch selected.' };
    }

    // 3. Compute expiry timestamp
    const now = new Date();
    let hours = 48;
    if (input.expiryOption === '24h') hours = 24;
    if (input.expiryOption === '48h') hours = 48;
    if (input.expiryOption === '7d') hours = 168;

    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

    const invitationType = input.assignedRole === 'branch_manager' ? 'manager' : 'staff';
    const { rawCode, tokenHash, tokenPrefix } = generateInvitationCode(invitationType);

    const invitedEmail = input.invitedEmail && input.invitedEmail.trim().length > 0
      ? input.invitedEmail.trim().toLowerCase()
      : null;

    // 4. Insert into staff_invitations
    const { data: inviteRow, error: insertErr } = await admin
      .from('staff_invitations')
      .insert({
        business_id: businessId,
        branch_id: input.branchId,
        invitation_type: invitationType,
        assigned_role: input.assignedRole,
        invited_email: invitedEmail,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
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

    // 5. Log audit event
    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'invitation.created',
      target_type: 'staff_invitation',
      target_id: inviteRow.id,
      payload: {
        branch_id: input.branchId,
        assigned_role: input.assignedRole,
        invited_email: invitedEmail,
        token_prefix: tokenPrefix,
        expires_at: expiresAt,
      },
    });

    const formatted: FormattedInvitation = {
      id: inviteRow.id,
      businessId: inviteRow.business_id,
      branchId: inviteRow.branch_id,
      branchName: branch.name,
      invitationType: inviteRow.invitation_type,
      assignedRole: inviteRow.assigned_role,
      invitedEmail: inviteRow.invited_email,
      tokenPrefix: inviteRow.token_prefix,
      status: inviteRow.status,
      createdBy: inviteRow.created_by,
      claimedBy: inviteRow.claimed_by,
      expiresAt: inviteRow.expires_at,
      claimedAt: inviteRow.claimed_at,
      revokedAt: inviteRow.revoked_at,
      createdAt: inviteRow.created_at,
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
      .select('*, businesses(*), branches(*)')
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
      // Update existing membership
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

    // Update user_profiles workspace preference
    await admin
      .from('user_profiles')
      .update({
        onboarding_intent: invite.assigned_role,
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
        claimed_by_email: userEmail,
      },
    });

    // Resolve target route
    let targetRoute = '/dashboard';
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

    return {
      success: true,
      targetRoute,
      role: invite.assigned_role as StaffRole,
    };
  }

  /**
   * Revokes an existing pending invitation.
   */
  static async revokeInvitation(
    userId: string,
    businessId: string,
    invitationId: string
  ): Promise<{ success: boolean; message?: string }> {
    const admin = createAdminClient();

    // Verify Business Owner
    const { data: ownerMem } = await admin
      .from('business_memberships')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .single();

    if (!ownerMem || ownerMem.role !== 'business_owner') {
      return { success: false, message: 'Only Business Owners can revoke invitations.' };
    }

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
    const admin = createAdminClient();

    const { data: ownerMem } = await admin
      .from('business_memberships')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .eq('membership_status', 'active')
      .single();

    if (!ownerMem || ownerMem.role !== 'business_owner') {
      return { success: false, message: 'Only Business Owners can regenerate invitations.' };
    }

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
    const { rawCode, tokenHash, tokenPrefix } = generateInvitationCode(invitationType);
    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from('staff_invitations')
      .update({
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        last_regenerated_at: now,
        updated_at: now,
      })
      .eq('id', invitationId);

    if (updateErr) {
      return { success: false, message: `Failed to regenerate invitation token: ${updateErr.message}` };
    }

    await admin.from('audit_logs').insert({
      business_id: businessId,
      actor_id: userId,
      action: 'invitation.regenerated',
      target_type: 'staff_invitation',
      target_id: invitationId,
      payload: { new_token_prefix: tokenPrefix },
    });

    return {
      success: true,
      rawCode,
      tokenPrefix,
    };
  }

  /**
   * Fetches formatted list of invitations for business dashboard.
   */
  static async listInvitations(businessId: string): Promise<FormattedInvitation[]> {
    const admin = createAdminClient();

    const { data: rows } = await admin
      .from('staff_invitations')
      .select('*, branches(name)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (!rows) return [];

    return rows.map((r) => {
      const b = r.branches as { name?: string } | null;
      return {
        id: r.id as string,
        businessId: r.business_id as string,
        branchId: r.branch_id as string,
        branchName: b?.name || 'Assigned Branch',
        invitationType: r.invitation_type as 'manager' | 'staff',
        assignedRole: r.assigned_role as StaffRole,
        invitedEmail: (r.invited_email as string) || null,
        tokenPrefix: r.token_prefix as string,
        status: r.status as 'pending' | 'claimed' | 'expired' | 'revoked',
        createdBy: r.created_by as string,
        claimedBy: (r.claimed_by as string) || null,
        expiresAt: r.expires_at as string,
        claimedAt: (r.claimed_at as string) || null,
        revokedAt: (r.revoked_at as string) || null,
        createdAt: r.created_at as string,
      };
    });
  }
}
