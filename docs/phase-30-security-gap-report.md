# WSNexa Phase 30 — Authorization Security Gap Report
**Document**: `docs/phase-30-security-gap-report.md`  
**Phase**: Phase 30 Step 1 — RBAC & Scope V2 Compatibility Baseline  
**Date**: August 2026  
**Status**: Authoritative Security Vulnerability & Risk Assessment  

---

## 1. Executive Summary

A comprehensive codebase audit across all 34 server action files, 33 domain services, API route handlers, and page entry points identified several critical, high, and medium-severity security and authorization inconsistencies. 

These vulnerabilities must be addressed in Phase 30 implementation through the central RBAC & Scope V2 engine.

---

## 2. Severity Ranking & Finding Summary

```
┌─────────────────────────────────────────────────────────────┐
│ CRITICAL SEVERITY (4 Findings)                              │
│ - Unprotected Anti-Fake Order Security Actions              │
│ - Unprotected Branch Payment Method Configuration           │
│ - Unchecked Client-Provided Waiter User ID on Order Actions │
│ - Unprotected Recipe Creation & Cost Viewing                │
├─────────────────────────────────────────────────────────────┤
│ HIGH SEVERITY (5 Findings)                                  │
│ - Cross-Branch Manager Mutation Vulnerability               │
│ - Order Status Updating Without Permission Checks           │
│ - Inventory Settings Upsert Without Permission Checks       │
│ - Inventory Intelligence & COGS Report Unrestricted Access  │
│ - Loyalty Points Adjustment Without Permission Checks       │
├─────────────────────────────────────────────────────────────┤
│ MEDIUM SEVERITY (4 Findings)                                │
│ - Inconsistent Owner Bypass & Staff Invitation Rejection    │
│ - Hardcoded Built-in Role Strings Excluding Custom Roles   │
│ - Missing Route Guards on Key Dashboard Pages               │
│ - Unvalidated Branch Cookie in Tenant Context Resolver      │
├─────────────────────────────────────────────────────────────┤
│ LOW SEVERITY (2 Findings)                                   │
│ - Stale In-Memory Permission Cache During Long Requests     │
│ - Duplicated Service Area Assignment Fallback Tables        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Vulnerability Descriptions & Remediations

### Finding 1: Unprotected Anti-Fake Order Security Settings Actions
- **Severity**: `CRITICAL`
- **Location**: `src/server/actions/order-security.ts`, `src/server/services/order-security.service.ts`
- **Impact**: Any unauthenticated client or external caller can invoke `updateBranchOrderSecuritySettingsAction(branchId, updates)` or `applySecurityPresetAction(branchId, preset)` for ANY `branchId` without session validation, tenant check, or permission check. An attacker could disable location verification and table session requirements, completely disabling anti-fake order defenses.
- **Root Cause**: The action delegates directly to `OrderSecurityService` which uses `createAdminClient()` without resolving tenant session or checking `order_security.manage` permission.
- **Remediation**: Wrap all security setting mutations in Phase 30 `requireScopePermission(user, business, branch, 'order_security.manage')`.

---

### Finding 2: Unprotected Branch Payment Methods Configuration Actions
- **Severity**: `CRITICAL`
- **Location**: `src/server/actions/branch-payment.ts`, `src/server/services/branch-payment.service.ts`
- **Impact**: Any caller can invoke `updateBranchPaymentMethodAction(branchId, method, updates)` to modify or disable branch payment methods without authentication or permission validation.
- **Root Cause**: `BranchPaymentService` uses `createAdminClient()` and does not resolve user session or enforce `branches.manage` or `business.settings.manage`.
- **Remediation**: Enforce `requireScopePermission(user, business, branch, 'branches.operational.manage')` on payment method toggles.

---

### Finding 3: Unchecked Client-Provided Waiter User ID on Order Approvals
- **Severity**: `CRITICAL`
- **Location**: `src/server/actions/waiter-approval.ts`
- **Impact**: `approveGuestOrderAction(orderId, waiterUserId)` and `rejectGuestOrderAction(orderId, waiterUserId, reason)` accept `waiterUserId` directly from client request arguments and pass it to `WaiterService.approveGuestOrder` without verifying `auth.uid() === waiterUserId`. An attacker can spoof approval as any waiter.
- **Root Cause**: Action trusts client arguments instead of deriving `actorId` from server session context.
- **Remediation**: Always resolve `actorId = session.user.id` on server side and enforce `waiter.requests.manage` permission.

---

### Finding 4: Unprotected Recipe Creation, BOM Costs, and Batch Production
- **Severity**: `CRITICAL`
- **Location**: `src/server/actions/recipe.ts`, `src/server/services/recipe.service.ts`
- **Impact**: `createRecipeAction` and `producePrepBatchAction` do not check user permissions. Any staff member (including cashier or waiter) can create recipe formulas, trigger prep batch consumption, and view proprietary recipe cost calculations (`recipes.costs.view`).
- **Root Cause**: Action does not check `recipes.manage` or `inventory.production.manage`.
- **Remediation**: Enforce `recipes.manage` on recipe mutations and `inventory.production.manage` on batch runs.

---

### Finding 5: Cross-Branch Manager Mutation Vulnerability
- **Severity**: `HIGH`
- **Location**: `src/server/actions/branch.ts`, `src/server/services/branch.service.ts`
- **Impact**: `updateBranchAction(branchId, input)` calls `requireBusinessRole(tenant.business.id, ['business_owner', 'branch_manager'])`. However, it does NOT verify that a `branch_manager` is assigned to the specific target `branchId`. A manager of Branch A can modify settings for Branch B.
- **Root Cause**: `requireBusinessRole` validates business-level role without evaluating `branch_assignments`.
- **Remediation**: Validate that non-owners possess an active assignment for the specific `branchId` via `PROPERTY` scope check.

---

### Finding 6: Order Status Updating Without Permission Checks
- **Severity**: `HIGH`
- **Location**: `src/server/actions/order.ts`, `src/server/services/order.service.ts`
- **Impact**: `OrderService.updateOrderStatus(orderId, nextStatus, notes)` checks `order.branch_id === context.activeBranch.id`, but does NOT check if the user has `orders.update_status`, `kitchen.update`, or `orders.cancel`. Any member with an active session can cancel orders or jump preparation statuses.
- **Root Cause**: Missing permission assertion before executing status updates.
- **Remediation**: Check `orders.cancel` if `nextStatus === 'cancelled'`, `kitchen.update` if status transitions to `preparing`/`ready`, and `orders.update_status` otherwise.

---

### Finding 7: Inconsistent Owner Bypass & Staff Invitation Rejection
- **Severity**: `MEDIUM`
- **Location**: `src/server/services/staff-invitation.service.ts`
- **Impact**: In the database catalog and `ROUTE_PERMISSION_MAP`, `branch_manager` is granted `staff.invite`. A Branch Manager can navigate to `/dashboard/team/invites`, fill the invite form, but upon submission, `StaffInvitationService.createInvitation` rejects the request with `"Only Business Owners can generate staff invitations"`.
- **Root Cause**: Hardcoded check `if (!ownerMem || ownerMem.role !== 'business_owner')` instead of evaluating `staff.invite` permission.
- **Remediation**: Replace static owner check with `PermissionService.hasPermission(userId, businessId, branchId, 'staff.invite')`.

---

### Finding 8: Hardcoded Built-in Role Strings Excluding Custom Roles
- **Severity**: `MEDIUM`
- **Location**: Multiple server action and service files:
  - `src/server/actions/modifier.ts` (`role !== 'business_owner' && role !== 'branch_manager'`)
  - `src/server/actions/table.ts` (`role !== 'business_owner' && role !== 'branch_manager'`)
  - `src/server/services/payment.service.ts` (`['business_owner', 'branch_manager', 'cashier'].includes(role)`)
  - `src/app/api/cashier/orders/route.ts` (`['business_owner', 'branch_manager', 'cashier'].includes(role)`)
  - `src/server/services/report.service.ts` (`role !== 'business_owner' && targetBranchId !== ...`)
- **Impact**: Custom roles that are granted permissions (e.g. `menu.modifiers.manage`, `tables.create`, `cashier.access`) are blocked by legacy hardcoded role name checks.
- **Remediation**: Standardize all checks onto the central Phase 30 authorization engine.

---

### Finding 9: Missing Route Guards on Key Dashboard Pages
- **Severity**: `MEDIUM`
- **Location**:
  - `src/app/(dashboard)/dashboard/business/page.tsx` (No permission check for `business.settings.manage` or `business.view`)
  - `src/app/(dashboard)/dashboard/branches/page.tsx` (No permission check for `branches.manage` or `branches.view`)
  - `src/app/(dashboard)/dashboard/dining/page.tsx` (No permission check for `tables.view`)
- **Impact**: Any logged-in member can access these pages directly via URL navigation, even if the sidebar hides the link.
- **Remediation**: Add `requireRoutePermission(pathname)` to all dashboard page server components.

---

### Finding 10: Active Branch Cookie Tampering in Tenant Resolver
- **Severity**: `MEDIUM`
- **Location**: `src/server/tenant/resolver.ts`
- **Impact**: `resolveActiveBusinessContext` reads `ACTIVE_BRANCH_COOKIE` and sets `activeBranch` to whatever branch matches the cookie without checking if a non-owner member is assigned to that branch in `branch_assignments`.
- **Root Cause**: Branch resolution does not filter `formattedBranches` by `branch_assignments` for non-owners.
- **Remediation**: Filter available branches by `branch_assignments` / `staff_assignments` for non-owners during context resolution.
