# WSNexa Phase 30 Step 3 — Authorization Context & Trusted Scope Resolver

## Executive Summary

Phase 30 Step 3 implements the **Trusted Server-Side Authorization Context & Scope Resolution Layer** for WSNexa. It establishes the architectural foundation for Role-Based Access Control & Scope V2 (RBAC V2).

### The Golden Rule of Authorization in WSNexa
* **Permission = WHAT** the user can do (e.g., `orders.view`, `inventory.adjust`, `people.manage`).
* **Scope = WHERE** the user can do it (e.g., `ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`).
* **Context = TRUSTED INPUT** for policy evaluation.

> [!IMPORTANT]
> The browser and client requests are **untrusted**. Authorization parameters such as `userId`, `businessId`, `membershipId`, `role`, permissions, branch ownership, department boundaries, service area assignments, acting authority, and secondments are **never accepted from client claims or cookies**. All authorization context is derived server-side from the authenticated session identity and live database state.

---

## 1. Canonical Authorization Types

Located in `src/types/authorization.types.ts` and re-exported via `src/types/index.ts`:

### 1.1 `AuthorizationContext`
Represents the complete, trusted server-side authorization snapshot for a single actor in a single business tenant:

```typescript
export interface AuthorizationContext {
  userId: string;
  isSuperAdmin: boolean;
  businessId: string;
  businessName: string;
  isBusinessOwner: boolean;
  membershipId: string;
  membershipRole: UserRole;
  customRoleId: string | null;
  activeBranchId: string | null;
  authorizedBranchIds: string[];
  branchAssignments: AuthorizedBranchAssignment[];
  staffAssignments: EffectiveStaffAssignment[];
  actingAssignments: EffectiveStaffAssignment[];
  secondments: EffectiveStaffAssignment[];
  departmentIds: string[];
  departments: AuthorizedDepartment[];
  organizationUnitIds: string[];
  organizationUnits: AuthorizedOrganizationUnit[];
  serviceAreaIds: string[];
  serviceAreas: AuthorizedServiceArea[];
  rolePermissions: string[];
  permissionOverrides: EffectivePermissionOverride[];
  scopeGrants: EffectiveScopeGrant[];
  roleScopePreset: RoleScopePresetInfo | null;
  selfIdentity: SelfIdentity;
  diagnostics: AuthorizationContextDiagnostics;
}
```

### 1.2 `ResourceScope`
Represents the organizational targets and ownership of any domain entity being accessed:

```typescript
export interface ResourceScope {
  resourceType: ResourceType;
  resourceId: string;
  businessId: string;
  branchId: string | null;
  departmentId: string | null;
  organizationUnitId: string | null;
  serviceAreaId: string | null;
  ownerUserId: string | null;
}
```

---

## 2. Server-Side Context Resolver Architecture

Located in `src/server/auth/authorization-context.ts`:

### 2.1 Resolution Lifecycle
```
Authenticated User (Session / Override)
                │
                ▼
1. Fetch All Active Business Memberships for User
                │
                ▼
2. Resolve Active Business (Requested Biz vs Cookie vs Primary)
   ├── Validate Membership Status === 'active'
   └── Verify Membership belongs to Target Business
                │
                ▼
3. Execute 10 Bounded Parallel Database Queries via Admin Client:
   ├── 3.1 All active business branches
   ├── 3.2 Member branch assignments (public.branch_assignments)
   ├── 3.3 Phase 29 staff assignments (public.staff_assignments)
   ├── 3.4 Staff service area assignments (public.staff_area_assignments)
   ├── 3.5 Role permissions (built-in role + custom role)
   ├── 3.6 Member permission overrides (legacy + scoped)
   ├── 3.7 Concrete permission scope grants (member + role + custom role)
   ├── 3.8 Role scope presets (default_scope + max_scope)
   ├── 3.9 Organization departments (public.organization_departments)
   └── 3.10 Organization units (public.organization_units)
                │
                ▼
4. Temporal Evaluation & Filtering
   ├── Filter active staff assignments by starts_at <= NOW and ends_at >= NOW
   ├── Identify active acting assignments and active secondments
   └── Exclude expired temporal records
                │
                ▼
5. Compute Authorized Scopes & Fallback Active Branch
   ├── Owner: All active business branches
   ├── Staff: Assigned branches + Active secondment branches
   ├── Active Branch: requestedBranchId IF authorized ELSE fallback to default/primary
   ├── Compute Authorized Department IDs (substantive + acting + secondment)
   ├── Compute Authorized Unit IDs (substantive + acting + secondment)
   └── Compute Authorized Service Area IDs (staff area assignments + dining areas)
                │
                ▼
6. Construct SELF Identity Foundation
   ├── userId: Context user ID
   ├── membershipId: Active membership ID
   └── staffAssignmentIds: All active valid staff assignment IDs
                │
                ▼
7. Return Immutable, Trusted AuthorizationContext
```

