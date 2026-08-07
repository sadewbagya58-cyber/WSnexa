import { z } from 'zod';

export const onboardingIntentEnum = z.enum([
  'business_owner',
  'branch_manager',
  'staff',
  'customer',
]);

export const workspaceModeEnum = z.enum(['dashboard', 'customer']);

export const selectAccountTypeSchema = z.object({
  intent: onboardingIntentEnum,
});

export const updateCustomerProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name must be at least 1 character')
    .max(100, 'Display name cannot exceed 100 characters')
    .optional(),
  phone: z.string().trim().max(30, 'Phone cannot exceed 30 characters').optional().nullable(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
});

export type OnboardingIntent = z.infer<typeof onboardingIntentEnum>;
export type WorkspaceMode = z.infer<typeof workspaceModeEnum>;
export type SelectAccountTypeInput = z.infer<typeof selectAccountTypeSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
