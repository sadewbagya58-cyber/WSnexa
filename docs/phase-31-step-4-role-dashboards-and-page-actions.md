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

#### Security Invariant
UI button hiding is strictly UX-focused. Server action route guards (`requireRoutePermission`) and server action permission checks (`can({ context, permission })`) remain authoritative on every server mutation.

---

### 4. Verification & Quality Gates

- **Suite**: `scripts/verify-phase31-dashboard-actions.ts`
- **Command**: `npm run verify:phase31-dashboard-actions`
- **Result**: **34 / 34 PASSED**

#### Regression Results
- `npm run verify:phase31-dashboard-actions` $\rightarrow$ **34 / 34 PASSED**
- `npm run verify:phase31-dashboard-shell` $\rightarrow$ **39 / 39 PASSED**
- `npm run verify:phase31-role-aware-navigation` $\rightarrow$ **46 / 46 PASSED**
- `npm run verify:phase31-navigation-ia` $\rightarrow$ **60 / 60 PASSED**
- `npm run verify:rbac-v2-management-ui` $\rightarrow$ **72 / 72 PASSED**
- `npx tsc --noEmit` $\rightarrow$ **PASSED (0 errors)**
- `npm run build` $\rightarrow$ **PASSED (Compiled 174 routes in 18.4s)**
