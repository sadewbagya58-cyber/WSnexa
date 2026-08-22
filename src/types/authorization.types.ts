import { ScopeType, GrantEffect, GrantSource, PermissionKey } from '@/lib/validation/permission';

export type { ScopeType, GrantEffect, GrantSource, PermissionKey };

export interface AuthorizedBranchAssignment {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  isPrimary: boolean;
  isDefault: boolean;
  status: string;
  assignedAt: string;
}

export interface EffectiveStaffAssignment {
  id: string;
  businessMembershipId: string;
  assignmentType: 'primary' | 'additional' | 'cross_property' | 'temporary' | 'acting' | 'secondment';
  status: 'active' | 'scheduled' | 'ended' | 'cancelled';
  isPrimary: boolean;
  branchId: string | null;
  departmentId: string | null;
  organizationUnitId: string | null;
  positionId: string | null;
  positionTitle?: string | null;
  startsAt: string;
  endsAt: string | null;
  sourceAssignmentId?: string | null;
  actingForAssignmentId?: string | null;
  coverageAbsenceId?: string | null;
  isActing: boolean;
  isSecondment: boolean;
}

export interface AuthorizedDepartment {
  id: string;
  name: string;
  code?: string | null;
  branchId: string | null;
  source: 'staff_assignment' | 'acting' | 'secondment' | 'business_owner';
}

export interface AuthorizedOrganizationUnit {
  id: string;
  name: string;
  unitType: string;
  departmentId: string | null;
  branchId: string | null;
  source: 'staff_assignment' | 'acting' | 'secondment' | 'business_owner';
}

export interface AuthorizedServiceArea {
  id: string;
  name: string;
  code?: string | null;
  branchId: string;
  source: 'staff_area_assignment' | 'business_owner';
}

export interface EffectivePermissionOverride {
  id: string;
  businessMembershipId: string;
  permissionKey: string;
  effect: 'allow' | 'deny';
  scopeType: ScopeType | null; // null represents legacy membership-wide override
  branchId: string | null;
  departmentId: string | null;
  organizationUnitId: string | null;
  serviceAreaId: string | null;
  createdAt: string;
}

export interface EffectiveScopeGrant {
  id: string;
  permissionKey: string;
  effect: 'allow' | 'deny';
  scopeType: ScopeType;
  branchId: string | null;
  departmentId: string | null;
  organizationUnitId: string | null;
  serviceAreaId: string | null;
  grantSource: GrantSource;
  sourceId: string | null;
}

export interface RoleScopePresetInfo {
  roleKey: string | null;
  customRoleId: string | null;
  defaultScope: ScopeType;
  maxScope: ScopeType;
}

export interface SelfIdentity {
  userId: string;
  membershipId: string;
  staffAssignmentIds: string[];
}

export interface AuthorizationContextDiagnostics {
  resolvedAt: string;
  queryCount: number;
  sources: {
    membershipSource: string;
    branchAssignmentCount: number;
    staffAssignmentCount: number;
    actingAssignmentCount: number;
    secondmentCount: number;
    rolePermissionCount: number;
    overrideCount: number;
    scopeGrantCount: number;
  };
}

export interface AuthorizationContext {
  userId: string;
  userEmail: string;

  businessId: string;
  businessName: string;
  businessSlug: string;

  membershipId: string;
  membershipRole: string;
  customRoleId: string | null;
  isBusinessOwner: boolean;

  activeBranchId: string | null;
  authorizedBranchIds: string[];
  branchAssignments: AuthorizedBranchAssignment[];

  departmentIds: string[];
  departments: AuthorizedDepartment[];

  organizationUnitIds: string[];
  organizationUnits: AuthorizedOrganizationUnit[];

  serviceAreaIds: string[];
  serviceAreas: AuthorizedServiceArea[];

  staffAssignments: EffectiveStaffAssignment[];
  actingAssignments: EffectiveStaffAssignment[];
  secondments: EffectiveStaffAssignment[];

  rolePermissions: string[];
  permissionOverrides: EffectivePermissionOverride[];
  scopeGrants: EffectiveScopeGrant[];
  roleScopePreset: RoleScopePresetInfo | null;

