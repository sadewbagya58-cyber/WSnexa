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

  // Customer CRM & Guest Data (Phase 33)
  'customers.view',
  'customers.manage',
  'customers.contact_view',

  // Reservations & Dining Guest Journey (Phase 35)
  'reservations.view',
  'reservations.create',
  'reservations.manage',
  'reservations.cancel',

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

  // Organization Structure & People (Phase 29)
  'organization.view',
  'organization.manage',
  'people.view',
  'people.manage',
  'positions.manage',

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

// ====================================================================
// Phase 30 RBAC & Scope V2 Canonical Types and Schemas
// ====================================================================

export const scopeTypeEnum = z.enum([
  'ORGANIZATION',
  'PROPERTY',
  'DEPARTMENT',
  'AREA_TEAM',
  'SELF',
]);

export type ScopeType = z.infer<typeof scopeTypeEnum>;

export const grantEffectEnum = z.enum(['allow', 'deny']);
export type GrantEffect = z.infer<typeof grantEffectEnum>;

export const grantSourceEnum = z.enum([
  'role_preset',
  'custom_role',
  'member_override',
  'staff_assignment',
  'acting_delegation',
]);
export type GrantSource = z.infer<typeof grantSourceEnum>;

export const createCustomRoleSchema = z.object({
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50, 'Role name too long'),
  description: z.string().max(200, 'Description too long').optional(),
  permissions: z.array(permissionKeyEnum),
  defaultScope: scopeTypeEnum.optional(),
  maxScope: scopeTypeEnum.optional(),
});

export type CreateCustomRoleInput = z.infer<typeof createCustomRoleSchema>;

