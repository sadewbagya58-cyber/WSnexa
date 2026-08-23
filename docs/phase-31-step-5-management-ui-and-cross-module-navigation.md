# WSNexa — Phase 31 Step 5 Documentation
## Management UI Standardization + Cross-Module Navigation Architecture

---

### Executive Overview

Phase 31 Step 5 standardizes WSNexa tenant management UI surfaces into a single, cohesive SaaS experience across all 42 canonical routes. It introduces a reusable UI primitive layer (`StatusBadge`, `EmptyState`, `ErrorState`, `ReadOnlyNotice`, `SummaryCard`, `EntityLink`, `ManagementToolbar`, `ActionMenu`, `PaginationControls`) and establishes safe, permission-aware cross-module entity navigation without exposing cross-tenant data or bypassing server-side authorization.

---

### 1. Management UI Pattern Classification

All 42 canonical tenant management routes are categorized into six standard UI patterns:

1. **Overview / Hub**:
   - `/dashboard`, `/dashboard/access`, `/dashboard/organization`, `/dashboard/inventory`, `/dashboard/menu`
2. **List / Directory**:
   - `/dashboard/team`, `/dashboard/team/invites`, `/dashboard/people`, `/dashboard/access/roles`, `/dashboard/access/scope-grants`, `/dashboard/menu/items`, `/dashboard/menu/categories`, `/dashboard/inventory/items`, `/dashboard/inventory/counts`, `/dashboard/inventory/waste`, `/dashboard/inventory/transfers`, `/dashboard/inventory/locations`, `/dashboard/inventory/recipes`, `/dashboard/inventory/purchasing`, `/dashboard/reviews`, `/dashboard/reputation`
3. **Configuration**:
   - `/dashboard/business`, `/dashboard/venue-profile`, `/dashboard/branches`, `/dashboard/dining`, `/dashboard/settings/order-security`, `/dashboard/settings/payments`
4. **Detail / Inspector**:
   - `/dashboard/people/[membershipId]`, `/dashboard/access/members/[membershipId]`, `/dashboard/access/roles/[roleId]`, `/dashboard/inventory/items/[id]`, `/dashboard/inventory/counts/[id]`, `/dashboard/inventory/recipes/[id]`, `/dashboard/inventory/purchasing/[id]`
5. **Operational Workspace (Specialized)**:
   - `/dashboard/cashier`, `/dashboard/kitchen`, `/dashboard/waiter`, `/dashboard/waiter/menu`
6. **Analytics & Reporting**:
   - `/dashboard/reports`, `/dashboard/reputation`

---

### 2. Reusable Management UI Primitives (`src/components/ui/`)

- **`StatusBadge`** (`src/components/ui/status-badge.tsx`): Canonical mapping for system status strings (`active`, `inactive`, `archived`, `pending`, `accepted`, `preparing`, `ready`, `completed`, `paid`, `unpaid`, `draft`, `approved`, `rejected`, `suspended`, `low_stock`, `out_of_stock`).
- **`EmptyState`** (`src/components/ui/empty-state.tsx`): Standardized empty list container supporting permission-aware CTA visibility (`canPerform`), contextual icons, and help center links (`helpSlug`).
- **`ErrorState`** (`src/components/ui/error-state.tsx`): User-friendly error message container stripping PostgreSQL/Supabase technical error codes with an expandable technical detail trigger.
- **`ReadOnlyNotice`** (`src/components/ui/read-only-notice.tsx`): Page-level and inline view-only indicator.
- **`SummaryCard`** (`src/components/ui/summary-card.tsx`): Metric cards for hubs with hover states, status accents, and optional target route links.
- **`EntityLink`** (`src/components/ui/entity-link.tsx`): Permission-aware cross-module entity link. Guards against raw UUID primary labels and falls back to non-clickable styled text if the user lacks destination access.
- **`ManagementToolbar`** (`src/components/ui/management-toolbar.tsx`): Combined search input, dynamic filter dropdowns, sort selection, primary action button, and total item counter.
- **`ActionMenu`** (`src/components/ui/action-menu.tsx`): Row dropdown menu for secondary entity actions.
- **`PaginationControls`** (`src/components/ui/pagination-controls.tsx`): Standardized pagination bar for large lists.

---

### 3. Cross-Module Deep Linking Graph

1. **People & Access Governance**:
   - People Directory (`/dashboard/people`) $\rightarrow$ Member Access Profile (`/dashboard/access/members/[membershipId]`).
   - Member Profile (`/dashboard/people/[membershipId]`) $\rightarrow$ Access Profile (`/dashboard/access/members/[membershipId]`).
   - Member Access Profile (`/dashboard/access/members/[membershipId]`) $\rightarrow$ People Profile (`/dashboard/people/[membershipId]`).
2. **Organization & Headcount**:
   - People Directory $\rightarrow$ Job Titles (`/dashboard/organization/job-titles`), Positions (`/dashboard/organization/positions`), Structure (`/dashboard/organization/structure`).
3. **Inventory & Recipes**:
   - Stock Items table (`/dashboard/inventory/items`) $\rightarrow$ Recipes (`/dashboard/inventory/recipes`), Storage Locations (`/dashboard/inventory/locations`), Purchasing (`/dashboard/inventory/purchasing`).
4. **Menu Catalog**:
   - Menu Items (`/dashboard/menu/items`) $\rightarrow$ Categories (`/dashboard/menu/categories`), Recipes & Costing (`/dashboard/inventory/recipes`).
5. **Growth & Reviews**:
   - Owner Review List (`/dashboard/reviews`) $\rightarrow$ Uses standardized `EmptyState` and links to customer order context where authorized.

---

### 4. Security, Isolation & Operational Boundary Invariants

- **Server-Side Authorization Authority**: Server route guards (`requireRoutePermission`), Policy Engine (`can({ context, permission, resource })`), RLS, and tenant boundary enforcement remain 100% authoritative.
- **Cross-Tenant Prevention**: Entity links never bypass context; destination parameters use current business/branch boundaries.
- **Operational Workspace Protection**: POS (`/dashboard/cashier`), Kitchen Queue (`/dashboard/kitchen`), and Waiter Terminal (`/dashboard/waiter`) maintain speed and touch ergonomics without management UI clutter.

---

### 5. Verification & Quality Gates

- **Dedicated Suite**: `scripts/verify-phase31-management-ui.ts`
- **Command**: `npm run verify:phase31-management-ui`
- **Result**: **ALL ASSERTIONS PASSED**

#### Full Regression Summary
- `verify:phase31-management-ui` $\rightarrow$ **PASSED**
- `verify:phase31-dashboard-actions` $\rightarrow$ **65 / 65 PASSED**
- `verify:phase31-dashboard-shell` $\rightarrow$ **39 / 39 PASSED**
- `verify:phase31-role-aware-navigation` $\rightarrow$ **46 / 46 PASSED**
- `verify:phase31-navigation-ia` $\rightarrow$ **60 / 60 PASSED**
- `verify:rbac-v2-management-ui` $\rightarrow$ **72 / 72 PASSED**
- `npx tsc --noEmit` $\rightarrow$ **PASSED (0 errors)**
- `npm run lint` $\rightarrow$ **PASSED (0 errors)**
- `npm run build` $\rightarrow$ **PASSED (174 / 174 static & dynamic routes compiled)**
