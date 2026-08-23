-- Migration: 20260823183000_fix_phase32_inventory_analytics_schema.sql
-- Description: Forward migration confirming canonical inventory_balances schema (current_quantity) and hardening Grouped Inventory RPC

-- 1. Ensure Index on inventory_balances for fast analytics reads
CREATE INDEX IF NOT EXISTS idx_inventory_balances_branch_current_qty
  ON public.inventory_balances (branch_id, current_quantity);

-- 2. Re-assert Grouped Inventory RPC with explicit schema qualification
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

-- Restrict Execution Privileges
REVOKE ALL ON FUNCTION public.get_grouped_branch_inventory_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_grouped_branch_inventory_summary(UUID, UUID[], TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
