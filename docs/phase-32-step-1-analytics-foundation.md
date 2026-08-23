# WSNexa — Phase 32 Step 1 Implementation Report
## Analytics Foundation & Data Engine

### 1. Objective
Establish a single-source-of-truth, canonical analytics foundation for WSNexa. Operational data across orders, payments, menu, inventory, and reviews is converted into typed, domain-scoped canonical metrics without inventing business truth or bypassing server-side RBAC and tenant boundaries.

---

### 2. Source Data Audit
- **Orders**: `orders`, `order_items`, `order_status_history`. Captures order creation, status transitions, table assignment, branch context, and monetary subtotals.
- **Payments**: `payments`, `payment_events`. Captures settlement amount, payment method (cash, card, qr, pay_at_counter), payment status (completed, refunded, failed).
- **Menu**: `menu_items`, `menu_categories`, `modifier_groups`, `modifier_options`. Captures catalog structure, prices, and modifier choices.
- **Inventory**: `inventory_items`, `inventory_balances`, `inventory_waste_records`, `inventory_stock_transfers`, `recipes`, `recipe_ingredients`. Captures stock balance, reorder thresholds, waste volume/cost, transfers, and BOM recipe costs.
- **Reviews**: `venue_reviews`. Captures 1-to-5 star ratings and staff responses.
- **Business / Branch**: `businesses`, `branches`. Captures tenant ID, branch property ID, timezone, and currency (`LKR`).

---

### 3. Data Grains
1. **Order Grain**: `orders.id`
2. **Order Item Grain**: `order_items.id`
3. **Payment Grain**: `payments.id`
4. **Inventory Movement Grain**: `inventory_stock_movements.id` / `inventory_waste_records.id`
5. **Review Grain**: `venue_reviews.id`
6. **Branch-Day Grain**: `(branch_id, local_date)`

---

### 4. Canonical Metric Registry (`src/lib/analytics/metric-registry.ts`)
Created typed `MetricDefinition` registry covering 41 canonical metrics across 5 domains:

- **Sales (15)**: `gross_sales`, `net_sales`, `completed_orders`, `placed_orders`, `cancelled_orders`, `rejected_orders`, `aov`, `items_sold`, `avg_items_per_order`, `revenue_per_order`, `revenue_per_branch`, `revenue_per_service_area`, `sales_by_payment_method`, `sales_by_hour`, `sales_by_day`.
- **Operations (7)**: `avg_order_acceptance_time`, `avg_kitchen_preparation_time`, `avg_fulfillment_time`, `pending_order_count`, `completion_rate`, `cancellation_rate`, `rejection_rate`.
- **Menu (8)**: `quantity_sold_by_item`, `revenue_by_item`, `item_order_count`, `item_penetration_rate`, `category_sales`, `category_quantity`, `estimated_food_cost`, `contribution_margin`.
- **Inventory (6)**: `current_stock`, `low_stock_item_count`, `out_of_stock_item_count`, `waste_quantity`, `waste_cost_cents`, `transfer_volume`.
- **Reputation (5)**: `avg_rating`, `review_count`, `rating_distribution`, `response_rate`, `unresponded_review_count`.

---

### 5. Sales & Money Semantics
- Minor-unit integer arithmetic (`cents`) used throughout data engine to prevent floating-point rounding errors.
- `gross_sales`: `SUM(orders.total_cents) WHERE status != 'cancelled'`.
- `net_sales`: `SUM(payments.amount_cents WHERE payment_status = 'completed') - SUM(payments.amount_cents WHERE payment_status = 'refunded')`.
- `aov`: `Gross Sales / (Total Orders - Cancelled Orders)`.
- No naive cross-currency summation. Multi-branch aggregation verifies single currency per tenant or returns grouped results.

---

### 6. Order Status Normalization (`src/lib/analytics/time-range.ts`)
`normalizeOrderAnalyticsStatus(status)` normalizes application status values:
- `COMPLETED`: `'completed'`, `'served'`
- `CANCELLED`: `'cancelled'`, `'canceled'`
- `REJECTED`: `'rejected'`
- `ACTIVE`: `'pending'`, `'confirmed'`, `'preparing'`, `'ready'`

---

### 7. Time & Timezone Engine (`src/lib/analytics/time-range.ts`)
- Resolves date range presets (`today`, `yesterday`, `last_7_days`, `last_30_days`, `this_month`, `last_month`, `custom`) using the branch's local timezone (`Asia/Colombo`).
- Strict half-open interval semantics: `[startUtc, endUtc)` to eliminate boundary record duplication.
- Comparison period engine (`computeMetricComparison`) calculates previous period date range and returns 0-denominator safe percentage changes (returns `null` when prior value is 0, avoiding `Infinity`).

---

### 8. Analytics Authorization & Scope Security (`src/server/analytics/analytics-auth.ts`)
- Resolves server-side `AuthorizationContext`.
- Evaluates `reports.view` and `reports.financial.view` via Policy Engine.
- Intersects input `branchId` / `branchIds` with `authContext.authorizedBranchIds`.
- Preserves explicit DENY precedence, acting authority, secondments, custom roles, and tenant isolation.
- Canonical scopes remain strictly `ORGANIZATION`, `PROPERTY`, `DEPARTMENT`, `AREA_TEAM`, `SELF`. No `REGION` or `SERVICE_AREA` canonical scope.

---

### 9. Server Analytics Service Layer (`src/server/analytics/`)
- `analytics-types.ts`: DTOs, MetricDefinitions, DataQualityFlags, AnalyticsError model.
- `analytics-auth.ts`: Server authorization guard.
- `sales-analytics.ts`: Sales, revenue, hourly & payment breakdown data queries.
- `operations-analytics.ts`: Kitchen speed, fulfillment time & queue depth queries.
- `menu-analytics.ts`: Item performance, category sales & recipe BOM cost margin queries.
- `inventory-analytics.ts`: Stock balance, low/out-of-stock count, waste & transfer queries.
- `review-analytics.ts`: Rating distribution & response rate queries.
- `analytics.service.ts`: Facade coordinating parallelized domain queries via `Promise.all`.

---

### 10. Data Quality & Nullability Architecture
- DTOs explicitly support `quality: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'` and `qualityNote`.
- Recipe food cost & contribution margin set `quality = 'PARTIAL'` when recipe costs are missing for sold items, or `quality = 'UNAVAILABLE'` when no cost data exists.
- Never fakes missing cost or data as 0.

---

### 11. Step 1 Verification Suite (`scripts/verify-phase32-analytics-foundation.ts`)
- Script: `npm run verify:phase32-analytics-foundation`
- Result: **43 / 43 PASSED**.

---

### 12. Step 2 Prerequisites
- Canonical Metric Registry locked.
- Timezone & date range contract locked.
- Data engine service layer built and authorized.
- Ready to build Step 2 Executive Analytics UI & Multi-Branch Intelligence.
