# WSNexa Phase 30 Step 1.5 — Critical Authorization Hardening Report
**Document**: `docs/phase-30-step-1-5-security-hardening.md`  
**Phase**: Phase 30 Step 1.5 — Critical Authorization Hardening Before RBAC V2  
**Date**: August 2026  
**Status**: Completed & Verified  

---

## 1. Executive Summary

Prior to launching the Phase 30 RBAC & Scope V2 engine and schema migrations, critical and high-severity authorization vulnerabilities identified during the Step 1 audit were remediated. All hardening was accomplished strictly within the **existing authorization architecture**, preserving all existing permission keys, RLS policies, role mechanics, Super Admin isolation, and public customer/guest dining workflows.

---

## 2. Remediated Vulnerabilities & Exact Fixes

### 1. Order Security Policy Mutations
- **Vulnerability**: `src/server/actions/order-security.ts` allowed unauthenticated callers to alter branch order security settings and presets (e.g. disabling location verification, shortening table session windows, modifying table PIN requirements).
- **Files Changed**: `src/server/actions/order-security.ts`
- **Permission Used**: `order_security.manage`, `order_security.view`
- **Remediation**:
  - Requires authenticated business session (`resolveActiveBusinessContext`).
  - Verifies target `branchId` belongs to the authenticated business.
  - Enforces `PermissionService.hasPermission(user.id, business.id, branchId, 'order_security.manage')`.
  - Revalidates paths upon successful mutation.
- **Backward Compatibility**: Public/guest verification RPCs (`verify_table_checkout_access`, location proofs) remain fully functional for customer ordering.

---

### 2. Branch Payment Method Configuration
- **Vulnerability**: `src/server/actions/branch-payment.ts` allowed unauthenticated mutation of enabled payment methods and instructions for any branch.
- **Files Changed**: `src/server/actions/branch-payment.ts`
- **Permission Used**: `branches.operational.manage`, `branches.manage`
- **Remediation**:
  - Added session context resolution.
  - Enforced `PermissionService.hasPermission(..., 'branches.operational.manage')` / `branches.manage`.
  - Verified non-owners are assigned to the target branch.

---

### 3. Client-Supplied Waiter Identity Spoofing
- **Vulnerability**: `src/server/actions/waiter-approval.ts` trusted `waiterUserId` passed from the client, enabling an attacker to spoof order approvals or rejections under another staff member's user ID.
- **Files Changed**: `src/server/actions/waiter-approval.ts`
- **Permission Used**: `waiter.requests.manage`, `waiter.access`, `waiter.requests.view`, `orders.update_status`, `orders.cancel`
- **Remediation**:
  - Ignored client-supplied `waiterUserId` and authoritatively extracted `context.user.id` from the server session.
  - Verified target order belongs to `context.business.id` via database lookup.
  - Verified waiter queue management permissions for the order's branch.
- **Backward Compatibility**: Action signatures accept optional `_waiterUserId?: string` for non-breaking client compatibility, but strictly discard it in favor of `context.user.id`.

---

### 4. Unprotected Recipe Creation & Cost Metrics Leakage
- **Vulnerability**: `src/server/actions/recipe.ts` and `src/server/services/recipe.service.ts` allowed any member to create recipes, trigger batch production, and view proprietary BOM cost calculations.
- **Files Changed**: `src/server/actions/recipe.ts`, `src/server/services/recipe.service.ts`
- **Permission Used**: `recipes.manage`, `inventory.production.manage`, `recipes.costs.view`, `inventory.costs.view`
- **Remediation**:
  - `createRecipeAction` enforces `recipes.manage`.
  - `producePrepBatchAction` enforces `inventory.production.manage`.
  - `RecipeService.getRecipes` and `RecipeService.getRecipeById` check `recipes.costs.view` / `inventory.costs.view`; if missing, all cost totals, portion costs, margin percentages, and ingredient unit costs are automatically redacted to `0`.

---

### 5. Cross-Branch Manager Settings Tampering
- **Vulnerability**: `src/server/actions/branch.ts` checked `role === 'branch_manager'` at the business level without validating that the manager was assigned to the specific target `branchId`.
- **Files Changed**: `src/server/actions/branch.ts`
- **Permission Used**: `branches.operational.manage`, `branches.manage`
- **Remediation**:
  - Replaced hardcoded `requireBusinessRole` with `PermissionService.hasPermission(user.id, business.id, branchId, 'branches.operational.manage')`.
  - Verified non-owners hold an active assignment in `branch_assignments` for the target branch.
  - Organization-wide branch lifecycle actions (create, archive, restore, delete) enforce `branches.manage`.

