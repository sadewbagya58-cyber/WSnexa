# WSNexa Phase 30 — Authorization & RBAC Architecture Audit
**Document**: `docs/phase-30-rbac-v2-audit.md`  
**Phase**: Phase 30 Step 1 — RBAC & Scope V2 Compatibility Baseline  
**Date**: August 2026  
**Status**: Authoritative Architectural Audit  

---

## 1. Executive Summary

WSNexa is transitioning from a hybrid authorization model (static role names + granular permission checks + branch boundary isolation) to an enterprise-grade **RBAC & Scope V2** model.

### The Core Principle of V2
$$\text{Authorization} = \text{Permission (WHAT)} \times \text{Scope (WHERE)}$$

- **Permission**: A discrete, machine-readable action capability (e.g., `orders.view`, `inventory.adjust`, `recipes.costs.view`, `staff.invite`).
- **Scope**: The organizational and spatial boundary where that permission is valid:
  - `ORGANIZATION`: Business-wide across all properties and branches.
  - `PROPERTY` / `BRANCH`: Specific branch location(s).
  - `DEPARTMENT`: Specific organizational department(s) (e.g., Kitchen, F&B, Finance).
  - `AREA` / `TEAM`: Specific service area, section, station, or team.
  - `SELF`: Restricted solely to records owned by or assigned to the current user.

This audit establishes the baseline across all 103 unique permissions, 5 built-in roles, custom roles, Phase 29 organizational hierarchy entities, 34 server action files, 33 server services, API routes, middleware/proxy, and Supabase RLS policies.

---

## 2. Existing Roles & Classification

WSNexa currently operates with 6 distinct classes of principals:

| Principal / Role | Classification | Authority Source | Scope Characteristics |
| :--- | :--- | :--- | :--- |
| `super_admin` | **Platform** | `user_profiles.is_super_admin = true` & `account_status = 'active'` | Global across entire platform / all tenants. Zero business RBAC entanglement. |
| `business_owner` | **Business Leadership** | `business_memberships.role = 'business_owner'` | Un-deniable business-wide authority (`ALLOW ALL` on business scope). Bypasses overrides & branch restrictions. |
| `branch_manager` | **Management** | `business_memberships.role = 'branch_manager'` + `branch_assignments` | Branch-level managerial operations. Receives extensive built-in role template permissions. |
| `supervisor` | **Management / Supervisory** | Code Preset (`ROLE_PRESETS`) | Preset template in code; maps to operational oversight permissions (menu availability, table status, sales view). |
| `cashier` | **Operational** | `business_memberships.role = 'cashier'` + `branch_assignments` | Front-of-house billing, payment recording, order settlements, receipt generation. |
| `kitchen_staff` | **Operational** | `business_memberships.role = 'kitchen_staff'` + `branch_assignments` | Back-of-house KDS ticket display, order preparation states, physical count & waste logging. |
| `waiter` | **Operational** | `business_memberships.role = 'waiter'` + `branch_assignments` + `staff_area_assignments` | Table service requests, table order creation, dining table occupancy, area-scoped filtering. |
| **Custom Role** | **Custom** | `business_memberships.custom_role_id` $\rightarrow$ `public.custom_roles` | Tenant-defined role linked to dynamic `role_permissions` grants. |
| **Customer** | **Customer** | `user_profiles.onboarding_intent = 'customer'` or `customer_profile_created_at IS NOT NULL` | B2C venue discovery, personal order history, customer loyalty points, reviews, favorites. |
| **Guest / Anonymous** | **Public** | Cryptographic tokens (`qr_visit_session`, `table_access_proof`, signed order `accessToken`) | QR digital dining cart, order placement, order status tracking. |

---

## 3. Current Permission Resolution Engine

