# Phase 30 Step 5: Production Authorization Integration Map

This document establishes the authoritative migration map for transitioning production mutations and security-sensitive operations from legacy ad-hoc checks (`PermissionService.hasPermission`, raw role comparisons, manual tenant checks) to the centralized **RBAC & Scope V2 Policy Engine** (`requirePermission()` / `can()`).

---

## 1. Orders & Kitchen Module

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `updateOrderStatusAction` | `src/server/actions/order.ts` | Delegates to `OrderService.updateOrderStatus` | `orders.update_status`, `orders.cancel`, `kitchen.update`, `cashier.access`, `payments.record` | `order` | `PROPERTY` | **V2 Authoritative** |
| `OrderService.updateOrderStatus` | `src/server/services/order.service.ts` | `PermissionService.hasPermission` with branch ID | `orders.cancel` (cancel), `kitchen.update` \| `orders.update_status` (preparing/ready), `orders.update_status` \| `cashier.access` \| `payments.record` (completed) | `order` | `PROPERTY` / `AREA_TEAM` | **V2 Authoritative** |
| `approveGuestOrderAction` | `src/server/actions/waiter-approval.ts` | `PermissionService.hasPermission` | `waiter.requests.manage`, `waiter.access`, `orders.update_status` | `order` | `PROPERTY` / `AREA_TEAM` | **V2 Authoritative** |
| `rejectGuestOrderAction` | `src/server/actions/waiter-approval.ts` | `PermissionService.hasPermission` | `waiter.requests.manage`, `waiter.access`, `orders.cancel`, `orders.update_status` | `order` | `PROPERTY` / `AREA_TEAM` | **V2 Authoritative** |
| `getPendingApprovalsAction` | `src/server/actions/waiter-approval.ts` | `PermissionService.hasPermission` | `waiter.requests.view`, `waiter.access`, `orders.view` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `submitGuestOrderAction` | `src/server/actions/order.ts` | Public / Token-authenticated | Public guest order creation (RPC PIN/HMAC verified) | `order` | Public Customer | **Retained (Intentionally Public)** |
| `getPublicOrderTrackingStateAction` | `src/server/actions/order.ts` | Public access token | Token-authenticated tracking | `order` | Public Customer | **Retained (Intentionally Public)** |

---

## 2. Payments & Cashier Module

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `recordOrderPaymentAction` | `src/server/actions/payment.ts` | Delegates to `PaymentService.recordPayment` | `payments.record`, `cashier.access` | `order` | `PROPERTY` | **V2 Authoritative** |
| `PaymentService.recordPayment` | `src/server/services/payment.service.ts` | `PermissionService.hasPermission` | `payments.record`, `cashier.access` | `order` | `PROPERTY` | **V2 Authoritative** |
| `voidOrderPaymentAction` | `src/server/actions/payment.ts` | Delegates to `PaymentService.voidPayment` | `payments.void` | `order` / `payment` | `PROPERTY` | **V2 Authoritative** |
| `PaymentService.voidPayment` | `src/server/services/payment.service.ts` | `PermissionService.hasPermission` | `payments.void` | `payment` | `PROPERTY` | **V2 Authoritative** |
| `getCashierOrders` | `src/server/services/payment.service.ts` | Active branch context check | `cashier.access`, `orders.view` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `GET /api/cashier/orders` | `src/app/api/cashier/orders/route.ts` | `PermissionService.hasPermission` | `cashier.access`, `orders.view` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `updateBranchPaymentMethodAction` | `src/server/actions/branch-payment.ts` | `PermissionService.hasPermission` | `branches.operational.manage`, `branches.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `acknowledgeBillRequestAction` | `src/server/actions/payment.ts` | Active branch context check | `waiter.requests.manage`, `cashier.access` | `branch` | `PROPERTY` | **V2 Authoritative** |

---

## 3. Inventory Core & Cost Intelligence

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `createInventoryCategoryAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.items.manage` | `inventory_item` | `ORGANIZATION` | **V2 Authoritative** |
| `createStorageLocationAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.locations.manage` | `inventory_location` | `PROPERTY` | **V2 Authoritative** |
| `createInventoryItemAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.items.manage` | `inventory_item` | `ORGANIZATION` | **V2 Authoritative** |
| `recordStockAdjustmentAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.adjust` | `inventory_location` | `PROPERTY` | **V2 Authoritative** |
| `recordWasteAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.waste.record` | `inventory_location` | `PROPERTY` | **V2 Authoritative** |
| `createStockCountAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.counts.manage` | `inventory_count` | `PROPERTY` | **V2 Authoritative** |
| `submitStockCountAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.counts.manage`, `inventory.counts.approve` | `inventory_count` | `PROPERTY` | **V2 Authoritative** |
| `approveStockCountAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.counts.approve` | `inventory_count` | `PROPERTY` | **V2 Authoritative** |
| `createStockTransferAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.transfers.manage` | `inventory_transaction` | `PROPERTY` | **V2 Authoritative** |
| `receiveStockTransferAction` | `src/server/actions/inventory.ts` | `PermissionService.hasPermission` | `inventory.transfers.receive` | `inventory_transaction` | `PROPERTY` | **V2 Authoritative** |
| `updateInventorySettingsAction` | `src/server/actions/inventory-settings.ts` | `PermissionService.hasPermission` | `inventory.settings.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `getMenuEngineeringMatrix` | `src/server/services/inventory-intelligence.service.ts` | `PermissionService.hasPermission` | `inventory.menu_profitability.view` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `getCogsFinancialReport` | `src/server/services/inventory-intelligence.service.ts` | `PermissionService.hasPermission` | `inventory.cogs.view` | `branch` | `PROPERTY` | **V2 Authoritative** |

