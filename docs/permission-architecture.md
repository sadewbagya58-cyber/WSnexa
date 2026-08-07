# WSNexa Granular Permission Architecture

## 1. Executive Summary
Phase 15 transitions WSNexa from static role name checks to a granular permission authorization engine with custom role mappings, per-member overrides, and branch boundary isolation.

---

## 2. Evaluation Order Strategy
Authorization checks (`PermissionService.hasPermission`) execute in the following sequence:

1. **Authentication Check**: Is `auth.uid()` valid?
2. **Membership Status Check**: Is target membership status `'active'`? (Suspended accounts are denied).
3. **Business Owner Authority**: If `role === 'business_owner'`, return `ALLOW ALL` (Owners possess un-deniable owner authority).
4. **Member Overrides Check**: Inspect `member_permission_overrides`:
   - If explicit `effect === 'deny'` -> Return `DENY` immediately.
   - If explicit `effect === 'allow'` -> Check branch boundary and return `ALLOW`.
5. **Custom Role or Built-in Role Lookup**:
   - If `custom_role_id` assigned -> Check `role_permissions` for custom role.
   - Else -> Check `role_permissions` for built-in `role_key`.
6. **Branch Boundary Isolation**: Ensure target member holds an active `branch_assignments` record for the requested `branch_id`.

---

## 3. Database Schema Overview
- `public.permissions`: Machine-readable permission keys (`orders.view`, `menu.manage`, `payments.record`, etc.).
- `public.custom_roles`: Business-bound custom roles (`id`, `business_id`, `name`, `role_key`, `is_active`).
- `public.role_permissions`: Category mapping table for built-in roles and custom roles.
- `public.member_permission_overrides`: Member-level `allow` or `deny` overrides.
