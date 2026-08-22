# WSNexa — Phase 30 Step 9 Legacy Authorization Audit

## Executive Summary
This document provides a comprehensive audit of all authorization paths in the WSNexa production codebase as of Phase 30 Step 9.
Every occurrence of legacy authorization helpers, hardcoded role checks, route guards, and identity resolutions has been categorized, analyzed, and mapped to its authoritative Phase 30 RBAC V2 target.

---

## 1. Classification Taxonomy

Each discovered path is classified into one of the following canonical categories:

- **Class A: RBAC V2 Authoritative** — Uses `resolveAuthorizationContext()`, `can()`, `authorize()`, or `requireBusinessPermission()`.
- **Class B: Legacy but Intentionally Retained** — Legacy helper retained for backward compatibility (e.g. `PermissionService.getMemberEffectivePermissions` for UI presets or non-critical queries), marked `@deprecated` for security mutations.
- **Class C: Legacy and Must Migrate** — Security-sensitive mutation or read relying on legacy `PermissionService.hasPermission()`, hardcoded role checks, or unvalidated inputs. Migrated in Step 9.
- **Class D: UI-Only / UX Navigation Helper** — Client or server-render display logic (e.g., `resolveAccountRoute`, menu navigation rendering).
- **Class E: Public / Customer Flow** — Token-based or customer session flow (e.g. QR guest order, customer favorites, table access proofs). Intentionally separate from staff RBAC.
- **Class F: Platform Super Admin Flow** — Platform-level administration (`is_super_admin`, `SuperAdminService`), isolated from tenant business RBAC.
- **Class G: Domain Business Invariant** — Legitimate business logic checking role (e.g. preventing owner demotion, calculating default presets), NOT authorization.

---

## 2. Server Action Audit & Migration Inventory

| File | Function / Action | Current Mechanism | Classification | Required Permission / Scope | Target V2 Path |
|------|-------------------|-------------------|----------------|-----------------------------|----------------|
| `src/server/actions/service-area.ts` | `createServiceAreaAction` | `PermissionService.hasPermission` + `role === 'business_owner'` | Class C | `areas.manage` (branch scope) | `resolveAuthorizationContext()` + `can({ permission: 'areas.manage' })` |
| `src/server/actions/service-area.ts` | `updateServiceAreaAction` | `PermissionService.hasPermission` + `role === 'business_owner'` | Class C | `areas.manage` (area scope) | `resolveAuthorizationContext()` + `can({ permission: 'areas.manage', resource: { type: 'service_area', id } })` |
| `src/server/actions/service-area.ts` | `deleteServiceAreaAction` | `PermissionService.hasPermission` + `role === 'business_owner'` | Class C | `areas.manage` (area scope) | `resolveAuthorizationContext()` + `can({ permission: 'areas.manage', resource: { type: 'service_area', id } })` |
| `src/server/actions/service-area.ts` | `assignStaffToAreasAction` | None (unprotected) | Class C | `staff.area.assign` (branch scope) | `resolveAuthorizationContext()` + `can({ permission: 'staff.area.assign' })` |
| `src/server/actions/service-area.ts` | `setBranchOrderingModeAction` | None (unprotected) | Class C | `branches.operational.manage` (branch scope) | `resolveAuthorizationContext()` + `can({ permission: 'branches.operational.manage' })` |
| `src/server/actions/waiter-order.ts` | `createWaiterOrderAction` | `PermissionService.hasPermission` + role check | Class C | `waiter.orders.create` (area/branch scope) | `resolveAuthorizationContext()` + `can({ permission: 'waiter.orders.create' })` + area check |
| `src/server/actions/venue-discovery.ts` | `upsertVenueProfileAction` | `PermissionService.hasPermission` | Class C | `venue_profile.manage` (business scope) | `resolveAuthorizationContext()` + `can({ permission: 'venue_profile.manage' })` |
| `src/server/actions/venue-discovery.ts` | `toggleVenuePublishedStatusAction` | `PermissionService.hasPermission` | Class C | `venue_profile.manage` (business scope) | `resolveAuthorizationContext()` + `can({ permission: 'venue_profile.manage' })` |
| `src/server/actions/venue-discovery.ts` | `respondToReviewAction` | `PermissionService.hasPermission` | Class C | `reviews.respond` (business scope) | `resolveAuthorizationContext()` + `can({ permission: 'reviews.respond' })` |
| `src/server/actions/venue-discovery.ts` | `searchVenuesAction`, `getVenueBySlugAction` | Public | Class E | None (Public discovery) | Preserved |
| `src/server/actions/venue-discovery.ts` | `toggleFavoriteVenueAction`, `createReviewAction`, etc. | Customer Auth | Class E | Customer User Session | Preserved |
| `src/server/actions/venue-ranking.ts` | `getBusinessReputationAction` | `PermissionService.hasPermission` | Class C | `reputation.view` (business scope) | `resolveAuthorizationContext()` + `can({ permission: 'reputation.view' })` |
| `src/server/actions/report.ts` | `fetchAnalyticsAction` | Delegates to `ReportService` | Class C | `reports.view` (branch/business scope) | `resolveAuthorizationContext()` + `can({ permission: 'reports.view' })` |
| `src/server/actions/report.ts` | `exportReportAction` | Delegates to `ReportService` | Class C | `reports.export` (branch/business scope) | `resolveAuthorizationContext()` + `can({ permission: 'reports.export' })` |
| `src/server/actions/menu.ts` | All 11 actions | RBAC V2 `can()` + `resource` | Class A | `menu.*` | Already authoritative |
| `src/server/actions/modifier.ts` | All 8 actions | RBAC V2 `can()` + `resource` | Class A | `menu.modifiers.manage` | Already authoritative |
| `src/server/actions/table.ts` | All 15 actions | RBAC V2 `can()` + `resource` | Class A | `tables.*` | Already authoritative |
| `src/server/actions/order-security.ts` | All 5 actions | RBAC V2 `can()` + `resource` | Class A | `business.settings.manage` | Already authoritative |
| `src/server/actions/branch-payment.ts` | All 3 actions | RBAC V2 `can()` + `resource` | Class A | `business.settings.manage` | Already authoritative |
| `src/server/actions/branch.ts` | All 4 actions | RBAC V2 `can()` + `resource` | Class A | `branches.manage` | Already authoritative |
| `src/server/actions/inventory.ts` | All 14 actions | RBAC V2 `can()` + `resource` | Class A | `inventory.*` | Already authoritative |
| `src/server/actions/purchasing.ts` | All 9 actions | RBAC V2 `can()` + `resource` | Class A | `purchasing.*` | Already authoritative |
| `src/server/actions/recipe.ts` | All 3 actions | RBAC V2 `can()` + `resource` | Class A | `recipes.*` | Already authoritative |
| `src/server/actions/organization.ts` | All 30 actions | RBAC V2 `can()` + `resource` | Class A | `organization.*`, `people.*` | Already authoritative |
| `src/server/actions/permission.ts` | All 18 actions | RBAC V2 `can()` + `resource` | Class A | `roles.*`, `staff.role.assign` | Already authoritative |
| `src/server/actions/waiter-approval.ts` | All 3 actions | RBAC V2 `can()` + `resource` | Class A | `waiter.requests.manage` | Already authoritative |
| `src/server/actions/super-admin.ts` | All actions | `SuperAdminService` | Class F | Platform Super Admin | Preserved |

