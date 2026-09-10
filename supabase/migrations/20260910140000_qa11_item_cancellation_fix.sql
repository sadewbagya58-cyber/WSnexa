-- ============================================================================
-- Migration: 20260910140000_qa11_item_cancellation_fix.sql
-- Fixes QA-11:
-- 1. inventory_order_consumptions_quantity_consumed_base_check:
--    Do NOT set quantity_consumed_base = 0 on full reversal. The original consumed
--    quantity is immutable history; status is updated to reversed_* and reversals
--    table records the reversed amount.
-- 2. inventory_consumption_reversals_disposition_check:
--    Map disposition 'none' to 'no_change' when inserting into inventory_consumption_reversals
--    which only accepts ('return_to_stock', 'record_waste', 'no_change').
-- 3. Prevent 'column updated_at of relation inventory_order_consumptions does not exist'
-- 4. Scope loops to status = 'consumed' and quantity_consumed_base > 0 for complete idempotency
-- ============================================================================

-- ── 1. Update reverse_order_item_consumption RPC ─────────────────────────────

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
  v_item_def RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_qty_to_rev NUMERIC(15, 4);
  v_cost_to_rev INT;
  v_remaining_uncancelled_qty INT;
  v_new_cancelled_qty INT;
  v_is_full_reversal BOOLEAN;
  v_line_fully_reversed BOOLEAN;
  v_reversed_lines_count INT := 0;
  v_total_base_qty_reversed NUMERIC(15, 4) := 0.0;
  v_total_cost_cents_reversed INT := 0;
  v_effective_disposition TEXT := p_disposition;
  v_reversal_disposition TEXT;