The central permission resolution engine is implemented in `PermissionService.hasPermission` (`src/server/services/permission.service.ts`):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Fetch active membership in business_memberships          │
│    (membership_status === 'active')                        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                No / Suspended ▼
                         [ DENY ]
                               │ Active
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Is role === 'business_owner'?                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                           Yes ▼
                        [ ALLOW ] (Un-deniable Owner Authority)
                               │ No
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Is requested key in ownerOnlyPermissions?                │
│    (e.g., owner.transfer, business.settings.manage)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                           Yes ▼
                         [ DENY ]
                               │ No
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Check member_permission_overrides for membership_id      │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼ effect = 'deny'                     ▼ effect = 'allow'
         [ DENY ]                       Verify Branch Boundary
                                                  │
                                                  ▼
                                            [ ALLOW / DENY ]
                               │ No Override
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Evaluate Role Grants (role_permissions table)            │
│    - If custom_role_id != null: check custom role perms     │
│    - Else: check built-in role_key perms                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                            No ▼
                         [ DENY ]
                               │ Yes
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Verify Branch Boundary                                   │
│    (branch_assignments table for target branch_id)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                        [ ALLOW / DENY ]
```

### Key Properties & Constraints of Current Engine
1. **Owner Bypass**: `business_owner` bypasses all permission lookups, all overrides, and all branch restrictions.
2. **Explicit Deny Precedence**: Per-member `deny` overrides execute before role grants.
3. **Explicit Allow Override**: Per-member `allow` overrides bypass role template grants but still enforce `branch_assignments`.
4. **Owner-Only Guard**: Non-owners cannot be granted owner-only permissions (`business.settings.manage`, `owner.transfer`, `branches.manage`, `order_security.manage`, `roles.manage`, `permissions.override.manage`).
5. **Branch Boundary Isolation**: When `branchId` is supplied, non-owners MUST possess an active record in `branch_assignments`.

---

## 4. Current Multi-Layer Authorization Entry Points

WSNexa enforces authorization across 5 distinct architectural layers:

```
[ LAYER 1: Client UI ]
  ├── dashboard-shell.tsx (Navigation link filtering based on effective permissions)
  └── Conditional component renders (action buttons hidden based on permissions)
       │
       ▼
[ LAYER 2: Route / Proxy Layer ]
  ├── proxy.ts (Next.js 16 Edge proxy: session check & onboarding route routing)
  └── requireRoutePermission() (Server Component guard: checks route -> PermissionKey mapping)
       │
       ▼
[ LAYER 3: Server Actions ]
  ├── resolveActiveBusinessContext() (Resolves user, business, activeBranch, membership)
  └── PermissionService.hasPermission() / hardcoded role checks
       │
       ▼
[ LAYER 4: Service Layer ]
  ├── Domain services (OrderService, InventoryService, PurchasingService, etc.)
  └── Dedicated security services (OrderSecurityService, PermissionService, SuperAdminService)
       │
       ▼
[ LAYER 5: Database & RLS ]
  ├── Supabase Row-Level Security (auth_has_business_access, auth_has_branch_access)
  └── SECURITY DEFINER Stored Procedures & Atomic RPCs
