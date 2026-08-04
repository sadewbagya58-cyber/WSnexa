# Dining Table & Service Area Security Threat Model

## Threat Vectors & Mitigation

| Threat Vector | Severity | Mitigation Strategy |
| :--- | :--- | :--- |
| **Forged Tenant ID Injection** | Critical | `business_id` and `branch_id` derived server-side via session resolution in Server Actions. |
| **Cross-Tenant Table Read/Write** | Critical | RLS policy `auth_has_branch_access(branch_id)` and trigger `trg_check_dining_table_area` block access. |
| **Unassigned Branch Manager Mutating Area** | High | RLS enforces `auth_has_business_role(..., 'branch_manager') AND auth_has_branch_access(branch_id)`. |
| **Staff Role (Cashier/Kitchen/Waiter) Altering Layout** | Medium | RLS permits SELECT only for non-management roles; INSERT/UPDATE/DELETE return 0 rows. |
| **Bulk Generation Overload Attack** | Medium | Zod schema & RPC enforce hard limit of 500 tables per operation. |
| **Orphaned Tables via Area Deletion** | Low | Trigger `trg_check_service_area_archival` prevents soft-deleting service area with active tables. |
