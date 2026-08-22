# WSNexa — Phase 30 Step 9 Authorization Convergence Document

## 1. Executive Summary
Phase 30 Step 9 converges all remaining legacy authorization entry points across the WSNexa production codebase onto the authoritative Phase 30 RBAC & Scope V2 architecture.

Every mutation, sensitive read, report generation, and operational setting is now gated by the centralized Policy Engine (`can()`, `authorize()`, `requireBusinessPermission()`) using database-verified `AuthorizationContext` and strict server-side resource scope resolution.

---

## 2. Core Invariants & Architecture Convergence

```
Client Request (Server Action / API Route / Service)
    │
    ▼
resolveAuthorizationContext() ──► Resolves Session User + Active Business + Assignments + Scopes
    │
    ▼
can({ context, permission, resource }) ──► Resolves trusted ResourceScope from Database
    │
    ▼
Policy Engine (src/server/auth/policy-engine.ts)
    │  ├─ 1. Unauthenticated rejection
    │  ├─ 2. Tenant boundary validation (expectedBusinessId === resource.businessId)
    │  ├─ 3. Owner un-deniable bypass (business_owner role)
    │  ├─ 4. Explicit deny override evaluation
    │  ├─ 5. Effective permission check (Custom Role + Built-in Role + Scope Grants)
    │  └─ 6. Scope reach evaluation (Branch, Acting reach, Secondment reach, Department, Unit, Service Area, Self-ownership)
    ▼
Domain Service Execution (via Admin / Standard Supabase Client)
    │
    ▼
Database RLS Hardening (Level 2 Database Defense)
```

---

## 3. Detailed Summary of Migrated Paths

### 3.1 Service Areas (`src/server/actions/service-area.ts`)
- **Before**: Used `PermissionService.hasPermission()` with string parameters and manual `role === 'business_owner'` checks. Actions `assignStaffToAreasAction` and `setBranchOrderingModeAction` lacked authorization checks.
- **After**:
  - `createServiceAreaAction`: Uses `resolveAuthorizationContext()` + `can({ context, permission: 'areas.manage' | 'tables.manage', resource: { type: 'branch', id } })`.
  - `updateServiceAreaAction`: Uses `can({ context, permission: 'areas.manage', resource: { type: 'service_area', id } })`.
  - `deleteServiceAreaAction`: Uses `can({ context, permission: 'areas.manage', resource: { type: 'service_area', id } })`.
  - `assignStaffToAreasAction`: Gated by `can({ context, permission: 'staff.area.assign' | 'staff.manage' | 'areas.manage' })`.
  - `setBranchOrderingModeAction`: Gated by `can({ context, permission: 'branches.operational.manage' | 'branches.manage' | 'business.settings.manage' })`.

### 3.2 Waiter Orders (`src/server/actions/waiter-order.ts`)
- **Before**: Checked `PermissionService.hasPermission()` and role strings (`role !== 'business_owner' && role !== 'branch_manager'`).
- **After**:
  - Validates permission via `can({ context, permission: 'waiter.orders.create' | 'orders.create' | 'orders.view' })`.
  - Dynamically validates table service area assignment reach against user's scoped reach via Policy Engine (`can({ context, permission: 'waiter.orders.create', resource: { type: 'dining_table', id } })`).
  - Session user ID and tenant business ID derived exclusively from `AuthorizationContext`.

### 3.3 Venue Discovery & Reviews (`src/server/actions/venue-discovery.ts`, `src/server/actions/venue-ranking.ts`, `src/server/services/venue-media.service.ts`)
- **Before**: Checked legacy `PermissionService.hasPermission()`.
- **After**:
  - `upsertVenueProfileAction`, `toggleVenuePublishedStatusAction`: Gated by `can({ context, permission: 'venue_profile.manage' })`.
  - `respondToReviewAction`: Gated by `can({ context, permission: 'reviews.respond' })`.
  - `getBusinessReputationAction`: Gated by `can({ context, permission: 'reputation.view' })`.
  - `VenueMediaService.uploadImage` & `removeImage`: Validates `authContext.businessId` match and checks `can({ context, permission: 'venue_profile.manage' })`.

### 3.4 Reports & Analytics (`src/server/actions/report.ts`, `src/server/services/report.service.ts`)
- **Before**: `report.ts` actions were un-gated; `ReportService` checked a hardcoded role array `['business_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'waiter'].includes(role)`.
- **After**:
  - `fetchAnalyticsAction`: Action-level check via `can({ context, permission: 'reports.view' | 'reports.financial.view', resource: branchResource })`.
  - `exportReportAction`: Action-level check via `can({ context, permission: 'reports.export' | 'reports.view', resource: branchResource })`.
  - `ReportService.getAnalyticsPayload`: Internal service-level authorization enforcement via RBAC V2 `can()`.
  - Cross-branch comparison strictly restricted to authorized business-wide owners (`can({ context, permission: 'reports.view' }) && authContext.isOwner`).

### 3.5 QR Codes & Ordering Configuration (`src/server/services/qr.service.ts`)
- **Before**: Checked `role !== 'business_owner' && role !== 'branch_manager'`.
- **After**:
  - `generateBranchQr`: Checked via `can({ context, permission: 'qr.generate' | 'qr.manage' | 'tables.manage', resource: branchResource })`.
  - `regenerateBranchQr`: Checked via `can({ context, permission: 'qr.security.reset' | 'qr.manage' | 'tables.manage', resource: branchResource })`.
  - `disableBranchQr`: Checked via `can({ context, permission: 'qr.manage' | 'tables.manage', resource: branchResource })`.
  - `updateBranchOrderingSettings`: Checked via `can({ context, permission: 'branches.operational.manage' | 'branches.manage' | 'business.settings.manage', resource: branchResource })`.

### 3.6 Recipes & Ingredient Costs (`src/server/services/recipe.service.ts`)
- **Before**: Dynamically imported `PermissionService.hasPermission` for cost view, create, and batch production.
- **After**:
  - `getRecipes` & `getRecipeById` cost redaction: Gated by `can({ context, permission: 'recipes.costs.view' | 'inventory.costs.view' })`. Non-permitted users see `$0` cost and `0%` margin.
  - `createRecipe`: Gated by `can({ context, permission: 'recipes.manage' | 'inventory.manage', resource: branchResource })`.
  - `producePrepBatch`: Gated by `can({ context, permission: 'recipes.produce' | 'inventory.production.manage', resource: branchResource })`.

### 3.7 Route Guards (`src/server/tenant/guard.ts`)
- **Before**: Called `PermissionService.hasPermission()`.
- **After**: Calls `resolveAuthorizationContext()` and evaluates `can({ context: authContext, permission: requiredPermission, resource: branchResource })`.

### 3.8 Legacy PermissionService Strategy (`src/server/services/permission.service.ts`)
- Marked legacy methods (`hasPermission`, `verifyBranchBoundary`, `verifyServiceAreaBoundary`, `requirePermission`) with `@deprecated`.
- Retained for legacy test compatibility and non-critical UI presets. Zero security-sensitive server mutations depend on `PermissionService`.

---

## 4. Zero Residual Legacy Mutations
A full automated AST and pattern scan of `src/server/actions/`, `src/server/services/`, and `src/app/api/` verifies **0 residual legacy `hasPermission` calls** across all production mutation and data paths.
