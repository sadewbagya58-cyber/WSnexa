-- Migration: 20260823000000_phase32_batched_analytics_rpcs.sql
-- Description: Hardened Server-Only Multi-Branch Analytics RPCs with Fixed search_path and Revoked Public Privileges

-- ------------------------------------------------------------------------
-- 1. Grouped Sales RPC
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_grouped_branch_sales_summary(
  p_business_id UUID,
  p_branch_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  branch_id UUID,
  gross_sales_cents BIGINT,
  completed_orders_count BIGINT,
  aov_cents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Input Validation
  IF p_business_id IS NULL OR p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_start_date >= p_end_date THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b_id AS branch_id,
    COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'completed' OR o.payment_status = 'paid'), 0)::BIGINT AS gross_sales_cents,
    COALESCE(COUNT(*) FILTER (WHERE o.status = 'completed'), 0)::BIGINT AS completed_orders_count,
    CASE
      WHEN COALESCE(COUNT(*) FILTER (WHERE o.status = 'completed'), 0) > 0 THEN
        (COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'completed' OR o.payment_status = 'paid'), 0) /
        COALESCE(COUNT(*) FILTER (WHERE o.status = 'completed'), 1))::BIGINT
      ELSE 0::BIGINT
    END AS aov_cents
  FROM UNNEST(p_branch_ids) AS b_id
  LEFT JOIN public.orders o
    ON o.business_id = p_business_id
   AND o.branch_id = b_id
   AND o.created_at >= p_start_date
   AND o.created_at < p_end_date
  GROUP BY b_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 2. Grouped Operations RPC
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_grouped_branch_operations_summary(
  p_business_id UUID,
  p_branch_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  branch_id UUID,
  completion_rate NUMERIC,
  avg_preparation_time_seconds INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Input Validation
  IF p_business_id IS NULL OR p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_start_date >= p_end_date THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b_id AS branch_id,
    CASE
      WHEN COUNT(o.id) > 0 THEN
        ROUND((COUNT(o.id) FILTER (WHERE o.status = 'completed')::NUMERIC / COUNT(o.id)::NUMERIC) * 100.0, 2)
      ELSE 0.00
    END AS completion_rate,
    CASE
      WHEN COUNT(o.id) FILTER (WHERE o.preparing_at IS NOT NULL AND o.ready_at IS NOT NULL) > 0 THEN
        ROUND(AVG(EXTRACT(EPOCH FROM (o.ready_at - o.preparing_at))) FILTER (WHERE o.preparing_at IS NOT NULL AND o.ready_at IS NOT NULL))::INTEGER
      ELSE NULL
    END AS avg_preparation_time_seconds
  FROM UNNEST(p_branch_ids) AS b_id
  LEFT JOIN public.orders o
    ON o.business_id = p_business_id
   AND o.branch_id = b_id
   AND o.created_at >= p_start_date
   AND o.created_at < p_end_date
  GROUP BY b_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 3. Grouped Inventory RPC
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_grouped_branch_inventory_summary(
  p_business_id UUID,
  p_branch_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  branch_id UUID,
  waste_cost_cents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Input Validation
  IF p_business_id IS NULL OR p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_start_date >= p_end_date THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b_id AS branch_id,
    COALESCE(SUM(w.total_cost_cents), 0)::BIGINT AS waste_cost_cents
  FROM UNNEST(p_branch_ids) AS b_id
  LEFT JOIN public.inventory_waste_records w
    ON w.business_id = p_business_id
   AND w.branch_id = b_id
   AND w.created_at >= p_start_date
   AND w.created_at < p_end_date
  GROUP BY b_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 4. Grouped Reviews RPC
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_grouped_branch_reviews_summary(
  p_business_id UUID,
  p_branch_ids UUID[],
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  branch_id UUID,
  avg_rating NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Input Validation
  IF p_business_id IS NULL OR p_branch_ids IS NULL OR array_length(p_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_start_date >= p_end_date THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b_id AS branch_id,
    CASE
      WHEN COUNT(r.id) > 0 THEN
        ROUND(AVG(r.rating)::NUMERIC, 2)
      ELSE NULL
    END AS avg_rating
  FROM UNNEST(p_branch_ids) AS b_id
  LEFT JOIN public.venue_reviews r
    ON r.business_id = p_business_id
   AND r.branch_id = b_id
   AND r.created_at >= p_start_date
   AND r.created_at < p_end_date
  GROUP BY b_id;
END;
$$;

-- ------------------------------------------------------------------------
-- 5. Revoke Public Privileges & Restrict Execution to Server service_role Only
-- ------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_grouped_branch_sales_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_grouped_branch_operations_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_grouped_branch_inventory_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_grouped_branch_reviews_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_grouped_branch_sales_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grouped_branch_operations_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grouped_branch_inventory_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_grouped_branch_reviews_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
