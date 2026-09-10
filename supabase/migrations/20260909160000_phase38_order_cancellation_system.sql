-- ═══════════════════════════════════════════════════════════════════════════════
-- WSNexa Phase 38: Order Cancellation & Adjustment System Schema & RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Venue Configurable Customer Cancellation Policy on Settings ───────────

ALTER TABLE public.branch_order_security_settings
  ADD COLUMN IF NOT EXISTS customer_cancellation_policy TEXT NOT NULL DEFAULT 'before_confirmation'
    CHECK (customer_cancellation_policy IN ('disabled', 'before_confirmation', 'within_time_limit', 'before_preparation')),
  ADD COLUMN IF NOT EXISTS cancellation_time_limit_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (cancellation_time_limit_minutes >= 1 AND cancellation_time_limit_minutes <= 60),
  ADD COLUMN IF NOT EXISTS require_manager_approval_after_prep BOOLEAN NOT NULL DEFAULT true;

-- ── 2. Extend Orders Table for Cancellation & Refund Eligibility ──────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS refund_eligibility TEXT NOT NULL DEFAULT 'none'
    CHECK (refund_eligibility IN ('none', 'eligible', 'not_applicable', 'processed')),
  ADD COLUMN IF NOT EXISTS last_cancellation_id UUID NULL;

-- ── 3. Extend Order Items Table for Item-Level Status and Quantity ───────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'partially_cancelled')),
  ADD COLUMN IF NOT EXISTS cancelled_quantity INTEGER NOT NULL DEFAULT 0
    CHECK (cancelled_quantity >= 0);

-- ── 4. Dedicated Cancellation Audit & Approval Ledger ─────────────────────────

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  cancellation_scope TEXT NOT NULL CHECK (cancellation_scope IN ('full_order', 'item_level', 'request')),
  channel TEXT NOT NULL CHECK (channel IN ('customer_qr', 'waiter_menu', 'kitchen_kds', 'cashier_pos', 'manager_workflow')),
  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('customer', 'staff', 'system')),
  requested_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_access_token_used BOOLEAN NOT NULL DEFAULT false,
  reason_category TEXT NOT NULL,
  reason_notes TEXT NULL,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('approved', 'rejected', 'pending_approval')),
  approved_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  inventory_disposition TEXT NOT NULL DEFAULT 'none' CHECK (inventory_disposition IN ('return_to_stock', 'record_waste', 'none')),
  refund_required BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ NULL,
  rejected_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_order_cancellations_order ON public.order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_branch_status ON public.order_cancellations(branch_id, approval_status);

CREATE TABLE IF NOT EXISTS public.order_cancellation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancellation_id UUID NOT NULL REFERENCES public.order_cancellations(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  quantity_cancelled INTEGER NOT NULL CHECK (quantity_cancelled > 0),
  unit_price_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  line_subtotal_cancelled_cents INTEGER NOT NULL DEFAULT 0,
  inventory_disposition TEXT NOT NULL DEFAULT 'none' CHECK (inventory_disposition IN ('return_to_stock', 'record_waste', 'none')),
  base_quantity_reversed NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  cost_cents_reversed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_cancellation_items_canc ON public.order_cancellation_items(cancellation_id);
CREATE INDEX IF NOT EXISTS idx_order_cancellation_items_item ON public.order_cancellation_items(order_item_id);

-- Enable RLS
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_cancellation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for order_cancellations" ON public.order_cancellations;
CREATE POLICY "Tenant isolation for order_cancellations"
  ON public.order_cancellations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = order_cancellations.business_id
        AND bm.user_id = auth.uid()
        AND bm.membership_status = 'active'
    )
  );

DROP POLICY IF EXISTS "Tenant isolation for order_cancellation_items" ON public.order_cancellation_items;
CREATE POLICY "Tenant isolation for order_cancellation_items"
  ON public.order_cancellation_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.order_cancellations oc
      JOIN public.business_memberships bm ON bm.business_id = oc.business_id
      WHERE oc.id = order_cancellation_items.cancellation_id
        AND bm.user_id = auth.uid()
        AND bm.membership_status = 'active'
    )
  );