BEGIN
  IF v_effective_disposition NOT IN ('return_to_stock', 'record_waste', 'none') THEN
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

  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_ALREADY_COMPLETED');
  END IF;

  -- Food in preparation or ready can NEVER be returned to raw stock
  IF v_order.status IN ('preparing', 'ready') AND v_effective_disposition = 'return_to_stock' THEN
    v_effective_disposition := 'record_waste';
  END IF;

  -- Map 'none' to 'no_change' for consumption reversals table constraint
  v_reversal_disposition := CASE
    WHEN v_effective_disposition = 'none' THEN 'no_change'
    ELSE v_effective_disposition
  END;

  SELECT * INTO v_item FROM public.order_items WHERE id = p_order_item_id AND order_id = p_order_id FOR UPDATE;
  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ITEM_NOT_FOUND');
  END IF;

  v_remaining_uncancelled_qty := v_item.quantity - COALESCE(v_item.cancelled_quantity, 0);
  IF p_cancelled_qty <= 0 OR p_cancelled_qty > v_remaining_uncancelled_qty THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUANTITY',
      'remaining_uncancelled_qty', v_remaining_uncancelled_qty
    );
  END IF;

  v_new_cancelled_qty := COALESCE(v_item.cancelled_quantity, 0) + p_cancelled_qty;
  v_is_full_reversal := (v_new_cancelled_qty >= v_item.quantity);

  -- Process active consumption rows for this order item
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
      AND order_item_id = p_order_item_id
      AND status = 'consumed'
      AND quantity_consumed_base > 0
    ORDER BY id ASC
    FOR UPDATE
  LOOP
    v_qty_to_rev := ROUND((v_cons.quantity_consumed_base * p_cancelled_qty::NUMERIC / v_remaining_uncancelled_qty::NUMERIC), 4);
    IF v_qty_to_rev > v_cons.quantity_consumed_base THEN
      v_qty_to_rev := v_cons.quantity_consumed_base;
    END IF;

    v_cost_to_rev := ROUND((v_cons.total_cost_cents_snapshot * p_cancelled_qty::NUMERIC / v_remaining_uncancelled_qty::NUMERIC));
    IF v_cost_to_rev > v_cons.total_cost_cents_snapshot THEN
      v_cost_to_rev := v_cons.total_cost_cents_snapshot;
    END IF;

    IF v_qty_to_rev > 0 THEN
      SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_cons.item_id;

      IF v_effective_disposition = 'return_to_stock' THEN
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

      ELSIF v_effective_disposition = 'record_waste' THEN
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

      v_line_fully_reversed := v_is_full_reversal OR ((v_cons.quantity_consumed_base - v_qty_to_rev) <= 0.0001);

      -- State snapshot updates on consumption record
      IF v_line_fully_reversed THEN
        INSERT INTO public.inventory_consumption_reversals (
          business_id, branch_id, order_id, consumption_id, item_id, location_id,
          quantity_reversed_base, disposition, cost_cents_snapshot, currency,
          reason, actor_id, idempotency_key
        ) VALUES (
          v_cons.business_id, v_cons.branch_id, p_order_id, v_cons.id, v_cons.item_id, v_cons.location_id,
          v_qty_to_rev, v_reversal_disposition, v_cost_to_rev, v_cons.currency,
          p_reason, v_actor_id, v_cons.id::text || '_item_full_rev_' || now()::text
        ) ON CONFLICT (consumption_id) DO NOTHING;

        -- Retain quantity_consumed_base > 0 to satisfy check constraint
        UPDATE public.inventory_order_consumptions
        SET
          status = CASE
            WHEN v_effective_disposition = 'return_to_stock' THEN 'reversed_to_stock'::public.inventory_consumption_status
            WHEN v_effective_disposition = 'record_waste' THEN 'reversed_as_waste'::public.inventory_consumption_status
            ELSE 'reversed_no_change'::public.inventory_consumption_status
          END,
          reversed_at = now(),
          reversal_reason = p_reason,
          reversal_actor_id = v_actor_id
        WHERE id = v_cons.id;
      ELSE
        -- Partial reversal: decrement while strictly remaining > 0
        UPDATE public.inventory_order_consumptions
        SET
          quantity_consumed_base = quantity_consumed_base - v_qty_to_rev,
          total_cost_cents_snapshot = total_cost_cents_snapshot - v_cost_to_rev
        WHERE id = v_cons.id;
      END IF;

      v_reversed_lines_count := v_reversed_lines_count + 1;
      v_total_base_qty_reversed := v_total_base_qty_reversed + v_qty_to_rev;
      v_total_cost_cents_reversed := v_total_cost_cents_reversed + v_cost_to_rev;
    END IF;
  END LOOP;

  -- Update order item row
  UPDATE public.order_items
  SET
    status = CASE WHEN v_is_full_reversal THEN 'cancelled' ELSE 'partially_cancelled' END,
    cancelled_quantity = v_new_cancelled_qty
  WHERE id = p_order_item_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_item_id', p_order_item_id,
    'cancelled_qty', p_cancelled_qty,
    'is_full_reversal', v_is_full_reversal,
    'disposition', v_effective_disposition,
    'reversed_lines_count', v_reversed_lines_count,
    'total_base_qty_reversed', v_total_base_qty_reversed,
    'total_cost_cents_reversed', v_total_cost_cents_reversed
  );
END;
$$;

