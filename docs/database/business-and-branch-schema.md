# WSNexa — Business and Branch Database Schema

> **Version:** 1.0.0 (Phase 3)  
> **Target:** PostgreSQL / Supabase  

---

## 1. Schema Tables

### `public.businesses`
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL, 1–100 chars)
- `slug` (TEXT, UNIQUE, NOT NULL, 1–120 chars)
- `business_type` (TEXT, NOT NULL, DEFAULT 'restaurant')
- `country_code` (TEXT, NOT NULL, DEFAULT 'US', 2 chars)
- `default_currency` (TEXT, NOT NULL, DEFAULT 'USD', 3 chars)
- `timezone` (TEXT, NOT NULL, DEFAULT 'UTC')
- `status` (ENUM: 'active', 'suspended', 'archived')
- `created_by` (UUID, Foreign Key -> `auth.users.id`)
- `created_at`, `updated_at`, `deleted_at`

### `public.branches`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, NOT NULL, UNIQUE per business)
- `address_line_1`, `address_line_2`, `city`, `region`, `postal_code`, `country_code`, `phone`, `email`, `timezone`
- `status` (ENUM: 'active', 'inactive', 'archived')
- `is_default` (BOOLEAN, DEFAULT FALSE)
- `created_at`, `updated_at`, `deleted_at`

### `public.business_memberships`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `user_id` (UUID, Foreign Key -> `auth.users.id` ON DELETE CASCADE)
- `role` (ENUM: 'business_owner', 'branch_manager', 'kitchen_staff', 'cashier', 'waiter')
- `membership_status` (ENUM: 'invited', 'active', 'suspended', 'revoked')
- `joined_at`, `created_at`, `updated_at`

### `public.branch_assignments`
- `id` (UUID, Primary Key)
- `business_membership_id` (UUID, Foreign Key -> `public.business_memberships.id` ON DELETE CASCADE)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `is_primary` (BOOLEAN, DEFAULT FALSE)
- `created_at`

### `public.audit_logs`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `actor_id` (UUID, Foreign Key -> `auth.users.id` ON DELETE SET NULL)
- `action` (TEXT, NOT NULL)
- `target_type` (TEXT, NOT NULL)
- `target_id` (TEXT, NOT NULL)
- `payload` (JSONB)
- `created_at`