-- ── 5. Atomic RPC: reverse_order_item_consumption ────────────────────────────

CREATE OR REPLACE FUNCTION public.reverse_order_item_consumption(
  p_order_id UUID,
  p_order_item_id UUID,
  p_cancelled_qty INT,
  p_disposition TEXT, -- 'return_to_stock', 'record_waste', 'none'
  p_reason TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_actor_id UUID;
  v_order RECORD;
  v_item RECORD;
  v_cons RECORD;
  v_balance RECORD;
  v_item_def RECORD;
  v_remaining_unreversed_qty INT;
  v_is_full_reversal BOOLEAN;
  v_qty_to_rev NUMERIC(15, 4);
  v_cost_to_rev INT;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_reversed_lines_count INT := 0;
  v_total_base_qty_reversed NUMERIC(15, 4) := 0.0;
  v_total_cost_cents_reversed INT := 0;
BEGIN
  IF p_disposition NOT IN ('return_to_stock', 'record_waste', 'none') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DISPOSITION');
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    v_actor_id := v_caller_id;
  ELSE
    v_actor_id := p_actor_id;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id AND order_id = p_order_id FOR UPDATE;
  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_ITEM_NOT_FOUND');
  END IF;

  v_remaining_unreversed_qty := v_item.quantity - v_item.cancelled_quantity;
  IF p_cancelled_qty > v_remaining_unreversed_qty THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANCEL_QTY_EXCEEDS_REMAINING',
      'remaining_quantity', v_remaining_unreversed_qty,
      'requested_cancel_qty', p_cancelled_qty
    );
  END IF;

  v_is_full_reversal := (p_cancelled_qty = v_remaining_unreversed_qty);

  -- Loop through all consumptions recorded for this item
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_item_id = p_order_item_id
    ORDER BY item_id ASC
    FOR UPDATE
  LOOP
    SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_cons.item_id;

    IF v_is_full_reversal THEN
      -- Full reversal of remaining consumption
      v_qty_to_rev := v_cons.quantity_consumed_base;
      v_cost_to_rev := v_cons.total_cost_cents_snapshot;
    ELSE
      -- Partial reversal: calculate proportional base quantity and cost
      v_qty_to_rev := ROUND((p_cancelled_qty::NUMERIC / v_remaining_unreversed_qty::NUMERIC) * v_cons.quantity_consumed_base, 4);
      v_cost_to_rev := ROUND((p_cancelled_qty::NUMERIC / v_remaining_unreversed_qty::NUMERIC) * v_cons.total_cost_cents_snapshot);
    END IF;

    IF v_qty_to_rev > 0 THEN
      -- Physical inventory balance adjustments
      IF p_disposition = 'return_to_stock' THEN
        SELECT * INTO v_balance
        FROM public.inventory_balances
        WHERE branch_id = v_cons.branch_id AND location_id = v_cons.location_id AND item_id = v_cons.item_id
        FOR UPDATE;

        IF v_balance.id IS NOT NULL THEN
          v_current_qty := v_balance.current_quantity;
          v_new_qty := v_current_qty + v_qty_to_rev;

          UPDATE public.inventory_balances
          SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
          WHERE id = v_balance.id;
        ELSE
          v_current_qty := 0.0;
          v_new_qty := v_qty_to_rev;

          INSERT INTO public.inventory_balances (
            business_id, branch_id, location_id, item_id, current_quantity, reserved_quantity, last_movement_at, updated_at
          ) VALUES (
            v_cons.business_id, v_cons.branch_id, v_cons.location_id, v_cons.item_id, v_new_qty, 0.0, now(), now()
          );
        END IF;

        INSERT INTO public.inventory_stock_movements (
          business_id, branch_id, location_id, item_id,
          movement_type, direction, quantity, unit, quantity_base,
          previous_balance_base, new_balance_base, unit_cost_cents, total_cost_cents,
          currency, reason, actor_id, reference_id
        ) VALUES (
          v_cons.business_id, v_cons.branch_id, v_cons.location_id, v_cons.item_id,
          'consumption_reversal', 'in', v_qty_to_rev, v_item_def.base_unit, v_qty_to_rev,
          v_current_qty, v_new_qty, v_cons.unit_cost_cents_snapshot, v_cost_to_rev,
          v_cons.currency, 'Item cancellation reversal: ' || p_reason, v_actor_id, p_order_id::text
        );

      ELSIF p_disposition = 'record_waste' THEN
        INSERT INTO public.inventory_waste_records (
          business_id, branch_id, location_id, item_id,
          quantity, unit, quantity_base, reason,
          unit_cost_cents, total_cost_cents, currency, notes, actor_id
        ) VALUES (
          v_cons.business_id, v_cons.branch_id, v_cons.location_id, v_cons.item_id,
          v_qty_to_rev, v_item_def.base_unit, v_qty_to_rev, 'prep_waste',
          v_cons.unit_cost_cents_snapshot, v_cost_to_rev, v_cons.currency,
          'Item cancellation waste: ' || p_reason, v_actor_id
        );
      END IF;

      -- State snapshot updates on consumption record
      IF v_is_full_reversal THEN
        -- Insert into inventory_consumption_reversals since the full consumption record is closed out
        INSERT INTO public.inventory_consumption_reversals (
          business_id, branch_id, order_id, consumption_id, item_id, location_id,
          quantity_reversed_base, disposition, cost_cents_snapshot, currency,
          reason, actor_id, idempotency_key
        ) VALUES (
          v_cons.business_id, v_cons.branch_id, p_order_id, v_cons.id, v_cons.item_id, v_cons.location_id,
          v_qty_to_rev, p_disposition, v_cost_to_rev, v_cons.currency,
          p_reason, v_actor_id, v_cons.id::text || '_item_full_rev_' || now()::text
        ) ON CONFLICT (consumption_id) DO NOTHING;

        UPDATE public.inventory_order_consumptions
        SET
          status = CASE
            WHEN p_disposition = 'return_to_stock' THEN 'reversed_to_stock'::public.inventory_consumption_status
            WHEN p_disposition = 'record_waste' THEN 'reversed_as_waste'::public.inventory_consumption_status
            ELSE 'reversed_no_change'::public.inventory_consumption_status
          END,
          quantity_consumed_base = 0.0000,
          total_cost_cents_snapshot = 0,
          reversal_reason = p_reason,
          reversal_actor_id = v_actor_id,
          reversed_at = now()
        WHERE id = v_cons.id;
      ELSE
        -- Partial line reversal: Decrement remaining consumption so future reversals or order-wide cancellation will reverse only the remaining balance
        UPDATE public.inventory_order_consumptions
        SET
          quantity_consumed_base = GREATEST(0.0000, v_cons.quantity_consumed_base - v_qty_to_rev),
          total_cost_cents_snapshot = GREATEST(0, v_cons.total_cost_cents_snapshot - v_cost_to_rev),
          reversal_reason = COALESCE(v_cons.reversal_reason || '; ', '') || 'Partial: ' || p_reason
        WHERE id = v_cons.id;
      END IF;

      v_reversed_lines_count := v_reversed_lines_count + 1;
      v_total_base_qty_reversed := v_total_base_qty_reversed + v_qty_to_rev;
      v_total_cost_cents_reversed := v_total_cost_cents_reversed + v_cost_to_rev;
    END IF;
  END LOOP;

  -- Update order item status and cancelled quantity
  UPDATE public.order_items
  SET
    cancelled_quantity = cancelled_quantity + p_cancelled_qty,
    status = CASE
      WHEN (cancelled_quantity + p_cancelled_qty) >= quantity THEN 'cancelled'
      ELSE 'partially_cancelled'
    END
  WHERE id = p_order_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_item_id', p_order_item_id,
    'cancelled_qty', p_cancelled_qty,
    'is_full_reversal', v_is_full_reversal,
    'reversed_lines_count', v_reversed_lines_count,
    'total_base_qty_reversed', v_total_base_qty_reversed,
    'total_cost_cents_reversed', v_total_cost_cents_reversed
  );
