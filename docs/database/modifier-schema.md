# WSNexa — Menu Modifiers Database Schema

> **Version:** 1.0.0 (Phase 6)  

---

## 1. Schema Tables

### `public.modifier_groups`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `menu_item_id` (UUID, Foreign Key -> `public.menu_items.id` ON DELETE CASCADE)
- `name` (TEXT, 1–100 chars)
- `description` (TEXT)
- `selection_type` (ENUM: 'single', 'multiple')
- `is_required` (BOOLEAN, DEFAULT FALSE)
- `min_selections` (INTEGER, DEFAULT 0, CHECK >= 0)
- `max_selections` (INTEGER, CHECK NULL OR >= min_selections)
- `display_order` (INTEGER, DEFAULT 0, CHECK >= 0)
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_by`, `created_at`, `updated_at`, `deleted_at`
- **Constraints:**
  - `chk_single_selection_max` (`selection_type <> 'single' OR (max_selections IS NULL OR max_selections = 1)`)
  - `chk_required_min` (`NOT is_required OR min_selections >= 1`)

### `public.modifier_options`
- `id` (UUID, Primary Key)
- `business_id` (UUID, Foreign Key -> `public.businesses.id` ON DELETE CASCADE)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `modifier_group_id` (UUID, Foreign Key -> `public.modifier_groups.id` ON DELETE CASCADE)
- `name` (TEXT, 1–100 chars)
- `additional_price_cents` (BIGINT, DEFAULT 0, CHECK >= 0)
- `display_order` (INTEGER, DEFAULT 0, CHECK >= 0)
- `is_active` (BOOLEAN, DEFAULT TRUE)
- `created_by`, `created_at`, `updated_at`, `deleted_at`
- **Unique Constraint:** `UNIQUE(modifier_group_id, name) WHERE deleted_at IS NULL`
