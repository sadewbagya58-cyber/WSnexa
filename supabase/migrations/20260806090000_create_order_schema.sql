-- Migration: 20260806090000_create_order_schema.sql
-- Description: Phase 10 Order Schema, RLS, Sequential Branch Counters, and Zero-Trust Atomic Order RPC
-- Audit & Safety: Fully idempotent, schema-contract verified, uses verified auth_has_branch_access helpers.

-- 1. Schema-Contract Assertions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'business_memberships' AND column_name = 'membership_status'
  ) THEN
    RAISE EXCEPTION 'Schema Contract Error: business_memberships.membership_status missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'default_currency'
  ) THEN
    RAISE EXCEPTION 'Schema Contract Error: businesses.default_currency missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'auth_has_branch_access'
  ) THEN
    RAISE EXCEPTION 'Schema Contract Error: public.auth_has_branch_access helper missing.';
  END IF;
END $$;

-- 2. Create Order Enums
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'unpaid',
    'paid',
    'refunded',
    'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'card',
    'qr_pay',
    'pay_at_counter',
    'online'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Branch Order Counters (For Atomic Sequential Order Numbers per Branch)
CREATE TABLE IF NOT EXISTS public.branch_order_counters (
  branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  last_order_number INTEGER NOT NULL DEFAULT 1000 CHECK (last_order_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  order_number INTEGER NOT NULL CHECK (order_number >= 1),
  order_number_formatted TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  access_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method public.payment_method NOT NULL DEFAULT 'pay_at_counter',
  guest_name TEXT CHECK (guest_name IS NULL OR char_length(guest_name) <= 100),
  guest_phone TEXT CHECK (guest_phone IS NULL OR char_length(guest_phone) <= 30),
  guest_notes TEXT CHECK (guest_notes IS NULL OR char_length(guest_notes) <= 500),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  service_charge_cents INTEGER NOT NULL DEFAULT 0 CHECK (service_charge_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_branch_idempotency
  ON public.orders (branch_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_orders_branch_status_created
  ON public.orders (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_business_created
  ON public.orders (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_id_access_token 
  ON public.orders (id, access_token);

-- 5. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  unit_price_cents_snapshot INTEGER NOT NULL CHECK (unit_price_cents_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 1 AND quantity <= 99),
  line_subtotal_cents INTEGER NOT NULL CHECK (line_subtotal_cents >= 0),
  special_instructions TEXT CHECK (special_instructions IS NULL OR char_length(special_instructions) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);

-- 6. Order Item Modifiers Table
CREATE TABLE IF NOT EXISTS public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE RESTRICT,
  modifier_option_id UUID NOT NULL REFERENCES public.modifier_options(id) ON DELETE RESTRICT,
  group_name_snapshot TEXT NOT NULL,
  option_name_snapshot TEXT NOT NULL,
  additional_price_cents_snapshot INTEGER NOT NULL CHECK (additional_price_cents_snapshot >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item_id ON public.order_item_modifiers (order_item_id);

-- 7. Order Status History Table
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status public.order_status,
  new_status public.order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history (order_id, created_at ASC);

-- 8. Enable Row-Level Security
ALTER TABLE public.branch_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies using Verified Helper auth_has_branch_access
DROP POLICY IF EXISTS "Staff branch access to order counters" ON public.branch_order_counters;
CREATE POLICY "Staff branch access to order counters"
  ON public.branch_order_counters FOR ALL
  USING (public.auth_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Staff select orders" ON public.orders;
CREATE POLICY "Staff select orders"
  ON public.orders FOR SELECT
  USING (public.auth_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Staff update orders" ON public.orders;
CREATE POLICY "Staff update orders"
  ON public.orders FOR UPDATE
  USING (
    public.auth_has_branch_access(branch_id)
    AND public.auth_has_business_role(business_id, ARRAY['business_owner'::public.user_role, 'branch_manager'::public.user_role, 'cashier'::public.user_role, 'kitchen_staff'::public.user_role, 'waiter'::public.user_role])
  );

DROP POLICY IF EXISTS "Staff select order items" ON public.order_items;
CREATE POLICY "Staff select order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Staff select order item modifiers" ON public.order_item_modifiers;
CREATE POLICY "Staff select order item modifiers"
  ON public.order_item_modifiers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_modifiers.order_item_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Staff select order status history" ON public.order_status_history;
CREATE POLICY "Staff select order status history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

DROP POLICY IF EXISTS "Staff insert order status history" ON public.order_status_history;
CREATE POLICY "Staff insert order status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

-- 10. Atomic SECURITY DEFINER Guest Order RPC
CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_token_hash TEXT,
  p_table_id UUID DEFAULT NULL,
  p_pin_hash TEXT DEFAULT NULL,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_cart_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr RECORD;
  v_branch RECORD;
  v_business RECORD;
  v_table RECORD;
  v_existing_order RECORD;
  v_next_order_num INTEGER;
  v_order_num_formatted TEXT;
  v_order_id UUID;
  v_access_token TEXT;
  v_cart_item JSONB;
  v_modifier_item JSONB;
  v_item RECORD;
  v_group RECORD;
  v_option RECORD;
  v_unit_price INTEGER;
  v_item_quantity INTEGER;
  v_item_line_subtotal INTEGER;
  v_item_modifiers_total INTEGER;
  v_order_subtotal INTEGER := 0;
  v_order_item_id UUID;
  v_opt_count INTEGER;
  v_selected_opt_ids UUID[];
  v_option_id UUID;
BEGIN
  -- 1. Validate Input Parameters
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR_TOKEN');
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_IDEMPOTENCY_KEY');
  END IF;

  IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'EMPTY_CART');
  END IF;

  -- 2. Resolve Active Branch QR Token
  SELECT bqr.id, bqr.business_id, bqr.branch_id, bqr.is_active, bqr.revoked_at
  INTO v_qr
  FROM public.branch_qr_codes bqr
  WHERE bqr.token_hash = p_token_hash;

  IF v_qr.id IS NULL OR v_qr.is_active = false OR v_qr.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OR_REVOKED_QR');
  END IF;

  -- 3. Resolve Active Branch & Business
  SELECT id, business_id, name, code, status, require_table_selection, require_table_pin, deleted_at
  INTO v_branch
  FROM public.branches
  WHERE id = v_qr.branch_id;

  IF v_branch.id IS NULL OR v_branch.status <> 'active' OR v_branch.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
  END IF;

  SELECT id, default_currency, status, deleted_at
  INTO v_business
  FROM public.businesses
  WHERE id = v_branch.business_id;

  IF v_business.id IS NULL OR v_business.status <> 'active' OR v_business.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BUSINESS_UNAVAILABLE');
  END IF;

  -- 4. Check Idempotency Protection for duplicate order submission
  SELECT id, order_number_formatted, status, total_cents, currency, access_token
  INTO v_existing_order
  FROM public.orders
  WHERE branch_id = v_branch.id AND idempotency_key = p_idempotency_key;

  IF v_existing_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'order_id', v_existing_order.id,
      'access_token', v_existing_order.access_token,
      'order_number_formatted', v_existing_order.order_number_formatted,
      'status', v_existing_order.status,
      'total_cents', v_existing_order.total_cents,
      'currency', v_existing_order.currency
    );
  END IF;

  -- 5. Dining Table & Table PIN Verification
  IF v_branch.require_table_selection = true THEN
    IF p_table_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'TABLE_REQUIRED');
    END IF;

    SELECT id, name, code, table_number, capacity, branch_id, table_pin_hash, is_active, status, deleted_at
    INTO v_table
    FROM public.dining_tables
    WHERE id = p_table_id;

    IF v_table.id IS NULL OR v_table.branch_id <> v_branch.id OR v_table.is_active = false OR v_table.deleted_at IS NOT NULL OR v_table.status = 'unavailable' THEN
      RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
    END IF;

    IF v_branch.require_table_pin = true THEN
      IF v_table.table_pin_hash IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN_NOT_CONFIGURED');
      END IF;

      IF p_pin_hash IS NULL OR p_pin_hash <> v_table.table_pin_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_TABLE_PIN');
      END IF;
    END IF;
  END IF;

  -- 6. Allocate Sequential Branch Order Number atomically
  INSERT INTO public.branch_order_counters (branch_id, business_id, last_order_number)
  VALUES (v_branch.id, v_business.id, 1001)
  ON CONFLICT (branch_id) DO UPDATE
  SET last_order_number = public.branch_order_counters.last_order_number + 1,
      updated_at = NOW()
  RETURNING last_order_number INTO v_next_order_num;

  v_order_num_formatted := '#' || COALESCE(v_branch.code, 'ORD') || '-' || v_next_order_num;
  v_access_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- 7. Insert Master Order Header Record
  INSERT INTO public.orders (
    business_id,
    branch_id,
    table_id,
    order_number,
    order_number_formatted,
    idempotency_key,
    access_token,
    status,
    payment_status,
    payment_method,
    guest_name,
    guest_phone,
    guest_notes,
    subtotal_cents,
    tax_cents,
    service_charge_cents,
    total_cents,
    currency
  ) VALUES (
    v_business.id,
    v_branch.id,
    p_table_id,
    v_next_order_num,
    v_order_num_formatted,
    p_idempotency_key,
    v_access_token,
    'pending',
    'unpaid',
    'pay_at_counter',
    p_guest_name,
    p_guest_phone,
    p_guest_notes,
    0, -- Will update after recalculation
    0,
    0,
    0, -- Will update after recalculation
    v_business.default_currency
  ) RETURNING id INTO v_order_id;

  -- 8. Loop through Cart Items and Recalculate Prices on Server
  FOR v_cart_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    v_item_quantity := (v_cart_item->>'quantity')::INTEGER;
    IF v_item_quantity IS NULL OR v_item_quantity < 1 OR v_item_quantity > 99 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY';
    END IF;

    -- Fetch and verify menu item
    SELECT id, name, price_cents, availability_status, is_active, deleted_at
    INTO v_item
    FROM public.menu_items
    WHERE id = (v_cart_item->>'menuItemId')::UUID
      AND business_id = v_business.id
      AND branch_id = v_branch.id;

    IF v_item.id IS NULL OR v_item.is_active = false OR v_item.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'ITEM_NOT_FOUND_OR_INACTIVE:%', COALESCE(v_cart_item->>'menuItemId', 'unknown');
    END IF;

    IF v_item.availability_status <> 'available' THEN
      RAISE EXCEPTION 'ITEM_OUT_OF_STOCK:%', v_item.name;
    END IF;

    v_unit_price := v_item.price_cents;
    v_item_modifiers_total := 0;

    -- Insert Order Item Snapshot
    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      item_name_snapshot,
      unit_price_cents_snapshot,
      quantity,
      line_subtotal_cents,
      special_instructions
    ) VALUES (
      v_order_id,
      v_item.id,
      v_item.name,
      v_unit_price,
      v_item_quantity,
      0, -- Placeholder
      v_cart_item->>'specialInstructions'
    ) RETURNING id INTO v_order_item_id;

    -- Array to track selected option IDs for duplicate option check
    v_selected_opt_ids := '{}';

    -- Validate and process selected modifiers
    IF v_cart_item->'selectedModifiers' IS NOT NULL AND jsonb_array_length(v_cart_item->'selectedModifiers') > 0 THEN
      FOR v_modifier_item IN SELECT * FROM jsonb_array_elements(v_cart_item->'selectedModifiers')
      LOOP
        v_option_id := (v_modifier_item->>'optionId')::UUID;

        -- Check duplicate option selection
        IF v_option_id = ANY(v_selected_opt_ids) THEN
          RAISE EXCEPTION 'DUPLICATE_MODIFIER_OPTION:%', v_option_id;
        END IF;
        v_selected_opt_ids := array_append(v_selected_opt_ids, v_option_id);

        -- Fetch and verify option and group
        SELECT mo.id, mo.name, mo.additional_price_cents, mo.is_active, mo.deleted_at,
               mg.id AS group_id, mg.name AS group_name, mg.menu_item_id, mg.is_active AS group_is_active, mg.deleted_at AS group_deleted_at
        INTO v_option
        FROM public.modifier_options mo
        JOIN public.modifier_groups mg ON mg.id = mo.modifier_group_id
        WHERE mo.id = v_option_id;

        IF v_option.id IS NULL OR v_option.is_active = false OR v_option.deleted_at IS NOT NULL OR v_option.group_is_active = false OR v_option.group_deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'MODIFIER_OPTION_UNAVAILABLE:%', v_option_id;
        END IF;

        -- Strict Injection Check: Modifier group MUST belong to this exact menu item
        IF v_option.menu_item_id <> v_item.id THEN
          RAISE EXCEPTION 'CROSS_ITEM_MODIFIER_INJECTION:%', v_option_id;
        END IF;

        v_item_modifiers_total := v_item_modifiers_total + v_option.additional_price_cents;

        -- Insert Order Item Modifier Snapshot
        INSERT INTO public.order_item_modifiers (
          order_item_id,
          modifier_group_id,
          modifier_option_id,
          group_name_snapshot,
          option_name_snapshot,
          additional_price_cents_snapshot
        ) VALUES (
          v_order_item_id,
          v_option.group_id,
          v_option.id,
          v_option.group_name,
          v_option.name,
          v_option.additional_price_cents
        );
      END LOOP;
    END IF;

    -- Validate Group Selection Rules (Required, Min, Max, Single)
    FOR v_group IN
      SELECT mg.id, mg.name, mg.selection_type, mg.is_required, mg.min_selections, mg.max_selections
      FROM public.modifier_groups mg
      WHERE mg.menu_item_id = v_item.id
        AND mg.is_active = true
        AND mg.deleted_at IS NULL
    LOOP
      SELECT COUNT(*) INTO v_opt_count
      FROM public.order_item_modifiers oim
      WHERE oim.order_item_id = v_order_item_id
        AND oim.modifier_group_id = v_group.id;

      IF (v_group.is_required = true OR COALESCE(v_group.min_selections, 0) > 0) AND v_opt_count < GREATEST(1, COALESCE(v_group.min_selections, 1)) THEN
        RAISE EXCEPTION 'REQUIRED_MODIFIER_GROUP_MISSING:%', v_group.name;
      END IF;

      IF v_group.selection_type = 'single' AND v_opt_count > 1 THEN
        RAISE EXCEPTION 'SINGLE_SELECTION_MODIFIER_EXCEEDED:%', v_group.name;
      END IF;

      IF v_group.max_selections IS NOT NULL AND v_opt_count > v_group.max_selections THEN
        RAISE EXCEPTION 'MAX_SELECTION_MODIFIER_EXCEEDED:%', v_group.name;
      END IF;
    END LOOP;

    -- Calculate line subtotal: (Unit Price + Modifiers) * Quantity
    v_item_line_subtotal := (v_unit_price + v_item_modifiers_total) * v_item_quantity;
    
    UPDATE public.order_items
    SET line_subtotal_cents = v_item_line_subtotal
    WHERE id = v_order_item_id;

    v_order_subtotal := v_order_subtotal + v_item_line_subtotal;
  END LOOP;

  -- 9. Update Master Order Totals
  UPDATE public.orders
  SET subtotal_cents = v_order_subtotal,
      total_cents = v_order_subtotal -- Future phases: add tax & service charge
  WHERE id = v_order_id;

  -- 10. Record Initial Status History
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    notes
  ) VALUES (
    v_order_id,
    NULL,
    'pending',
    'Order placed by guest'
  );

  -- 11. Return Success Result
  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'order_id', v_order_id,
    'access_token', v_access_token,
    'order_number_formatted', v_order_num_formatted,
    'status', 'pending',
    'total_cents', v_order_subtotal,
    'currency', v_business.default_currency
  );

EXCEPTION WHEN OTHERS THEN
  -- Transaction automatically rolls back on exception in PL/pgSQL
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
