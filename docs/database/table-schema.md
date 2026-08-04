# Dining Table & Service Area Schema Reference

## Tables

### `public.service_areas`
- `id` (UUID, PK)
- `business_id` (UUID, FK -> `businesses.id`)
- `branch_id` (UUID, FK -> `branches.id`)
- `name` (TEXT, e.g. "Main Hall")
- `code` (TEXT, e.g. "HALL")
- `description` (TEXT, nullable)
- `display_order` (INTEGER, default 0)
- `is_active` (BOOLEAN, default true)
- `deleted_at` (TIMESTAMPTZ, nullable soft delete)

### `public.dining_tables`
- `id` (UUID, PK)
- `business_id` (UUID, FK -> `businesses.id`)
- `branch_id` (UUID, FK -> `branches.id`)
- `service_area_id` (UUID, FK -> `service_areas.id`)
- `name` (TEXT, e.g. "Table 1")
- `code` (TEXT, e.g. "T1")
- `table_number` (INTEGER, nullable)
- `capacity` (INTEGER, default 2, check 1..50)
- `status` (`table_status`: `'available'`, `'occupied'`, `'reserved'`, `'cleaning'`, `'unavailable'`)
- `shape` (`table_shape`: `'square'`, `'rectangle'`, `'round'`, `'other'`)
- `display_order` (INTEGER, default 0)
- `is_active` (BOOLEAN, default true)
- `deleted_at` (TIMESTAMPTZ, nullable soft delete)

## Atomic Bulk RPC
- `public.bulk_create_dining_tables(p_business_id, p_branch_id, p_service_area_id, p_prefix, p_start_number, p_count, p_capacity, p_shape)`
