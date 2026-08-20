# Phase 30 Step 5: RBAC & Scope V2 — Production Authorization Integration Report

## 1. Executive Summary

Phase 30 Step 5 successfully integrates the centralized **RBAC & Scope V2 Policy Decision Engine** (`can()`, `authorize()`, `requireBusinessPermission()`) into real server-side business operations across the entire WSNexa platform. 

Every migrated security-sensitive mutation now follows the authoritative server-side execution pipeline:
```text
Authenticated Request
    ↓
Trusted AuthorizationContext (Server/DB Verified)
    ↓
Trusted Resource Scope Resolution (Server/DB Authoritative)
    ↓
Policy Engine Evaluation (Owner Policy → Explicit Deny → Explicit Allow → Scope Grants → Role Grants)
    ↓
Business Operation Execution & Audit Logging
```

Ad-hoc legacy permission checks, direct role comparisons, and unprotected branch operations across 7 core domain modules have been migrated to the V2 policy engine while preserving full backward compatibility for unmigrated auxiliary pathways.

---

## 2. Architectural Security Principles Enforced

1. **Server Authority & UI Independence**:
   - UI navigation guards and button hiding are strictly for UX.
   - All server actions and backend domain services enforce authoritative policy checks.
2. **Authoritative Resource Resolution**:
   - Resource scopes (`branchId`, `departmentId`, `organizationUnitId`, `serviceAreaId`, `ownerUserId`) are always resolved from trusted database lookups or verified server-side identifiers, never from unvalidated client parameters.
3. **Super Admin Platform Isolation**:
   - Super admin platform privileges (`is_super_admin: true`) govern platform administrative functions only.
   - Super admin access never bypasses tenant RBAC checks for regular business tenant operations.
4. **Explicit DENY Precedence**:
   - Member-level explicit `DENY` overrides strictly supersede role permissions, custom roles, presets, and acting scopes.
5. **Organizational Scope Boundaries**:
   - Staff cannot mutate resources outside their assigned branches, departments, or service areas unless explicit multi-property or organization-level grants exist.
6. **Time-Bounded Authority Reach**:
   - Acting assignments and secondments are strictly evaluated against active date bounds (`startsAt` <= now <= `endsAt`) and status (`active`). Expired assignments deny resource reach.

---

## 3. Production Domains Migrated

### Domain 1: Orders & Kitchen
- **Migrated Files**:
  - `src/server/services/order.service.ts`: `updateOrderStatus` migrated to `can()` with `{ type: 'order', id: orderId }`.
  - `src/server/actions/waiter-approval.ts`: `approveGuestOrderAction`, `rejectGuestOrderAction`, and `getPendingApprovalsAction` migrated to `can()`.
- **Public Entry Points Protected**:
  - `submitGuestOrderAction`, `getPublicOrderTrackingStateAction`: Retained as HMAC/PIN verified customer access.

### Domain 2: Payments & Cashier
- **Migrated Files**:
  - `src/server/services/payment.service.ts`: `recordPayment`, `voidPayment`, `getCashierOrders` migrated to `can()`.
  - `src/server/actions/payment.ts`: `acknowledgeBillRequestAction` migrated to `can()`.
  - `src/server/actions/branch-payment.ts`: `getBranchPaymentMethodsAction`, `updateBranchPaymentMethodAction` migrated to `can()`.
  - `src/app/api/cashier/orders/route.ts`: `GET` endpoint migrated to `can()`.

### Domain 3: Inventory Core & Cost Intelligence
- **Migrated Files**:
  - `src/server/actions/inventory.ts`: All 11 inventory mutations (`createInventoryCategoryAction`, `createStorageLocationAction`, `createInventoryItemAction`, `recordStockAdjustmentAction`, `recordWasteAction`, `createStockCountAction`, `submitStockCountAction`, `approveStockCountAction`, `createStockTransferAction`, `sendStockTransferAction`, `receiveStockTransferAction`) migrated to `can()`.
  - `src/server/actions/inventory-settings.ts`: `updateInventorySettingsAction` migrated to `can()`.
  - `src/server/services/inventory-intelligence.service.ts`: `getMenuEngineeringMatrix` and `getCogsFinancialReport` migrated to `can()`.

### Domain 4: Purchasing & Suppliers
- **Migrated Files**:
  - `src/server/actions/purchasing.ts`: `createSupplierAction`, `updateSupplierAction`, `upsertSupplierItemAction`, `removeSupplierItemAction`, `getSupplierItemPriceHistoryAction`, `createPurchaseOrderAction`, `approvePurchaseOrderAction`, `cancelPurchaseOrderAction`, `recordGoodsReceiptAction`, `recordSupplierReturnAction` migrated to `can()` and `resolveAuthorizationContext()`.

