-- Migration: 20260807030000_create_reporting_schema_and_rpcs.sql
-- Description: Phase 12 Performance Reporting Indexes and Private SECURITY DEFINER Reporting RPCs

-- 1. Create Performance Reporting Indexes
CREATE INDEX IF NOT EXISTS idx_orders_branch_created_status
  ON public.orders (branch_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_payments_branch_created_status
  ON public.payments (branch_id, created_at DESC, payment_status);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON public.order_status_history (order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item_id
  ON public.order_item_modifiers (order_item_id);

-- 2. Branch Sales Summary RPC
CREATE OR REPLACE FUNCTION public.get_branch_sales_summary(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_orders INTEGER := 0;
  v_completed_orders INTEGER := 0;
  v_cancelled_orders INTEGER := 0;
  v_pending_orders INTEGER := 0;
  v_gross_sales INTEGER := 0;
  v_subtotal_cents INTEGER := 0;
  v_tax_cents INTEGER := 0;
  v_service_charge_cents INTEGER := 0;
  v_paid_revenue INTEGER := 0;
  v_outstanding_balance INTEGER := 0;
  v_refunded_cents INTEGER := 0;
  v_aov_cents INTEGER := 0;
  v_top_item RECORD;
  v_top_cat RECORD;
  v_top_payment RECORD;
  v_avg_prep_seconds INTEGER := 0;
BEGIN
  -- Validate Branch
  IF p_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_BRANCH_ID');
  END IF;

  -- Order Counts & Totals
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(COUNT(*) FILTER (WHERE status = 'completed'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')), 0),
    COALESCE(SUM(total_cents) FILTER (WHERE status <> 'cancelled'), 0),
    COALESCE(SUM(subtotal_cents) FILTER (WHERE status <> 'cancelled'), 0),
    COALESCE(SUM(tax_cents) FILTER (WHERE status <> 'cancelled'), 0),
    COALESCE(SUM(service_charge_cents) FILTER (WHERE status <> 'cancelled'), 0)
  INTO
    v_total_orders,
    v_completed_orders,
    v_cancelled_orders,
    v_pending_orders,
    v_gross_sales,
    v_subtotal_cents,
    v_tax_cents,
    v_service_charge_cents
  FROM public.orders
  WHERE branch_id = p_branch_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Paid Revenue & Refunds from Payments table
  SELECT
    COALESCE(SUM(amount_cents) FILTER (WHERE payment_status = 'completed'), 0),
    COALESCE(SUM(amount_cents) FILTER (WHERE payment_status = 'refunded'), 0)
  INTO
    v_paid_revenue,
    v_refunded_cents
  FROM public.payments
  WHERE branch_id = p_branch_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  v_outstanding_balance := GREATEST(0, v_gross_sales - v_paid_revenue);

  IF v_total_orders - v_cancelled_orders > 0 THEN
    v_aov_cents := v_gross_sales / (v_total_orders - v_cancelled_orders);
  END IF;

  -- Top Selling Item
  SELECT oi.item_name_snapshot, SUM(oi.quantity) as qty
  INTO v_top_item
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND o.status <> 'cancelled'
  GROUP BY oi.item_name_snapshot
  ORDER BY qty DESC
  LIMIT 1;

  -- Top Category
  SELECT mc.name, SUM(oi.quantity) as qty
  INTO v_top_cat
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  JOIN public.menu_categories mc ON mc.id = mi.category_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND o.status <> 'cancelled'
  GROUP BY mc.name
  ORDER BY qty DESC
  LIMIT 1;

  -- Top Payment Method
  SELECT payment_method, COUNT(*) as cnt
  INTO v_top_payment
  FROM public.payments
  WHERE branch_id = p_branch_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND payment_status = 'completed'
  GROUP BY payment_method
  ORDER BY cnt DESC
  LIMIT 1;

  -- Average Prep Seconds (preparing -> ready)
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (h_ready.created_at - h_prep.created_at))), 0)::integer
  INTO v_avg_prep_seconds
  FROM public.order_status_history h_prep
  JOIN public.order_status_history h_ready ON h_ready.order_id = h_prep.order_id
  JOIN public.orders o ON o.id = h_prep.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND h_prep.new_status = 'preparing'
    AND h_ready.new_status = 'ready';

  RETURN jsonb_build_object(
    'success', true,
    'total_orders', v_total_orders,
    'completed_orders', v_completed_orders,
    'cancelled_orders', v_cancelled_orders,
    'pending_orders', v_pending_orders,
    'gross_sales_cents', v_gross_sales,
    'subtotal_cents', v_subtotal_cents,
    'tax_cents', v_tax_cents,
    'service_charge_cents', v_service_charge_cents,
    'paid_revenue_cents', v_paid_revenue,
    'outstanding_balance_cents', v_outstanding_balance,
    'refunded_cents', v_refunded_cents,
    'aov_cents', v_aov_cents,
    'top_item_name', COALESCE(v_top_item.item_name_snapshot, 'None'),
    'top_category_name', COALESCE(v_top_cat.name, 'None'),
    'top_payment_method', COALESCE(v_top_payment.payment_method::text, 'pay_at_counter'),
    'avg_prep_seconds', v_avg_prep_seconds
  );
END;
$$;

-- 3. Revenue Time Series RPC
CREATE OR REPLACE FUNCTION public.get_revenue_time_series(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_interval TEXT DEFAULT 'day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc TEXT := 'day';
  v_series JSONB;
BEGIN
  IF p_interval IN ('hour', 'day', 'week', 'month') THEN
    v_trunc := p_interval;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'bucket', sub.bucket,
      'gross_sales_cents', sub.gross_sales_cents,
      'orders_count', sub.orders_count,
      'paid_revenue_cents', COALESCE(
        (
          SELECT SUM(p.amount_cents)
          FROM public.payments p
          WHERE p.branch_id = p_branch_id
            AND p.payment_status = 'completed'
            AND date_trunc(v_trunc, p.created_at) = sub.bucket
        ), 0
      )
    )
    ORDER BY sub.bucket ASC
  )
  INTO v_series
  FROM (
    SELECT
      date_trunc(v_trunc, o.created_at) as bucket,
      COALESCE(SUM(o.total_cents), 0) as gross_sales_cents,
      COUNT(*) as orders_count
    FROM public.orders o
    WHERE o.branch_id = p_branch_id
      AND o.created_at >= p_start_date
      AND o.created_at <= p_end_date
      AND o.status <> 'cancelled'
    GROUP BY date_trunc(v_trunc, o.created_at)
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'interval', v_trunc,
    'series', COALESCE(v_series, '[]'::jsonb)
  );
END;
$$;

-- 4. Orders By Hour RPC (0-23 Hour Distribution)
CREATE OR REPLACE FUNCTION public.get_orders_by_hour(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', h.hr,
      'orders_count', COALESCE(o_data.cnt, 0),
      'revenue_cents', COALESCE(o_data.rev, 0)
    )
    ORDER BY h.hr ASC
  )
  INTO v_hours
  FROM generate_series(0, 23) AS h(hr)
  LEFT JOIN (
    SELECT
      EXTRACT(HOUR FROM created_at)::integer AS hr,
      COUNT(*) AS cnt,
      SUM(total_cents) AS rev
    FROM public.orders
    WHERE branch_id = p_branch_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
      AND status <> 'cancelled'
    GROUP BY EXTRACT(HOUR FROM created_at)::integer
  ) o_data ON o_data.hr = h.hr;

  RETURN jsonb_build_object(
    'success', true,
    'hours', COALESCE(v_hours, '[]'::jsonb)
  );
