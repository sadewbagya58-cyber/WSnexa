# WSNexa Phase 30 Step 7 — Role Governance & Custom Roles Architecture Audit

## 1. Executive Summary

This document performs an exhaustive audit of the existing role definitions, custom role storage, permission mappings, role scope presets, role assignments, and organization placement systems across the WSNexa codebase and live Supabase instance.

The objective is to establish an authoritative foundation for **Role Templates, Custom Roles V2, and Role Assignment Governance** in Phase 30 Step 7, strictly maintaining the core architectural principle:
* **ROLE / PERMISSION** = **WHAT** an actor can do (Capability Profile).
* **SCOPE / TARGET** = **WHERE** they can do it (Operational Boundary).
* **JOB TITLE / POSITION** = **WHO/WHERE** they are organizationally placed (Enterprise Hierarchy), **NOT** an automatic grant of authority.

---

## 2. Current Built-In Roles Catalog

From inspection of live Supabase tables (`role_permissions`, `role_scope_presets`, `business_memberships`) and codebase constants:

| Built-In Role Key | Display Name | Permissions Count | Default Scope | Max Scope | Protected Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `business_owner` | Business Owner | 25 (Global) + Owner Policy (All non-platform) | `ORGANIZATION` | `ORGANIZATION` | **PROTECTED** (Owner-level) | Cannot be deleted, archived, or demoted through generic role workflows. |
| `branch_manager` | Branch Manager | 82 | `PROPERTY` | `PROPERTY` | **PROTECTED** (System template) | Full property operational management across orders, dining, staff, inventory. |
| `kitchen_staff` | Kitchen Staff | 10 | `PROPERTY` | `PROPERTY` | **PROTECTED** (System template) | Kitchen display, ticket updates, orders view, menu view. (Canonical DB key: `kitchen_staff`). |
| `cashier` | Cashier | 10 | `PROPERTY` | `PROPERTY` | **PROTECTED** (System template) | POS billing, payment recording, order status updates, table viewing. |
| `waiter` | Waiter | 8 | `AREA_TEAM` | `PROPERTY` | **PROTECTED** (System template) | Table ordering, guest requests, menu view, dining table access. |

### Role Aliasing & Legacy Notes:
* Earlier migrations occasionally referred to `kitchen` or `supervisor`. In the live schema and `role_permissions` table, `kitchen_staff` is the canonical built-in role key.
* `business_memberships.role` column is a `TEXT` or `business_role_type` containing one of the canonical built-in roles (`business_owner`, `branch_manager`, `cashier`, `kitchen_staff`, `waiter`).
* When a custom role is active, `business_memberships.custom_role_id` points to `custom_roles.id`.

---

## 3. Current Role & Permission Schema Structure

### 3.1 `custom_roles` Table
```sql
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  role_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, name)
);
```

### 3.2 `role_permissions` Table
```sql
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL for global built-in templates
  role_key TEXT, -- Built-in role key e.g. 'waiter', 'cashier'
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role_permission_target CHECK (
    (role_key IS NOT NULL AND custom_role_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NOT NULL)
  )
);
```

### 3.3 `role_scope_presets` Table (Phase 30 Step 2 & 6)
```sql
CREATE TABLE public.role_scope_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  role_key TEXT,
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  default_scope public.canonical_scope_type NOT NULL,
  max_scope public.canonical_scope_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.4 `permission_scope_grants` Table (Phase 30 Step 2 & 6)
Concrete scope grants for built-in roles, custom roles, or individual business memberships across the 5 canonical scope tiers (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`).

---

## 4. Current Role Assignment & Management Paths

### 4.1 Paths that Modify Member Roles
1. **`PermissionService.updateMemberRole(userId, businessId, input)`**:
   * Updates `business_memberships.role` and `business_memberships.custom_role_id`.
   * Checks `hasPermission(userId, businessId, null, 'staff.manage')`.
   * Prevents modification if target is `business_owner`.
2. **`StaffInvitationService.claimInvitation(rawCode, userId, userEmail)`**:
   * Creates or updates `business_memberships` with `invite.assigned_role` and `invite.custom_role_id`.
   * Rejects claim if user is already a `business_owner`.
   * Validates `onboarding_intent` matches invitation type.
3. **`complete_business_onboarding` RPC**:
   * Creates initial business and sets creator membership to `business_owner`.
4. **`SuperAdminService.initializePilotVenue`**:
   * Creates demo business and owner membership.

---

## 5. Discovered Security Gaps & Required Hardening

1. **Custom Role Archival & In-Use Protection**:
   * `custom_roles` has `is_active` boolean, but lacks safe archival safeguards (e.g. checking if active members or pending invitations reference the role before archiving/deleting).
   * Archived custom roles must not grant permissions indefinitely or allow new assignments.
2. **Privilege Escalation in Role Assignment**:
   * `staff.role.assign` / `roles.manage` must enforce administrative reach: a Property Manager must not be able to assign a custom role that has `ORGANIZATION` max scope, or assign permissions beyond their own authority.
   * Self-role escalation must be strictly prevented: a non-owner actor cannot promote themselves.
3. **Role Cloning Safety**:
   * Cloning built-in roles or custom roles must strip out owner-only permissions if executed by a non-owner, and must never copy active member assignments or platform Super Admin authority.
4. **Stale Invitation Claim-Time Revalidation**:
   * When an invitation is claimed, the target custom role must be checked for active status and tenant ownership at claim time, not just creation time.
5. **Decoupling from Phase 29 Enterprise Placement**:
   * Changing a job title or position must **never** mutate the RBAC role or custom role.
   * Changing an RBAC role must **never** mutate the employee's substantive organizational seat or reporting chain.
6. **Effective Access Preview**:
   * Provide a unified preview for custom and built-in roles combining role capabilities, default/max scope presets, concrete scope grants, and member overrides.

---

## 6. Audit Sign-Off

The existing schema is robust, well-indexed, and additive. Phase 30 Step 7 will build the authoritative governance layer on top of `custom_roles`, `role_permissions`, `role_scope_presets`, `permission_scope_grants`, and `business_memberships` without destructive schema changes.
