-- ============================================================================
-- Migration: 20260830000000_performance_indexes.sql
-- Description: High-impact database indexes for P0 App-Wide Performance & Responsiveness
-- ============================================================================

-- 1. Staff Assignments Index (for temporal and active status lookups in auth context)
CREATE INDEX IF NOT EXISTS idx_staff_assignments_membership_status
  ON public.staff_assignments (business_membership_id, status);

-- 2. Branch Assignments Index (for membership-to-branch resolution)
CREATE INDEX IF NOT EXISTS idx_branch_assignments_membership
  ON public.branch_assignments (business_membership_id);

-- 3. Member Permission Overrides Index
CREATE INDEX IF NOT EXISTS idx_member_permission_overrides_membership
  ON public.member_permission_overrides (business_membership_id);

-- 4. Permission Scope Grants Composite Index
CREATE INDEX IF NOT EXISTS idx_permission_scope_grants_membership_role
  ON public.permission_scope_grants (business_membership_id, role_key);

-- 5. Orders Active Queue & Status Index
CREATE INDEX IF NOT EXISTS idx_orders_branch_active_status
  ON public.orders (branch_id, status, payment_status, created_at DESC);

-- 6. Waiter Requests Active Queue Index
CREATE INDEX IF NOT EXISTS idx_waiter_requests_active_queue
  ON public.waiter_requests (branch_id, status, created_at DESC);

-- 7. Dining Tables Active Area Lookup Index
CREATE INDEX IF NOT EXISTS idx_dining_tables_branch_active
  ON public.dining_tables (branch_id, is_active, service_area_id);

-- 8. Menu Items Catalog Filter Index
CREATE INDEX IF NOT EXISTS idx_menu_items_branch_active_catalog
  ON public.menu_items (branch_id, is_active, availability_status, category_id);
