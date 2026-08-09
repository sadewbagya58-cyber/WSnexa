import { z } from 'zod';

export const permissionKeyEnum = z.enum([
  'orders.view',
  'orders.update_status',
  'orders.cancel',
  'kitchen.access',
  'kitchen.update',
  'cashier.access',
  'payments.record',
  'payments.view',
  'receipts.print',
  'waiter.requests.view',
  'waiter.requests.manage',
  'menu.view',
  'menu.manage',
  'tables.view',
  'tables.manage',
  'qr.manage',
  'staff.view',
  'staff.manage',
  'invitations.manage',
  'reports.view',
  'reports.export',
  'branches.manage',
  'business.settings.manage',
  'owner.transfer',
  'venue_profile.view',
  'venue_profile.manage',
  'reviews.view',
  'reviews.respond',
  'reviews.moderate',
  'reputation.view',
  'reputation.export',
]);

export type PermissionKey = z.infer<typeof permissionKeyEnum>;

export const ownerOnlyPermissions: PermissionKey[] = [
  'business.settings.manage',
  'owner.transfer',
];

export const createCustomRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50, 'Role name too long'),
  description: z.string().max(200, 'Description too long').optional(),
  permissions: z.array(permissionKeyEnum),
});

export type CreateCustomRoleInput = z.infer<typeof createCustomRoleSchema>;

export const updateCustomRoleSchema = createCustomRoleSchema.extend({
  roleId: z.string().uuid('Invalid role ID'),
  isActive: z.boolean().optional(),
});

export type UpdateCustomRoleInput = z.infer<typeof updateCustomRoleSchema>;

export const memberOverrideSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  permissionKey: permissionKeyEnum,
  effect: z.enum(['allow', 'deny']),
});

export type MemberOverrideInput = z.infer<typeof memberOverrideSchema>;

export const updateMemberRoleSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  builtInRole: z.enum(['business_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'waiter']),
  customRoleId: z.string().uuid('Invalid custom role ID').optional().nullable(),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const updateMemberStatusSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  status: z.enum(['active', 'suspended']),
});

export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