```

---

## 5. Phase 29 Organizational Hierarchy Integration Audit

Phase 29 established comprehensive organizational structures. The following table maps how Phase 29 tables will be authoritative sources for Phase 30 scopes:

| Scope Level | Authoritative Phase 29 / Multi-Tenant Entities | Foreign Keys / Resolution Strategy |
| :--- | :--- | :--- |
| **`ORGANIZATION`** | `public.businesses`, `public.business_memberships` | `business_memberships.business_id = target_business_id` AND `membership_status = 'active'` |
| **`PROPERTY` / `BRANCH`** | `public.branches`, `public.branch_assignments`, `public.staff_assignments` | `staff_assignments.branch_id` OR `branch_assignments.branch_id` |
| **`DEPARTMENT`** | `public.organization_departments`, `public.staff_assignments` | `staff_assignments.department_id` with recursive ancestor resolution via `parent_department_id` |
| **`AREA` / `TEAM`** | `public.organization_units`, `public.service_areas`, `public.staff_area_assignments`, `public.staff_assignments` | `staff_assignments.unit_id` OR `staff_area_assignments.service_area_id` |
| **`SELF`** | `public.user_profiles`, `auth.users`, `public.staff_assignments` | `actor_user_id === resource.user_id` OR `resource.created_by` |

### Effective Position & Acting/Secondment Coverage in Phase 29
Phase 29 Step 3 implemented:
- `organization_assignment_absences`: Formal leave/absence tracking.
- `staff_assignments.assignment_type IN ('acting', 'secondment', 'temporary')`:
  - `acting`: Temporary coverage for a substantive manager/position during absence (`acting_for_assignment_id`, `coverage_absence_id`).
  - `secondment`: Cross-property or cross-department temporary deployment (`source_assignment_id`, `starts_at`, `ends_at`).
- `reconcile_temporary_staff_assignments()`: Automated database reconciliation function that activates/ends assignments when timestamps expire.

**Critical Phase 30 Requirement**: When a staff member is on an active `acting` assignment, their effective scope and permissions must dynamically inherit the acting position's scope without altering their permanent base membership.

---

## 6. Super Admin Isolation Verification

The Super Admin system (`src/server/auth/super-admin.ts`, `src/server/actions/super-admin.ts`, `migrations/20260815000000_super_admin_system_and_security.sql`) is completely isolated:

1. **Identity & Authority**: Verified exclusively via `user_profiles.is_super_admin === true` and `user_profiles.account_status === 'active'`.
2. **Zero RBAC Overlap**: Super Admins do NOT possess business roles (`business_owner`, `branch_manager`, etc.) in tenant spaces.
3. **Dedicated Guard**: Server-side `requireSuperAdmin()` uses `createAdminClient()` and `React.cache()` to verify session and flag.
4. **Platform Actions**: Platform settings, global metrics, tenant provisioning, system kill switch, and platform audit logs are restricted exclusively to Super Admins.
5. **Tenant Impersonation / Cross-Tenant**: Super Admins cannot execute business operational actions (e.g. order placement, kitchen updates) without an explicit tenant session.

---

## 7. Customer & Guest Isolation Verification

1. **Customer Authority**:
   - Customers have `user_profiles.onboarding_intent = 'customer'`.
   - Access is restricted to `app/(customer)/` routes (`/customer`, `/customer/orders`, `/customer/loyalty`, `/customer/reviews`, `/customer/favorites`, `/customer/profile`).
   - Customer mutations (review submission, favorite toggle, profile edit, order claiming) verify `user.id === target_user_id` via Supabase RLS and server actions.
2. **Guest / Public Ordering Authority**:
   - Guests have no `auth.uid()`.
   - Access to dining carts and menus is authorized via cryptographic token: `rawQrToken` $\rightarrow$ `token_hash` in `table_qr_codes` or `branch_qr_codes`.
   - Order submission is secured by `table_access_proof` (HMAC SHA-256 signed table token) and `qr_visit_session_id`.
   - Order tracking is secured by cryptographically random `access_token` generated at order creation.

---

## 8. Summary of Architectural Findings

1. **Strong Core Catalog**: 103 granular permission keys already exist and cover all modules (Orders, Kitchen, Cashier, Menu, Tables, Areas, QR, Reports, Staff, Roles, Branches, Business Settings, Venue Profile, Reviews, Reputation, Loyalty, Order Security, Inventory Core, Recipes, Purchasing, Organization, People).
2. **Incomplete Migration from Role Names**: While newer modules (Inventory, Purchasing, Org/People) enforce `PermissionService.hasPermission`, older legacy actions (Modifiers, Payments, Order Status, QR, Branch Payment) still check hardcoded role strings (`role !== 'business_owner' && role !== 'branch_manager'`).
3. **Missing Authorization on Peripheral Actions**: Several utility/settings actions (`branch-payment.ts`, `order-security.ts`, `recipe.ts`, `inventory-settings.ts`, `inventory-intelligence.ts`, `waiter-approval.ts`) trust client-provided IDs without verifying that the user belongs to the tenant or has permission.
4. **Readiness for Phase 30 Scope V2**: The Phase 29 hierarchy tables (`organization_departments`, `organization_units`, `organization_positions`, `staff_assignments`) are structurally sound and ready to serve as the authoritative scope backing for Phase 30.