-- ── 2. Update reverse_order_consumption RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.reverse_order_consumption(
  p_order_id UUID,
  p_disposition TEXT, -- 'return_to_stock', 'record_waste', 'no_change', 'none'
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
  v_cons RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_item_def RECORD;
  v_reversed_count INT := 0;
  v_has_pending BOOLEAN := false;
  v_effective_disposition TEXT := p_disposition;
  v_reversal_disposition TEXT;
BEGIN
  IF v_effective_disposition NOT IN ('return_to_stock', 'record_waste', 'no_change', 'none') THEN
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

  v_reversal_disposition := CASE
    WHEN v_effective_disposition = 'none' THEN 'no_change'
    ELSE v_effective_disposition
  END;

  -- 1. ORDER-WIDE PRE-FLIGHT PASS: Check for any unreversed consumed rows
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
      AND status = 'consumed'
      AND quantity_consumed_base > 0
    FOR UPDATE
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_consumption_reversals
      WHERE consumption_id = v_cons.id
    ) THEN
      v_has_pending := true;
    END IF;
  END LOOP;

  IF NOT v_has_pending THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'reversed_count', 0);
  END IF;

  -- 2. ATOMIC MUTATION PASS: Process only active unreversed rows
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
      AND status = 'consumed'
      AND quantity_consumed_base > 0
    ORDER BY item_id ASC
    FOR UPDATE
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.inventory_consumption_reversals
      WHERE consumption_id = v_cons.id
    ) THEN
      SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_cons.item_id;

      IF v_effective_disposition = 'return_to_stock' THEN
        SELECT * INTO v_balance
        FROM public.inventory_balances
        WHERE branch_id = v_cons.branch_id AND location_id = v_cons.location_id AND item_id = v_cons.item_id
        FOR UPDATE;

        IF v_balance.id IS NOT NULL THEN
          v_current_qty := v_balance.current_quantity;
          v_new_qty := v_current_qty + v_cons.quantity_consumed_base;

          UPDATE public.inventory_balances
          SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
          WHERE id = v_balance.id;
        ELSE
          v_current_qty := 0.0;
          v_new_qty := v_cons.quantity_consumed_base;

          INSERT INTO public.inventory_balances (
            business_id, branch_id, location_id, item_id, current_quantity, reserved_quantity, last_movement_at, updated_at
          ) VALUES (
            v_cons.business_id, v_cons.branch_id, v_cons.location_id, v_cons.item_id, v_new_qty, 0.0, now(), now()
          );
        END IF;

        INSERT INTO public.inventory_stock_movements (
          business_id,
          branch_id,
          location_id,
          item_id,
          movement_type,
          direction,
          quantity,
          unit,
          quantity_base,
          previous_balance_base,
          new_balance_base,
          unit_cost_cents,
          total_cost_cents,
          currency,
          reason,
          actor_id,
          reference_id
        ) VALUES (
          v_cons.business_id,
          v_cons.branch_id,
          v_cons.location_id,
          v_cons.item_id,
          'consumption_reversal',
          'in',
          v_cons.quantity_consumed_base,
          v_item_def.base_unit,
          v_cons.quantity_consumed_base,
          v_current_qty,
          v_new_qty,
          v_cons.unit_cost_cents_snapshot,
          v_cons.total_cost_cents_snapshot,
          v_cons.currency,
          'Order cancellation reversal: ' || p_reason,
          v_actor_id,
          p_order_id::text
        );

      ELSIF v_effective_disposition = 'record_waste' THEN
        INSERT INTO public.inventory_waste_records (
          business_id,
          branch_id,
          location_id,
          item_id,
          quantity,
          unit,
          quantity_base,
          reason,
          unit_cost_cents,
          total_cost_cents,
          currency,
          notes,
          actor_id
        ) VALUES (
          v_cons.business_id,
          v_cons.branch_id,
          v_cons.location_id,
          v_cons.item_id,
          v_cons.quantity_consumed_base,
          v_item_def.base_unit,
          v_cons.quantity_consumed_base,
          'prep_waste',
          v_cons.unit_cost_cents_snapshot,
          v_cons.total_cost_cents_snapshot,
          v_cons.currency,
          'Order cancellation waste: ' || p_reason,
          v_actor_id
        );
      END IF;

      INSERT INTO public.inventory_consumption_reversals (
        business_id,
        branch_id,
        order_id,
        consumption_id,
        item_id,
        location_id,
        quantity_reversed_base,
        disposition,
        cost_cents_snapshot,
        currency,
        reason,
        actor_id,
        idempotency_key
      ) VALUES (
        v_cons.business_id,
        v_cons.branch_id,
        p_order_id,
        v_cons.id,
        v_cons.item_id,
        v_cons.location_id,
        v_cons.quantity_consumed_base,
        v_reversal_disposition,
        v_cons.total_cost_cents_snapshot,
        v_cons.currency,
        p_reason,
        v_actor_id,
        v_cons.id::text || '_' || v_reversal_disposition
      ) ON CONFLICT (consumption_id) DO NOTHING;

      -- Retain quantity_consumed_base > 0 to satisfy check constraint
      UPDATE public.inventory_order_consumptions
      SET
        status = CASE
          WHEN v_effective_disposition = 'return_to_stock' THEN 'reversed_to_stock'::public.inventory_consumption_status
          WHEN v_effective_disposition = 'record_waste' THEN 'reversed_as_waste'::public.inventory_consumption_status
          ELSE 'reversed_no_change'::public.inventory_consumption_status
        END,
        reversed_at = now(),
        reversal_reason = p_reason,
        reversal_actor_id = v_actor_id
      WHERE id = v_cons.id;

      v_reversed_count := v_reversed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reversed_count', v_reversed_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverse_order_item_consumption(UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_order_item_consumption(UUID, UUID, INT, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
