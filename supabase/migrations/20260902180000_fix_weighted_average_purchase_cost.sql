-- ============================================================================
-- Fix Weighted Average Purchase Cost Calculation in record_goods_receipt_and_update_stock
--
-- Root cause of previous discrepancy:
-- 1. Calculated weighted average cost using only the local storage location's
--    balance (v_current_qty) rather than total on-hand stock across all locations.
-- 2. When receiving into a location with 0 stock (e.g. newly created location),
--    it overwrote the item's cost to the new unit cost, ignoring existing stock.
-- 3. In multi-location scenarios (e.g. Eggs: 81 pcs in Kitchen, 10 pcs in Bar = 91 pcs),
--    it calculated (81*60 + 10*80)/91 = 62.20 instead of (91*60 + 10*80)/101 = 61.98.
--
-- This migration fixes the weighted average calculation by aggregating
-- total existing on-hand stock across the business before the balance update,
-- respecting inventory_settings.costing_method ('weighted_average' vs 'latest_cost'),
-- and properly handling multi-unit conversions and multi-location balances.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_goods_receipt_and_update_stock(
  p_business_id UUID,
  p_branch_id UUID,
  p_supplier_id UUID,
  p_location_id UUID,
  p_po_id UUID,
  p_grn_number TEXT,
  p_received_items JSONB, -- Array of { item_id, po_item_id, quantity_received, unit_received, quantity_received_base, unit_cost_cents, batch_code, expiry_date, discrepancy_reason }
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grn_id UUID;
  v_item_elem JSONB;
  v_item_id UUID;
  v_po_item_id UUID;
  v_qty_rec NUMERIC(15, 4);
  v_qty_rec_base NUMERIC(15, 4);
  v_unit_cost INT;
  v_tot_cost INT;
  v_unit_cost_base INT;
  v_batch_code TEXT;
  v_expiry DATE;
  v_discrepancy TEXT;
  v_batch_id UUID;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_total_existing_qty NUMERIC(15, 4);
  v_costing_method public.inventory_costing_method := 'weighted_average';
  v_item_row RECORD;
  v_new_weighted_cost INT;
  v_all_po_received BOOLEAN := TRUE;
  v_any_po_received BOOLEAN := FALSE;
  v_po_item RECORD;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_grn_id
    FROM public.inventory_goods_receipts
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;

    IF v_grn_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'idempotent_replay', true);
    END IF;
  END IF;

  -- Fetch Costing Method from Settings
  SELECT costing_method INTO v_costing_method
  FROM public.inventory_settings
  WHERE business_id = p_business_id
    AND (branch_id = p_branch_id OR branch_id IS NULL)
  ORDER BY branch_id NULLS LAST
  LIMIT 1;

  IF v_costing_method IS NULL THEN
    v_costing_method := 'weighted_average';
  END IF;

  -- 1. Create Goods Receipt Header
  INSERT INTO public.inventory_goods_receipts (
    business_id,
    branch_id,
    po_id,
    supplier_id,
    location_id,
    grn_number,
    idempotency_key,
    received_by,
    received_at,
    notes
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_po_id,
    p_supplier_id,
    p_location_id,
    p_grn_number,
    p_idempotency_key,
    p_actor_id,
    now(),
    p_notes
  ) RETURNING id INTO v_grn_id;

  -- 2. Process each received item
  FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_received_items)
  LOOP
    v_item_id := (v_item_elem->>'item_id')::uuid;
    v_po_item_id := (v_item_elem->>'po_item_id')::uuid;
    v_qty_rec := (v_item_elem->>'quantity_received')::numeric;
    v_qty_rec_base := (v_item_elem->>'quantity_received_base')::numeric;
    v_unit_cost := (v_item_elem->>'unit_cost_cents')::int;

    IF v_qty_rec IS NOT NULL AND v_qty_rec > 0 AND v_qty_rec_base IS NOT NULL AND v_qty_rec_base > 0 THEN
      v_tot_cost := ROUND(v_qty_rec * v_unit_cost);
      v_unit_cost_base := ROUND((v_tot_cost::numeric) / v_qty_rec_base);
    ELSE
      v_tot_cost := ROUND(v_qty_rec_base * v_unit_cost);
      v_unit_cost_base := v_unit_cost;
    END IF;

    v_batch_code := v_item_elem->>'batch_code';
    v_discrepancy := v_item_elem->>'discrepancy_reason';
    IF (v_item_elem->>'expiry_date') IS NOT NULL AND (v_item_elem->>'expiry_date') <> '' THEN
      v_expiry := (v_item_elem->>'expiry_date')::date;
    ELSE
      v_expiry := NULL;
    END IF;

    -- Fetch item definition
    SELECT * INTO v_item_row FROM public.inventory_items WHERE id = v_item_id FOR UPDATE;

    -- Optional Batch Creation
    v_batch_id := NULL;
    IF v_batch_code IS NOT NULL AND v_batch_code <> '' THEN
      INSERT INTO public.inventory_item_batches (
        business_id,
        branch_id,
        location_id,
        item_id,
        batch_code,
        initial_quantity,
        remaining_quantity,
        unit_cost_cents,
        currency,
        received_date,
        expiry_date,
        status
      ) VALUES (
        p_business_id,
        p_branch_id,
        p_location_id,
        v_item_id,
        v_batch_code,
        v_qty_rec_base,
        v_qty_rec_base,
        v_unit_cost_base,
        v_item_row.currency,
        CURRENT_DATE,
        v_expiry,
        'active'
      ) RETURNING id INTO v_batch_id;
    END IF;

    -- Insert GRN line item
    INSERT INTO public.inventory_goods_receipt_items (
      grn_id,
      po_item_id,
      item_id,
      quantity_received,
      unit_received,
      quantity_received_base,
      unit_cost_cents,
      total_cost_cents,
      batch_code,
      expiry_date,
      batch_id,
      discrepancy_reason
    ) VALUES (
      v_grn_id,
      v_po_item_id,
      v_item_id,
      COALESCE(v_qty_rec, v_qty_rec_base),
      v_item_elem->>'unit_received',
      v_qty_rec_base,
      v_unit_cost,
      v_tot_cost,
      v_batch_code,
      v_expiry,
      v_batch_id,
      v_discrepancy
    );

    -- Query total on-hand quantity for this item across all storage locations in the business prior to this receipt
    SELECT COALESCE(SUM(current_quantity), 0.0)
    INTO v_total_existing_qty
    FROM public.inventory_balances
    WHERE business_id = p_business_id AND item_id = v_item_id;

    -- Upsert Inventory Balance for receiving location
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE branch_id = p_branch_id AND location_id = p_location_id AND item_id = v_item_id
    FOR UPDATE;

    IF v_balance.id IS NOT NULL THEN
      v_current_qty := v_balance.current_quantity;
      v_new_qty := v_current_qty + v_qty_rec_base;

      UPDATE public.inventory_balances
      SET current_quantity = v_new_qty,
          last_movement_at = now(),
          updated_at = now()
      WHERE id = v_balance.id;
    ELSE
      v_current_qty := 0.0;
      v_new_qty := v_qty_rec_base;

      INSERT INTO public.inventory_balances (
        business_id,
        branch_id,
        location_id,
        item_id,
        current_quantity,
        reserved_quantity,
        last_movement_at,
        updated_at
      ) VALUES (
        p_business_id,
        p_branch_id,
        p_location_id,
        v_item_id,
        v_new_qty,
        0.0,
        now(),
        now()
      );
    END IF;

    -- Calculate Locked Cost according to configured costing method
    IF v_costing_method = 'latest_cost' THEN
      v_new_weighted_cost := v_unit_cost_base;
    ELSE
      -- Weighted Average Cost:
      -- If existing total stock is zero or negative, the new unit cost is the incoming purchase unit cost.
      -- If existing stock is positive, accurately weight existing stock value + new incoming cost over total stock.
      IF v_total_existing_qty <= 0 THEN
        v_new_weighted_cost := v_unit_cost_base;
      ELSE
        v_new_weighted_cost := ROUND(((v_total_existing_qty * v_item_row.cost_per_unit_cents) + v_tot_cost) / (v_total_existing_qty + v_qty_rec_base));
      END IF;
    END IF;

    UPDATE public.inventory_items
    SET cost_per_unit_cents = v_new_weighted_cost,
        updated_at = now()
    WHERE id = v_item_id;

    -- Update supplier item last price
    UPDATE public.inventory_supplier_items
    SET last_price_cents = v_unit_cost,
        updated_at = now()
    WHERE supplier_id = p_supplier_id AND item_id = v_item_id;

    -- Insert Audit Movement
    INSERT INTO public.inventory_stock_movements (
      business_id,
      branch_id,
      location_id,
      item_id,
      batch_id,
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
      p_business_id,
      p_branch_id,
      p_location_id,
      v_item_id,
      v_batch_id,
      'purchase_receipt',
      'in',
      COALESCE(v_qty_rec, v_qty_rec_base),
      COALESCE(v_item_elem->>'unit_received', v_item_row.base_unit),
      v_qty_rec_base,
      v_current_qty,
      v_new_qty,
      v_unit_cost_base,
      v_tot_cost,
      v_item_row.currency,
      'Goods Receipt #' || p_grn_number,
      p_actor_id,
      v_grn_id::text
    );

    -- Update PO Item Received Quantity if linked
    IF v_po_item_id IS NOT NULL THEN
      UPDATE public.inventory_purchase_order_items
      SET quantity_received_base = quantity_received_base + v_qty_rec_base
      WHERE id = v_po_item_id;
    END IF;
  END LOOP;

  -- 3. If PO linked, update PO status
  IF p_po_id IS NOT NULL THEN
    FOR v_po_item IN
      SELECT quantity_ordered_base, quantity_received_base
      FROM public.inventory_purchase_order_items
      WHERE po_id = p_po_id
    LOOP
      IF v_po_item.quantity_received_base > 0 THEN
        v_any_po_received := TRUE;
      END IF;
      IF v_po_item.quantity_received_base < v_po_item.quantity_ordered_base THEN
        v_all_po_received := FALSE;
      END IF;
    END LOOP;

    IF v_all_po_received THEN
      UPDATE public.inventory_purchase_orders
      SET status = 'received', updated_at = now()
      WHERE id = p_po_id;
    ELSIF v_any_po_received THEN
      UPDATE public.inventory_purchase_orders
      SET status = 'partially_received', updated_at = now()
      WHERE id = p_po_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'grn_id', v_grn_id,
    'grn_number', p_grn_number,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_goods_receipt_and_update_stock FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_goods_receipt_and_update_stock FROM anon;
GRANT EXECUTE ON FUNCTION public.record_goods_receipt_and_update_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_goods_receipt_and_update_stock TO service_role;
