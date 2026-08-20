# WSNexa Phase 30 — Canonical Permission Inventory
**Document**: `docs/phase-30-permission-inventory.md`  
**Phase**: Phase 30 Step 1 — RBAC & Scope V2 Compatibility Baseline  
**Total Unique Permission Keys**: 103  
**Status**: Authoritative Canonical Reference  

---

## 1. Permission Catalog Overview

Every permission in WSNexa represents a discrete action capability. This document catalogs all 103 unique permission keys found in the database catalog (`public.permissions`) and application type schemas (`src/lib/validation/permission.ts`).

### Built-in Role Codes
- **`BO`**: `business_owner` (Un-deniable owner authority — inherits all permissions)
- **`BM`**: `branch_manager`
- **`CS`**: `cashier`
- **`KS`**: `kitchen_staff`
- **`WT`**: `waiter`
- **`SP`**: `supervisor` (Preset template)
- **`OO`**: Owner Only (Restricted from non-owners)

---

## 2. Comprehensive Permission Inventory Table

| # | Permission Key | Category | Risk Level | Default Role Grants | Enforcement Layer | Current Scope Behavior |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `orders.view` | Orders | Low | `BO, BM, CS, KS, WT, SP` | Route Guard, UI, Actions | Branch-specific |
| 2 | `orders.create` | Orders | Medium | `BO, BM` | Service / Actions | Branch-specific |
| 3 | `orders.update_status` | Orders | Medium | `BO, BM, SP` | Service Layer | Branch-specific |
| 4 | `orders.cancel` | Orders | High | `BO, BM` | Service Layer | Branch-specific |
| 5 | `orders.history.view` | Orders | Low | `BO, BM, CS, SP` | UI / Actions | Branch-specific |
| 6 | `waiter.access` | Waiter | Low | `BO, BM, WT` | Route Guard, UI | Branch / Area-specific |
| 7 | `waiter.requests.view` | Waiter | Low | `BO, BM, WT` | Route Guard, UI, Service | Branch / Area-specific |
| 8 | `waiter.requests.manage` | Waiter | Low | `BO, BM, WT` | Actions, Service | Branch / Area-specific |
| 9 | `waiter.orders.create` | Waiter | Medium | `BO, BM, WT` | Actions, Service | Branch / Area-specific |
| 10 | `kitchen.access` | Kitchen | Low | `BO, BM, KS` | Route Guard, UI | Branch-specific |
| 11 | `kitchen.orders.view` | Kitchen | Low | `BO, BM, KS` | Service, UI | Branch-specific |
| 12 | `kitchen.update` | Kitchen | Medium | `BO, BM, KS` | Actions, Service | Branch-specific |
| 13 | `cashier.access` | Cashier & Payments | Medium | `BO, BM, CS` | Route Guard, UI, API | Branch-specific |
| 14 | `payments.view` | Cashier & Payments | Medium | `BO, BM, CS` | Actions, Service | Branch-specific |
| 15 | `payments.record` | Cashier & Payments | High | `BO, BM, CS` | Service Layer, RPC | Branch-specific |
| 16 | `payments.void` | Cashier & Payments | High | `BO, BM` | Service Layer | Branch-specific |
| 17 | `payments.refund` | Cashier & Payments | Critical | `BO` | Service Layer | Branch-specific |
| 18 | `receipts.print` | Cashier & Payments | Low | `BO, BM, CS` | Service, UI | Branch-specific |
| 19 | `menu.view` | Menu Catalog | Low | `BO, BM, CS, KS, WT, SP` | Route Guard, UI | Organization-wide |
| 20 | `menu.manage` (legacy) | Menu Catalog | Medium | `BO, BM` | Actions (fallback) | Organization / Branch |
| 21 | `menu.items.create` | Menu Catalog | Medium | `BO, BM` | Route Guard, Actions | Organization / Branch |
| 22 | `menu.items.edit` | Menu Catalog | Medium | `BO, BM` | Actions | Organization / Branch |
| 23 | `menu.price.update` | Menu Catalog | High | `BO, BM` | Actions | Organization / Branch |
| 24 | `menu.availability.update` | Menu Catalog | Low | `BO, BM, SP` | Actions | Branch-specific |
| 25 | `menu.items.delete` | Menu Catalog | High | `BO, BM` | Actions | Organization / Branch |
| 26 | `menu.categories.manage` | Menu Catalog | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 27 | `menu.modifiers.manage` | Menu Catalog | Medium | `BO, BM` | Actions | Organization / Branch |
| 28 | `tables.view` | Dining & Tables | Low | `BO, BM, CS, WT, SP` | Route Guard, UI | Branch-specific |
| 29 | `tables.manage` (legacy) | Dining & Tables | Medium | `BO, BM` | Actions (fallback) | Branch-specific |
| 30 | `tables.status.update` | Dining & Tables | Low | `BO, BM, WT, SP` | Actions | Branch / Area-specific |
| 31 | `tables.create` | Dining & Tables | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 32 | `tables.edit` | Dining & Tables | Medium | `BO, BM` | Actions | Branch-specific |
| 33 | `tables.delete` | Dining & Tables | High | `BO, BM` | Actions | Branch-specific |
| 34 | `areas.view` | Dining & Tables | Low | `BO, BM` | Actions, UI | Branch-specific |
| 35 | `areas.manage` | Dining & Tables | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 36 | `qr.view` | Dining & Tables | Low | `BO, BM` | UI | Branch-specific |
| 37 | `qr.manage` (legacy) | Dining & Tables | Medium | `BO, BM` | Actions (fallback) | Branch-specific |
| 38 | `qr.generate` | Dining & Tables | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 39 | `qr.security.reset` | Dining & Tables | High | `BO, BM` | Actions | Branch-specific |
| 40 | `reports.view` | Reports & Analytics | Low | `BO, BM, CS, SP` | Route Guard, UI | Branch / Org |
| 41 | `reports.financial.view`| Reports & Analytics | High | `BO, BM` | Service, UI | Branch / Org |
| 42 | `reports.export` | Reports & Analytics | Medium | `BO, BM` | Actions | Branch / Org |
| 43 | `staff.view` | Team & Staff | Low | `BO, BM` | Route Guard, Service | Branch / Org |
| 44 | `staff.manage` (legacy) | Team & Staff | High | `BO, BM` | Actions, Service | Organization-wide |
| 45 | `staff.invite` | Team & Staff | Medium | `BO, BM` | Route Guard, Actions | Organization / Branch |
| 46 | `staff.edit` | Team & Staff | Medium | `BO, BM` | Actions, Service | Organization / Branch |
| 47 | `staff.suspend` | Team & Staff | High | `BO, BM` | Actions, Service | Organization-wide |
| 48 | `staff.role.assign` | Team & Staff | High | `BO, BM` | Actions, Service | Organization-wide |
| 49 | `staff.branch.assign` | Team & Staff | Medium | `BO` | Actions, Service | Organization-wide |
| 50 | `staff.area.assign` | Team & Staff | Medium | `BO, BM` | Actions, Service | Branch-specific |
| 51 | `roles.view` | Team & Staff | Low | `BO` | Route Guard, Service | Organization-wide |
| 52 | `roles.manage` | Team & Staff | Critical | `BO (OO)` | Service Layer | Organization-wide |
| 53 | `permissions.override.manage` | Team & Staff | Critical | `BO (OO)` | Service Layer | Organization-wide |
| 54 | `branches.view` | Branches | Low | `BO` | UI | Organization-wide |
| 55 | `branches.operational.manage` | Branches | Medium | `BO, BM` | Actions, Service | Branch-specific |
| 56 | `branches.manage` | Branches | Critical | `BO (OO)` | Route Guard, Actions | Organization-wide |
| 57 | `business.view` | Business Settings | Low | `BO` | UI | Organization-wide |
| 58 | `business.settings.manage` | Business Settings | Critical | `BO (OO)` | Route Guard, Actions | Organization-wide |
| 59 | `venue_profile.view` | Venue Profile | Low | `BO, BM` | UI | Organization-wide |
| 60 | `venue_profile.manage` | Venue Profile | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 61 | `reviews.view` | Reviews & Reputation | Low | `BO, BM` | Route Guard, UI | Organization / Branch |
| 62 | `reviews.respond` | Reviews & Reputation | Medium | `BO, BM` | Route Guard, Actions | Organization / Branch |
| 63 | `reviews.moderate` | Reviews & Reputation | High | `BO` | Actions | Organization-wide |
| 64 | `reputation.view` | Reviews & Reputation | Low | `BO, BM` | Route Guard, UI | Organization-wide |
| 65 | `reputation.export` | Reviews & Reputation | Medium | `BO` | Actions | Organization-wide |
| 66 | `loyalty.view` | Loyalty & Rewards | Low | `BO, BM` | Route Guard, UI | Organization-wide |
| 67 | `loyalty.manage` | Loyalty & Rewards | Medium | `BO` | Route Guard, Actions | Organization-wide |
| 68 | `loyalty.rewards.manage` | Loyalty & Rewards | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 69 | `loyalty.customers.view` | Loyalty & Rewards | Low | `BO, BM` | Route Guard, Actions | Organization-wide |
| 70 | `loyalty.points.adjust` | Loyalty & Rewards | High | `BO` | Actions | Organization-wide |
| 71 | `order_security.view` | Order Security | Medium | `BO` | Route Guard, UI | Branch-specific |
| 72 | `order_security.manage`| Order Security | Critical | `BO (OO)` | Actions, Service | Branch-specific |
| 73 | `inventory.view` | Inventory | Low | `BO, BM, KS` | Route Guard, UI, Actions | Branch / Org |
| 74 | `inventory.items.manage` | Inventory | Medium | `BO, BM` | Route Guard, Actions | Organization / Branch |
| 75 | `inventory.costs.view` | Inventory | High | `BO, BM` | Service, UI | Organization / Branch |
| 76 | `inventory.adjust` | Inventory | High | `BO, BM` | Actions, Service | Branch-specific |
| 77 | `inventory.counts.manage` | Inventory | Medium | `BO, BM, KS` | Route Guard, Actions | Branch-specific |
| 78 | `inventory.counts.approve` | Inventory | High | `BO, BM` | Actions, Service | Branch-specific |
| 79 | `inventory.waste.record` | Inventory | Medium | `BO, BM, KS` | Route Guard, Actions | Branch-specific |
| 80 | `inventory.transfers.manage` | Inventory | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 81 | `inventory.transfers.receive` | Inventory | Medium | `BO, BM` | Actions, Service | Branch-specific |
| 82 | `inventory.locations.manage` | Inventory | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 83 | `inventory.reports.view` | Inventory | Low | `BO, BM` | UI, Actions | Branch / Org |
| 84 | `recipes.view` | Recipes & Production | Low | `BO, BM, KS` | Route Guard, UI, Actions | Organization-wide |
| 85 | `recipes.manage` | Recipes & Production | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 86 | `recipes.costs.view` | Recipes & Production | High | `BO, BM` | Service, UI | Organization-wide |
| 87 | `purchasing.view` | Purchasing & Suppliers | Low | `BO, BM` | Route Guard, UI | Branch / Org |
| 88 | `purchasing.create` | Purchasing & Suppliers | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 89 | `purchasing.approve` | Purchasing & Suppliers | High | `BO, BM` | Actions, Service | Branch-specific |
| 90 | `purchasing.receive` | Purchasing & Suppliers | Medium | `BO, BM` | Route Guard, Actions | Branch-specific |
| 91 | `suppliers.view` | Purchasing & Suppliers | Low | `BO, BM` | Route Guard, UI | Organization-wide |
| 92 | `suppliers.manage` | Purchasing & Suppliers | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 93 | `inventory.cogs.view` | Inventory Intelligence | High | `BO, BM` | Service, UI | Branch / Org |
| 94 | `inventory.menu_profitability.view` | Inventory Intelligence | Medium | `BO, BM` | Service, UI | Branch / Org |
| 95 | `inventory.settings.manage` | Inventory Intelligence | High | `BO, BM` | Actions, Service | Organization / Branch |
| 96 | `inventory.production.manage` | Recipes & Production | Medium | `BO, BM, KS` | Route Guard, Actions | Branch-specific |
| 97 | `organization.view` | Organization & People | Low | `BO, BM` | Route Guard, UI | Organization-wide |
| 98 | `organization.manage` | Organization & People | High | `BO, BM` | Actions, Service | Organization-wide |
| 99 | `people.view` | Organization & People | Low | `BO, BM` | Route Guard, UI | Organization-wide |
| 100 | `people.manage` | Organization & People | High | `BO, BM` | Actions, Service | Organization-wide |
| 101 | `positions.manage` | Organization & People | Medium | `BO, BM` | Route Guard, Actions | Organization-wide |
| 102 | `invitations.manage` (legacy) | Staff & Team | High | `BO` | Actions (fallback) | Organization-wide |
| 103 | `owner.transfer` | Owner Operations | Critical | `BO (OO)` | Actions, Service | Organization-wide |