END;
$$;

-- 5. Payment Analytics Breakdown RPC
CREATE OR REPLACE FUNCTION public.get_payment_analytics(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_breakdown JSONB;
  v_total_paid INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid
  FROM public.payments
  WHERE branch_id = p_branch_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date
    AND payment_status = 'completed';

  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_method', p.payment_method,
      'total_cents', COALESCE(SUM(p.amount_cents), 0),
      'transaction_count', COUNT(*),
      'percentage', CASE WHEN v_total_paid > 0 THEN ROUND((COALESCE(SUM(p.amount_cents), 0)::numeric / v_total_paid::numeric) * 100, 2) ELSE 0 END
    )
  )
  INTO v_breakdown
  FROM public.payments p
  WHERE p.branch_id = p_branch_id
    AND p.created_at >= p_start_date
    AND p.created_at <= p_end_date
    AND p.payment_status = 'completed'
  GROUP BY p.payment_method;

  RETURN jsonb_build_object(
    'success', true,
    'total_paid_cents', v_total_paid,
    'breakdown', COALESCE(v_breakdown, '[]'::jsonb)
  );
END;
$$;

-- 6. Menu Analytics RPC
CREATE OR REPLACE FUNCTION public.get_menu_analytics(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_name', sub.item_name_snapshot,
      'quantity_sold', sub.qty_sold,
      'total_revenue_cents', sub.total_rev,
      'orders_count', sub.orders_cnt,
      'avg_price_cents', sub.avg_price
    )
    ORDER BY sub.total_rev DESC
  )
  INTO v_items
  FROM (
    SELECT
      oi.item_name_snapshot,
      SUM(oi.quantity) as qty_sold,
      SUM(oi.line_subtotal_cents) as total_rev,
      COUNT(DISTINCT oi.order_id) as orders_cnt,
      ROUND(AVG(oi.unit_price_cents_snapshot)) as avg_price
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.branch_id = p_branch_id
      AND o.created_at >= p_start_date
      AND o.created_at <= p_end_date
      AND o.status <> 'cancelled'
    GROUP BY oi.item_name_snapshot
    ORDER BY SUM(oi.line_subtotal_cents) DESC
    LIMIT LEAST(50, GREATEST(1, p_limit))
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

-- 7. Modifier Analytics RPC
CREATE OR REPLACE FUNCTION public.get_modifier_analytics(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modifiers JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'group_name', oim.group_name_snapshot,
      'option_name', oim.option_name_snapshot,
      'selections_count', COUNT(*),
      'additional_revenue_cents', SUM(oim.additional_price_cents_snapshot)
    )
    ORDER BY COUNT(*) DESC
  )
  INTO v_modifiers
  FROM public.order_item_modifiers oim
  JOIN public.order_items oi ON oi.id = oim.order_item_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND o.status <> 'cancelled'
  GROUP BY oim.group_name_snapshot, oim.option_name_snapshot
  LIMIT LEAST(50, GREATEST(1, p_limit));

  RETURN jsonb_build_object(
    'success', true,
    'modifiers', COALESCE(v_modifiers, '[]'::jsonb)
  );