---

## 3. Trusted Resource Scope Resolver

Located in `src/server/auth/resource-scope-resolver.ts`:

Derives organizational targets (`businessId`, `branchId`, `departmentId`, `organizationUnitId`, `serviceAreaId`, `ownerUserId`) from the database for domain resources:

| Resource Type | Underlying Database Table | Derived Scopes |
| :--- | :--- | :--- |
| `order` | `public.orders` + `public.dining_tables` | `businessId`, `branchId`, `serviceAreaId`, `ownerUserId` (`customer_user_id`) |
| `inventory_item` | `public.inventory_items` | `businessId`, `branchId = null` (organization-scoped) |
| `inventory_location` | `public.inventory_storage_locations` | `businessId`, `branchId` |
| `inventory_count` | `public.inventory_stock_counts` | `businessId`, `branchId`, `ownerUserId` (`created_by`) |
| `inventory_transaction` | `public.inventory_stock_transfers` | `businessId`, `branchId` (`source_branch_id` / `destination_branch_id`), `ownerUserId` (`created_by`) |
| `purchase_order` | `public.inventory_purchase_orders` | `businessId`, `branchId`, `ownerUserId` (`created_by`) |
| `business_membership` | `public.business_memberships` | `businessId`, `ownerUserId` (`user_id`) |
| `staff_assignment` | `public.staff_assignments` + `public.business_memberships` | `businessId`, `branchId`, `departmentId`, `organizationUnitId`, `ownerUserId` (`membership.user_id`) |
| `dining_table` | `public.dining_tables` | `businessId`, `branchId`, `serviceAreaId` |
| `service_area` | `public.service_areas` | `businessId`, `branchId` |
| `recipe` | `public.recipes` | `businessId`, `branchId`, `ownerUserId` (`created_by`) |
| `modifier_group` | `public.modifier_groups` | `businessId`, `branchId` |
| `menu_item` | `public.menu_items` | `businessId`, `branchId` |

### Security Checks in Resource Scope Resolution
1. **Cross-Tenant Assertion**: If `expectedBusinessId` is provided, any mismatch throws `AuthorizationContextError('TENANT_MISMATCH')`.
2. **Missing Resources**: Non-existent IDs throw `AuthorizationContextError('RESOURCE_NOT_FOUND')`.

---

## 4. Multi-Business & Tenant Isolation

* **Single Tenant per Context**: An actor operating across multiple businesses has separate `business_memberships` rows. The resolver isolates authority to the requested business.
* **Tampered Business Rejection**: Attempting to query or execute actions in a business where the actor has no active membership throws `AuthorizationContextError('TENANT_MISMATCH')` (HTTP 403).
* **Inactive/Suspended Rejection**: Suspended memberships throw `AuthorizationContextError('MEMBERSHIP_INACTIVE')` (HTTP 403).

---

## 5. Branch / Property Security & Tamper Resistance

* **Owner Authority**: `business_owner` automatically has `authorizedBranchIds` covering all active branches in `public.branches`.
* **Staff Authority**: Non-owners have `authorizedBranchIds` computed strictly from:
  $$\text{authorizedBranchIds} = \{\text{branch\_assignments.branch\_id}\} \cup \{\text{active secondments.branch\_id}\}$$
