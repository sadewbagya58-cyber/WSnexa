# WSNexa — Phase 32 Step 2: Executive Analytics & Multi-Branch Intelligence

## Overview
Phase 32 Step 2 transforms the Phase 32 Step 1 canonical analytics data engine into a full-featured, role-aware, multi-branch executive business intelligence experience. The Reports & Analytics interface (`/dashboard/reports`) has been rebuilt to consume server-gated `ExecutiveOverviewDTO` data directly from `AnalyticsService.getExecutiveOverview`.

---

## 1. Information Architecture & Navigation
The `/dashboard/reports` interface features a unified layout with global filter controls and internal navigation tabs:
- **`overview`**: Executive Overview with top-level KPI summary cards, comparison DTOs, and revenue trends.
- **`sales`**: Sales & Revenue Analytics featuring interactive hourly and daily time-series charts and payment method distribution.
- **`operations`**: Speed & Fulfillment Analytics featuring order acceptance time, kitchen preparation duration, fulfillment time, live queue depth, and completion/cancellation/rejection rates.
- **`menu`**: Menu Performance & BOM Costing featuring top-selling items with penetration rates, category revenue breakdown, modifier performance, estimated food cost (BOM), and contribution margins.
- **`inventory`**: Stock Movement & Waste Analytics featuring current total stock, low stock count, out-of-stock count, ingredient waste cost, and cross-branch transfer volumes.
- **`reputation`**: Customer Feedback & Reputation Analytics featuring average star rating, review count, star rating distribution (1–5 stars), response rate, and unresponded review counts.
- **`comparison`**: Multi-Branch Intelligence featuring a sortable comparison table ranking all authorized property branches across sales, orders, AOV, completion rates, kitchen prep speed, waste cost, and ratings.

---

## 2. Server Authorization & Financial Data Redaction
1. **Server Authorization**: Route access is protected by `requireRoutePermission('/dashboard/reports')` and data retrieval is protected by `requireAnalyticsAccess`.
2. **Role & Capability Scoping**: Access is evaluated via the Policy Engine using `reports.view` and `reports.financial.view`.
3. **Financial Redaction**: Users with `reports.view` but lacking `reports.financial.view` receive redacted financial metrics at the server layer (`grossSales`, `netSales`, `aov`, item revenue, waste cost, contribution margin). Values are set to `null` with `quality: 'UNAVAILABLE'` and `qualityNote: 'Redacted: Financial reporting permission required.'`.
4. **Single-Branch vs Multi-Branch Scoping**: Property-scoped users are strictly restricted to their authorized branch IDs (`authContext.authorizedBranchIds`). Single-branch users are presented with a clean single-branch interface while multi-branch users can toggle between `"All Authorized Branches"` and individual authorized branches.

---

## 3. UI Component Architecture (`src/components/reports/`)
- `AnalyticsFilterBar`: Date range preset selector (`today`, `yesterday`, `last_7_days`, `last_30_days`, `this_month`, `last_month`, `custom`), custom date-time pickers, and branch dropdown.
- `ExecutiveKpiCards`: Metric cards with period-over-period comparison badges (`+12.4% vs prior period`), direction indicators, data quality badges, and financial redaction notices.
- `TimeSeriesChart`: Responsive, accessible SVG line/bar chart displaying daily and hourly revenue and order volume trends with tooltips and local timezone formatting.
- `SalesAnalyticsView`: Renders daily sales trend, hourly peak distribution, and payment method percentage breakdowns.
- `OperationsAnalyticsView`: Renders speed metrics and fulfillment disposition rates.
- `MenuAnalyticsView`: Renders BOM recipe food cost, contribution margin, top-selling items table with penetration rate, category sales, and modifier selections.
- `InventoryAnalyticsView`: Renders stock counts, low/out-of-stock alerts, waste metrics, and transfer volumes.
- `ReputationAnalyticsView`: Renders average rating, review count, star distribution, response rate, and unresponded counts.
- `BranchComparisonView`: Renders sortable multi-branch performance table with branch drill-down clicks.
- `ExportCenterModal`: Modal for generating CSV, Excel (.xls), and Print/PDF reports.

---

## 4. Verification & Quality Gates
- **`npm run verify:phase32-executive-analytics`**: 51/51 PASSED
- **`npm run verify:phase32-analytics-foundation`**: 43/43 PASSED
- **`npm run verify:phase31-closure`**: 46/46 PASSED
- **`npm run verify:rbac-v2-engine`**: 83/83 PASSED
- **`npm run verify:rbac-v2-context`**: 45/45 PASSED
- **`npm run verify:orders`**: 17/17 PASSED
- **`npm run verify:payments`**: 12/12 PASSED
- **`npx tsc --noEmit`**: PASSED (0 errors)
- **`npm run lint`**: PASSED (0 errors, 37 warnings)
- **`npm run build`**: PASSED (174/174 static & dynamic routes compiled)
