import { z } from 'zod';

export const staffRoleEnum = z.enum([
  'branch_manager',
  'cashier',
  'kitchen_staff',
  'waiter',
]);

export type StaffRole = z.infer<typeof staffRoleEnum>;

export const expiryOptionEnum = z.enum(['24h', '48h', '7d']);
export type ExpiryOption = z.infer<typeof expiryOptionEnum>;

export const createInvitationSchema = z.object({
  branchId: z.string().uuid('Invalid branch selected'),
  assignedRole: staffRoleEnum,
  invitedEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  expiryOption: expiryOptionEnum.default('48h'),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const claimInvitationSchema = z.object({
  code: z
    .string()
    .min(6, 'Invitation code is too short')
    .max(50, 'Invitation code is too long'),
});

export type ClaimInvitationInput = z.infer<typeof claimInvitationSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

export const regenerateInvitationSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
});

export type RegenerateInvitationInput = z.infer<typeof regenerateInvitationSchema>;
