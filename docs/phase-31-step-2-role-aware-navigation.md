# WSNexa — Phase 31 Step 2 Role-Aware & Scope-Aware Navigation Engine

## 1. Executive Summary

Phase 31 Step 2 implements the single-source **Role-Aware & Scope-Aware Navigation Engine** for WSNexa.

The navigation engine dynamically computes what dashboard navigation sections and items a tenant user can see based on:
1. Effective permissions (`rolePermissions`, `permissionOverrides`, `scopeGrants`, owner privileges)
2. Scope context requirements (`ORGANIZATION`, `PROPERTY`, `MIXED`)
3. Tenant membership and active branch authorization
4. Feature flags (`IS_LOYALTY_ENABLED`)

---

## 2. Pre-Step-2 Navigation Architecture

Prior to Step 2:
- Navigation items were statically hardcoded in `rawNavSections` inside `src/components/layout/dashboard-shell.tsx`.
- Desktop sidebar and mobile drawer evaluated permission routes client-side using `getRequiredPermissionForRoute`.
- Custom roles and scope grants were not cleanly integrated into sidebar visibility.
- Subroute active matching used plain `pathname.startsWith()`.

---

## 3. Step 2 Architecture & Single Source of Truth

### Components Introduced / Updated

1. **`src/lib/navigation/dashboard-navigation.ts`**:
   - Single canonical configuration source of truth (`CANONICAL_DASHBOARD_NAV_SECTIONS`).
   - Standardized DTO interfaces (`DashboardNavSectionDTO`, `DashboardNavItemDTO`).
   - Centralized detail parent path lookup (`getParentNavPath`) and active route matcher (`isNavItemActive`).

2. **`src/server/navigation/navigation-engine.ts`**:
   - Server-side visibility resolver (`resolveDashboardNavigation(context)`).
   - In-memory single-pass capability evaluation (`hasNavCapability`).
   - In-memory scope context evaluation (`hasNavScopeContext`).
   - Section collapsing (sections with 0 visible items are removed).

3. **`src/app/(dashboard)/layout.tsx`**:
   - Resolves `AuthorizationContext` once per request (using React `cache()` deduplication).
   - Calls `resolveDashboardNavigation(authContext)` server-side.
   - Injects clean, serializable `navSections` DTO into `<DashboardShell>`.

4. **`src/components/layout/dashboard-shell.tsx`**:
   - Both Desktop Sidebar AND Mobile Drawer consume the exact same `navSections` prop.
   - Uses `isNavItemActive(item, pathname)` for clean active route highlighting.

---

## 4. Capability & Security Guarantees

- **Golden Invariant**:
  - `NAVIGATION VISIBILITY = UX`
  - `SERVER AUTHORIZATION = SECURITY`
  - Sidebar visibility NEVER replaces server-side route guards (`requireRoutePermission`), server action validation, Policy Engine checks, or RLS.
- **Explicit DENY Precedence**: Explicit DENY overrides take highest precedence over built-in role permissions, scope grants, and Business Owner status.
- **Custom Role First-Class Support**: Navigation visibility is capability-driven, NOT role-name driven. Custom roles receive exact navigation items matching their granted capabilities without needing a built-in role name.
- **Performance / Zero N+1**: Single-pass filtering in memory from the cached `AuthorizationContext`. Zero sequential Supabase queries issued during sidebar rendering.

---

## 5. Verification Results

- `npm run verify:phase31-role-aware-navigation`: **46 / 46 PASSED**
- `npm run verify:phase31-navigation-ia`: **60 / 60 PASSED**
- `npm run verify:rbac-v2-management-ui`: **72 / 72 PASSED**
- `npm run verify:rbac-v2-engine`: **83 / 83 PASSED**
- `npm run verify:rbac-v2-context`: **45 / 45 PASSED**
- `npm run verify:rbac-v2-roles`: **68 / 68 PASSED**
- `npm run verify:rbac-v2-legacy-cleanup`: **54 / 54 PASSED**
- `npx tsc --noEmit`: **PASSED (0 errors)**
- `npm run lint`: **PASSED**
- `npm run build`: **PASSED (Production build compiled in 25.8s)**

---

**Phase 31 Step 2 Role-Aware & Scope-Aware Navigation Engine is COMPLETE and READY FOR MANUAL RETEST.**