  selfIdentity: SelfIdentity;
  diagnostics: AuthorizationContextDiagnostics;
}

export type SupportedResourceType =
  | 'order'
  | 'inventory_item'
  | 'inventory_location'
  | 'inventory_count'
  | 'inventory_transaction'
  | 'purchase_order'
  | 'business_membership'
  | 'staff_assignment'
  | 'dining_table'
  | 'service_area'
  | 'recipe'
  | 'modifier_group'
  | 'menu_item'
  | 'branch'
  | 'department'
  | 'organization_unit'
  | 'supplier'
  | 'payment';

export interface ResourceScope {
  resourceType: SupportedResourceType;
  resourceId: string;
  businessId: string;
  branchId: string | null;
  departmentId: string | null;
  organizationUnitId: string | null;
  serviceAreaId: string | null;
  ownerUserId: string | null;
  additionalMetadata?: Record<string, unknown>;
}

export interface ResolveContextOptions {
  requestedBusinessId?: string;
  requestedBranchId?: string;
  overrideUserId?: string; // For trusted server-side tests / background tasks
  client?: unknown;
}

export interface ResolveResourceScopeOptions {
  resourceType: SupportedResourceType;
  resourceId: string;
  expectedBusinessId?: string;
  client?: unknown;
}

export type AuthorizationContextErrorCode =
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'TENANT_MISMATCH'
  | 'BRANCH_ACCESS_DENIED'
  | 'MEMBERSHIP_INACTIVE'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_RESOURCE_TYPE'
  | 'PERMISSION_DENIED'
  | 'OUTSIDE_SCOPE'
  | 'EXPLICIT_DENY'
  | 'INVALID_PERMISSION'
  | 'ROLE_NOT_FOUND'
  | 'ROLE_RESERVED'
  | 'ROLE_IN_USE'
  | 'ROLE_ARCHIVED'
  | 'ROLE_SCOPE_EXCEEDED'
  | 'ROLE_NAME_DUPLICATE'
  | 'OWNER_ROLE_PROTECTED'
  | 'SELF_ESCALATION_DENIED'
  | 'DATABASE_ERROR';

export type AuthorizationDecisionReason =
  | 'ALLOWED'
  | 'UNAUTHENTICATED'
  | 'TENANT_MISMATCH'
  | 'MEMBERSHIP_INACTIVE'
  | 'PERMISSION_MISSING'
  | 'EXPLICIT_DENY'
  | 'OUTSIDE_SCOPE'
  | 'ASSIGNMENT_INACTIVE'
  | 'ACTING_EXPIRED'
  | 'SECONDMENT_EXPIRED'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_RESOURCE_TYPE'
  | 'OWNER_POLICY_DENIED'
  | 'INVALID_PERMISSION';

export type AuthorizationDecisionSource =
  | 'owner_policy'
  | 'explicit_override'
  | 'role_permission'
  | 'scope_grant'
  | 'legacy_override'
  | 'acting_assignment'
  | 'secondment'
  | 'self_ownership'
  | 'default_deny';

export interface AuthorizationDecision {
  allowed: boolean;
  permission: string;
  reason: AuthorizationDecisionReason;
  matchedScope?: ScopeType | null;
  source?: AuthorizationDecisionSource;
  grantId?: string | null;
  overrideId?: string | null;
  assignmentId?: string | null;
  resourceScope?: ResourceScope | null;
  diagnostics?: {
    evaluatedAt: string;
    evaluationDurationMs: number;
    details?: Record<string, unknown>;
  };
}

export interface ResourceTarget {
  type: SupportedResourceType;
  id: string;
}

export interface AuthorizeOptions {
  context: AuthorizationContext;
  permission: string;
  resource?: ResourceTarget | ResourceScope | null;
}

export interface CanOptions {
  context: AuthorizationContext;
  permission: string;
  resource?: ResourceTarget | ResourceScope | null;
}

export interface RequirePermissionOptions {
  context?: AuthorizationContext; // If omitted, resolved automatically server-side
  permission: string;
  resource?: ResourceTarget | ResourceScope | null;
}