---

## 4. Purchasing & Suppliers Module

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `createSupplierAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `suppliers.manage` | `supplier` | `ORGANIZATION` | **V2 Authoritative** |
| `updateSupplierAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `suppliers.manage` | `supplier` | `ORGANIZATION` | **V2 Authoritative** |
| `upsertSupplierItemAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `suppliers.manage` | `supplier` | `ORGANIZATION` | **V2 Authoritative** |
| `createPurchaseOrderAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `purchasing.create` | `purchase_order` | `PROPERTY` | **V2 Authoritative** |
| `recordGoodsReceiptAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `purchasing.receive` | `purchase_order` | `PROPERTY` | **V2 Authoritative** |
| `recordSupplierReturnAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `suppliers.manage`, `purchasing.receive` | `purchase_order` | `PROPERTY` | **V2 Authoritative** |
| `cancelPurchaseOrderAction` | `src/server/actions/purchasing.ts` | `PermissionService.hasPermission` | `purchasing.approve`, `purchasing.create` | `purchase_order` | `PROPERTY` | **V2 Authoritative** |

---

## 5. Staff, People & Organization Architecture

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `createInvitationAction` / `createInvitation` | `src/server/services/staff-invitation.service.ts` | Hardcoded `role === 'business_owner'` | `staff.invite`, `staff.manage` | `branch` | `PROPERTY` / `ORGANIZATION` | **V2 Authoritative** |
| `revokeInvitationAction` | `src/server/actions/staff-invitation.ts` | Hardcoded `role === 'business_owner'` | `staff.manage`, `invitations.manage` | `branch` | `PROPERTY` / `ORGANIZATION` | **V2 Authoritative** |
| `regenerateInvitationAction` | `src/server/actions/staff-invitation.ts` | Hardcoded `role === 'business_owner'` | `staff.invite`, `staff.manage` | `branch` | `PROPERTY` / `ORGANIZATION` | **V2 Authoritative** |
| `claimInvitationAction` | `src/server/actions/staff-invitation.ts` | Public / Token claim | Token-authenticated claim | Invite Token | Public Auth | **Retained (Intentionally Token Auth)** |
| `createStaffAssignmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `people.manage` | `staff_assignment` | `PROPERTY` / `DEPARTMENT` | **V2 Authoritative** |
| `updateStaffAssignmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `people.manage` | `staff_assignment` | `PROPERTY` / `DEPARTMENT` | **V2 Authoritative** |
| `endStaffAssignmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `people.manage` | `staff_assignment` | `PROPERTY` / `DEPARTMENT` | **V2 Authoritative** |
| `createActingAssignmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `people.manage` | `staff_assignment` | `PROPERTY` / `DEPARTMENT` | **V2 Authoritative** |
| `createSecondmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `people.manage` | `staff_assignment` | `PROPERTY` | **V2 Authoritative** |
| `createDepartmentAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `organization.manage` | `department` | `PROPERTY` / `ORGANIZATION` | **V2 Authoritative** |
| `createOrganizationUnitAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `organization.manage` | `organization_unit` | `PROPERTY` / `AREA_TEAM` | **V2 Authoritative** |
| `createPositionAction` | `src/server/actions/organization.ts` | `PermissionService.hasPermission` | `positions.manage`, `organization.manage` | `department` | `ORGANIZATION` / `PROPERTY` | **V2 Authoritative** |

---

## 6. Menu, Modifiers, Tables & Security Settings

| Entry Point | Location | Current Authorization | Required Permission(s) | Resource Type | Expected Scope | V2 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `createMenuCategoryAction` | `src/server/actions/menu.ts` | `PermissionService.hasPermission` | `menu.categories.manage`, `menu.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `createMenuItemAction` | `src/server/actions/menu.ts` | `PermissionService.hasPermission` | `menu.items.create`, `menu.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `updateMenuItemAction` | `src/server/actions/menu.ts` | `PermissionService.hasPermission` | `menu.items.edit`, `menu.price.update`, `menu.availability.update`, `menu.manage` | `menu_item` | `PROPERTY` | **V2 Authoritative** |
| `deleteMenuItemAction` | `src/server/actions/menu.ts` | `PermissionService.hasPermission` | `menu.items.delete`, `menu.manage` | `menu_item` | `PROPERTY` | **V2 Authoritative** |
| `createModifierGroupAction` | `src/server/actions/modifier.ts` | `PermissionService.hasPermission` | `menu.modifiers.manage`, `menu.manage` | `menu_item` | `PROPERTY` | **V2 Authoritative** |
| `updateModifierGroupAction` | `src/server/actions/modifier.ts` | `PermissionService.hasPermission` | `menu.modifiers.manage`, `menu.manage` | `modifier_group` | `PROPERTY` | **V2 Authoritative** |
| `createDiningTableAction` | `src/server/actions/table.ts` | `PermissionService.hasPermission` | `tables.create`, `tables.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `updateDiningTableAction` | `src/server/actions/table.ts` | `PermissionService.hasPermission` | `tables.edit`, `tables.manage` | `dining_table` | `PROPERTY` / `AREA_TEAM` | **V2 Authoritative** |
| `createServiceAreaAction` | `src/server/actions/table.ts` | `PermissionService.hasPermission` | `areas.manage`, `tables.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `updateBranchOrderSecuritySettingsAction` | `src/server/actions/order-security.ts` | `PermissionService.hasPermission` | `order_security.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `applySecurityPresetAction` | `src/server/actions/order-security.ts` | `PermissionService.hasPermission` | `order_security.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `createBranchAction` | `src/server/actions/branch.ts` | `PermissionService.hasPermission` | `branches.manage` | `branch` | `ORGANIZATION` | **V2 Authoritative** |
| `updateBranchAction` | `src/server/actions/branch.ts` | `PermissionService.hasPermission` | `branches.operational.manage`, `branches.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `createRecipeAction` | `src/server/actions/recipe.ts` | `PermissionService.hasPermission` | `recipes.manage` | `branch` | `PROPERTY` | **V2 Authoritative** |
| `producePrepBatchAction` | `src/server/actions/recipe.ts` | `PermissionService.hasPermission` | `inventory.production.manage` | `recipe` | `PROPERTY` | **V2 Authoritative** |
