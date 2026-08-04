# WSNexa — Menu Modifiers Threat Model & Isolation Security

> **Version:** 1.0.0 (Phase 6)  

---

## 1. Security Safeguards

| Threat Vector | System Mitigation |
| :--- | :--- |
| **Cross-Tenant Modifier Leak** | RLS policy evaluates `auth_has_branch_access(branch_id)` on groups and options. Unauthorized users receive 0 rows. |
| **Unauthorized Modifier Mutation** | RLS INSERT/UPDATE policies restrict mutations to `business_owner` or assigned `branch_manager`. Staff roles (Cashier, Waiter, Kitchen) cannot mutate modifier data. |
| **Cross-Item Group Injection** | Trigger `trg_check_modifier_group_item` validates `NEW.branch_id = item.branch_id` and `NEW.business_id = item.business_id`. |
| **Cross-Group Option Injection** | Trigger `trg_check_modifier_option_group` validates `NEW.branch_id = group.branch_id` and `NEW.business_id = group.business_id`. |
| **Invalid Selection Rules** | Database CHECK constraints (`chk_single_selection_max`, `chk_required_min`) and Zod schemas reject invalid min/max rules. |
