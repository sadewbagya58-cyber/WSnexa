# Phase 30 Step 7: RBAC & Scope V2 — Role Templates, Custom Roles & Role Assignment Governance

## 1. Executive Summary

Phase 30 Step 7 establishes an enterprise-grade **Role Governance Layer** that formalizes roles as authoritative permission profiles while strictly maintaining the foundational architectural separation:

$$\begin{aligned}
\text{\textbf{ROLE / PERMISSION}} &\longrightarrow \text{\textbf{WHAT}} \text{ a person can do (Capabilities \& Authorities)} \\
\text{\textbf{SCOPE / ASSIGNMENT}} &\longrightarrow \text{\textbf{WHERE}} \text{ they can do it (Branches, Departments, Units, Service Areas)} \\
\text{\textbf{JOB TITLE / POSITION}} &\longrightarrow \text{\textbf{ORGANIZATIONAL IDENTITY}} \text{ (Org Chart, Reporting Lines, Headcount)}
\end{aligned}$$

---

## 2. Core Architectural Guarantees & Invariants

### 2.1 Protected Built-In Role Templates
- System built-in role templates (`business_owner`, `branch_manager`, `cashier`, `kitchen_staff`, `waiter`) are immutable platform definitions:
  - Cannot be renamed, deleted, converted to custom roles, or archived.
  - `business_owner` default and max scope are strictly anchored to `ORGANIZATION`.
  - Canonical permission sets are queried directly from the `permissions` and global `role_permissions` catalog.

### 2.2 Custom Role Lifecycle & Isolation
- **Creation & Uniqueness**: Custom role names are unique per tenant (`business_id`, case-insensitive). Reserved names matching built-in roles (`owner`, `manager`, `cashier`, `kitchen`, `waiter`, `super_admin`, `admin`) are strictly rejected.
- **Scope Preset Synchronization**: Creating a custom role automatically populates its `role_scope_presets` row.
- **Archival & In-Use Protection**:
  - Custom roles with active member assignments or pending staff invitations cannot be silently archived without an explicit `reassignToRoleId` target.
  - Safe archival automatically transfers active members to the reassignment target.
  - Custom roles can be cleanly restored via `restoreCustomRole`.
- **Role Cloning**: Allows deep-copying permissions and scope presets from either built-in role templates or existing custom roles into a new role without copying member assignments.

### 2.3 Privilege Escalation Ceilings & Administrative Reach
- **Non-Owner Constraints**:
  - Non-owners cannot create, clone, or elevate custom roles to `ORGANIZATION` max scope.
  - Non-owners cannot grant or clone owner-only permissions (`business.settings.manage`, `owner.transfer`, `roles.manage`, `branches.manage`, `order_security.manage`, etc.) — unauthorized permissions are automatically stripped.
  - Non-owners cannot assign the `business_owner` role, nor can they demote or modify the `business_owner`.
  - Non-owners cannot self-escalate their own role (`SELF_ESCALATION_DENIED`).
  - Non-owners cannot assign roles exceeding their administrative scope reach.
- **Super Admin Platform Decoupling**:
  - Platform permissions (`super_admin.*`) are strictly prohibited in tenant custom roles.
  - Super Admin status does not bypass tenant RBAC permissions in business domain operations.

### 2.4 Invitation Security & Claim-Time Revalidation
- Staff invitations capture target `custom_role_id`.
- Claiming an invitation dynamically re-validates the target custom role:
  - If the custom role was archived or deleted between invite creation and invite claim, the claim is strictly rejected (`ROLE_ARCHIVED`).
  - Restoring the custom role allows the invitation to be successfully claimed.

---

## 3. Implementation Summary

### 3.1 New & Extended Modules

1. **`src/types/authorization.types.ts`**:
   - Added canonical `BUILT_IN_ROLE_TEMPLATES` catalog dictionary.
   - Added `BuiltInRoleKey`, `BuiltInRoleTemplate`, `CustomRoleDetail`, `RoleUsageInfo`, `RoleEffectiveAccessSummary`.
   - Extended `AuthorizationContextErrorCode` with role governance error codes (`ROLE_NOT_FOUND`, `ROLE_RESERVED`, `ROLE_IN_USE`, `ROLE_ARCHIVED`, `ROLE_SCOPE_EXCEEDED`, `ROLE_NAME_DUPLICATE`, `OWNER_ROLE_PROTECTED`, `SELF_ESCALATION_DENIED`).

2. **`src/server/services/role-governance.service.ts`**:
   - Implemented 13 enterprise governance methods:
     - `listBuiltInRoleTemplates(businessId)`
     - `getBuiltInRoleTemplate(roleKey)`
     - `listCustomRoles(actorContext, options)`
     - `getCustomRoleById(actorContext, roleId)`
     - `createCustomRole(actorContext, input)`
     - `updateCustomRole(actorContext, roleId, input)`
     - `setCustomRolePermissions(actorContext, roleId, permissions)`
     - `cloneRole(actorContext, input)`
     - `getRoleUsage(actorContext, input)`
     - `archiveCustomRole(actorContext, input)`
     - `restoreCustomRole(actorContext, input)`
     - `reassignRoleMembers(actorContext, input)`
     - `assignMemberRole(actorContext, input)`
     - `previewRoleEffectiveAccess(actorContext, input)`
   - Integrated full append-only audit logging (`custom_role.created`, `custom_role.updated`, `custom_role.permissions_updated`, `custom_role.archived`, `custom_role.restored`, `member_role.reassigned`, `member_role.changed`).