// ====================================================================
// Scope Management Domain Types (Phase 30 Step 6)
// ====================================================================

export const SCOPE_RANK: Record<ScopeType, number> = {
  SELF: 1,
  AREA_TEAM: 2,
  DEPARTMENT: 3,
  PROPERTY: 4,
  ORGANIZATION: 5,
};

export type ScopeGrantPrincipal =
  | { type: 'role'; roleKey: string }
  | { type: 'custom_role'; customRoleId: string }
  | { type: 'membership'; membershipId: string };

export type ScopeTarget =
  | { scopeType: 'ORGANIZATION' }
  | { scopeType: 'PROPERTY'; branchId: string }
  | { scopeType: 'DEPARTMENT'; departmentId: string }
  | { scopeType: 'AREA_TEAM'; organizationUnitId?: string; serviceAreaId?: string }
  | { scopeType: 'SELF' };

export interface ScopeGrantDetail {
  id: string;
  businessId: string | null;
  roleKey: string | null;
  customRoleId: string | null;
  customRoleName?: string | null;
  businessMembershipId: string | null;
  memberName?: string | null;
  memberEmail?: string | null;
  permissionKey: string;
  permissionName?: string;
  effect: GrantEffect;
  scopeType: ScopeType;
  branchId: string | null;
  branchName?: string | null;
  departmentId: string | null;
  departmentName?: string | null;
  organizationUnitId: string | null;
  organizationUnitName?: string | null;
  serviceAreaId: string | null;
  serviceAreaName?: string | null;
  grantSource: GrantSource;
  sourceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleScopePresetDetail {
  id: string;
  businessId: string | null;
  roleKey: string | null;
  roleName?: string | null;
  customRoleId: string | null;
  customRoleName?: string | null;
  defaultScope: ScopeType;
  maxScope: ScopeType;
  createdAt: string;
  updatedAt: string;
  isSystemProtected?: boolean;
}

export interface EffectiveAccessPreview {
  membershipId: string;
  userId: string;
  userEmail: string;
  memberName?: string | null;
  position?: string | null;
  primaryBranchId?: string | null;
  departmentId?: string | null;
  businessId: string;
  role: string;
  customRoleId: string | null;
  customRoleName: string | null;
  preset: RoleScopePresetInfo | null;
  rolePermissions: string[];
  scopeGrants: ScopeGrantDetail[];
  scopedOverrides: Array<{
    id: string;
    permissionKey: string;
    effect: GrantEffect;
    scopeType?: ScopeType | null;
    branchId?: string | null;
    departmentId?: string | null;
    organizationUnitId?: string | null;
    serviceAreaId?: string | null;
    targetName?: string | null;
    isAllowed?: boolean;
  }>;
  overrides?: Array<{
    id: string;
    permissionKey: string;
    effect: GrantEffect;
    scopeType?: ScopeType | null;
    branchId?: string | null;
    isAllowed?: boolean;
  }>;
  effectiveSummary: Array<{
    permissionKey: string;
    effect: GrantEffect;
    scopeType: ScopeType;
    scopeTargets: Array<{
      type: ScopeType;
      id?: string | null;
      name?: string | null;
    }>;
    source: string;
  }>;
  defaultScope?: ScopeType;
  temporaryAuthority?: {
    actingAssignments: any[];
    secondmentAssignments: any[];
    secondments?: any[];
  };
}

// ====================================================================
// Phase 30 Step 7 Role Governance Types & Canonical Templates
// ====================================================================

export type BuiltInRoleKey =
  | 'business_owner'
  | 'branch_manager'
  | 'kitchen_staff'
  | 'cashier'
  | 'waiter';

export interface BuiltInRoleTemplate {
  roleKey: BuiltInRoleKey;
  displayName: string;
  description: string;
  defaultScope: ScopeType;
  maxScope: ScopeType;
  isSystemRole: boolean;
  isOwnerRole: boolean;
  isAssignable: boolean;
  isProtected: boolean;
  sortOrder: number;
  permissions?: string[];
}

export const BUILT_IN_ROLE_TEMPLATES: Record<BuiltInRoleKey, BuiltInRoleTemplate> = {
  business_owner: {
    roleKey: 'business_owner',
    displayName: 'Business Owner',
    description: 'Full organizational administrative and operational authority across all venues and modules.',
    defaultScope: 'ORGANIZATION',
    maxScope: 'ORGANIZATION',
    isSystemRole: true,
    isOwnerRole: true,
    isAssignable: false,
    isProtected: true,
    sortOrder: 1,
  },
  branch_manager: {
    roleKey: 'branch_manager',
    displayName: 'Branch Manager',
    description: 'Operational and staff management authority for assigned property location(s).',
    defaultScope: 'PROPERTY',
    maxScope: 'PROPERTY',
    isSystemRole: true,
    isOwnerRole: false,
    isAssignable: true,
    isProtected: true,
    sortOrder: 2,
  },
  kitchen_staff: {
    roleKey: 'kitchen_staff',
    displayName: 'Kitchen Staff',
    description: 'Kitchen display access, ticket progression, order item status, and recipe production.',
    defaultScope: 'PROPERTY',
    maxScope: 'PROPERTY',
    isSystemRole: true,
    isOwnerRole: false,
    isAssignable: true,
    isProtected: true,
    sortOrder: 3,
  },
  cashier: {
    roleKey: 'cashier',
    displayName: 'Cashier',
    description: 'Point of sale billing, payment collection, receipt generation, and dining table viewing.',
    defaultScope: 'PROPERTY',
    maxScope: 'PROPERTY',
    isSystemRole: true,
    isOwnerRole: false,
    isAssignable: true,
    isProtected: true,
    sortOrder: 4,
  },
  waiter: {
    roleKey: 'waiter',
    displayName: 'Waiter',
    description: 'Dining area table orders, guest assistance calls, and table service management.',
    defaultScope: 'AREA_TEAM',
    maxScope: 'PROPERTY',
    isSystemRole: true,
    isOwnerRole: false,
    isAssignable: true,
    isProtected: true,
    sortOrder: 5,
  },
};

export interface CustomRoleDetail {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  roleKey: string;
  isActive: boolean;
  isArchived: boolean;
  defaultScope: ScopeType;
  maxScope: ScopeType;
  permissions: string[];
  assignedMembersCount?: number;
  pendingInvitationsCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleUsageInfo {
  roleIdentifier: string; // roleKey or customRoleId
  isCustomRole: boolean;
  customRoleId?: string | null;
  roleKey?: string | null;
  name: string;
  isActive: boolean;
  activeMembers: number;
  pendingInvitations: number;
  scopeGrants: number;
  canSafelyArchive: boolean;
  canSafelyDelete: boolean;
}

export interface RoleEffectiveAccessSummary {
  roleSource: 'built_in' | 'custom';
  roleKey?: string | null;
  customRoleId?: string | null;
  displayName: string;
  description?: string | null;
  defaultScope: ScopeType;
  maxScope: ScopeType;
  isProtected: boolean;
  isArchived: boolean;
  permissions: Array<{
    key: string;
    name?: string;
    category?: string;
    riskLevel?: string;
  }>;
  scopePreset: {
    defaultScope: ScopeType;
    maxScope: ScopeType;
  };
  concreteGrantsCount: number;
}

export interface FormattedPermission {
  key: PermissionKey;
  name: string;
  description: string | null;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface FormattedMemberDetail {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  customRoleId: string | null;
  customRoleName: string | null;
  membershipStatus: string;
  branchId: string | null;
  branchName: string | null;
  joinedAt: string;
  assignedAreaIds?: string[];
  assignedAreaNames?: string[];
  overrides: Array<{ permissionKey: PermissionKey; effect: 'allow' | 'deny' }>;
  effectivePermissions: PermissionKey[];
  memberName?: string;
  position?: string;
  primaryBranchId?: string;
  departmentId?: string;
  secondments?: Array<{ branchId: string; branchName?: string }>;
  isAllowed?: boolean;
}

