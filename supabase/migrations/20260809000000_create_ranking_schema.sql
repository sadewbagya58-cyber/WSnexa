-- ============================================================================
-- WSNexa Phase 18 Schema Migration
-- Ranking & Reputation Permissions and Database Aggregation RPCs
-- ============================================================================

-- 1. Insert reputation permissions into permission catalog
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES
  ('reputation.view', 'View Business Reputation', 'Allows staff to view public rating, ranking position, and customer retention metrics', 'reputation', 'low'),
  ('reputation.export', 'Export Reputation Reports', 'Allows staff to export reputation and ranking performance data', 'reputation', 'medium')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 2. Assign default reputation permissions to business_owner and branch_manager roles
INSERT INTO public.role_permissions (role, permission_key)
VALUES
  ('business_owner', 'reputation.view'),
  ('business_owner', 'reputation.export'),
  ('branch_manager', 'reputation.view')
ON CONFLICT (role, permission_key) DO NOTHING;

-- 3. Create database indexes for high-performance ranking queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (business_id, status, created_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_orders_customer_user_id
  ON public.orders (customer_user_id, status, created_at)
  WHERE customer_user_id IS NOT NULL AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_venue_reviews_verified
  ON public.venue_reviews (venue_profile_id, is_verified_visit, status, rating);