END;
$$;

-- 8. Kitchen Operations Analytics RPC
CREATE OR REPLACE FUNCTION public.get_kitchen_analytics(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_confirm_sec INTEGER := 0;
  v_avg_prep_sec INTEGER := 0;
  v_avg_ready_sec INTEGER := 0;
  v_max_prep_sec INTEGER := 0;
BEGIN
  -- Pending -> Confirmed
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (h_conf.created_at - h_pend.created_at))), 0)::integer
  INTO v_avg_confirm_sec
  FROM public.order_status_history h_pend
  JOIN public.order_status_history h_conf ON h_conf.order_id = h_pend.order_id
  JOIN public.orders o ON o.id = h_pend.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND h_pend.new_status = 'pending'
    AND h_conf.new_status = 'confirmed';

  -- Preparing -> Ready
  SELECT
    COALESCE(AVG(EXTRACT(EPOCH FROM (h_ready.created_at - h_prep.created_at))), 0)::integer,
    COALESCE(MAX(EXTRACT(EPOCH FROM (h_ready.created_at - h_prep.created_at))), 0)::integer
  INTO
    v_avg_prep_sec,
    v_max_prep_sec
  FROM public.order_status_history h_prep
  JOIN public.order_status_history h_ready ON h_ready.order_id = h_prep.order_id
  JOIN public.orders o ON o.id = h_prep.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND h_prep.new_status = 'preparing'
    AND h_ready.new_status = 'ready';

  -- Ready -> Completed
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (h_comp.created_at - h_ready.created_at))), 0)::integer
  INTO v_avg_ready_sec
  FROM public.order_status_history h_ready
  JOIN public.order_status_history h_comp ON h_comp.order_id = h_ready.order_id
  JOIN public.orders o ON o.id = h_ready.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND h_ready.new_status = 'ready'
    AND h_comp.new_status = 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'avg_confirmation_seconds', v_avg_confirm_sec,
    'avg_preparation_seconds', v_avg_prep_sec,
    'avg_ready_seconds', v_avg_ready_sec,
    'longest_preparation_seconds', v_max_prep_sec
  );
