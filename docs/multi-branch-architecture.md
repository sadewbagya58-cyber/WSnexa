# Phase 9.5 Multi-Branch Architecture & Scoping

This document details the multi-branch management infrastructure, active branch switching, subscription quotas, and data isolation models in WSNexa.

---

## 1. Multi-Branch Context & Active Switcher

- **Tenant Scope:** Every business can own multiple branches (`branches` table).
- **Active Branch Cookie:** `wsnexa_active_branch` cookie stores the user's currently selected active branch ID.
- **Resolver Logic:** `resolveActiveBusinessContext()` fetches all active branches for the business and resolves `activeBranch` via the cookie (falling back to the primary default branch).
- **Dashboard Switcher:** Header dropdown (`ActiveBranchSwitcher`) allows instant branch switching (< 150ms) without signing out.

---

## 2. Subscription Branch Quotas

Branch creation is checked against subscription tier limits (`BranchService.createBranch` & `checkBranchQuota`):
- **Free Tier:** 1 Branch Limit.
- **Starter Tier:** 3 Branches Limit (Default for MVP).
- **Pro Tier:** Unlimited Branches.

---

## 3. Data Scoping & RLS Isolation

All operational entities strictly incorporate `branch_id`:
- `menu_categories` -> `branch_id`
- `menu_items` -> `branch_id`
- `modifier_groups` -> `branch_id`
- `dining_tables` -> `branch_id`
- `service_areas` -> `branch_id`
- `branch_qr_codes` -> `branch_id` (Unique active index `idx_active_qr_per_branch`)
- `branch_operating_hours` -> `branch_id`

Row Level Security (RLS) policies enforce that Branch Managers, Cashiers, Kitchen Staff, and Waiters can only view and interact with data matching their assigned branch.

---

## 4. Cross-Branch Cart Isolation

Guest digital menus (`/m/[token]`) resolve a specific branch catalog. Client-side carts are stored in `sessionStorage` with key `wsnexa_cart_v1_${branchId}`. Cart lines, table selections, and Table PIN contexts for Branch A are isolated and never leak into Branch B.