export const updateCustomRoleSchema = z.object({
  roleId: z.string().uuid('Invalid role ID'),
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50, 'Role name too long').optional(),
  description: z.string().max(200, 'Description too long').optional().nullable(),
  permissions: z.array(permissionKeyEnum).optional(),
  defaultScope: scopeTypeEnum.optional(),
  maxScope: scopeTypeEnum.optional(),
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

export const roleScopePresetSchema = z.object({
  id: z.string().uuid().optional(),
  businessId: z.string().uuid().nullable().optional(),
  roleKey: z.string().nullable().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
  defaultScope: scopeTypeEnum,
  maxScope: scopeTypeEnum,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type RoleScopePreset = z.infer<typeof roleScopePresetSchema>;

export const permissionScopeGrantSchema = z
  .object({
    id: z.string().uuid().optional(),
    businessId: z.string().uuid().nullable().optional(),
    roleKey: z.string().nullable().optional(),
    customRoleId: z.string().uuid().nullable().optional(),
    businessMembershipId: z.string().uuid().nullable().optional(),
    permissionKey: permissionKeyEnum,
    effect: grantEffectEnum.default('allow'),
    scopeType: scopeTypeEnum,
    branchId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    organizationUnitId: z.string().uuid().nullable().optional(),
    serviceAreaId: z.string().uuid().nullable().optional(),
    grantSource: grantSourceEnum.default('role_preset'),
    sourceId: z.string().uuid().nullable().optional(),
    createdBy: z.string().uuid().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scopeType === 'ORGANIZATION') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'PROPERTY') {
        return Boolean(data.branchId) && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'DEPARTMENT') {
        return Boolean(data.departmentId) && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'AREA_TEAM') {
        const hasUnit = Boolean(data.organizationUnitId);
        const hasArea = Boolean(data.serviceAreaId);
        return ((hasUnit && !hasArea) || (hasArea && !hasUnit)) && !data.branchId && !data.departmentId;
      }
      if (data.scopeType === 'SELF') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      return false;
    },
    {
      message: 'Scope target foreign keys must match scopeType (e.g. PROPERTY requires branchId, AREA_TEAM requires unit or service area, ORGANIZATION/SELF must have null targets)',
      path: ['scopeType'],
    }
  );

export type PermissionScopeGrant = z.infer<typeof permissionScopeGrantSchema>;

export const scopedMemberOverrideSchema = memberOverrideSchema
  .extend({
    scopeType: scopeTypeEnum.optional().default('PROPERTY'),
    branchId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    organizationUnitId: z.string().uuid().nullable().optional(),
    serviceAreaId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => {
      if (!data.scopeType) return true;
      if (data.scopeType === 'ORGANIZATION') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'PROPERTY') {
        return Boolean(data.branchId) && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'DEPARTMENT') {
        return Boolean(data.departmentId) && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'AREA_TEAM') {
        const hasUnit = Boolean(data.organizationUnitId);
        const hasArea = Boolean(data.serviceAreaId);
        return ((hasUnit && !hasArea) || (hasArea && !hasUnit)) && !data.branchId && !data.departmentId;
      }
      if (data.scopeType === 'SELF') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      return false;
    },
    {
      message: 'Scope target foreign keys must match scopeType for scoped member overrides',
      path: ['scopeType'],
    }
  );

export type ScopedMemberOverrideInput = z.infer<typeof scopedMemberOverrideSchema>;

export const scopeTargetSchema = z.discriminatedUnion('scopeType', [
  z.object({
    scopeType: z.literal('ORGANIZATION'),
  }),
  z.object({
    scopeType: z.literal('PROPERTY'),
    branchId: z.string().uuid('Invalid branch ID'),
  }),
  z.object({
    scopeType: z.literal('DEPARTMENT'),
    departmentId: z.string().uuid('Invalid department ID'),
  }),
  z.object({
    scopeType: z.literal('AREA_TEAM'),
    organizationUnitId: z.string().uuid('Invalid organization unit ID').optional(),
    serviceAreaId: z.string().uuid('Invalid service area ID').optional(),
  }).refine(
    (d) => (Boolean(d.organizationUnitId) !== Boolean(d.serviceAreaId)),
    { message: 'AREA_TEAM requires exactly one of organizationUnitId or serviceAreaId', path: ['organizationUnitId'] }
  ),
  z.object({
    scopeType: z.literal('SELF'),
  }),
]);

export type ScopeTargetInput = z.infer<typeof scopeTargetSchema>;

export const createScopeGrantInputSchema = z
  .object({
    roleKey: z.string().optional().nullable(),
    customRoleId: z.string().uuid('Invalid custom role ID').optional().nullable(),
    businessMembershipId: z.string().uuid('Invalid membership ID').optional().nullable(),
    permissionKey: permissionKeyEnum,
    effect: grantEffectEnum.default('allow'),
    scopeType: scopeTypeEnum,
    branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
    departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
    organizationUnitId: z.string().uuid('Invalid organization unit ID').optional().nullable(),
    serviceAreaId: z.string().uuid('Invalid service area ID').optional().nullable(),
    grantSource: grantSourceEnum.default('role_preset'),
    sourceId: z.string().uuid('Invalid source ID').optional().nullable(),
  })
  .refine(
    (data) => {
      const hasRole = Boolean(data.roleKey);
      const hasCustomRole = Boolean(data.customRoleId);
      const hasMembership = Boolean(data.businessMembershipId);
      const count = (hasRole ? 1 : 0) + (hasCustomRole ? 1 : 0) + (hasMembership ? 1 : 0);
      return count === 1;
    },
    { message: 'Scope grant must target exactly one principal: roleKey, customRoleId, or businessMembershipId', path: ['roleKey'] }
  )
  .refine(
    (data) => {
      if (data.scopeType === 'ORGANIZATION') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'PROPERTY') {
        return Boolean(data.branchId) && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'DEPARTMENT') {
        return Boolean(data.departmentId) && !data.organizationUnitId && !data.serviceAreaId;
      }
      if (data.scopeType === 'AREA_TEAM') {
        const hasUnit = Boolean(data.organizationUnitId);
        const hasArea = Boolean(data.serviceAreaId);
        return ((hasUnit && !hasArea) || (hasArea && !hasUnit)) && !data.branchId && !data.departmentId;
      }
      if (data.scopeType === 'SELF') {
        return !data.branchId && !data.departmentId && !data.organizationUnitId && !data.serviceAreaId;
      }
      return false;
    },
    { message: 'Scope target foreign keys must match scopeType', path: ['scopeType'] }
  );

export type CreateScopeGrantInput = z.infer<typeof createScopeGrantInputSchema>;

export const updateScopeGrantInputSchema = z.object({
  grantId: z.string().uuid('Invalid grant ID'),
  effect: grantEffectEnum.optional(),
  scopeType: scopeTypeEnum.optional(),
  branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  organizationUnitId: z.string().uuid('Invalid organization unit ID').optional().nullable(),
  serviceAreaId: z.string().uuid('Invalid service area ID').optional().nullable(),
});