END;
$$;

-- ── 6. Atomic RPC: cancel_order_atomic ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id UUID,
  p_channel TEXT, -- 'customer_qr', 'waiter_menu', 'kitchen_kds', 'cashier_pos', 'manager_workflow'
  p_requested_by_type TEXT, -- 'customer', 'staff', 'system'
  p_reason_category TEXT,
  p_reason_notes TEXT,
  p_disposition TEXT, -- 'return_to_stock', 'record_waste', 'none'
  p_actor_id UUID DEFAULT NULL,
  p_guest_access_token_used BOOLEAN DEFAULT false,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_previous_status public.order_status;
  v_refund_eligibility TEXT := 'none';
  v_refund_required BOOLEAN := false;
  v_cancellation_id UUID;
  v_has_consumption BOOLEAN := false;
  v_rev_result JSONB;
BEGIN
  IF p_disposition NOT IN ('return_to_stock', 'record_waste', 'none') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DISPOSITION');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  -- Strictly reject cancellation if order is completed
  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_ALREADY_COMPLETED');
  END IF;

  -- Idempotency check: if order is already cancelled, return success
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'idempotent_replay', true,
      'status', 'cancelled',
      'refund_eligibility', v_order.refund_eligibility
    );
  END IF;

  v_previous_status := v_order.status;

  -- Determine refund eligibility and flag
  IF v_order.payment_status = 'paid' THEN
    v_refund_eligibility := 'eligible';
    v_refund_required := true;
  ELSE
    v_refund_eligibility := 'not_applicable';
    v_refund_required := false;
  END IF;

  -- 1. Create order_cancellations record
  INSERT INTO public.order_cancellations (
    business_id, branch_id, order_id, cancellation_scope,
    channel, requested_by_type, requested_by_user_id, guest_access_token_used,
    reason_category, reason_notes, approval_status, approved_by_user_id,
    inventory_disposition, refund_required, metadata, approved_at
  ) VALUES (
    v_order.business_id, v_order.branch_id, p_order_id, 'full_order',
    p_channel, p_requested_by_type, p_actor_id, p_guest_access_token_used,
    p_reason_category, p_reason_notes, 'approved', p_actor_id,
    p_disposition, v_refund_required, p_metadata, now()
  ) RETURNING id INTO v_cancellation_id;

  -- 2. Update orders record
  UPDATE public.orders
  SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason_notes,
    refund_eligibility = v_refund_eligibility,
    last_cancellation_id = v_cancellation_id,
    updated_at = now()
  WHERE id = p_order_id;

  -- 3. Update all order_items to cancelled
  UPDATE public.order_items
  SET
    status = 'cancelled',
    cancelled_quantity = quantity
  WHERE order_id = p_order_id;

  -- 4. Record status change history
  INSERT INTO public.order_status_history (
    order_id, previous_status, new_status, changed_by, notes
  ) VALUES (
    p_order_id, v_previous_status, 'cancelled', p_actor_id,
    COALESCE(p_reason_notes, 'Order cancelled via ' || p_channel)
  );

  -- 5. Inventory reversal handling: only execute if consumption records exist
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id AND quantity_consumed_base > 0
  ) INTO v_has_consumption;

  IF v_has_consumption AND p_disposition != 'none' THEN
    v_rev_result := public.reverse_order_consumption(
      p_order_id,
      p_disposition,
      COALESCE(p_reason_notes, 'Full order cancellation via ' || p_channel),
      p_actor_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'cancellation_id', v_cancellation_id,
    'previous_status', v_previous_status,
    'status', 'cancelled',
    'refund_eligibility', v_refund_eligibility,
    'refund_required', v_refund_required,
    'inventory_reversed', v_has_consumption AND (p_disposition != 'none')
  );
END;
$$;

-- ── 7. Permissions & Grants ───────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.reverse_order_item_consumption(UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_order_item_consumption(UUID, UUID, INT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, BOOLEAN, JSONB) TO authenticated, service_role;
