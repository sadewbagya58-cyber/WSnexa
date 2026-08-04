# WSNexa — Menu Catalog Architecture

> **Version:** 5.0.0 (Phase 5 Menu Catalog Management)  
> **Status:** Active Specification  

---

## 1. Hierarchical Domain Model

WSNexa organizes menu assets in a multi-tenant hierarchy:

`Business` → `Branch` → `Menu Categories` → `Menu Items` → `Menu Item Images`

Key architectural invariants:

1. **Branch Scoping:** In MVP, every menu category and menu item is strictly scoped to a specific `business_id` and `branch_id`.
2. **Integer Money Storage:** Menu item prices are stored as non-negative integers representing the smallest currency unit (`price_cents` BIGINT). E.g. $12.50 USD is stored as `1250` cents.
3. **Database Integrity Triggers:** PostgreSQL trigger `trg_check_menu_item_category` guarantees at the database level that a menu item cannot reference a category belonging to another business/branch or an archived category.
4. **Availability Model:**
   - `available`: Visible and orderable by customers.
   - `out_of_stock`: Visible with "Out of Stock" badge; un-orderable.
   - `hidden`: Hidden from customer menu views.
5. **Soft Deletion & Relational Integrity:** Categories and items use soft deletion (`deleted_at TIMESTAMPTZ`). Archiving a category prevents new items from being added under it while preserving existing relational links.
