'use server';

import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { StaffInvitationService, FormattedInvitation } from '@/server/services/staff-invitation.service';
import {
  createInvitationSchema,
  claimInvitationSchema,
  revokeInvitationSchema,
  regenerateInvitationSchema,
  CreateInvitationInput,
  ClaimInvitationInput,
  RevokeInvitationInput,
  RegenerateInvitationInput,
} from '@/lib/validation/staff-invitation';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export async function createInvitationAction(
  formData: CreateInvitationInput
): Promise<ActionResponse<{ rawCode: string; tokenPrefix: string; invitation: FormattedInvitation }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized. Business context required.' };
  }

  const parsed = createInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid invitation payload format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await StaffInvitationService.createInvitation(
    context.user.id,
    context.business.id,
    parsed.data
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to generate staff invitation.' };
  }

  return {
    success: true,
    message: 'Invitation generated successfully.',
    data: {
      rawCode: res.rawCode!,
      tokenPrefix: res.tokenPrefix!,
      invitation: res.invitation!,
    },
  };
}

export async function claimInvitationAction(
  formData: ClaimInvitationInput
): Promise<ActionResponse<{ targetRoute: string; role: string }> & { mismatchIntent?: boolean; targetIntentNeeded?: 'branch_manager' | 'staff' }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: 'Authentication required to claim invitation.' };
  }

  const parsed = claimInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Invalid invitation code format.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const res = await StaffInvitationService.claimInvitation(
    user.id,
    user.email || '',
    parsed.data.code
  );

  if (!res.success) {
    return {
      success: false,
      message: res.message || 'Failed to claim invitation.',
      mismatchIntent: res.mismatchIntent,
      targetIntentNeeded: res.targetIntentNeeded,
    };
  }

  return {
    success: true,
    message: 'Invitation claimed successfully! Access granted.',
    data: {
      targetRoute: res.targetRoute!,
      role: res.role!,
    },
  };
}

export async function revokeInvitationAction(
  formData: RevokeInvitationInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = revokeInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid invitation ID.' };
  }

  const res = await StaffInvitationService.revokeInvitation(
    context.user.id,
    context.business.id,
    parsed.data.invitationId
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to revoke invitation.' };
  }

  return { success: true, message: 'Invitation revoked successfully.' };
}

export async function regenerateInvitationAction(
  formData: RegenerateInvitationInput
): Promise<ActionResponse<{ rawCode: string; tokenPrefix: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.user || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const parsed = regenerateInvitationSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, message: 'Invalid invitation ID.' };
  }

  const res = await StaffInvitationService.regenerateInvitation(
    context.user.id,
    context.business.id,
    parsed.data.invitationId
  );

  if (!res.success) {
    return { success: false, message: res.message || 'Failed to regenerate invitation.' };
  }

  return {
    success: true,
    message: 'Invitation code regenerated successfully.',
    data: {
      rawCode: res.rawCode!,
      tokenPrefix: res.tokenPrefix!,
    },
  };
}

export async function listInvitationsAction(): Promise<ActionResponse<FormattedInvitation[]>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.business) {
    return { success: false, message: 'Unauthorized.' };
  }

  const list = await StaffInvitationService.listInvitations(context.business.id);
  return { success: true, data: list };
}
