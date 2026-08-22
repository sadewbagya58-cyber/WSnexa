# WSNexa — Phase 31 Step 3 Dashboard Shell, Page Headers & Navigation UX

## 1. Executive Summary

Phase 31 Step 3 implements the single canonical **Page Metadata Registry**, **Standard PageHeader Component**, **Breadcrumb Navigation Landmark**, and **Dashboard Shell Layout Variant Engine**.

This step unifies the management experience so WSNexa feels like one cohesive hospitality management platform with predictable layout structure, clear route context, and accessible navigation landmarks without altering underlying security or authorization mechanics.

---

## 2. Pre-Step-3 Shell Architecture & Issues Found

Prior to Step 3:
- Management pages rendered inconsistent header elements (some pages double-rendered page titles, some lacked descriptions or back links, others had hardcoded text breadcrumbs).
- Detail routes (e.g. `/dashboard/access/roles/[roleId]`, `/dashboard/people/[membershipId]`) did not consistently present clear breadcrumb back-navigation landmarks.
- High-density operational workspaces (`Cashier POS`, `Kitchen Queue`, `Waiter Assistance`) were squeezed into the standard `max-w-7xl` centered layout box.
- Pages lacked a single source of truth for page-level titles, descriptions, section groupings, and layout variant preferences.

---

## 3. Step 3 Architecture & Single Source of Truth

### Components Introduced / Refactored

1. **`src/lib/navigation/dashboard-page-metadata.ts`**:
   - Single canonical Page Metadata Registry (`DASHBOARD_PAGE_METADATA_REGISTRY`).
   - Standardized interface (`DashboardPageMetadata`).
   - Dynamic route metadata resolvers (`getPageMetadata(pathname)`).
   - Recursive ancestor breadcrumb resolver (`getPageBreadcrumbs(pathname, customEntityName)`).
   - Layout variant support (`standard`, `wide`, `workspace`).

2. **`src/components/layout/page-header.tsx`**:
   - Single reusable `<PageHeader>` component across management and detail pages.
   - Props: `title`, `description`, `breadcrumbs`, `primaryAction`, `secondaryActions`, `badge`, `contextBadge`, `helpSlug`, `className`.
   - Semantic `<h1>` heading, responsive action slots, zero horizontal overflow.

3. **`src/components/layout/breadcrumbs.tsx`**:
   - Lightweight, accessible breadcrumb landmark (`<nav aria-label="Breadcrumb">`).
   - Renders clickable parent links and bold, unlinked current page labels.

4. **`src/components/layout/dashboard-shell.tsx`**:
   - Dynamically evaluates `getPageMetadata(pathname).layoutVariant` to set appropriate main container width (`max-w-7xl mx-auto` for standard, `max-w-full` for wide, and full-width padding for operational POS/Kitchen/Waiter workspaces).
   - Formats role slugs cleanly in top bar (`Business Owner`, `Branch Manager`, `Cashier`, `Kitchen`, `Waiter`).

5. **Detail Page Integration**:
   - Integrated `<PageHeader>` cleanly across key detail inspector routes:
     - `/dashboard/access/roles/[roleId]`
     - `/dashboard/access/members/[membershipId]`
     - `/dashboard/people/[membershipId]`
     - `/dashboard/inventory/items/[id]`
     - `/dashboard/inventory/counts/[id]`
     - `/dashboard/inventory/recipes/[id]`
     - `/dashboard/inventory/purchasing/[id]`

---

## 4. Security & Architecture Invariants Preserved

- **Server-Side Authorization**: Security remains strictly enforced server-side via `requireRoutePermission`, `AuthorizationContext`, Policy Engine, server action validation, and Supabase RLS.
- **Permission-Filtered Sidebar**: Step 2 server navigation engine (`resolveDashboardNavigation`) remains the single source of truth for desktop and mobile navigation links.
- **Canonical Scopes**: Preserved exact canonical RBAC scopes (`ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`).
- **Super Admin & Public Boundaries**: Platform `/admin` routes and public customer routes remain completely isolated from the tenant dashboard shell.

---

## 5. Verification Results

- `npm run verify:phase31-dashboard-shell`: **39 / 39 PASSED**
- `npm run verify:phase31-role-aware-navigation`: **46 / 46 PASSED**
- `npm run verify:phase31-navigation-ia`: **60 / 60 PASSED**
- `npm run verify:rbac-v2-management-ui`: **72 / 72 PASSED**
- `npx tsc --noEmit`: **PASSED (0 errors)**
- `npm run lint`: **PASSED**
- `npm run build`: **PASSED (Production bundle compiled in 17.4s)**

---

**Phase 31 Step 3 Dashboard Shell, Page Headers & Navigation UX is COMPLETE and READY FOR MANUAL RETEST.**
