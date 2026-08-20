# WSNexa Phase 30 — RBAC & Scope V2 Implementation Blueprint
**Document**: `docs/phase-30-implementation-plan.md`  
**Phase**: Phase 30 Step 1 — RBAC & Scope V2 Compatibility Baseline  
**Date**: August 2026  
**Status**: Authoritative Technical Architecture & Step-by-Step Execution Plan  

---

## 1. Executive Summary & Architectural Goals

Phase 30 elevates WSNexa's authorization architecture to a unified **RBAC & Scope V2** model. 

$$\text{Decision} = \text{Evaluate}\Big(\text{Principal}, \text{Permission Key}, \text{Target Scope}, \text{Context}\Big)$$

### Core Objectives
1. **Separation of What vs. Where**: Permission = WHAT the user can do; Scope = WHERE the user can do it (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA/TEAM`, `SELF`).
2. **100% Backward Compatibility**: Existing built-in roles, custom roles, member overrides, and permissions continue working seamlessly without downtime or broken production workflows.
3. **Phase 29 Deep Integration**: Authority dynamically derives from Phase 29 hierarchy structures (`organization_departments`, `organization_units`, `organization_positions`, `staff_assignments`, `acting` coverage, `secondments`).
4. **Platform vs. Tenant Separation**: Super Admin platform authority remains strictly decoupled from tenant RBAC.
5. **Security Remediation**: Fix all 10 vulnerabilities identified in the Phase 30 Security Gap Report (`docs/phase-30-security-gap-report.md`).

---

## 2. Recommended Additive Data Model

The Phase 30 schema extension is strictly **additive**. Existing tables (`permissions`, `custom_roles`, `role_permissions`, `member_permission_overrides`, `business_memberships`, `branch_assignments`) remain intact.

### 2.1 Proposed New & Extended Tables

```
                               ┌─────────────────────────────┐
                               │     public.permissions      │ (103 Canonical Keys)
                               └──────────────┬──────────────┘
                                              │
                     ┌────────────────────────┼────────────────────────┐
                     │                        │                        │
                     ▼                        ▼                        ▼
       ┌───────────────────────────┐┌───────────────────┐┌───────────────────────────┐
       │   public.custom_roles     ││  role_templates   ││ member_permission_       │
       │ (business_id, name, etc.) ││ (built-in presets)││ overrides (allow/deny)   │
       └─────────────┬─────────────┘└─────────┬─────────┘└─────────────┬─────────────┘
                     │                        │                        │
                     └────────────────────────┼────────────────────────┘
                                              ▼
                             ┌───────────────────────────────────┐
                             │    public.permission_scope_grants │ (NEW ADDITIVE TABLE)
                             │ --------------------------------- │
                             │ id (UUID, PK)                     │
                             │ business_id (UUID, FK)            │
                             │ role_key (TEXT, nullable)         │
                             │ custom_role_id (UUID, nullable)   │
                             │ membership_id (UUID, nullable)    │
                             │ permission_key (TEXT, FK)         │
                             │ scope_type (TEXT: ORG, PROP, etc.)│
                             │ scope_id (UUID, nullable)         │
                             │ effect (TEXT: allow/deny)         │
                             │ created_at, updated_at            │
                             └───────────────────────────────────┘
```

#### Detailed Table Specifications

#### 1. `public.permission_scope_grants`
- **Purpose**: Authoritative store for multi-level permission-to-scope bindings.
- **Columns**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `business_id`: `UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE`
  - `role_key`: `TEXT NULL` (Built-in role key e.g. `'branch_manager'`, `'cashier'`)
  - `custom_role_id`: `UUID NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE`
  - `business_membership_id`: `UUID NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE`
  - `permission_key`: `TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE`
  - `scope_type`: `TEXT NOT NULL CHECK (scope_type IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA', 'SELF'))`
  - `scope_id`: `UUID NULL` (Branch ID, Department ID, or Unit ID when applicable)
  - `effect`: `TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny'))`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Constraints & Indexes**:
  - `CONSTRAINT chk_grant_target CHECK ((role_key IS NOT NULL AND custom_role_id IS NULL AND business_membership_id IS NULL) OR (role_key IS NULL AND custom_role_id IS NOT NULL AND business_membership_id IS NULL) OR (role_key IS NULL AND custom_role_id IS NULL AND business_membership_id IS NOT NULL))`
  - `CREATE INDEX idx_perm_scope_lookup ON public.permission_scope_grants(business_id, permission_key, scope_type, scope_id)`
  - `CREATE INDEX idx_perm_scope_role ON public.permission_scope_grants(role_key, custom_role_id)`
  - `CREATE INDEX idx_perm_scope_member ON public.permission_scope_grants(business_membership_id)`

#### 2. `public.authorization_audit_logs` (Optional Additive Table)
- **Purpose**: Append-only tamper-evident audit record for critical authorization mutations (role assignments, scope grant creations, permission overrides, ownership transfers).
- **Columns**:
  - `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `business_id`: `UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE`
  - `actor_user_id`: `UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
  - `target_membership_id`: `UUID NULL REFERENCES public.business_memberships(id) ON DELETE SET NULL`
  - `action`: `TEXT NOT NULL`
  - `previous_state`: `JSONB NULL`
  - `new_state`: `JSONB NOT NULL`
  - `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.2 Backward Compatibility Strategy & Backfill
1. An idempotent SQL backfill script will populate `permission_scope_grants` from existing `role_permissions` and `member_permission_overrides`.
2. Existing built-in role template grants default to their canonical scopes (`PROPERTY` for operational keys, `ORGANIZATION` for enterprise catalog keys).
3. The application engine queries `permission_scope_grants` with immediate fallback to legacy `role_permissions` during transition.

---

## 3. Step-by-Step Implementation Sequence

The remaining Phase 30 work is structured into 11 discrete, test-driven steps:

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Additive Database Schema & Backfill Migration       │
│ - Create permission_scope_grants table & indexes           │
│ - Idempotent backfill from legacy role_permissions          │
│ - RLS policies for scope grants table                       │
├─────────────────────────────────────────────────────────────┤
│ STEP 3: Central Authorization Context & Scope Resolver      │
│ - Enhance tenant resolver with branch & org validation      │
│ - Build ScopeResolver to extract user's effective scopes    │
│ - Request-scoped caching via React cache()                  │
├─────────────────────────────────────────────────────────────┤
│ STEP 4: Central Authorization Engine (AuthEngine V2)        │
│ - Implement AuthEngine.hasPermission(principal, key, scope) │
│ - Implement AuthEngine.requirePermission(...) helper        │
│ - Strict hierarchical scope evaluation (Org->Prop->Dept->Area->Self) │
├─────────────────────────────────────────────────────────────┤
│ STEP 5: Role Templates & Custom Role Scope Integration      │
│ - Update custom role creation/editing with scope defaults   │
│ - Standardize preset definitions in permission-presets.ts   │
├─────────────────────────────────────────────────────────────┤
│ STEP 6: Multi-Level Scope Grants Service                    │
│ - Implement grant/revoke APIs for Org, Property, Dept, Area │
│ - Scope validation against Phase 29 hierarchy entities      │
├─────────────────────────────────────────────────────────────┤
│ STEP 7: Granular Member Permission Overrides with Scopes    │
│ - Extend member overrides to support explicit scopes        │
│ - Deny precedence across matching scopes                   │
├─────────────────────────────────────────────────────────────┤
│ STEP 8: Acting Positions & Secondment Dynamic Scope Engine  │
│ - Integrate Phase 29 acting coverage scope elevation       │
│ - Integrate secondment cross-property scope resolution      │
├─────────────────────────────────────────────────────────────┤
│ STEP 9: Server Action & Service Layer Migration & Hardening │
│ - Remediate all 10 Security Gap findings                   │
│ - Replace hardcoded role name checks across 34 actions      │
│ - Fix unauthenticated order-security & branch-payment actions│
├─────────────────────────────────────────────────────────────┤
│ STEP 10: Server Route Guards & Client Diagnostics           │
│ - Add requireRoutePermission to all dashboard pages         │
│ - Update dashboard-shell.tsx nav link filtering with scopes │
├─────────────────────────────────────────────────────────────┤
│ STEP 11: Team & Roles Management UI Enhancement             │
│ - Update Team Management UI with scope indicators           │
│ - Visual scope badge & position assignment representation   │
├─────────────────────────────────────────────────────────────┤
│ STEP 12: Verification Suite, Verification Script & Hardening│
│ - Author scripts/verify-rbac-v2.ts                          │
│ - Verify all roles, presets, custom roles, acting, scopes   │
│ - Compile walkthrough.md & delivery sign-off               │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Step Blueprints

### Step 2: Additive Database Schema & Backfill Migration
- **Files**: `supabase/migrations/20260819000000_phase30_rbac_v2_scope_grants.sql`
- **Actions**:
  - Create `public.permission_scope_grants`.
  - Create RLS policies (`auth_has_business_access(business_id)`).
  - Execute idempotent backfill populating built-in templates (`branch_manager`, `cashier`, `kitchen_staff`, `waiter`, `supervisor`) with appropriate default scopes.
  - Backfill existing `custom_roles` grants into `permission_scope_grants`.

### Step 3: Authorization Context & Scope Resolver
- **Files**: `src/server/auth/scope-resolver.ts`, `src/server/tenant/resolver.ts`
- **Actions**:
  - Implement `ScopeResolver.resolvePrincipalScopes(userId, businessId)` returning:
    - `isOwner: boolean`
    - `isSuperAdmin: boolean`
    - `activeBranchIds: string[]`
    - `activeDepartmentIds: string[]`
    - `activeUnitIds: string[]`
    - `activeActingScopes: ScopeGrant[]`
    - `activeSecondmentScopes: ScopeGrant[]`
  - Fix branch cookie tampering vulnerability in `resolveActiveBusinessContext` by verifying membership branch assignments.

### Step 4: Central Authorization Engine (`AuthEngine`)
- **Files**: `src/server/auth/engine.ts`, `src/server/services/permission.service.ts`
- **Actions**:
  - Create unified `AuthEngine.can(actor, action, resourceScope)` API.
  - Evaluation sequence:
    1. Super Admin bypass (Platform level).
    2. Suspended check.
    3. Business Owner bypass (`ORGANIZATION` scope).
    4. Owner-only permission guard.
    5. Member-level explicit `deny` overrides (hierarchical).
    6. Member-level explicit `allow` overrides (hierarchical).
    7. Acting position scope grants.
    8. Custom role / built-in role scope grants.
  - Maintain full backward compatibility with `PermissionService.hasPermission`.

### Step 5: Role Templates & Custom Role Scope Integration
- **Files**: `src/server/services/permission.service.ts`, `src/lib/validation/permission.ts`
- **Actions**:
  - Update `createCustomRole` and `updateCustomRole` to write to both `role_permissions` and `permission_scope_grants`.

### Step 6: Multi-Level Scope Grants Service
- **Files**: `src/server/services/scope-grant.service.ts`
- **Actions**:
  - Add administrative methods to grant/revoke permissions at specific scopes (`department_id`, `unit_id`, `branch_id`).

### Step 7: Granular Member Permission Overrides with Scope Support
- **Files**: `src/server/services/permission.service.ts`, `src/server/actions/permission.ts`
- **Actions**:
  - Allow member overrides to specify target `scope_type` and `scope_id`.

### Step 8: Acting Positions & Secondment Dynamic Scope Engine
- **Files**: `src/server/auth/acting-scope-engine.ts`, `src/server/services/organization.service.ts`
- **Actions**:
  - Connect `organization_assignment_absences` and `staff_assignments.assignment_type = 'acting'` to dynamically elevate actor scope during active coverage.

### Step 9: Server Action & Service Layer Migration & Hardening
- **Files**: All 10 affected action & service files:
  - `src/server/actions/order-security.ts` & `order-security.service.ts` (Fix Finding 1)
  - `src/server/actions/branch-payment.ts` & `branch-payment.service.ts` (Fix Finding 2)
  - `src/server/actions/waiter-approval.ts` & `waiter.service.ts` (Fix Finding 3)
  - `src/server/actions/recipe.ts` & `recipe.service.ts` (Fix Finding 4)
  - `src/server/actions/branch.ts` (Fix Finding 5)
  - `src/server/actions/order.ts` & `order.service.ts` (Fix Finding 6)
  - `src/server/services/staff-invitation.service.ts` (Fix Finding 7)
  - `src/server/actions/modifier.ts`, `table.ts`, `payment.service.ts`, `report.service.ts`, `cashier/orders/route.ts` (Fix Finding 8)
  - `src/server/actions/inventory-settings.ts` & `inventory-intelligence.service.ts` (Fix Findings)

### Step 10: Server Route Guards & Client Diagnostics
- **Files**:
  - `src/app/(dashboard)/dashboard/business/page.tsx` (Add `requireRoutePermission('/dashboard/business')`)
  - `src/app/(dashboard)/dashboard/branches/page.tsx` (Add `requireRoutePermission('/dashboard/branches')`)
  - `src/app/(dashboard)/dashboard/dining/page.tsx` (Add `requireRoutePermission('/dashboard/dining')`)
  - `src/components/layout/dashboard-shell.tsx`

### Step 11: Team & Roles Management UI Enhancement
- **Files**: `src/components/team/team-management.tsx`, `src/components/team/member-card.tsx`
- **Actions**:
  - Render scope badges (e.g. `PROPERTY [Main Branch]`, `AREA [Bar Area]`, `DEPT [Kitchen]`) alongside member roles and permissions.

### Step 12: Verification Suite, Verification Script & Hardening
- **Files**: `scripts/verify-rbac-v2.ts`, `package.json`
- **Actions**:
  - Add `"verify:rbac-v2": "tsx scripts/verify-rbac-v2.ts"`.
  - Comprehensive automated tests covering all roles, scopes, overrides, acting positions, and security invariants.