### Domain 5: Staff, People & Organization Architecture
- **Migrated Files**:
  - `src/server/services/staff-invitation.service.ts`: `createInvitation`, `verifyStaffManagementAccess` migrated to `can()`.
  - `src/server/actions/organization.ts`: All 24 organization lifecycle server actions migrated to `can()`.
  - `src/server/actions/permission.ts`: `createCustomRoleAction`, `updateCustomRoleAction`, `listCustomRolesAction`, `setMemberOverrideAction`, `removeMemberOverrideAction`, `updateMemberRoleAction`, `setMembershipStatusAction`, `listTeamMembersAction` migrated to `can()`.

### Domain 6: Menu, Modifiers, Tables & Recipes
- **Migrated Files**:
  - `src/server/actions/menu.ts`: Category management, menu items (create, update, price update, availability update, archive) migrated to `can()`.
  - `src/server/actions/modifier.ts`: Modifier group and modifier option mutations migrated to `can()`.
  - `src/server/actions/table.ts`: Service areas, dining tables (create, update, archive, status, PIN generation) migrated to `can()`.
  - `src/server/actions/recipe.ts`: Recipe creation and prep batch production migrated to `can()`.

### Domain 7: Business, Branch & Security Settings
- **Migrated Files**:
  - `src/server/actions/order-security.ts`: `getBranchOrderSecuritySettingsAction`, `updateBranchOrderSecuritySettingsAction`, `applySecurityPresetAction` migrated to `can()`.
  - `src/server/actions/branch.ts`: `createBranchAction`, `updateBranchAction`, `archiveBranchAction`, `restoreBranchAction`, `deleteBranchAction` migrated to `can()`.

---

---

## 4. Live Supabase Schema Table-Name Verification

The resource scope resolver and production domain mutations map strictly to the authoritative live Supabase table schema:

| Domain Resource Type | Live Supabase Table Name | Verified Columns Queried for Scope Resolution |
| :--- | :--- | :--- |
| `order` | `public.orders` | `id`, `business_id`, `branch_id`, `table_id`, `customer_user_id` |
| `inventory_item` | `public.inventory_items` | `id`, `business_id` |
| `inventory_location` | `public.inventory_storage_locations` | `id`, `business_id`, `branch_id` |
| `inventory_count` | `public.inventory_stock_counts` | `id`, `business_id`, `branch_id`, `created_by` |
| `inventory_transaction` | `public.inventory_stock_transfers` | `id`, `business_id`, `source_branch_id`, `destination_branch_id`, `created_by` |
| `purchase_order` | `public.inventory_purchase_orders` | `id`, `business_id`, `branch_id`, `created_by` |
| `recipe` | `public.inventory_recipes` | `id`, `business_id`, `branch_id`, `created_by` |
| `supplier` | `public.inventory_suppliers` | `id`, `business_id` |
| `payment` | `public.payments` | `id`, `business_id`, `branch_id`, `received_by` |
| `business_membership` | `public.business_memberships` | `id`, `business_id`, `user_id` |
| `staff_assignment` | `public.staff_assignments` | `id`, `business_id`, `branch_id`, `department_id`, `unit_id`, `business_membership_id` |
| `dining_table` | `public.dining_tables` | `id`, `business_id`, `branch_id`, `service_area_id` |
| `service_area` | `public.service_areas` | `id`, `business_id`, `branch_id` |
| `modifier_group` | `public.modifier_groups` | `id`, `business_id`, `branch_id` |
| `menu_item` | `public.menu_items` | `id`, `business_id`, `branch_id` |
| `branch` | `public.branches` | `id`, `business_id` |
| `department` | `public.organization_departments` | `id`, `business_id`, `branch_id` |
| `organization_unit` | `public.organization_units` | `id`, `business_id`, `branch_id`, `department_id` |

---

## 5. Verification & Test Coverage Summary

- **New Test Suite**: `scripts/verify-rbac-v2-integration.ts` (`npm run verify:rbac-v2-integration`)
  - 40/40 assertions passed covering all 7 production domains, resource scoping, boundary denials, explicit overrides, acting authorities, secondments, and tenant isolation.
- **Engine Test Suite**: `scripts/verify-rbac-v2-engine.ts` (`npm run verify:rbac-v2-engine`)
  - 83/83 policy engine unit and regression tests passing.
- **Context Resolver Test Suite**: `scripts/verify-rbac-v2-context.ts` (`npm run verify:rbac-v2-context`)
  - 45/45 trusted context resolution tests passing.
- **Schema & Baseline Test Suites**:
  - `verify:rbac-v2-schema`: All scope presets and schema constraints verified (62/62 passing).
  - `verify:phase30-security-baseline`: Complete audit baseline passing (35/35 passing).
  - Full domain regression suites passing across organization (119/119), orders (17/17), payments (12/12), modifiers (22/22), and super-admin (27/27).

