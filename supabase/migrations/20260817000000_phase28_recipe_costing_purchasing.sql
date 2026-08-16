-- Migration: Phase 28 — Advanced Recipe Costing, Purchasing & Inventory Intelligence Schema
-- Version: 20260817000000

-- ── 1. Create Enums ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.inventory_recipe_type AS ENUM ('menu_item', 'prep_recipe');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_modifier_effect_type AS ENUM ('add', 'remove', 'substitute', 'scale');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_po_status AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'sent',
    'partially_received',
    'received',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_consumption_stage AS ENUM ('confirmed', 'preparing', 'served', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_consumption_status AS ENUM (
    'consumed',
    'reversed_to_stock',
    'reversed_as_waste',
    'reversed_no_change'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_costing_method AS ENUM ('weighted_average', 'latest_cost');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_auto_sold_out_mode AS ENUM ('warn_only', 'suggest_sold_out', 'auto_mark_sold_out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Expand movement_type check constraint on existing Phase 27 inventory_stock_movements table
DO $$ BEGIN
  ALTER TABLE public.inventory_stock_movements DROP CONSTRAINT IF EXISTS inventory_stock_movements_movement_type_check;
  ALTER TABLE public.inventory_stock_movements ADD CONSTRAINT inventory_stock_movements_movement_type_check
    CHECK (movement_type IN (
      'opening_balance',
      'adjustment_add',
      'adjustment_remove',
      'stock_count_adjustment',
      'waste',
      'transfer_out',
      'transfer_in',
      'transfer_discrepancy',
      'return',
      'purchase_receive_reserved',
      'recipe_consumption_reserved',
      'purchase_receipt',
      'production_in',
      'production_out',
      'recipe_consumption',
      'consumption_reversal',
      'supplier_return'
    ));
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- ── 2. Recipes & BOM ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  menu_item_id UUID NULL REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
  recipe_type public.inventory_recipe_type NOT NULL DEFAULT 'menu_item',
  output_inventory_item_id UUID NULL REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  yield_quantity NUMERIC(15, 4) NOT NULL DEFAULT 1.0 CHECK (yield_quantity > 0),
  yield_unit TEXT NOT NULL DEFAULT 'portion',
  portion_size TEXT NULL,
  preparation_instructions TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_recipes_biz_item
  ON public.inventory_recipes (business_id, menu_item_id, is_active);

CREATE INDEX IF NOT EXISTS idx_inventory_recipes_output_item
  ON public.inventory_recipes (output_inventory_item_id);

CREATE TABLE IF NOT EXISTS public.inventory_recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.inventory_recipes(id) ON DELETE CASCADE,
  item_id UUID NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  sub_recipe_id UUID NULL REFERENCES public.inventory_recipes(id) ON DELETE RESTRICT,
  quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  quantity_base NUMERIC(15, 4) NOT NULL CHECK (quantity_base > 0),
  yield_factor NUMERIC(5, 4) NOT NULL DEFAULT 1.0 CHECK (yield_factor > 0 AND yield_factor <= 1.0),
  default_location_id UUID NULL REFERENCES public.inventory_storage_locations(id) ON DELETE SET NULL,
  display_order INT NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_recipe_ingredient_ref CHECK (
    (item_id IS NOT NULL AND sub_recipe_id IS NULL) OR
    (item_id IS NULL AND sub_recipe_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
  ON public.inventory_recipe_ingredients (recipe_id, display_order);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item
  ON public.inventory_recipe_ingredients (item_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_sub_recipe
  ON public.inventory_recipe_ingredients (sub_recipe_id);

-- ── 3. Modifier Recipe Overrides (Inventory Effects) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_modifier_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  modifier_option_id UUID NOT NULL REFERENCES public.modifier_options(id) ON DELETE CASCADE,
  effect_type public.inventory_modifier_effect_type NOT NULL DEFAULT 'add',
  item_id UUID NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity NUMERIC(15, 4) NOT NULL DEFAULT 1.0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity_base NUMERIC(15, 4) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modifier_overrides_option
  ON public.inventory_modifier_overrides (modifier_option_id);

-- ── 4. Prep Production Batches ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.inventory_recipes(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  target_location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  source_location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  expected_quantity NUMERIC(15, 4) NOT NULL CHECK (expected_quantity > 0),
  actual_quantity NUMERIC(15, 4) NOT NULL CHECK (actual_quantity >= 0),
  yield_variance NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  unit TEXT NOT NULL,
  cost_per_unit_cents INT NOT NULL DEFAULT 0,
  total_cost_cents INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT NULL,
  produced_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  produced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_batches_branch
  ON public.inventory_production_batches (branch_id, produced_at DESC);

-- ── 5. Suppliers & Supplier Items ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1),
  contact_person TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  address_line1 TEXT NULL,
  address_line2 TEXT NULL,
  city TEXT NULL,
  country TEXT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_terms TEXT NULL,
  tax_id TEXT NULL,
  is_preferred BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_biz_active
  ON public.inventory_suppliers (business_id, is_active, name);

CREATE TABLE IF NOT EXISTS public.inventory_supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.inventory_suppliers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  supplier_sku TEXT NULL,
  purchasing_unit TEXT NOT NULL DEFAULT 'kg',
  conversion_to_base NUMERIC(15, 4) NOT NULL DEFAULT 1.0 CHECK (conversion_to_base > 0),
  last_price_cents INT NOT NULL DEFAULT 0 CHECK (last_price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_preferred BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_items_supplier_item UNIQUE (supplier_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_items_item
  ON public.inventory_supplier_items (item_id);

-- ── 6. Purchase Orders & Goods Receipts ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.inventory_suppliers(id) ON DELETE RESTRICT,
  destination_location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  po_number TEXT NOT NULL,
  status public.inventory_po_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_cents INT NOT NULL DEFAULT 0,
  tax_cents INT NOT NULL DEFAULT 0,
  total_cents INT NOT NULL DEFAULT 0,
  expected_delivery_date DATE NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_status
  ON public.inventory_purchase_orders (branch_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  purchasing_unit TEXT NOT NULL,
  quantity_ordered NUMERIC(15, 4) NOT NULL CHECK (quantity_ordered > 0),
  quantity_ordered_base NUMERIC(15, 4) NOT NULL CHECK (quantity_ordered_base > 0),
  quantity_received_base NUMERIC(15, 4) NOT NULL DEFAULT 0.0 CHECK (quantity_received_base >= 0),
  unit_cost_cents INT NOT NULL DEFAULT 0 CHECK (unit_cost_cents >= 0),
  total_cost_cents INT NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_items_po
  ON public.inventory_purchase_order_items (po_id);

CREATE TABLE IF NOT EXISTS public.inventory_goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  po_id UUID NULL REFERENCES public.inventory_purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES public.inventory_suppliers(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  grn_number TEXT NOT NULL,
  idempotency_key TEXT NULL,
  received_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_goods_receipts_idempotency
  ON public.inventory_goods_receipts (business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES public.inventory_goods_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NULL REFERENCES public.inventory_purchase_order_items(id) ON DELETE SET NULL,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_received NUMERIC(15, 4) NOT NULL CHECK (quantity_received > 0),
  unit_received TEXT NOT NULL,
  quantity_received_base NUMERIC(15, 4) NOT NULL CHECK (quantity_received_base > 0),
  unit_cost_cents INT NOT NULL CHECK (unit_cost_cents >= 0),
  total_cost_cents INT NOT NULL CHECK (total_cost_cents >= 0),
  batch_code TEXT NULL,
  expiry_date DATE NULL,
  batch_id UUID NULL REFERENCES public.inventory_item_batches(id) ON DELETE SET NULL,
  discrepancy_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_grn_items_grn
  ON public.inventory_goods_receipt_items (grn_id);

-- ── 7. Supplier Returns ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_supplier_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.inventory_suppliers(id) ON DELETE RESTRICT,
  grn_id UUID NULL REFERENCES public.inventory_goods_receipts(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  return_number TEXT NOT NULL,
  quantity NUMERIC(15, 4) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  quantity_base NUMERIC(15, 4) NOT NULL CHECK (quantity_base > 0),
  unit_cost_cents INT NOT NULL DEFAULT 0,
  total_cost_cents INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  returned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_returns_branch
  ON public.inventory_supplier_returns (branch_id, created_at DESC);

-- ── 8. Order Ingredient Consumptions (Immutable Ledger) ──────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_order_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  recipe_id UUID NULL REFERENCES public.inventory_recipes(id) ON DELETE SET NULL,
  recipe_version INT NOT NULL DEFAULT 1,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  quantity_consumed_base NUMERIC(15, 4) NOT NULL CHECK (quantity_consumed_base > 0),
  unit_cost_cents_snapshot INT NOT NULL DEFAULT 0,
  total_cost_cents_snapshot INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  deduction_stage public.inventory_consumption_stage NOT NULL DEFAULT 'preparing',
  status public.inventory_consumption_status NOT NULL DEFAULT 'consumed',
  reversal_reason TEXT NULL,
  reversal_actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reversed_at TIMESTAMPTZ NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_consumption_deduction UNIQUE (order_item_id, item_id, deduction_stage)
);

CREATE INDEX IF NOT EXISTS idx_order_consumptions_order
  ON public.inventory_order_consumptions (order_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_order_consumptions_item_created
  ON public.inventory_order_consumptions (item_id, created_at);

-- ── 9. Inventory Settings ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  deduction_timing public.inventory_consumption_stage NOT NULL DEFAULT 'preparing',
  costing_method public.inventory_costing_method NOT NULL DEFAULT 'weighted_average',
  auto_sold_out_mode public.inventory_auto_sold_out_mode NOT NULL DEFAULT 'warn_only',
  receiving_tolerance_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.0 CHECK (receiving_tolerance_percent >= 0),
  default_consumption_location_id UUID NULL REFERENCES public.inventory_storage_locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_settings_biz_branch
  ON public.inventory_settings (business_id, (COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- ── 10. Enable Row-Level Security ───────────────────────────────────────────

ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_modifier_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_production_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_order_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;

-- ── 11. Atomic PostgreSQL RPCs ───────────────────────────────────────────────

-- RPC 1: Goods Receiving & Weighted Cost Update
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
  v_qty_rec_base NUMERIC(15, 4);
  v_unit_cost INT;
  v_tot_cost INT;
  v_batch_code TEXT;
  v_expiry DATE;
  v_discrepancy TEXT;
  v_batch_id UUID;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
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
    v_qty_rec_base := (v_item_elem->>'quantity_received_base')::numeric;
    v_unit_cost := (v_item_elem->>'unit_cost_cents')::int;
    v_tot_cost := ROUND(v_qty_rec_base * v_unit_cost);
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
        v_unit_cost,
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
      (v_item_elem->>'quantity_received')::numeric,
      v_item_elem->>'unit_received',
      v_qty_rec_base,
      v_unit_cost,
      v_tot_cost,
      v_batch_code,
      v_expiry,
      v_batch_id,
      v_discrepancy
    );

    -- Upsert Inventory Balance
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

    -- Calculate Locked Weighted Average Cost
    IF v_current_qty <= 0 THEN
      v_new_weighted_cost := v_unit_cost;
    ELSE
      v_new_weighted_cost := ROUND(((v_current_qty * v_item_row.cost_per_unit_cents) + (v_qty_rec_base * v_unit_cost)) / (v_current_qty + v_qty_rec_base));
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
      v_qty_rec_base,
      v_item_row.base_unit,
      v_qty_rec_base,
      v_current_qty,
      v_new_qty,
      v_unit_cost,
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

  RETURN jsonb_build_object('success', true, 'grn_id', v_grn_id, 'grn_number', p_grn_number);
END;
$$;

-- RPC 2: Prep Production Batch Runner
CREATE OR REPLACE FUNCTION public.produce_prep_recipe_batch(
  p_business_id UUID,
  p_branch_id UUID,
  p_recipe_id UUID,
  p_batch_number TEXT,
  p_source_location_id UUID,
  p_target_location_id UUID,
  p_scale NUMERIC(15, 4),
  p_actual_quantity NUMERIC(15, 4),
  p_actor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipe RECORD;
  v_output_item RECORD;
  v_ingredient RECORD;
  v_ing_item RECORD;
  v_req_qty NUMERIC(15, 4);
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_total_raw_cost INT := 0;
  v_line_cost INT;
  v_unit_cost_out INT;
  v_batch_id UUID;
  v_expected_qty NUMERIC(15, 4);
  v_variance NUMERIC(15, 4);
BEGIN
  -- 1. Fetch Recipe
  SELECT * INTO v_recipe FROM public.inventory_recipes WHERE id = p_recipe_id FOR UPDATE;
  IF v_recipe.id IS NULL OR v_recipe.recipe_type <> 'prep_recipe' OR v_recipe.output_inventory_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PREP_RECIPE');
  END IF;

  SELECT * INTO v_output_item FROM public.inventory_items WHERE id = v_recipe.output_inventory_item_id;
  IF v_output_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OUTPUT_ITEM_NOT_FOUND');
  END IF;

  v_expected_qty := v_recipe.yield_quantity * p_scale;
  v_variance := p_actual_quantity - v_expected_qty;

  -- 2. Deduct Raw Ingredients
  FOR v_ingredient IN
    SELECT * FROM public.inventory_recipe_ingredients
    WHERE recipe_id = p_recipe_id
  LOOP
    IF v_ingredient.item_id IS NOT NULL THEN
      SELECT * INTO v_ing_item FROM public.inventory_items WHERE id = v_ingredient.item_id;
      v_req_qty := (v_ingredient.quantity_base / v_ingredient.yield_factor) * p_scale;

      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE branch_id = p_branch_id AND location_id = p_source_location_id AND item_id = v_ingredient.item_id
      FOR UPDATE;

      IF v_balance.id IS NULL OR v_balance.current_quantity < v_req_qty THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'INSUFFICIENT_RAW_INGREDIENT',
          'message', 'Insufficient stock for ' || v_ing_item.name || '. Required: ' || v_req_qty || ' ' || v_ing_item.base_unit
        );
      END IF;

      v_current_qty := v_balance.current_quantity;
      v_new_qty := v_current_qty - v_req_qty;
      v_line_cost := ROUND(v_req_qty * v_ing_item.cost_per_unit_cents);
      v_total_raw_cost := v_total_raw_cost + v_line_cost;

      UPDATE public.inventory_balances
      SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
      WHERE id = v_balance.id;

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
        p_business_id,
        p_branch_id,
        p_source_location_id,
        v_ingredient.item_id,
        'production_out',
        'out',
        v_req_qty,
        v_ing_item.base_unit,
        v_req_qty,
        v_current_qty,
        v_new_qty,
        v_ing_item.cost_per_unit_cents,
        v_line_cost,
        v_ing_item.currency,
        'Batch #' || p_batch_number || ' raw ingredient consumption',
        p_actor_id,
        p_recipe_id::text
      );
    END IF;
  END LOOP;

  -- 3. Calculate Output Cost
  IF p_actual_quantity > 0 THEN
    v_unit_cost_out := ROUND(v_total_raw_cost / p_actual_quantity);
  ELSE
    v_unit_cost_out := 0;
  END IF;

  -- 4. Record Production Batch Record
  INSERT INTO public.inventory_production_batches (
    business_id,
    branch_id,
    recipe_id,
    batch_number,
    target_location_id,
    source_location_id,
    expected_quantity,
    actual_quantity,
    yield_variance,
    unit,
    cost_per_unit_cents,
    total_cost_cents,
    currency,
    notes,
    produced_by,
    produced_at
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_recipe_id,
    p_batch_number,
    p_target_location_id,
    p_source_location_id,
    v_expected_qty,
    p_actual_quantity,
    v_variance,
    v_output_item.base_unit,
    v_unit_cost_out,
    v_total_raw_cost,
    v_output_item.currency,
    p_notes,
    p_actor_id,
    now()
  ) RETURNING id INTO v_batch_id;

  -- 5. Add Prepared Output to Target Location
  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE branch_id = p_branch_id AND location_id = p_target_location_id AND item_id = v_output_item.id
  FOR UPDATE;

  IF v_balance.id IS NOT NULL THEN
    v_current_qty := v_balance.current_quantity;
    v_new_qty := v_current_qty + p_actual_quantity;

    UPDATE public.inventory_balances
    SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
    WHERE id = v_balance.id;
  ELSE
    v_current_qty := 0.0;
    v_new_qty := p_actual_quantity;

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
      p_target_location_id,
      v_output_item.id,
      v_new_qty,
      0.0,
      now(),
      now()
    );
  END IF;

  -- Update Output Item Weighted Cost
  UPDATE public.inventory_items
  SET cost_per_unit_cents = v_unit_cost_out, updated_at = now()
  WHERE id = v_output_item.id;

  -- Movement for Output Item
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
    p_business_id,
    p_branch_id,
    p_target_location_id,
    v_output_item.id,
    'production_in',
    'in',
    p_actual_quantity,
    v_output_item.base_unit,
    p_actual_quantity,
    v_current_qty,
    v_new_qty,
    v_unit_cost_out,
    v_total_raw_cost,
    v_output_item.currency,
    'Batch #' || p_batch_number || ' produced',
    p_actor_id,
    v_batch_id::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'produced_quantity', p_actual_quantity,
    'unit_cost_cents', v_unit_cost_out
  );
END;
$$;

-- RPC 3: Idempotent Order Ingredient Consumption
CREATE OR REPLACE FUNCTION public.consume_order_item_ingredients(
  p_order_id UUID,
  p_stage public.inventory_consumption_stage,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_order_item RECORD;
  v_recipe RECORD;
  v_ing RECORD;
  v_item_def RECORD;
  v_deduct_qty NUMERIC(15, 4);
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_location_id UUID;
  v_line_cost INT;
  v_already_consumed BOOLEAN;
  v_consumed_count INT := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  -- Default consumption location
  SELECT id INTO v_location_id
  FROM public.inventory_storage_locations
  WHERE branch_id = v_order.branch_id AND is_active = true
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1;

  FOR v_order_item IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
    -- Check if active recipe exists for menu item
    SELECT * INTO v_recipe
    FROM public.inventory_recipes
    WHERE business_id = v_order.business_id
      AND menu_item_id = v_order_item.menu_item_id
      AND is_active = true
    LIMIT 1;

    IF v_recipe.id IS NOT NULL THEN
      FOR v_ing IN
        SELECT * FROM public.inventory_recipe_ingredients
        WHERE recipe_id = v_recipe.id
      LOOP
        IF v_ing.item_id IS NOT NULL THEN
          -- Idempotency check: Has this order item already consumed this ingredient at this stage?
          SELECT EXISTS (
            SELECT 1 FROM public.inventory_order_consumptions
            WHERE order_item_id = v_order_item.id
              AND item_id = v_ing.item_id
              AND deduction_stage = p_stage
          ) INTO v_already_consumed;

          IF NOT v_already_consumed THEN
            SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_ing.item_id;
            v_deduct_qty := (v_ing.quantity_base / v_ing.yield_factor) * v_order_item.quantity;
            v_line_cost := ROUND(v_deduct_qty * v_item_def.cost_per_unit_cents);

            -- Fetch balance
            SELECT * INTO v_balance
            FROM public.inventory_balances
            WHERE branch_id = v_order.branch_id AND location_id = v_location_id AND item_id = v_ing.item_id
            FOR UPDATE;

            IF v_balance.id IS NOT NULL THEN
              v_current_qty := v_balance.current_quantity;
              v_new_qty := GREATEST(0.0, v_current_qty - v_deduct_qty);

              UPDATE public.inventory_balances
              SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
              WHERE id = v_balance.id;
            ELSE
              v_current_qty := 0.0;
              v_new_qty := 0.0;

              INSERT INTO public.inventory_balances (
                business_id, branch_id, location_id, item_id, current_quantity, reserved_quantity, last_movement_at, updated_at
              ) VALUES (
                v_order.business_id, v_order.branch_id, v_location_id, v_ing.item_id, 0.0, 0.0, now(), now()
              );
            END IF;

            -- Record immutable consumption snapshot
            INSERT INTO public.inventory_order_consumptions (
              business_id,
              branch_id,
              order_id,
              order_item_id,
              recipe_id,
              recipe_version,
              item_id,
              location_id,
              quantity_consumed_base,
              unit_cost_cents_snapshot,
              total_cost_cents_snapshot,
              currency,
              deduction_stage,
              status,
              idempotency_key
            ) VALUES (
              v_order.business_id,
              v_order.branch_id,
              p_order_id,
              v_order_item.id,
              v_recipe.id,
              v_recipe.version,
              v_ing.item_id,
              v_location_id,
              v_deduct_qty,
              v_item_def.cost_per_unit_cents,
              v_line_cost,
              v_item_def.currency,
              p_stage,
              'consumed',
              p_order_id::text || '_' || v_order_item.id::text || '_' || v_ing.item_id::text || '_' || p_stage::text
            );

            -- Stock Movement Audit
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
              v_order.business_id,
              v_order.branch_id,
              v_location_id,
              v_ing.item_id,
              'recipe_consumption',
              'out',
              v_deduct_qty,
              v_item_def.base_unit,
              v_deduct_qty,
              v_current_qty,
              v_new_qty,
              v_item_def.cost_per_unit_cents,
              v_line_cost,
              v_item_def.currency,
              'Order #' || COALESCE(v_order.order_number::text, v_order.id::text) || ' consumption',
              p_actor_id,
              p_order_id::text
            );

            v_consumed_count := v_consumed_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'consumed_count', v_consumed_count);
END;
$$;

-- RPC 4: Reversal / Disposition of Order Consumption
CREATE OR REPLACE FUNCTION public.reverse_order_consumption(
  p_order_id UUID,
  p_disposition TEXT, -- 'return_to_stock', 'record_waste', 'no_change'
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cons RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_item_def RECORD;
BEGIN
  FOR v_cons IN
    SELECT * FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id AND status = 'consumed'
    FOR UPDATE
  LOOP
    SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_cons.item_id;

    IF p_disposition = 'return_to_stock' THEN
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
        p_actor_id,
        p_order_id::text
      );

      UPDATE public.inventory_order_consumptions
      SET status = 'reversed_to_stock', reversal_reason = p_reason, reversal_actor_id = p_actor_id, reversed_at = now()
      WHERE id = v_cons.id;

    ELSIF p_disposition = 'record_waste' THEN
      INSERT INTO public.inventory_waste_records (
        business_id,
        branch_id,
        location_id,
        item_id,
        quantity,
        unit,
        quantity_base,
        reason,
        cost_per_unit_cents,
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
        p_actor_id
      );

      UPDATE public.inventory_order_consumptions
      SET status = 'reversed_as_waste', reversal_reason = p_reason, reversal_actor_id = p_actor_id, reversed_at = now()
      WHERE id = v_cons.id;

    ELSE
      UPDATE public.inventory_order_consumptions
      SET status = 'reversed_no_change', reversal_reason = p_reason, reversal_actor_id = p_actor_id, reversed_at = now()
      WHERE id = v_cons.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 12. Seed Phase 28 Permissions Catalog ────────────────────────────────────

INSERT INTO public.permissions (key, name, description, category, risk_level) VALUES
  ('recipes.view', 'View Recipes & BOM', 'View recipe formulas, portion sizes, preparation instructions, and ingredient bills of materials', 'Recipes & Production', 'low'),
  ('recipes.manage', 'Manage Recipes & Formulas', 'Create, edit, version, and archive recipe formulas and sub-recipes', 'Recipes & Production', 'medium'),
  ('recipes.costs.view', 'View Recipe Costs & Margins', 'View live ingredient cost rollups, portion costs, food cost percentages, and gross profit margins', 'Recipes & Production', 'high'),
  ('purchasing.view', 'View Purchasing & POs', 'View purchase orders, delivery statuses, and supplier purchasing histories', 'Purchasing & Suppliers', 'low'),
  ('purchasing.create', 'Create Purchase Orders', 'Draft and submit purchase orders for supplier replenishment', 'Purchasing & Suppliers', 'medium'),
  ('purchasing.approve', 'Approve Purchase Orders', 'Authorize and approve submitted purchase orders for supplier delivery', 'Purchasing & Suppliers', 'high'),
  ('purchasing.receive', 'Receive Goods & Deliveries (GRN)', 'Accept supplier deliveries, log GRNs, record lot expiry dates, and update inventory stock', 'Purchasing & Suppliers', 'medium'),
  ('suppliers.view', 'View Suppliers', 'View authorized vendor contacts, payment terms, and purchasing catalogs', 'Purchasing & Suppliers', 'low'),
  ('suppliers.manage', 'Manage Suppliers & Vendor Catalogs', 'Create, update, and manage vendor details, payment terms, and vendor item price agreements', 'Purchasing & Suppliers', 'medium'),
  ('inventory.cogs.view', 'View Cost of Goods Sold (COGS)', 'View real-time Cost of Goods Sold, theoretical food cost variances, and margin analytics', 'Inventory Intelligence', 'high'),
  ('inventory.menu_profitability.view', 'View Menu Profitability & Engineering', 'View Menu Engineering matrix (Stars, Plowhorses, Puzzles, Dogs) and item contribution margins', 'Inventory Intelligence', 'medium'),
  ('inventory.settings.manage', 'Manage Inventory Settings', 'Configure automatic stock deduction timing stages, costing valuation rules, and receiving discrepancy tolerances', 'Inventory Intelligence', 'high'),
  ('inventory.production.manage', 'Manage Batch Prep Production', 'Dispatch batch production runs, convert raw ingredients into prepared inventory, and track yield variances', 'Recipes & Production', 'medium')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- ── 13. Seed Built-In Role Permissions for Phase 28 ──────────────────────────

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('business_owner', 'recipes.view'),
  ('business_owner', 'recipes.manage'),
  ('business_owner', 'recipes.costs.view'),
  ('business_owner', 'purchasing.view'),
  ('business_owner', 'purchasing.create'),
  ('business_owner', 'purchasing.approve'),
  ('business_owner', 'purchasing.receive'),
  ('business_owner', 'suppliers.view'),
  ('business_owner', 'suppliers.manage'),
  ('business_owner', 'inventory.cogs.view'),
  ('business_owner', 'inventory.menu_profitability.view'),
  ('business_owner', 'inventory.settings.manage'),
  ('business_owner', 'inventory.production.manage'),
  ('branch_manager', 'recipes.view'),
  ('branch_manager', 'recipes.manage'),
  ('branch_manager', 'recipes.costs.view'),
  ('branch_manager', 'purchasing.view'),
  ('branch_manager', 'purchasing.create'),
  ('branch_manager', 'purchasing.approve'),
  ('branch_manager', 'purchasing.receive'),
  ('branch_manager', 'suppliers.view'),
  ('branch_manager', 'suppliers.manage'),
  ('branch_manager', 'inventory.cogs.view'),
  ('branch_manager', 'inventory.menu_profitability.view'),
  ('branch_manager', 'inventory.settings.manage'),
  ('branch_manager', 'inventory.production.manage'),
  ('kitchen_staff', 'recipes.view'),
  ('kitchen_staff', 'inventory.production.manage')
ON CONFLICT (role_key, permission_key) WHERE custom_role_id IS NULL AND business_id IS NULL DO NOTHING;
