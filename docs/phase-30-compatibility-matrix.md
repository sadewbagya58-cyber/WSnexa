# WSNexa Phase 30 — Backward-Compatibility Matrix
**Document**: `docs/phase-30-compatibility-matrix.md`  
**Phase**: Phase 30 Step 1 — RBAC & Scope V2 Compatibility Baseline  
**Status**: Authoritative Migration & Mapping Matrix  

---

## 1. Migration Philosophy & Invariant Rules

To ensure zero downtime and zero broken workflows during and after the Phase 30 RBAC V2 upgrade, the following invariants are enforced:

1. **No Breaking Schema Mutations**: Existing columns (`business_memberships.role`, `business_memberships.custom_role_id`, `member_permission_overrides`, `role_permissions`) remain functional and authoritative during transition.
2. **Permission Key Immutability**: All 103 permission keys maintain exact string identities. No keys are renamed or deleted.
3. **Additive Scope Resolution**: If a scope is not explicitly defined on a grant or custom role, it defaults safely to its canonical backward-compatible scope.
4. **Owner Un-deniable Authority**: Business Owners continue to hold un-deniable owner authority (`ORGANIZATION` scope `ALLOW ALL`).
5. **Super Admin Platform Separation**: Super Admin checks remain outside tenant business RBAC.

---

## 2. Role-by-Role Compatibility & Scope Mapping Matrix

| Current Role / Principal | Current Permissions & Mechanics | Phase 30 V2 Target Scope | V2 Behavioral Description | Migration Action / Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **`super_admin`** | Platform authority via `user_profiles.is_super_admin` | **PLATFORM (Global)** | Unchanged. Remains outside tenant RBAC. Cannot hold tenant business roles. | Zero schema or logic change. |
| **`business_owner`** | `ALLOW ALL` on all business permissions via `membership.role === 'business_owner'` | **`ORGANIZATION`** | Implicitly granted all permissions at `ORGANIZATION` scope across all branches, departments, and units. | Preserved via `ORGANIZATION` scope bypass. |
| **`branch_manager`** | Full branch management permissions in `role_permissions` where `role_key = 'branch_manager'` | **`PROPERTY` / `BRANCH`** (with selective `ORGANIZATION` view) | Enforces existing permissions restricted to their assigned branch(es) in `branch_assignments` / `staff_assignments`. | Automatically mapped to `PROPERTY` scope for operational keys, `ORGANIZATION` scope for shared catalog reads. |
| **`cashier`** | Billing, payment recording, order settlement, receipt printing | **`PROPERTY` / `BRANCH`** | Cashier operations bounded to the assigned branch where cashier shift is active. | Preserved with `PROPERTY` scope on Cashier & Payment permissions. |
| **`kitchen_staff`** | KDS queue display, item preparation states, physical count & waste logging | **`PROPERTY` / `BRANCH`** + **`DEPARTMENT`** (Kitchen) | Back-of-house operational permissions bounded to branch and kitchen department inventory items. | Preserved with `PROPERTY` scope and Kitchen department alignment. |
| **`waiter` (without area)** | Table orders, assistance requests, table status updates | **`PROPERTY` / `BRANCH`** | Operations bounded to all tables within the assigned branch. | Preserved with `PROPERTY` scope. |
| **`waiter` (with area assignment)** | Table requests and order approvals filtered by `staff_area_assignments` | **`AREA` / `TEAM`** | Operations and pending approvals strictly bounded to tables within their assigned `service_areas` / `organization_units`. | Automatically resolved via `staff_area_assignments` $\rightarrow$ `AREA` scope. |
| **`supervisor`** | Preset in code: menu stock toggle, table status, sales view | **`PROPERTY` / `BRANCH`** | Floor supervision bounded to assigned branch. | Upgraded from code-only preset to first-class V2 role template. |
| **Custom Roles** | Tenant-defined role with custom permission list in `role_permissions` | **Compatible V2 Scope** (defaults to `PROPERTY` or `ORGANIZATION` based on keys) | Custom roles preserve all current permission keys. Scope defaults to `PROPERTY` for operational permissions and `ORGANIZATION` for enterprise structure permissions. | Automatic backfill to additive `role_scope_grants` table with zero disruption. |
| **Customer** | B2C venue discovery, personal order tracking, loyalty points, reviews | **`SELF`** | Actions bounded strictly to records where `customer_user_id === auth.uid()`. | Enforced via existing RLS + service layer verification. |
| **Guest / Anonymous** | QR ordering, live order tracking via signed cryptographic tokens | **`TOKEN_SESSION` / `SELF`** | Bounded strictly to the specific table/branch session authorized by the cryptographic token. | Unchanged; cryptographic verification remains authoritative. |