END;
$$;

-- 9. Dining Table Analytics RPC
CREATE OR REPLACE FUNCTION public.get_table_analytics(
  p_branch_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'table_id', dt.id,
      'table_name', dt.name,
      'table_code', dt.code,
      'orders_count', COUNT(o.id),
      'total_revenue_cents', COALESCE(SUM(o.total_cents), 0),
      'avg_order_value_cents', CASE WHEN COUNT(o.id) > 0 THEN COALESCE(SUM(o.total_cents), 0) / COUNT(o.id) ELSE 0 END
    )
    ORDER BY COALESCE(SUM(o.total_cents), 0) DESC
  )
  INTO v_tables
  FROM public.dining_tables dt
  LEFT JOIN public.orders o ON o.table_id = dt.id
    AND o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND o.status <> 'cancelled'
  WHERE dt.branch_id = p_branch_id
    AND dt.deleted_at IS NULL
  GROUP BY dt.id, dt.name, dt.code;

  RETURN jsonb_build_object(
    'success', true,
    'tables', COALESCE(v_tables, '[]'::jsonb)
  );
END;
$$;

-- 10. Cross-Branch Comparison RPC (Business Owner Only)
CREATE OR REPLACE FUNCTION public.get_branch_comparison(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branches JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'branch_id', sub.branch_id,
      'branch_name', sub.branch_name,
      'branch_code', sub.branch_code,
      'orders_count', sub.orders_count,
      'gross_sales_cents', sub.gross_sales_cents,
      'paid_revenue_cents', sub.paid_revenue_cents,
      'avg_order_value_cents', CASE WHEN sub.valid_orders_count > 0 THEN sub.gross_sales_cents / sub.valid_orders_count ELSE 0 END
    )
    ORDER BY sub.gross_sales_cents DESC
  )
  INTO v_branches
  FROM (
    SELECT
      b.id AS branch_id,
      b.name AS branch_name,
      b.code AS branch_code,
      COUNT(o.id) AS orders_count,
      COUNT(o.id) FILTER (WHERE o.status <> 'cancelled') AS valid_orders_count,
      COALESCE(SUM(o.total_cents) FILTER (WHERE o.status <> 'cancelled'), 0) AS gross_sales_cents,
      COALESCE((
        SELECT SUM(p.amount_cents)
        FROM public.payments p
        WHERE p.branch_id = b.id
          AND p.created_at >= p_start_date
          AND p.created_at <= p_end_date
          AND p.payment_status = 'completed'
      ), 0) AS paid_revenue_cents
    FROM public.branches b
    LEFT JOIN public.orders o ON o.branch_id = b.id
      AND o.created_at >= p_start_date
      AND o.created_at <= p_end_date
    WHERE b.business_id = p_business_id
      AND b.deleted_at IS NULL
    GROUP BY b.id, b.name, b.code
  ) sub;

  RETURN jsonb_build_object(
    'success', true,
    'branches', COALESCE(v_branches, '[]'::jsonb)
  );
END;
$$;

-- Revoke & Grant Private Security Privileges
REVOKE EXECUTE ON FUNCTION public.get_branch_sales_summary(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_sales_summary(uuid, timestamptz, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_revenue_time_series(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_revenue_time_series(uuid, timestamptz, timestamptz, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_hour(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_orders_by_hour(uuid, timestamptz, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_payment_analytics(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_analytics(uuid, timestamptz, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_menu_analytics(uuid, timestamptz, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_menu_analytics(uuid, timestamptz, timestamptz, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_modifier_analytics(uuid, timestamptz, timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_modifier_analytics(uuid, timestamptz, timestamptz, int) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_kitchen_analytics(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kitchen_analytics(uuid, timestamptz, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_table_analytics(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_analytics(uuid, timestamptz, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_branch_comparison(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_branch_comparison(uuid, timestamptz, timestamptz) TO service_role;