* **Tampered Branch Fallback**: If a client sends a `branchId` parameter or cookie that does not exist in `authorizedBranchIds`, the resolver safely and deterministically falls back to the user's primary/first authorized branch without throwing or expanding scope.

---

## 6. Phase 29 Staff Assignments, Acting & Secondments

### 6.1 Temporal Validation
Every staff assignment, acting assignment, and secondment is checked against the database server time:
$$\text{starts\_at} \le \text{NOW}() \quad \text{AND} \quad (\text{ends\_at IS NULL} \lor \text{ends\_at} \ge \text{NOW}())$$
* Expired acting delegations and secondments are strictly excluded from effective authority.
* Scheduled future assignments are excluded until their `starts_at` timestamp arrives.

### 6.2 Organization Hierarchy Resolution
* **Department Authority**: Derived from active substantive staff assignments, active acting assignments, and active secondments.
* **Unit Authority**: Derived from active substantive and acting assignments.
* **Service Area Authority**: Derived from `public.staff_area_assignments` and dining table service areas.

---

## 7. SELF Identity Model

The `selfIdentity` block in `AuthorizationContext` provides the identity foundation for `SELF`-scoped permissions:
* `userId`: The authenticated user's ID.
* `membershipId`: The user's active `business_memberships` ID.
* `staffAssignmentIds`: The set of active `staff_assignments` IDs belonging to this user.

---

## 8. Super Admin Platform Isolation

* **Strict Boundary**: Super Admin accounts have `isSuperAdmin = true`.
* **Zero RBAC Pollution**: Super Admin platform privileges are never injected into business RBAC contexts or tenant permission lists. Platform governance remains strictly segregated in `src/server/auth/super-admin.ts` and `src/server/services/super-admin.service.ts`.

---

## 9. Performance & Bounded Query Budget

* **Batch Execution**: Context resolution executes exactly **10 queries** in a single `Promise.all` batch using the Supabase admin client (11 queries for business owners who resolve all active service areas).
* **Indexed Execution**: Relies on indexes created in Step 2 (`idx_permission_scope_grants_lookup`, `idx_member_permission_overrides_scope`, etc.).
* **Diagnostic Metadata**: Records query count, resolution duration in milliseconds, and timestamp in `context.diagnostics`.

---

## 10. Structured Error Model

Located in `src/server/auth/errors.ts`:

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `UNAUTHENTICATED` | 401 | No authenticated session or valid user ID provided |
| `NO_ACTIVE_MEMBERSHIP` | 403 | User has no active business memberships |
| `TENANT_MISMATCH` | 403 | User does not have an active membership in the requested business |
| `BRANCH_ACCESS_DENIED` | 403 | User does not have authorization for the requested branch |
| `MEMBERSHIP_INACTIVE` | 403 | User membership is suspended, inactive, or archived |
| `RESOURCE_NOT_FOUND` | 404 | Target domain entity was not found in the database |
| `INVALID_RESOURCE_TYPE` | 400 | Unknown resource type requested for scope resolution |

---

## 11. Verification & Test Suite

Test suite in `scripts/verify-rbac-v2-context.ts` (`npm run verify:rbac-v2-context`):
* **45 assertions across 5 core suites**, testing:
  1. Authentication & multi-business membership resolution
  2. Active & authorized branch computation with tampered request fallback
  3. Built-in & custom role permissions, legacy unscoped & scoped overrides, and scope grants
  4. Phase 29 staff assignments, acting assignments, secondments, temporal validity filtering, departments, units, service areas, and SELF identity
  5. Trusted resource scope resolver for orders, inventory items, dining tables, cross-tenant assertion, and 404 handling

---

## 12. Non-Goals & Deferrals to Step 4

* **Policy Decision Engine (`can()` / `authorize()`)**: Step 3 provides the **context input**; policy evaluation logic is deferred to Step 4 (`AuthEngine`).
* **Server Action Migration**: Existing server actions remain compatible and will be incrementally upgraded in subsequent steps.
* **PermissionService**: Remains active as the backward-compatible authorization baseline.
