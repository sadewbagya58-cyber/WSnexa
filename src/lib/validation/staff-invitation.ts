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

export const createInvitationSchema = z
  .object({
    branchId: z.string().uuid('Invalid branch selected'),
    assignedRole: staffRoleEnum,
    customRoleId: z.string().uuid('Invalid custom role ID').optional(),
    invitedEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
    expiryOption: expiryOptionEnum.default('48h'),
    serviceAreaIds: z.array(z.string().uuid('Invalid area ID')).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.assignedRole === 'waiter') {
      if (!data.serviceAreaIds || data.serviceAreaIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one Service Area is required when inviting a Waiter.',
          path: ['serviceAreaIds'],
        });
      }
    }
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