3. **`src/server/actions/permission.ts`**:
   - Implemented 10 Next.js Server Actions connecting the frontend to `RoleGovernanceService`:
     - `listBuiltInRoleTemplatesAction`
     - `getBuiltInRoleTemplateAction`
     - `listCustomRolesAction`
     - `getCustomRoleByIdAction`
     - `createCustomRoleAction`
     - `updateCustomRoleAction`
     - `setCustomRolePermissionsAction`
     - `cloneRoleAction`
     - `getRoleUsageAction`
     - `archiveCustomRoleAction`
     - `restoreCustomRoleAction`
     - `reassignRoleMembersAction`
     - `assignMemberRoleAction`
     - `previewRoleEffectiveAccessAction`

4. **`src/server/services/staff-invitation.service.ts`**:
   - Added `custom_role_id` assignment on invitation creation.
   - Added claim-time revalidation checking custom role active status (`is_active === true`).

5. **`src/server/auth/authorization-context.ts`**:
   - Verified custom role `is_active === true` before loading custom role permissions, safely ignoring archived roles.

---

## 4. Verification Suite & Quality Assurance

### 4.1 Step 7 Live Verification Results (`scripts/verify-rbac-v2-roles.ts`)

| Section | Tests | Passed | Failed | Description |
|---|:---:|:---:|:---:|---|
| **Section 1: Built-In Role Templates & Catalog** | 6 | 6 | 0 | 5 canonical templates, owner maxScope=ORGANIZATION, branch_manager=PROPERTY, waiter=AREA_TEAM |
| **Section 2: Custom Role Creation & Lifecycle** | 8 | 8 | 0 | Tenant uniqueness, case insensitivity, reserved names, scope preset sync, list filters |
| **Section 3: Permission Bundle Management** | 6 | 6 | 0 | Atomic update, super_admin prohibition, owner-only stripping, tenant isolation |
| **Section 4: Role Scope Governance** | 6 | 6 | 0 | defaultScope > maxScope rejection, non-owner reach ceiling, audit trail |
| **Section 5: Role Assignment & Escalation Prevention** | 8 | 8 | 0 | OWNER_ROLE_PROTECTED, SELF_ESCALATION_DENIED, ROLE_ARCHIVED, reach bounds |
| **Section 6: Role / Organization Decoupling** | 5 | 5 | 0 | Position mutations do not alter RBAC roles; role changes do not mutate positions |
| **Section 7: Acting & Secondment Compatibility** | 4 | 4 | 0 | Acting coverage expands scope dynamically without mutating substantive role |
| **Section 8: Role Cloning** | 5 | 5 | 0 | Deep copy from built-in or custom, reach ceiling for non-owners, no member copying |
| **Section 9: Role Usage & Archive Protection** | 8 | 8 | 0 | In-use rejection (ROLE_IN_USE), reassignment target migration, soft delete, restore |
| **Section 10: Invitation Security & Claim Revalidation**| 3 | 3 | 0 | Claim-time check rejects archived custom roles; restored role allows claim |
| **Section 11: Effective Access Preview** | 3 | 3 | 0 | Complete permission preview across built-in and custom roles |
| **Section 12: Super Admin Platform Isolation** | 2 | 2 | 0 | super_admin.* excluded from tenant roles; platform auth decoupled |
| **Section 13: Direct Database RLS Denial** | 4 | 4 | 0 | Non-owner authenticated clients denied direct INSERT, UPDATE, DELETE on roles |
| **TOTAL** | **68** | **68** | **0** | **100% Passed** |

---

### 4.2 Full Regression Test Suite Matrix

| Suite | Command | Assertions | Status |
|---|---|:---:|:---:|
| **Role Governance Suite** | `npm run verify:rbac-v2-roles` | 68 / 68 | ✅ PASS |
| **Scope Management Suite** | `npm run verify:rbac-v2-management` | 44 / 44 | ✅ PASS |
| **Integration Suite** | `npm run verify:rbac-v2-integration` | 40 / 40 | ✅ PASS |
| **Policy Engine Suite** | `npm run verify:rbac-v2-engine` | 83 / 83 | ✅ PASS |
| **Context & Scope Suite** | `npm run verify:rbac-v2-context` | 45 / 45 | ✅ PASS |
| **Schema Foundation Suite** | `npm run verify:rbac-v2-schema` | 62 / 62 | ✅ PASS |
| **Security Baseline Suite** | `npm run verify:phase30-security-baseline` | 35 / 35 | ✅ PASS |
| **Permissions V2 Suite** | `npm run verify:permissions-v2` | 18 / 18 | ✅ PASS |
| **Organization & Hierarchy** | `npm run verify:organization` | 119 / 119 | ✅ PASS |
| **Order RPC & Security Proofs** | `npm run verify:orders` | 17 / 17 | ✅ PASS |
| **Cashier POS & Payments** | `npm run verify:payments` | 12 / 12 | ✅ PASS |
| **Menu Modifiers & Groups** | `npm run verify:modifiers` | 22 / 22 | ✅ PASS |
| **Inventory Core & Forecasting**| `npm run verify:inventory-v2` | 370 / 370 | ✅ PASS |
| **Super Admin Platform Control**| `npm run verify:super-admin` | 27 / 27 | ✅ PASS |
| **TypeScript Type Checking** | `npx tsc --noEmit` | 0 errors | ✅ PASS |
| **ESLint Static Analysis** | `npm run lint` | 0 problems | ✅ PASS |
| **Next.js Production Build** | `npm run build` | 169/169 routes | ✅ PASS |
| **GRAND TOTAL** | **17 Verification Gates** | **962 / 962** | **✅ 100% PASS** |
