# WSNexa — Tenant Isolation & Security Model

> **Version:** 1.0.0 (Phase 3)  
> **Classification:** Internal Security Architecture  

---

## 1. Threat Matrix & Isolation Guards

| Threat Vector | Potential Vulnerability | System Mitigation |
| :--- | :--- | :--- |
| **Cross-Tenant Data Leak (IDOR)** | User A passes Business B ID in request parameters to view Business B data. | RLS policies evaluate `auth_has_business_access(business_id)` using session token `auth.uid()`. Cross-tenant SELECT returns 0 rows. |
| **Cross-Tenant Mutation** | User A attempts to update Business B name or branches. | RLS UPDATE policies enforce `auth_is_business_owner(business_id)`. Cross-tenant updates return error / 0 rows modified. |
| **Role Escalation** | Staff member submits request to change their membership role to `business_owner`. | Memberships RLS blocks UPDATE unless `auth_is_business_owner(business_id)` is true. |
| **Branch Access Escalation** | Waiter assigned to Branch 1 attempts to access Branch 2 data. | `auth_has_branch_access(branch_id)` checks `branch_assignments` for non-owner roles. |
| **Partial Transaction Corruption** | Business creation fails midway, leaving orphaned business or branch records. | `create_business_with_default_branch` RPC executes inside an atomic PostgreSQL transaction. Any error rolls back all inserts. |

---

## 2. Security Verification Standard

To verify tenant isolation boundaries before deployment, run:

```bash
npm run verify:tenant
```