export type UpdateScopeGrantInput = z.infer<typeof updateScopeGrantInputSchema>;

export const updateRoleScopePresetInputSchema = z
  .object({
    roleKey: z.string().optional().nullable(),
    customRoleId: z.string().uuid('Invalid custom role ID').optional().nullable(),
    defaultScope: scopeTypeEnum,
    maxScope: scopeTypeEnum,
  })
  .refine(
    (d) => Boolean(d.roleKey) !== Boolean(d.customRoleId),
    { message: 'Preset must target either roleKey or customRoleId (XOR)' }
  );

export type UpdateRoleScopePresetInput = z.infer<typeof updateRoleScopePresetInputSchema>;

export const convertLegacyOverrideSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  permissionKey: permissionKeyEnum,
  scopeType: scopeTypeEnum,
  branchId: z.string().uuid('Invalid branch ID').optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  organizationUnitId: z.string().uuid('Invalid organization unit ID').optional().nullable(),
  serviceAreaId: z.string().uuid('Invalid service area ID').optional().nullable(),
});

export type ConvertLegacyOverrideInput = z.infer<typeof convertLegacyOverrideSchema>;

// ====================================================================
// Phase 30 Step 7 Role Governance & Lifecycle Schemas
// ====================================================================

export const cloneRoleSchema = z.object({
  sourceType: z.enum(['built_in', 'custom']),
  sourceRoleKey: z.string().optional().nullable(),
  sourceCustomRoleId: z.string().uuid('Invalid source custom role ID').optional().nullable(),
  name: z.string().min(2, 'Role name must be at least 2 characters').max(50, 'Role name too long'),
  description: z.string().max(200, 'Description too long').optional().nullable(),
  defaultScope: scopeTypeEnum.optional(),
  maxScope: scopeTypeEnum.optional(),
}).refine(
  (d) => (d.sourceType === 'built_in' ? Boolean(d.sourceRoleKey) : Boolean(d.sourceCustomRoleId)),
  { message: 'Must provide sourceRoleKey for built_in or sourceCustomRoleId for custom' }
);

export type CloneRoleInput = z.infer<typeof cloneRoleSchema>;

export const archiveCustomRoleSchema = z.object({
  roleId: z.string().uuid('Invalid custom role ID'),
  reassignToRoleKey: z.string().optional().nullable(),
  reassignToCustomRoleId: z.string().uuid('Invalid target custom role ID').optional().nullable(),
});

export type ArchiveCustomRoleInput = z.infer<typeof archiveCustomRoleSchema>;

export const restoreCustomRoleSchema = z.object({
  roleId: z.string().uuid('Invalid custom role ID'),
});

export type RestoreCustomRoleInput = z.infer<typeof restoreCustomRoleSchema>;

export const reassignRoleMembersSchema = z.object({
  fromCustomRoleId: z.string().uuid('Invalid source custom role ID').optional().nullable(),
  fromRoleKey: z.string().optional().nullable(),
  toRoleKey: z.string().optional().nullable(),
  toCustomRoleId: z.string().uuid('Invalid target custom role ID').optional().nullable(),
}).refine(
  (d) => (Boolean(d.fromCustomRoleId) || Boolean(d.fromRoleKey)) && (Boolean(d.toRoleKey) || Boolean(d.toCustomRoleId)),
  { message: 'Must specify valid source and target role identifiers' }
);

export type ReassignRoleMembersInput = z.infer<typeof reassignRoleMembersSchema>;

export const assignMemberRoleSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  builtInRole: z.enum(['business_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'waiter']).optional(),
  customRoleId: z.string().uuid('Invalid custom role ID').optional().nullable(),
});

export type AssignMemberRoleInput = z.infer<typeof assignMemberRoleSchema>;

export const roleUsageQuerySchema = z.object({
  roleKey: z.string().optional().nullable(),
  customRoleId: z.string().uuid('Invalid custom role ID').optional().nullable(),
}).refine(
  (d) => Boolean(d.roleKey) !== Boolean(d.customRoleId),
  { message: 'Must specify either roleKey or customRoleId (XOR)' }
);

export type RoleUsageQueryInput = z.infer<typeof roleUsageQuerySchema>;

