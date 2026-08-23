# WSNexa — Phase 32 Master Implementation Plan
## Advanced Analytics, Multi-Branch Fleet Management & AI Hospitality Intelligence

### Roadmap Overview

| Step | Title | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Step 1** | **Analytics Foundation & Data Engine** | Canonical Metric Registry, Time Engine, Data Quality, Server Analytics Service | **COMPLETED** |
| **Step 2** | **Executive Analytics & Multi-Branch Intelligence** | Executive Dashboard UI, Multi-Branch Command Center, Cross-Branch Comparison | **Not Started** |
| **Step 3** | **Operational Insights & AI Hospitality Intelligence** | Kitchen/POS Operational Widgets, AI Anomaly Detection & Insights Engine | **Not Started** |
| **Step 4** | **Reporting, Export, Full Regression & Phase 32 Closure** | Scheduled Reports, Export Engine, E2E System Regressions & Phase 32 Checkpoint | **Not Started** |

---

### Step 1 Detailed Architecture & Verification
- **Metric Registry**: 41 canonical metric definitions (`src/lib/analytics/metric-registry.ts`).
- **Time Engine**: Branch-local timezone resolution (`Asia/Colombo`), half-open intervals `[startUtc, endUtc)`, 0-denominator safe comparison calculator (`src/lib/analytics/time-range.ts`).
- **Security & Authorization**: `requireAnalyticsAccess` guard evaluating Policy Engine (`reports.view`, `reports.financial.view`) and property branch scope (`src/server/analytics/analytics-auth.ts`).
- **Service Layer**: Parallelized domain queries in `AnalyticsService` (`src/server/analytics/analytics.service.ts`).
- **Verification Suite**: `verify:phase32-analytics-foundation` $\rightarrow$ **43 / 43 PASSED**.
