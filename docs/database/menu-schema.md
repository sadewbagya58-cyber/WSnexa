# WSNexa — Menu Catalog Database Schema

> **Version:** 1.0.0 (Phase 5)  

---

## 1. Schema Tables

### `public.menu_categories`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `name` (TEXT, 1–100 chars)
- `slug` (TEXT, 1–120 chars)
- `description` (TEXT)
- `image_url` (TEXT)
- `display_order` (INTEGER, DEFAULT 0, CHECK >= 0)
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_by` (UUID, Foreign Key -> `auth.users.id`)
- `created_at`, `updated_at`, `deleted_at`
- **Unique Constraint:** `UNIQUE(branch_id, slug) WHERE deleted_at IS NULL`

### `public.menu_items`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `category_id` (UUID, Foreign Key -> `public.menu_categories.id` ON DELETE CASCADE)
- `name` (TEXT, 1–100 chars)
- `slug` (TEXT, 1–120 chars)
- `description` (TEXT)
- `price_cents` (BIGINT, CHECK >= 0)
- `currency` (TEXT, 3 chars, DEFAULT 'USD')
- `preparation_time_minutes` (INTEGER, CHECK >= 0)
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `availability_status` (ENUM: 'available', 'out_of_stock', 'hidden')
- `is_featured` (BOOLEAN, DEFAULT FALSE)
- `display_order` (INTEGER, DEFAULT 0, CHECK >= 0)
- `primary_image_url` (TEXT)
- `created_by`, `created_at`, `updated_at`, `deleted_at`
- **Unique Constraint:** `UNIQUE(branch_id, slug) WHERE deleted_at IS NULL`

### `public.menu_item_images`
- `id` (UUID, Primary Key)
- `business_id`, `branch_id`, `menu_item_id`
- `storage_path` (TEXT, UNIQUE)
- `alt_text` (TEXT)
- `display_order` (INTEGER, DEFAULT 0)
- `created_at`, `deleted_at`
