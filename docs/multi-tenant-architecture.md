# WSNexa — Multi-Tenant Architecture

> **Version:** 3.0.0 (Phase 3 Multi-Tenant Foundation)  
> **Status:** Active Specification  

---

## 1. Multi-Tenancy Architecture Principles

WSNexa employs a **shared-database, isolated-schema multi-tenant architecture**. All tenant data is stored in unified PostgreSQL tables, with strict isolation enforced at the database level via **Row Level Security (RLS)** and security helper functions.

Key architectural invariants:

1. **Zero Browser Trust:** `business_id`, `branch_id`, and `role` parameters submitted by the client are never trusted. All tenant authorization context is derived from the server session and verified memberships.
2. **Atomic Business Onboarding:** New business accounts, default branches (`is_default = true`), owner memberships, and initial audit logs are created in a single PostgreSQL transaction RPC (`create_business_with_default_branch`).
3. **Single Default Branch Enforcement:** Each business must have exactly one default branch (`is_default = true`), enforced via a unique partial index on `(business_id) WHERE is_default = TRUE`.
4. **Decoupled Staff Assignments:** Business members may be assigned to specific branches via `branch_assignments`. Business Owners have implicit access to all branches under their business.

---

## 2. PostgreSQL Helper Functions

- `auth_has_business_access(target_business_id UUID)`: Checks if `auth.uid()` has an active membership in the business.
- `auth_is_business_owner(target_business_id UUID)`: Checks if `auth.uid()` holds the `business_owner` role.
- `auth_has_business_role(target_business_id UUID, allowed_roles user_role[])`: Checks if `auth.uid()` holds one of the specified roles.
- `auth_has_branch_access(target_branch_id UUID)`: Checks if `auth.uid()` is a business owner or assigned to the branch.

All helper functions use `SECURITY DEFINER` with explicit `SET search_path = public`.

---

## 3. Active Tenant Context Resolver

The server-side resolver (`src/server/tenant/resolver.ts`) inspects the authenticated session:

```typescript
export async function resolveActiveBusinessContext(): Promise<ActiveTenantContext | null>;
```

- If the user belongs to 1 business, it is selected automatically.
- If the user belongs to multiple businesses, the selection cookie (`wsnexa_active_business`) is read and revalidated against `business_memberships`.
- Unauthenticated or unauthorized context requests are safely rejected.
