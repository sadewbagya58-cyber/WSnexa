# WSNexa — Menu Catalog Threat Model & Isolation Security

> **Version:** 1.0.0 (Phase 5)  

---

## 1. Security Safeguards

| Threat Vector | System Mitigation |
| :--- | :--- |
| **Cross-Tenant Menu Leak** | RLS policy evaluates `auth_has_branch_access(branch_id)` on categories and items. Unauthorized users get 0 rows. |
| **Unauthorized Menu Mutation** | RLS INSERT/UPDATE policies restrict mutations to `business_owner` or assigned `branch_manager`. Staff roles (Cashier, Waiter, Kitchen) cannot mutate menu data. |
| **Cross-Branch Category Injection** | Database trigger `trg_check_menu_item_category` validates `NEW.branch_id = category.branch_id` before saving. |
| **Negative Price Injection** | Database CHECK constraint `price_cents >= 0` and Zod validation block negative prices. |
| **Storage Upload Exploit** | Storage policy restricts upload path to `menu-items/*` with 5MB max size limit and MIME validation. |
