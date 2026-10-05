-- Migration: 20261005110000_fix_inventory_reversal_disposition_conflict.sql
-- Description: Fix public.reverse_order_consumption RPC preflight logic to detect conflicting dispositions on previously reversed orders

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
  v_existing_rev RECORD;
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

  -- 1. ORDER-WIDE PRE-FLIGHT PASS:
  -- A. Check if this order was already reversed with a different/conflicting disposition
  SELECT * INTO v_existing_rev
  FROM public.inventory_consumption_reversals
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_existing_rev.id IS NOT NULL AND v_existing_rev.disposition != v_reversal_disposition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_REVERSED',
      'existing_disposition', v_existing_rev.disposition,
      'requested_disposition', v_reversal_disposition
    );
  END IF;

  -- B. Check for any unreversed consumed rows
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

REVOKE EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
