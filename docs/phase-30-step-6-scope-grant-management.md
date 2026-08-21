# Phase 30 Step 6: RBAC & Scope V2 — Scope Grants & Permission Overrides Management Layer

## 1. Executive Summary

Phase 30 Step 6 implements the authoritative server-side management layer for:
1. **Role Scope Presets** (`role_scope_presets`)
2. **Permission Scope Grants** (`permission_scope_grants`)
3. **Scoped Member Permission Overrides** (`member_permission_overrides`)

### The Golden Rule of Scope Management
> **Grant configuration itself is a privileged security operation.**
> A user who can manage grants must never be able to grant authority outside:
> - Their tenant (`business_id`)
> - Their permitted administrative reach (`actorContext.authorizedBranchIds`, `authorizedDepartmentIds`, etc.)
> - The target role/member's legitimate organizational boundaries
> - The allowed maximum scope policy (`SCOPE_RANK[requestedScope] <= SCOPE_RANK[targetMaxScope]`)

---

## 2. Core Architectural Components

### 2.1 Scope Target & Administrative Reach Validator
File: `src/server/auth/scope-target-validator.ts`

- **`validateScopeTarget(params)`**:
  - Enforces database check constraint `chk_grant_scope_target_consistency`.
  - `ORGANIZATION`: zero target FKs.
  - `PROPERTY`: requires `branchId`, validates branch belongs to tenant.
  - `DEPARTMENT`: requires `departmentId`, validates department belongs to tenant.
  - `AREA_TEAM`: requires exactly one of `organizationUnitId` or `serviceAreaId` (XOR). When storing into `permission_scope_grants`, `branch_id` and `department_id` are `NULL` to satisfy the DB check constraint, while `resolvedBranchId` and `resolvedDepartmentId` are returned for reach evaluation.
  - `SELF`: zero target FKs. Logical self-ownership.
- **`validateMaxScope(params)`**:
  - Enforces hierarchy rank: `SELF (1) < AREA_TEAM (2) < DEPARTMENT (3) < PROPERTY (4) < ORGANIZATION (5)`.
  - Throws `AuthorizationContextError('OUTSIDE_SCOPE')` if requested scope exceeds the principal's max allowed scope.
- **`validateAdministrativeReach(params)`**:
  - Privilege escalation defense: non-owners cannot grant `ORGANIZATION` scope.
  - Target boundary checks: non-owners cannot grant on branches or departments outside their `authorizedBranchIds` / `authorizedDepartmentIds`.
  - Sensitive permission guard: non-owners cannot grant owner-only permissions (`owner.transfer`, `roles.manage`, `business.settings.manage`, etc.).
  - Super Admin isolation: platform permissions (`super_admin.*`) cannot be granted via tenant RBAC.

### 2.2 Scope Grant & Preset Management Service
File: `src/server/services/scope-grant.service.ts`

- **`listScopeGrants(params)`**:
  - Returns `ScopeGrantDetail[]` with joined display names from `branches`, `organization_departments`, `organization_units`, `service_areas`, `custom_roles`, and `permissions`.
- **`getScopeGrantById(businessId, grantId)`**:
  - Fetches a single grant detail.
- **`createScopeGrant(actorContext, input)`**:
  - Validates principal (`roleKey`, `customRoleId`, or `businessMembershipId`).
  - Validates target scope integrity and tenant ownership.
  - Enforces max scope rank against target presets.
  - Validates actor administrative reach.
  - Deduplicates grants; if an opposite effect grant exists on the exact same target, updates it atomically.
  - Records append-only audit event `scope_grant.created` to `audit_logs`.
- **`updateScopeGrant(actorContext, input)`**:
  - Validates existing grant and actor administrative reach.
  - Updates effect and/or target.
  - Records `scope_grant.updated` to `audit_logs`.
- **`revokeScopeGrant(actorContext, grantId)`**:
  - Validates actor reach and deletes grant row.
  - Records `scope_grant.revoked` to `audit_logs`.
- **`listRoleScopePresets(businessId)`**:
  - Returns system built-in presets (`business_id IS NULL`) overlaid with tenant-specific preset overrides.
  - Annotates `isSystemProtected` for built-in owner/role templates.
- **`updateRoleScopePreset(actorContext, input)`**:
  - Protects global built-in templates (`business_id IS NULL`) by writing tenant-specific preset overrides.
  - Prevents modifying `business_owner` max scope (`ORGANIZATION`).
  - Supports custom roles (`custom_roles`).
  - Records `role_scope_preset.updated` to `audit_logs`.
- **`previewMemberEffectiveAccess(businessId, membershipId)`**:
  - Returns `EffectiveAccessPreview` aggregating role permissions base, concrete scope grants, and scoped member overrides into an effective permission summary with sources and resolved target names.

### 2.3 Scoped Member Overrides & Legacy Conversion
File: `src/server/services/permission.service.ts`

