# WSNexa Reports & Analytics Architecture

## 1. Executive Summary

WSNexa Reports & Analytics (Phase 12) provides enterprise-grade Business Intelligence for multi-tenant, multi-branch restaurant operations. It aggregates sales, revenue trends, hourly volume, payment breakdown, menu performance, modifier usage, kitchen prep efficiency, dining table turnover, and cross-branch performance rollups.

---

## 2. Query Architecture & Performance Optimization

### Zero Client-Side Data Loading
WSNexa never fetches raw order rows into the browser memory for reporting aggregation. All computations execute inside PostgreSQL database RPCs via indexed aggregations.

### Reporting Indexes
- `idx_orders_branch_created_status` on `orders(branch_id, created_at, status)`
- `idx_payments_branch_created_status` on `payments(branch_id, created_at, payment_status)`
- `idx_order_status_history_order_created` on `order_status_history(order_id, created_at)`
- `idx_order_item_modifiers_item_id` on `order_item_modifiers(order_item_id)`

---

## 3. SECURITY DEFINER Private RPC Functions

1. `get_branch_sales_summary(p_branch_id, p_start_date, p_end_date)`
2. `get_revenue_time_series(p_branch_id, p_start_date, p_end_date, p_interval)`
3. `get_orders_by_hour(p_branch_id, p_start_date, p_end_date)`
4. `get_payment_analytics(p_branch_id, p_start_date, p_end_date)`
5. `get_menu_analytics(p_branch_id, p_start_date, p_end_date, p_limit)`
6. `get_modifier_analytics(p_branch_id, p_start_date, p_end_date, p_limit)`
7. `get_kitchen_analytics(p_branch_id, p_start_date, p_end_date)`
8. `get_table_analytics(p_branch_id, p_start_date, p_end_date)`
9. `get_branch_comparison(p_business_id, p_start_date, p_end_date)`

Direct invocation of these functions from `PUBLIC`, `anon`, and `authenticated` roles is revoked. Access is granted exclusively to `service_role` via Next.js server context verification.