---

## 3. Server Service Audit & Migration Inventory

| Service | Method | Current Mechanism | Classification | Target V2 Path |
|---------|--------|-------------------|----------------|----------------|
| `ReportService` | `getAnalyticsPayload` | Hardcoded `role in ['business_owner', ...]` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'reports.view', resource: { type: 'branch', id } })` |
| `QrService` | `generateBranchQr`, `regenerateBranchQr`, `disableBranchQr` | `role !== 'business_owner' && role !== 'branch_manager'` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'qr.generate' | 'qr.manage' })` |
| `QrService` | `updateBranchOrderingSettings` | `role !== 'business_owner' && role !== 'branch_manager'` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'branches.operational.manage' | 'business.settings.manage' })` |
| `RecipeService` | `getRecipes` (cost redaction) | Dynamic `PermissionService.hasPermission` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'recipes.costs.view' })` |
| `RecipeService` | `getRecipeById` (cost redaction) | Dynamic `PermissionService.hasPermission` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'recipes.costs.view' })` |
| `RecipeService` | `createRecipe` | Dynamic `PermissionService.hasPermission` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'recipes.manage' })` |
| `RecipeService` | `processBatchProduction` | Dynamic `PermissionService.hasPermission` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'recipes.produce' })` |
| `VenueMediaService` | `uploadImage`, `deleteImage` | `PermissionService.hasPermission` | Class C | `resolveAuthorizationContext()` + `can({ permission: 'venue_profile.manage' })` |
| `AccountService` | `resolveAccountRoute` | Role string switch & permission reading for UI route | Class D | Retained as UX navigation helper |
| `PermissionService` | `hasPermission`, `verifyBranchBoundary`, `requirePermission` | Legacy compatibility helpers | Class B | Marked `@deprecated`, retained for legacy test/UI compatibility |
| `OrderService` | `updateOrderStatus` | `resolveAuthorizationContext()` + `can()` | Class A | Already authoritative |
| `PaymentService` | `recordPayment`, `voidPayment` | `resolveAuthorizationContext()` + `can()` | Class A | Already authoritative |
| `InventoryIntelligenceService` | `getMenuEngineeringMatrix`, `getCogsFinancialReport` | `resolveAuthorizationContext()` + `can()` | Class A | Already authoritative |

---

## 4. API Routes Audit

| Route | Methods | Current Mechanism | Status |
|-------|---------|-------------------|--------|
| `src/app/api/cashier/orders/route.ts` | GET | `resolveAuthorizationContext()` + `can({ permission: 'cashier.access' | 'orders.view' })` + branch match | Class A (Fully migrated & hardened) |
| `src/app/api/auth/logout/route.ts` | POST | Supabase Session signout | Class E (Session lifecycle) |

---

## 5. Tenant Guard Audit

| File | Function | Current Mechanism | Target V2 Path |
|------|----------|-------------------|----------------|
| `src/server/tenant/guard.ts` | `requireRoutePermission` | `PermissionService.hasPermission` | `resolveAuthorizationContext()` + `can({ context, permission: requiredPermission, resource })` |

---

## 6. Distinction: Authorization Check vs Domain Business Invariant

Not all `role === 'business_owner'` checks represent authorization. The following are verified legitimate **Domain Business Invariants**:
1. **Owner Protection Against Demotion/Removal**: A business must always have an owner; the owner membership cannot be suspended, deleted, or reassigned to staff by any actor.
2. **Preset Defaults Resolution**: When a new member is invited or a default role is provisioned, preset templates map standard roles to initial scope grants.
3. **Workspace Initial Redirect**: `resolveDefaultWorkspaceRoute('cashier')` directing cashiers to `/dashboard/cashier` upon login.

All **Authorization Decisions** (determining whether a user can perform an action on a resource) are strictly migrated to the centralized Phase 30 Policy Engine (`can()`, `authorize()`).
