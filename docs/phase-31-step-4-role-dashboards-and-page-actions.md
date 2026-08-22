# WSNexa — Phase 31 Step 4 Documentation
## Role-Specific Dashboards & Permission-Aware Page Actions Architecture

---

### Executive Overview

Phase 31 Step 4 transforms the WSNexa tenant dashboard experience into a capability-first, role-adapted environment where both **Dashboard Home (`/dashboard`) composition** and **Primary Page Actions** adapt dynamically to the user's effective permissions, active property scope, and temporary authority context.

---

### 1. Dashboard Home Composition Architecture

#### Capability Resolver
- **Module**: `src/server/navigation/dashboard-home-model.ts`
- **Function**: `resolveDashboardHomeModel(authContext: AuthorizationContext): Promise<DashboardHomeModel>`
- **Golden Rule**: Composition is derived from effective permissions evaluated against the Policy Engine (`can({ context, permission, resource })`). Built-in role names do NOT dictate hardcoded single-page routing; instead, custom roles automatically compose custom dashboards based on their granted capabilities.

#### Role-Specific Dashboard Compositions
1. **Business Owner**: Broad executive management dashboard showing active branch metrics, setup progress checklist, catalog stats, dining table status, stock balances, audit logs, and management quick actions.
2. **Branch Manager**: Property-focused operational overview emphasizing dining floors, active menu items, stock catalog, and analytics without owner-only governance setup cards.
3. **Cashier**: Highlighting Cashier POS terminal shortcut (`/dashboard/cashier`) with quick order access, hiding setup checklists and governance cards.
4. **Kitchen Staff**: Highlighting Kitchen Queue card (`/dashboard/kitchen`) with live order queue status, hiding business management cards.
5. **Waiter**: Highlighting Waiter Terminal (`/dashboard/waiter`) and guest menu access, hiding administrative setup actions.
6. **Custom Role (e.g. Auditor/Analyst)**: Dynamically displays Reports card (`reports.view`) and Inventory Health card (`inventory.view`) without Cashier/Kitchen/Waiter cards unless explicitly permitted.
7. **Fallback Mode**: Highly restricted users with minimal operational capabilities receive a clean, safe fallback card displaying active business/branch context, sidebar navigation guidance, and Help Center link (`/dashboard/help`).

---

### 2. Performance Strategy & N+1 Avoidance

- **Conditional Fetching**: `src/app/(dashboard)/dashboard/page.tsx` resolves `dashboardModel` first and dispatches Supabase queries ONLY for cards that are enabled (`showMenuStatsCard`, `showDiningStatsCard`, `showInventoryCard`, `showAuditLogs`).
- **Zero Hidden Query Overhead**: Cards that are hidden for a role/user perform 0 database queries, avoiding N+1 pattern and eliminating query overhead.

---

### 3. Permission-Aware Page Actions & Read-Only Mode

Primary page headers (`<PageHeader>`) and action shortcuts are permission-gated:
- **Menu Overview (`/dashboard/menu`)**: `+ Add Menu Item` requires `menu.items.create` or `menu.manage`.
- **Stock Items (`/dashboard/inventory/items`)**: `+ Add Ingredient` requires `inventory.items.create` or `inventory.manage`.
- **Stock Counts (`/dashboard/inventory/counts`)**: `+ Start New Count` requires `inventory.counts.manage` or `inventory.manage`.
- **Recipes (`/dashboard/inventory/recipes`)**: `+ Create Recipe` requires `inventory.recipes.manage` or `inventory.manage`.
- **Purchasing (`/dashboard/inventory/purchasing`)**: `+ New Purchase Order` requires `inventory.purchasing.manage` or `inventory.manage`.

---

### 4. Final Full Role & Action Permission Audit

#### Page Classifications
- **A. Read-Only Pages**: Safe and informative with `view` permission (`/dashboard/menu/items`, `/dashboard/inventory/items`, `/dashboard/people`).
- **B. Mixed Pages**: Viewable with `view` permission, but mutation controls require specific `manage` permissions (`/dashboard/menu`, `/dashboard/inventory/counts`, `/dashboard/inventory/recipes`).
- **C. Configuration / Management Workspaces**: Primary navigation requires management capability (`/dashboard/dining`, `/dashboard/settings/order-security`, `/dashboard/settings/payments`, `/dashboard/access/roles`).

#### Dining Setup Workspace Fix
- **Navigation**: Required permission for `/dashboard/dining` updated to `tables.manage`. Waiters and view-only roles no longer see "Dining Setup" in primary navigation.
- **Controls Gating**: In `/dashboard/dining`, creation forms, "Add New Service Area", "Create Area", "Archive Area", table status selectors, PIN reset/edit buttons, bulk PIN generators, and ordering security toggles are conditionally rendered only when `canManage` is `true`.

#### High-Impact Settings Gating
- **`/dashboard/settings/order-security`**: Protected by `requireRoutePermission` and `order_security.manage` capability. Inputs and preset buttons are disabled for non-managers.
- **`/dashboard/settings/payments`**: Protected by `requireRoutePermission` and `branches.manage` capability. Toggle switches and instruction inputs are disabled for non-managers.

---

### 5. Verification & Quality Gates

- **Suite**: `scripts/verify-phase31-dashboard-actions.ts`
- **Command**: `npm run verify:phase31-dashboard-actions`
- **Result**: **52 / 52 PASSED**

#### Regression Results
- `npm run verify:phase31-dashboard-actions` $\rightarrow$ **52 / 52 PASSED**
- `npm run verify:phase31-role-aware-navigation` $\rightarrow$ **46 / 46 PASSED**
- `npm run verify:phase31-dashboard-shell` $\rightarrow$ **39 / 39 PASSED**
- `npm run verify:phase31-navigation-ia` $\rightarrow$ **60 / 60 PASSED**
- `npx tsc --noEmit` $\rightarrow$ **PASSED (0 errors)**