---

### 6. Order Status Mutation Authorization
- **Vulnerability**: `src/server/services/order.service.ts` updated order statuses without asserting discrete order permissions.
- **Files Changed**: `src/server/services/order.service.ts`
- **Permission Used**: `orders.update_status`, `orders.cancel`, `kitchen.update`, `cashier.access`, `payments.record`
- **Remediation**:
  - `cancelled` status requires `orders.cancel`.
  - `in_preparation` / `ready` status requires `kitchen.update` OR `orders.update_status`.
  - `completed` status requires `orders.update_status` OR `cashier.access` OR `payments.record`.
  - Validated that the order belongs to `context.business.id` and `context.activeBranch.id`.

---

### 7. Staff Invitation Generation & Management
- **Vulnerability**: `src/server/services/staff-invitation.service.ts` rejected Branch Managers who possess the `staff.invite` permission because of a static `role === 'business_owner'` check.
- **Files Changed**: `src/server/services/staff-invitation.service.ts`
- **Permission Used**: `staff.invite`, `staff.manage`, `invitations.manage`
- **Remediation**:
  - Replaced hardcoded owner check in `createInvitation`, `revokeInvitation`, and `regenerateInvitation` with `PermissionService.hasPermission`.

---

### 8. Hardcoded Role String Checks Replaced
- **Files Changed**:
  - `src/server/actions/modifier.ts` $\rightarrow$ enforces `menu.modifiers.manage` or `menu.manage`.
  - `src/server/actions/table.ts` $\rightarrow$ enforces `tables.create`, `tables.edit`, `qr.security.reset`, `tables.manage`.
  - `src/server/actions/inventory-settings.ts` $\rightarrow$ enforces `inventory.settings.manage`.
  - `src/server/services/inventory-intelligence.service.ts` $\rightarrow$ enforces `inventory.menu_profitability.view` and `inventory.cogs.view`.
  - `src/server/services/payment.service.ts` $\rightarrow$ enforces `payments.record`, `payments.void`, `cashier.access`.
  - `src/app/api/cashier/orders/route.ts` $\rightarrow$ enforces `cashier.access` or `orders.view`.

---

### 9. Active Branch Cookie Spoofing Hardening
- **Vulnerability**: `resolveActiveBusinessContext` trusted `wsnexa_active_branch` from cookies without checking whether a non-owner member was assigned to that branch.
- **Files Changed**: `src/server/tenant/resolver.ts`
- **Remediation**:
  - For non-owners, queries `branch_assignments` for the active membership.
  - Filters accessible branches to assigned branches only.
  - Rejects unassigned branch cookies and falls back safely to the member's default authorized branch.

---

### 10. Dashboard Server Component Route Guards
- **Files Changed**:
  - `src/app/(dashboard)/dashboard/business/page.tsx` $\rightarrow$ guarded by `requireRoutePermission('/dashboard/business')` (`business.settings.manage`).
  - `src/app/(dashboard)/dashboard/branches/page.tsx` $\rightarrow$ guarded by `requireRoutePermission('/dashboard/branches')` (`branches.manage`).
  - `src/app/(dashboard)/dashboard/dining/page.tsx` $\rightarrow$ guarded by `requireRoutePermission('/dashboard/dining')` (`tables.view`).

---

## 3. Test Coverage & Verification

- Added verification suite: `scripts/verify-phase30-security-baseline.ts`
- Registered npm script: `npm run verify:phase30-security-baseline`
- Verified:
  - 100% of order-security mutations protected
  - 100% of branch-payment mutations protected
  - Server-side authoritative waiter identity
  - Recipe mutation and costing permissions enforced
  - Cross-branch manager isolation enforced
  - Order status permissions enforced
  - Active branch cookie spoofing prevented
  - Super Admin isolation preserved
  - Public guest ordering unaffected

---

## 4. Issues Intentionally Deferred to Phase 30 V2
The following items remain as planned for Phase 30 RBAC & Scope V2:
- First-class multi-level scope grants (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA`, `SELF`) backed by `permission_scope_grants`.
- Dynamic scope inheritance for Phase 29 `acting` positions and `secondments`.
- Granular UI scope badge indicators in the Team Management dashboard.
