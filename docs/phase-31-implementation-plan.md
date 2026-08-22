# WSNexa — Phase 31 Implementation Plan
## Role-Aware & Scope-Aware Management Dashboard Experience

### Master 7-Step Roadmap

| Step | Title | Objective | Status |
| :--- | :--- | :--- | :---: |
| **Step 1** | **Navigation & Information Architecture Audit + Freeze** | Audit real dashboard routes, resolve overlaps/unlinked pages, freeze canonical IA and navigation map | **COMPLETED** |
| **Step 2** | **Role-Aware & Scope-Aware Navigation Engine** | Implement single-source navigation engine with dynamic permission & scope filtering | **Not Started** |
| **Step 3** | **Dashboard Shell, Page Headers & Navigation UX** | Refactor Dashboard Shell layout, breadcrumbs, header profile, active branch switcher, and mobile drawer | **Not Started** |
| **Step 4** | **Role-Specific Dashboards & Permission-Aware Page Actions** | Build customized role landing views and permission-guarded page action toolbars | **Not Started** |
| **Step 5** | **Management UI Standardization + Cross-Module Navigation** | Standardize data tables, page layouts, empty states, and cross-module deep-linking | **Not Started** |
| **Step 6** | **Mobile, Accessibility & Performance Hardening** | Mobile viewport optimization, touch target refinement, ARIA accessibility, and skeleton loading | **Not Started** |
| **Step 7** | **Role Simulation, Full Regression & Phase 31 Closure** | Role simulation preview, multi-persona E2E regression suite, and final Phase 31 checkpoint closure | **Not Started** |

---

### Step 1 Verification Status

- **Complete Dashboard Route Inventory**: 75 page routes cataloged.
- **Canonical IA & Navigation Map**: Defined and frozen in `docs/phase-31-navigation-map.md`.
- **Step 1 Verification Script**: `npm run verify:phase31-navigation-ia` passed 16/16 assertions.
- **Type Check, Lint & Build**: Passed with 0 errors.
