-- ============================================================================
-- WSNexa Phase 38 QA Fixes: Order Cancellation & Adjustment Engine
-- Migration: 20260909180000_phase38_cancellation_qa_blocker_fixes.sql
-- ============================================================================

-- ── 1. Settings Schema Additions & Policy Extensions ─────────────────────────

ALTER TABLE public.branch_order_security_settings
  ADD COLUMN IF NOT EXISTS allow_customer_cancellation BOOLEAN NOT NULL DEFAULT true;

-- Update check constraint on customer_cancellation_policy to support all stage policies
ALTER TABLE public.branch_order_security_settings
  DROP CONSTRAINT IF EXISTS branch_order_security_settings_customer_cancellation_policy_check;

ALTER TABLE public.branch_order_security_settings
  ADD CONSTRAINT branch_order_security_settings_customer_cancellation_policy_check
  CHECK (customer_cancellation_policy IN (
    'disabled',
    'before_confirmation',
    'within_time_limit',
    'before_preparation',
    'during_preparation',
    'until_ready'
  ));

-- ── 2. Terminal CANCELLED Invariant Trigger ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.prevent_reactivate_cancelled_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Invalid order transition: Cancelled orders are terminal and cannot be reactivated.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reactivate_cancelled_order ON public.orders;
CREATE TRIGGER trg_prevent_reactivate_cancelled_order
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_reactivate_cancelled_order();

-- ── 3. Update reverse_order_item_consumption RPC ─────────────────────────────
-- Ensures in-prep items cannot be returned to stock, and logs authoritative waste.

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
  v_reversed_lines_count INT := 0;
  v_total_base_qty_reversed NUMERIC(15, 4) := 0.0;
  v_total_cost_cents_reversed INT := 0;
  v_effective_disposition TEXT := p_disposition;
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

      -- State snapshot updates on consumption record
      IF v_is_full_reversal THEN
        INSERT INTO public.inventory_consumption_reversals (
          business_id, branch_id, order_id, consumption_id, item_id, location_id,
          quantity_reversed_base, disposition, cost_cents_snapshot, currency,
          reason, actor_id, idempotency_key
        ) VALUES (
          v_cons.business_id, v_cons.branch_id, p_order_id, v_cons.id, v_cons.item_id, v_cons.location_id,
          v_qty_to_rev, v_effective_disposition, v_cost_to_rev, v_cons.currency,
          p_reason, v_actor_id, v_cons.id::text || '_item_full_rev_' || now()::text
        ) ON CONFLICT (consumption_id) DO NOTHING;

        UPDATE public.inventory_order_consumptions
        SET
          status = CASE
            WHEN v_effective_disposition = 'return_to_stock' THEN 'reversed_to_stock'::public.inventory_consumption_status
            WHEN v_effective_disposition = 'record_waste' THEN 'reversed_as_waste'::public.inventory_consumption_status
            ELSE 'reversed_no_change'::public.inventory_consumption_status
          END,
          quantity_consumed_base = 0.0000,
          total_cost_cents_snapshot = 0,
          reversed_at = now(),
          reversal_reason = p_reason,
          reversal_actor_id = v_actor_id
        WHERE id = v_cons.id;
      ELSE
        UPDATE public.inventory_order_consumptions
        SET
          quantity_consumed_base = quantity_consumed_base - v_qty_to_rev,
          total_cost_cents_snapshot = total_cost_cents_snapshot - v_cost_to_rev,
          updated_at = now()
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

-- ── 4. Update cancel_order_atomic RPC ─────────────────────────────────────────
-- Updates approval_status to 'cancelled', enforces waste for in-prep orders,
-- and prevents fake waste when zero consumption exists.

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
  v_effective_disposition TEXT := p_disposition;
  v_rev_result JSONB;
BEGIN
  IF v_effective_disposition NOT IN ('return_to_stock', 'record_waste', 'none') THEN
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

  -- Check if inventory was actually consumed
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id AND quantity_consumed_base > 0
  ) INTO v_has_consumption;

  -- Authoritative disposition rule:
  -- 1. If food had already started preparation, it can NEVER be returned to stock
  IF v_previous_status IN ('preparing', 'ready') AND v_has_consumption THEN
    v_effective_disposition := 'record_waste';
  -- 2. If NO consumption ever occurred, never record fake waste or move stock
  ELSIF NOT v_has_consumption THEN
    v_effective_disposition := 'none';
  END IF;

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
    v_effective_disposition, v_refund_required, p_metadata, now()
  ) RETURNING id INTO v_cancellation_id;

  -- 2. Update orders record: update status, set approval_status to 'rejected' if pending
  UPDATE public.orders
  SET
    status = 'cancelled',
    approval_status = CASE
      WHEN approval_status = 'pending_waiter_approval' THEN 'rejected'
      ELSE approval_status
    END,
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
  IF v_has_consumption AND v_effective_disposition != 'none' THEN
    v_rev_result := public.reverse_order_consumption(
      p_order_id,
      v_effective_disposition,
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
    'approval_status', CASE WHEN v_order.approval_status = 'pending_waiter_approval' THEN 'rejected' ELSE v_order.approval_status END,
    'refund_eligibility', v_refund_eligibility,
    'refund_required', v_refund_required,
    'disposition', v_effective_disposition,
    'inventory_reversed', v_has_consumption AND (v_effective_disposition != 'none')
  );
END;
$$;

-- ── 5. Update reverse_order_consumption RPC ──────────────────────────────────
-- Fixes unit_cost_cents column reference in inventory_waste_records,
-- updates inventory_order_consumptions status, and supports 'none' disposition.

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
  v_existing_rev RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_item_def RECORD;
  v_reversed_count INT := 0;
  v_has_pending BOOLEAN := false;
  v_effective_disposition TEXT := p_disposition;
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

  -- 1. ORDER-WIDE PRE-FLIGHT PASS: Check all consumption rows for conflicts
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
    FOR UPDATE
  LOOP
    SELECT * INTO v_existing_rev
    FROM public.inventory_consumption_reversals
    WHERE consumption_id = v_cons.id;

    IF v_existing_rev.id IS NOT NULL THEN
      IF v_existing_rev.disposition != v_effective_disposition THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'ALREADY_REVERSED',
          'consumption_id', v_cons.id,
          'existing_disposition', v_existing_rev.disposition,
          'requested_disposition', v_effective_disposition
        );
      END IF;
    ELSE
      v_has_pending := true;
    END IF;
  END LOOP;

  IF NOT v_has_pending THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'reversed_count', 0);
  END IF;

  -- 2. ATOMIC MUTATION PASS: Runs only after 100% preflight validation passes
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
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
        v_effective_disposition,
        v_cons.total_cost_cents_snapshot,
        v_cons.currency,
        p_reason,
        v_actor_id,
        v_cons.id::text || '_' || v_effective_disposition
      );

      UPDATE public.inventory_order_consumptions
      SET
        status = CASE
          WHEN v_effective_disposition = 'return_to_stock' THEN 'reversed_to_stock'::public.inventory_consumption_status
          WHEN v_effective_disposition = 'record_waste' THEN 'reversed_as_waste'::public.inventory_consumption_status
          ELSE 'reversed_no_change'::public.inventory_consumption_status
        END,
        quantity_consumed_base = 0.0000,
        total_cost_cents_snapshot = 0,
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