---

## 3. Preserved Legacy Permission Aliases

For strict backward compatibility, the following 4 legacy keys are preserved in the catalog and mapped internally:

1. `menu.manage` $\rightarrow$ broad category encompassing `menu.items.*`, `menu.price.update`, `menu.categories.manage`, `menu.modifiers.manage`.
2. `tables.manage` $\rightarrow$ broad category encompassing `tables.create`, `tables.edit`, `tables.delete`, `areas.manage`.
3. `qr.manage` $\rightarrow$ broad category encompassing `qr.view`, `qr.generate`, `qr.security.reset`.
4. `staff.manage` $\rightarrow$ broad category encompassing `staff.invite`, `staff.edit`, `staff.suspend`, `staff.role.assign`, `roles.*`, `permissions.override.manage`.
5. `invitations.manage` $\rightarrow$ legacy alias for `staff.invite`.

---

## 4. Permission Key Distribution by Domain

```
  Orders & Waiter:       9 keys
  Kitchen:               3 keys
  Cashier & Payments:    6 keys
  Menu & Modifiers:      9 keys
  Dining, Tables & QR:  12 keys
  Reports & Analytics:   3 keys
  Team, Roles & Staff:  11 keys
  Branches & Business:   5 keys
  Venue, Reviews & Rep:  7 keys
  Loyalty & Rewards:     5 keys
  Order Security:        2 keys
  Inventory Core:       11 keys
  Recipes & Purchasing: 14 keys
  Org & People (Ph 29):  5 keys
  Owner Transfer:        1 key
  ---------------------------------
  Total Unique Keys:   103 keys
```