---

## 3. Organizational Scope Hierarchy & Resolution Flow

When a user attempts an action requiring permission $P$ on resource $R$ located at scope $S$:

$$\text{Evaluate}(User, Business, Branch, Resource, P) \implies \text{Hierarchy Evaluation}$$

```
                ┌───────────────────────────────────┐
                │ 1. ORGANIZATION SCOPE GRANTS     │ (Covers all branches, departments & units)
                └─────────────────┬─────────────────┘
                                  │ (If not matched)
                                  ▼
                ┌───────────────────────────────────┐
                │ 2. PROPERTY / BRANCH SCOPE GRANTS│ (Covers specified branch & sub-units)
                └─────────────────┬─────────────────┘
                                  │ (If not matched)
                                  ▼
                ┌───────────────────────────────────┐
                │ 3. DEPARTMENT SCOPE GRANTS        │ (Covers department & child units)
                └─────────────────┬─────────────────┘
                                  │ (If not matched)
                                  ▼
                ┌───────────────────────────────────┐
                │ 4. AREA / TEAM SCOPE GRANTS       │ (Covers specific station / dining area)
                └─────────────────┬─────────────────┘
                                  │ (If not matched)
                                  ▼
                ┌───────────────────────────────────┐
                │ 5. SELF SCOPE GRANTS              │ (Covers only records created by / assigned to user)
                └─────────────────┬─────────────────┘
                                  │
                                  ▼
                               [ DENY ]
```

---

## 4. Acting Positions & Secondments Integration

Phase 29 Step 3 added acting assignments and secondments (`staff_assignments.assignment_type IN ('acting', 'secondment')`). In Phase 30 V2, these integrate seamlessly:

1. **Acting Position Scope Inheritance**:
   - If User A (Waiter, Area Scope) is appointed `acting` Branch Manager for Branch 1 during Manager B's absence:
   - User A's effective scope dynamically elevates to `PROPERTY` scope for Branch 1 for the duration of the acting window (`starts_at` $\le \text{NOW}() \le$ `ends_at`).
   - When the acting assignment expires or is ended, User A's effective scope reverts automatically to their primary assignment.
2. **Secondment Cross-Property Scope**:
   - If User C (Cashier, Branch 1) is seconded to Branch 2:
   - User C holds active `PROPERTY` scope grants on Branch 2 for the secondment duration, while retaining or pausing their Branch 1 assignment based on status.

---

## 5. Summary of Uncertain Mappings & Resolution Decisions

| Area / Question | Potential Ambiguity | V2 Architectural Decision |
| :--- | :--- | :--- |
| **Organization Menu Catalog vs. Branch Pricing** | Is `menu.price.update` Organization-wide or Branch-specific? | `ORGANIZATION` scope for central base price; `PROPERTY` scope for branch price overrides. |
| **Inventory Viewing vs Cost Valuation** | Kitchen staff need `inventory.view` but should not see cost figures (`inventory.costs.view`). | `inventory.view` is granted at `PROPERTY` / `DEPARTMENT` scope; `inventory.costs.view` is restricted to Management (`BO, BM`). |
| **Legacy `staff.manage` vs Granular Roles** | Existing custom roles may have legacy `staff.manage`. | Auto-expanded in migration `20260814120000_permissions_v2_catalog.sql` into granular actions; mapped to `PROPERTY` or `ORGANIZATION` scope based on role level. |
