import { ScopeType, GrantEffect, GrantSource } from '@/lib/validation/permission';

export type { ScopeType, GrantEffect, GrantSource };

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
  | 'NO_ACTIVE_MEMBERSHIP'
  | 'TENANT_MISMATCH'
  | 'BRANCH_ACCESS_DENIED'
  | 'MEMBERSHIP_INACTIVE'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_RESOURCE_TYPE'
  | 'PERMISSION_DENIED'
  | 'OUTSIDE_SCOPE'
  | 'EXPLICIT_DENY'
  | 'INVALID_PERMISSION';

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
    scopeType: ScopeType | null;
    branchId: string | null;
    departmentId: string | null;
    organizationUnitId: string | null;
    serviceAreaId: string | null;
    targetName?: string | null;
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
}
