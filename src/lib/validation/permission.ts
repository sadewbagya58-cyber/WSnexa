import { z } from 'zod';

export const permissionKeyEnum = z.enum([
  // Orders
  'orders.view',
  'orders.create',
  'orders.update_status',
  'orders.cancel',
  'orders.history.view',

  // Waiter
  'waiter.access',
  'waiter.requests.view',
  'waiter.requests.manage',
  'waiter.orders.create',

  // Kitchen
  'kitchen.access',
  'kitchen.orders.view',
  'kitchen.update',

  // Cashier & Payments
  'cashier.access',
  'payments.view',
  'payments.record',
  'payments.void',
  'payments.refund',
  'receipts.print',

  // Menu Catalog
  'menu.view',
  'menu.manage', // Preserved for backward compatibility
  'menu.items.create',
  'menu.items.edit',
  'menu.price.update',
  'menu.availability.update',
  'menu.items.delete',
  'menu.categories.manage',
  'menu.modifiers.manage',

  // Dining & Tables
  'tables.view',
  'tables.manage', // Preserved for backward compatibility
  'tables.status.update',
  'tables.create',
  'tables.edit',
  'tables.delete',

  // Service Areas
  'areas.view',
  'areas.manage',

  // QR Codes & Security
  'qr.view',
  'qr.manage', // Preserved for backward compatibility
  'qr.generate',
  'qr.security.reset',

  // Reports & Analytics
  'reports.view',
  'reports.financial.view',
  'reports.export',

  // Staff & Team
  'staff.view',
  'staff.manage', // Preserved for backward compatibility
  'staff.invite',
  'staff.edit',
  'staff.suspend',
  'staff.role.assign',
  'staff.branch.assign',
  'staff.area.assign',

  // Roles & Permissions Administration
  'roles.view',
  'roles.manage',
  'permissions.override.manage',

  // Branches
  'branches.view',
  'branches.operational.manage',
  'branches.manage',

  // Business Settings
  'business.view',
  'business.settings.manage',

  // Venue Profile
  'venue_profile.view',
  'venue_profile.manage',

  // Reviews & Reputation
  'reviews.view',
  'reviews.respond',
  'reviews.moderate',
  'reputation.view',
  'reputation.export',

  // Loyalty & Rewards
  'loyalty.view',
  'loyalty.manage',
  'loyalty.rewards.manage',
  'loyalty.customers.view',
  'loyalty.points.adjust',

  // Order Security Engine
  'order_security.view',
  'order_security.manage',

  // Inventory Core (Phase 27)
  'inventory.view',
  'inventory.items.manage',
  'inventory.costs.view',
  'inventory.adjust',
  'inventory.counts.manage',
  'inventory.counts.approve',
  'inventory.waste.record',
  'inventory.transfers.manage',
  'inventory.transfers.receive',
  'inventory.locations.manage',
  'inventory.reports.view',

  // Recipes, Costing & Intelligence (Phase 28)
  'recipes.view',
  'recipes.manage',
  'recipes.costs.view',
  'purchasing.view',
  'purchasing.create',
  'purchasing.approve',
  'purchasing.receive',
  'suppliers.view',
  'suppliers.manage',
  'inventory.cogs.view',
  'inventory.menu_profitability.view',
  'inventory.settings.manage',
  'inventory.production.manage',

  // Owner Only
  'invitations.manage', // Preserved for backward compatibility
  'owner.transfer',
]);

export type PermissionKey = z.infer<typeof permissionKeyEnum>;

export const ownerOnlyPermissions: PermissionKey[] = [
  'business.settings.manage',
  'owner.transfer',
  'branches.manage',
  'order_security.manage',
  'roles.manage',
  'permissions.override.manage',
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
