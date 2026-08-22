# WSNexa — Phase 31 Implementation Plan
## Role-Aware & Scope-Aware Management Dashboard Experience

### Master 7-Step Roadmap

| Step | Title | Objective | Status |
| :--- | :--- | :--- | :---: |
| **Step 1** | **Navigation & Information Architecture Audit + Freeze** | Audit real dashboard routes, resolve overlaps/unlinked pages, freeze canonical IA and navigation map | **COMPLETED** |
| **Step 2** | **Role-Aware & Scope-Aware Navigation Engine** | Implement single-source navigation engine with dynamic permission & scope filtering | **COMPLETED** |
| **Step 3** | **Dashboard Shell, Page Headers & Navigation UX** | Refactor Dashboard Shell layout, breadcrumbs, header profile, active branch switcher, and mobile drawer | **Not Started** |
| **Step 4** | **Role-Specific Dashboards & Permission-Aware Page Actions** | Build customized role landing views and permission-guarded page action toolbars | **Not Started** |
| **Step 5** | **Management UI Standardization + Cross-Module Navigation** | Standardize data tables, page layouts, empty states, and cross-module deep-linking | **Not Started** |
| **Step 6** | **Mobile, Accessibility & Performance Hardening** | Mobile viewport optimization, touch target refinement, ARIA accessibility, and skeleton loading | **Not Started** |
| **Step 7** | **Role Simulation, Full Regression & Phase 31 Closure** | Role simulation preview, multi-persona E2E regression suite, and final Phase 31 checkpoint closure | **Not Started** |

---

### Step 1 Verification Status
- Complete Dashboard Route Inventory: 75 page routes cataloged.
- Canonical IA & Navigation Map: Defined and frozen in `docs/phase-31-navigation-map.md`.
- `verify:phase31-navigation-ia`: 60/60 PASSED.

---

### Step 2 Verification Status
- Single-source navigation config created in `src/lib/navigation/dashboard-navigation.ts`.
- Server navigation engine created in `src/server/navigation/navigation-engine.ts`.
- Desktop and Mobile nav in `DashboardShell` consume identical `navSections` DTO.
- `verify:phase31-role-aware-navigation`: 46/46 PASSED.
- All Phase 30 & Phase 31 RBAC targeted regressions: 382/382 PASSED.
- Type Check, Lint & Production Build: Passed cleanly.