- **`setScopedMemberOverride(actorContext, input)`**:
  - Validates target member, scope type, and target entity existence within tenant.
  - Validates actor administrative reach.
  - Upserts into `member_permission_overrides` with `scope_type`, `branch_id`, `department_id`, `organization_unit_id`, `service_area_id`.
  - Records `member_override.updated` to `audit_logs`.
- **`convertLegacyOverride(actorContext, input)`**:
  - Explicit conversion mechanism to migrate legacy unscoped overrides (`scope_type = NULL`) to V2 scoped overrides.
  - Records `legacy_override.converted` to `audit_logs`.
- **`removeMemberOverride(actorContext, membershipId, permissionKey)`**:
  - Deletes override row and logs `member_override.removed` to `audit_logs`.

### 2.4 Server Actions Layer
File: `src/server/actions/permission.ts`

Exposes safe Next.js Server Actions backed by trusted authorization context:
- `listRoleScopePresetsAction`
- `updateRoleScopePresetAction`
- `listPermissionScopeGrantsAction`
- `createPermissionScopeGrantAction`
- `updatePermissionScopeGrantAction`
- `revokePermissionScopeGrantAction`
- `setScopedMemberOverrideAction`
- `removeScopedMemberOverrideAction`
- `convertLegacyOverrideAction`
- `previewMemberEffectiveAccessAction`

---

## 3. Database RLS Hardening

Migration: `supabase/migrations/20260821000000_phase30_step6_rls_hardening.sql`

- Dropped overly-permissive client write policies on `role_scope_presets` and `permission_scope_grants`.
- Retained read policies scoped to member business access (`auth_has_business_access(business_id)`).
- Enforces that all scope mutations must proceed through the trusted server-side management layer via the Supabase Service Role client.

---

## 4. Verification Suite

Verification Script: `scripts/verify-rbac-v2-management.ts` (NPM script: `npm run verify:rbac-v2-management`)

### Test Coverage (44/44 Passed):
1. **Scope Target Validator**:
   - `ORGANIZATION` with null FKs => PASS
   - `ORGANIZATION` with branchId => REJECTED
   - `PROPERTY` with branchId => PASS
   - `PROPERTY` without branchId => REJECTED
   - Cross-tenant branch target => REJECTED
   - `DEPARTMENT` with departmentId => PASS
   - `AREA_TEAM` with unit => PASS
   - `AREA_TEAM` with serviceArea => PASS
   - `AREA_TEAM` with both unit and service area => REJECTED
   - `SELF` with null FKs => PASS
2. **Max Scope Enforcement**:
   - Rank logic: `SELF < AREA_TEAM < DEPARTMENT < PROPERTY < ORGANIZATION`
   - Scope within or equal to maxScope => PASS
   - Requesting `ORGANIZATION` grant on `PROPERTY` maxScope => REJECTED
   - Requesting `PROPERTY` grant on `DEPARTMENT` maxScope => REJECTED
3. **Administrative Reach & Privilege Escalation Prevention**:
   - Business Owner has full organizational reach => PASS
   - Property manager cannot grant `ORGANIZATION` scope => REJECTED
   - Property manager cannot grant on unassigned Branch B => REJECTED
   - Property manager can grant on assigned Branch A => PASS
   - Non-owner cannot grant sensitive owner-only permissions => REJECTED
   - Plain staff without `roles.manage` => DENIED
   - Platform Super Admin permissions cannot be granted via tenant RBAC => REJECTED
4. **Scope Grant CRUD**:
   - Create grant on `roleKey` => PASS
   - Create grant on `customRole` => PASS
   - Create grant on `businessMembershipId` => PASS
   - List grants by `roleKey` => PASS
   - Update grant effect => PASS
   - Revoke grant => PASS
   - Revoked grant no longer retrievable => PASS
   - Duplicate semantic grant handling => PASS
5. **Scoped Member Overrides & Legacy Conversion**:
   - Set scoped `ALLOW` override => PASS
   - Set scoped `DENY` override => PASS
   - Legacy unscoped override row exists (`scope_type = NULL`) => PASS
   - Explicit conversion of legacy override to V2 scoped override => PASS
   - Remove member override => PASS
6. **Role Scope Preset Management**:
   - List built-in presets => PASS
   - Business owner preset protected (`ORGANIZATION`) => PASS
   - Update custom role preset => PASS
7. **Effective Access Preview**:
   - `previewMemberEffectiveAccess` aggregates role base, scope grants, and scoped overrides => PASS
8. **Audit Trail Verification**:
   - Recorded `scope_grant.created` => PASS
   - Recorded `scope_grant.updated` => PASS
   - Recorded `scope_grant.revoked` => PASS
   - Recorded `member_override.updated` => PASS
   - Recorded `legacy_override.converted` => PASS
   - Recorded `role_scope_preset.updated` => PASS
