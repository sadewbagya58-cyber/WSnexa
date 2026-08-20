# WSNexa Phase 30 Step 2 — Scope Model, Additive Schema & Compatibility Backfill
**Document**: `docs/phase-30-step-2-scope-schema.md`  
**Phase**: Phase 30 Step 2 — RBAC & Scope V2 Additive Schema Foundation  
**Date**: August 2026  
**Status**: Completed & Verified  

---

## 1. Executive Summary

Phase 30 Step 2 introduces the additive database schema foundation for **RBAC & Scope V2**, formalizing:
- **Permission = WHAT** the user can do (103 canonical permission keys preserved from Step 1).
- **Scope = WHERE** the user can do it (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`).

This foundation is 100% additive, non-destructive, and rollback-safe. It introduces `role_scope_presets`, `permission_scope_grants`, and extends `member_permission_overrides` with typed foreign key scope targets, preserving database referential integrity, cross-tenant boundary isolation, and full backward compatibility with Phase 29 organizational structures and live operational workflows.

---

## 2. Canonical Scope Vocabulary

The authorization engine recognizes five discrete, canonical scope tiers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ORGANIZATION  (Entire business tenant, all properties)   │
├─────────────────────────────────────────────────────────────┤
│ 2. PROPERTY      (Specific branch / physical venue)         │
├─────────────────────────────────────────────────────────────┤
│ 3. DEPARTMENT    (Specific department, e.g. F&B, Kitchen)   │
├─────────────────────────────────────────────────────────────┤
│ 4. AREA_TEAM     (Organizational unit or dining service area)│
├─────────────────────────────────────────────────────────────┤
│ 5. SELF          (Authenticated identity / own resources)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Schema Architecture: Why Typed Nullable Foreign Keys Over Polymorphic `scope_id`

### Rejected Alternatives

#### Alternative A: Polymorphic `(scope_type, scope_id)`
```sql
-- REJECTED
CREATE TABLE permission_scope_grants (
  ...
  scope_type TEXT,
  scope_id UUID -- Polymorphic UUID with no foreign key
);
```
- **Flaws**:
  - Zero database referential integrity (`REFERENCES` impossible on polymorphic UUID).
  - Deleting a branch or department leaves orphaned dangling scope grants.
  - Cross-tenant tampering cannot be prevented by DB constraints (e.g. referencing a department from another business).
  - Query planner cannot leverage foreign key join optimizations.

#### Alternative C: Normalized Scope Target Entity Table
```sql
-- REJECTED
CREATE TABLE authorization_scopes (
  id UUID PRIMARY KEY,
  business_id UUID,
  scope_type TEXT,
  target_id UUID
);
```
- **Flaws**:
  - Introduces duplicate shadow entities for every branch, department, unit, and service area.
  - Requires continuous synchronization triggers across all Phase 29 entities.

### Chosen Design: Typed Nullable Foreign Keys with Target Consistency Constraints (Option B)

```sql
CREATE TABLE public.permission_scope_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  role_key TEXT NULL,
  custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  business_membership_id UUID NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF')),
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE CASCADE,
  organization_unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
  service_area_id UUID NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  grant_source TEXT NOT NULL DEFAULT 'role_preset' CHECK (grant_source IN ('role_preset', 'custom_role', 'member_override', 'staff_assignment', 'acting_delegation')),
  source_id UUID NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_grant_principal CHECK (
    (role_key IS NOT NULL AND custom_role_id IS NULL AND business_membership_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NOT NULL AND business_membership_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NULL AND business_membership_id IS NOT NULL)
  ),
  CONSTRAINT chk_grant_scope_target_consistency CHECK (
    (scope_type = 'ORGANIZATION' AND branch_id IS NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'PROPERTY' AND branch_id IS NOT NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'DEPARTMENT' AND department_id IS NOT NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'AREA_TEAM' AND ((organization_unit_id IS NOT NULL AND service_area_id IS NULL) OR (service_area_id IS NOT NULL AND organization_unit_id IS NULL))) OR
    (scope_type = 'SELF' AND branch_id IS NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL)
  )
);
```

---

## 4. Exact Additive Schema Elements

### 4.1 Tables Created
1. `public.role_scope_presets`:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `business_id UUID NULL REFERENCES public.businesses(id) ON DELETE CASCADE`
   - `role_key TEXT NULL`
   - `custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE`
   - `default_scope TEXT NOT NULL CHECK (...)`
   - `max_scope TEXT NOT NULL CHECK (...)`
   - `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`

2. `public.permission_scope_grants`:
   - As detailed in Section 3.

3. `public.member_permission_overrides` (Extended):
   - Added `scope_type TEXT NULL DEFAULT 'PROPERTY'`
   - Added `branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE`
   - Added `department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE CASCADE`
   - Added `organization_unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE CASCADE`
   - Added `service_area_id UUID NULL REFERENCES public.service_areas(id) ON DELETE CASCADE`

### 4.2 Constraints & Triggers
- `chk_grant_principal`: Exactly one principal type (`role_key`, `custom_role_id`, or `business_membership_id`) per grant row.
- `chk_grant_scope_target_consistency`: Scope targets must match `scope_type` exactly.
- `trg_check_scope_grant_integrity`: Trigger validating that target branch, department, unit, service area, and custom role belong to the same `business_id`.

### 4.3 Indexes Created
- `idx_role_scope_presets_lookup` on `(business_id, role_key, custom_role_id)`
- `idx_perm_scope_grants_biz_role` on `(business_id, role_key, permission_key)`
- `idx_perm_scope_grants_custom_role` on `(custom_role_id, permission_key)`
- `idx_perm_scope_grants_membership` on `(business_membership_id, permission_key)`
- `idx_perm_scope_grants_branch` on `(branch_id)` WHERE `branch_id IS NOT NULL`
- `idx_perm_scope_grants_department` on `(department_id)` WHERE `department_id IS NOT NULL`
- `idx_perm_scope_grants_unit` on `(organization_unit_id)` WHERE `organization_unit_id IS NOT NULL`
- `idx_perm_scope_grants_service_area` on `(service_area_id)` WHERE `service_area_id IS NOT NULL`
- `idx_member_permission_overrides_scope` on `(business_membership_id, permission_key, scope_type)`

### 4.4 Row-Level Security (RLS)
- `role_scope_presets`: Read policy allows authenticated business members (`auth_has_business_access(business_id)` or `business_id IS NULL` for global templates); manage policy restricted to business members.
- `permission_scope_grants`: Read and manage policies enforced through `auth_has_business_access(business_id)`.

---

## 5. Compatibility Backfill Behavior: Separating Role Presets from Concrete Grants

### 5.1 Architectural Distinction
- **Role Scope Presets (`role_scope_presets`)**: Define the *template capability* of a role (e.g. `branch_manager` operates by default at `PROPERTY` scope, `waiter` at `AREA_TEAM` scope).
- **Permission Scope Grants (`permission_scope_grants`)**: Define *concrete authorization grants*. A `PROPERTY` grant must have a non-null `branch_id`, a `DEPARTMENT` grant must have a `department_id`, and an `AREA_TEAM` grant must have an `organization_unit_id` or `service_area_id`.

Targetless `PROPERTY`, `DEPARTMENT`, or `AREA_TEAM` grants are strictly prevented by `chk_grant_scope_target_consistency`.

### 5.2 Deterministic Backfill Rules

| Principal / Entity | Role Scope Preset | Concrete Grant Backfill in `permission_scope_grants` |
| :--- | :--- | :--- |
| **`business_owner`** | `default: ORGANIZATION`, `max: ORGANIZATION` | System-wide template grants seeded with `role_key = 'business_owner'`, `scope_type = 'ORGANIZATION'`, all foreign key targets `NULL`. |
| **`branch_manager`** | `default: PROPERTY`, `max: PROPERTY` | Concrete grants seeded for active memberships with non-null `branch_id` from their `branch_assignments`. |
| **`waiter`** | `default: AREA_TEAM`, `max: PROPERTY` | Concrete `AREA_TEAM` grants seeded for active waiters from `staff_area_assignments` (`service_area_id`); concrete `PROPERTY` grants seeded from `branch_assignments` for non-area permissions or branch-wide waiters. |
| **`kitchen_staff`** | `default: PROPERTY`, `max: PROPERTY` | Concrete `PROPERTY` grants seeded for active members from their `branch_assignments`. |
| **`cashier`** | `default: PROPERTY`, `max: PROPERTY` | Concrete `PROPERTY` grants seeded for active members from their `branch_assignments`. |
| **`custom_role`** | `default: PROPERTY`, `max: PROPERTY` | Role scope presets seeded for custom roles; concrete `PROPERTY` grants seeded for active members from `branch_assignments` joined with `role_permissions`. |
| **`member_permission_overrides`** | `default: PROPERTY` | Backfilled with `branch_id` from member's assigned branch (`scope_type = 'PROPERTY'`), or `ORGANIZATION` for owners. Unscoped overrides remain supported when `scope_type IS NULL`. |

---

## 6. Phase 29 Organization & People Integration

### AREA_TEAM Mapping
- **Organizational Units** (`organization_units`): Represent organizational teams, kitchen lines, stations, and back-of-house sections (`organization_unit_id`).
- **Service Areas** (`service_areas`): Represent dining floor sections, patios, VIP rooms, and table service zones (`service_area_id`).
- Both map cleanly into the canonical `AREA_TEAM` logical scope without conflating physical dining tables with kitchen stations.

### Acting Positions & Secondments
- Temporary assignments, acting delegations, and secondments do NOT permanently duplicate permission grants.
- Authority derives dynamically from the active, valid assignment (`staff_assignments.status = 'active'` within `starts_at` and `ends_at`).
- Schema provides `grant_source IN ('staff_assignment', 'acting_delegation')` and `source_id` to trace assignment-derived grants where needed.

### Separation of Job Title from RBAC Role
- **Job Title ≠ Authorization Role**: A CEO or General Manager job title does not bypass permission boundaries.
- Permissions remain governed strictly by RBAC roles, grants, and overrides.

---

## 7. Super Admin Isolation Invariant

- Super Admin platform authority remains completely decoupled from tenant-level `permission_scope_grants`.
- Super Admins use platform-level gates (`user_profiles.is_super_admin === true` and `requireSuperAdmin()`), operating strictly outside tenant RBAC.

---

## 8. Verification & Test Coverage

- Added test suite: `scripts/verify-rbac-v2-schema.ts`
- Registered npm script: `npm run verify:rbac-v2-schema`
- Verified:
  - 5-tier scope enumeration
  - Scope target consistency constraints
  - Role default scope presets
  - Scoped member override validation
  - SQL migration structure and DDL invariants
  - 103 canonical permission keys preserved
  - Live Supabase connectivity and schema compatibility
