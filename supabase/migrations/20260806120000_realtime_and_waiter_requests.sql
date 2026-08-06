-- Migration: 20260806120000_realtime_and_waiter_requests.sql
-- Description: Phase 10.5 Realtime Operations, Access Token Security, Waiter Assistance Requests, and Realtime Publications

-- 1. Add access_token Column to Orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS access_token TEXT NOT NULL DEFAULT gen_random_uuid()::text;

CREATE INDEX IF NOT EXISTS idx_orders_id_access_token 
  ON public.orders (id, access_token);

-- 2. Create Waiter Request Enums
DO $$ BEGIN
  CREATE TYPE public.waiter_request_type AS ENUM (
    'call_waiter',
    'need_water',
    'need_bill',
    'need_assistance'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.waiter_request_status AS ENUM (
    'pending',
    'accepted',
    'completed',
    'dismissed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Create Waiter Requests Table
CREATE TABLE IF NOT EXISTS public.waiter_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  request_type public.waiter_request_type NOT NULL,
  status public.waiter_request_status NOT NULL DEFAULT 'pending',
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_waiter_requests_branch_status 
  ON public.waiter_requests (branch_id, status, created_at DESC);

-- 4. Enable RLS on Waiter Requests Table
ALTER TABLE public.waiter_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff select waiter requests" ON public.waiter_requests;
CREATE POLICY "Staff select waiter requests"
  ON public.waiter_requests FOR SELECT
  USING (public.auth_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Staff update waiter requests" ON public.waiter_requests;
CREATE POLICY "Staff update waiter requests"
  ON public.waiter_requests FOR UPDATE
  USING (
    public.auth_has_branch_access(branch_id)
    AND public.auth_has_business_role(business_id, ARRAY['business_owner'::public.user_role, 'branch_manager'::public.user_role, 'cashier'::public.user_role, 'kitchen_staff'::public.user_role, 'waiter'::public.user_role])
  );

-- 5. RPC Function: Customer Assistance Submission
CREATE OR REPLACE FUNCTION public.submit_customer_assistance(
  p_token_hash TEXT,
  p_table_id UUID,
  p_request_type public.waiter_request_type,
  p_order_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qr RECORD;
  v_branch RECORD;
  v_table RECORD;
  v_request_id UUID;
BEGIN
  -- 1. Validate Token Hash
  IF p_token_hash IS NULL OR trim(p_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR_TOKEN');
  END IF;

  SELECT bqr.id, bqr.business_id, bqr.branch_id, bqr.is_active, bqr.revoked_at
  INTO v_qr
  FROM public.branch_qr_codes bqr
  WHERE bqr.token_hash = p_token_hash;

  IF v_qr.id IS NULL OR v_qr.is_active = false OR v_qr.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OR_REVOKED_QR');
  END IF;

  -- 2. Validate Branch
  SELECT id, business_id, status, deleted_at
  INTO v_branch
  FROM public.branches
  WHERE id = v_qr.branch_id;

  IF v_branch.id IS NULL OR v_branch.status <> 'active' OR v_branch.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
  END IF;

  -- 3. Validate Table
  IF p_table_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TABLE_REQUIRED');
  END IF;

  SELECT id, name, code, is_active, status, deleted_at
  INTO v_table
  FROM public.dining_tables
  WHERE id = p_table_id AND branch_id = v_branch.id;

  IF v_table.id IS NULL OR v_table.is_active = false OR v_table.deleted_at IS NOT NULL OR v_table.status = 'unavailable' THEN
    RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
  END IF;

  -- 4. Insert Waiter Assistance Request
  INSERT INTO public.waiter_requests (
    business_id,
    branch_id,
    table_id,
    order_id,
    request_type,
    status,
    notes
  ) VALUES (
    v_branch.business_id,
    v_branch.id,
    v_table.id,
    p_order_id,
    p_request_type,
    'pending',
    p_notes
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'table_name', v_table.name,
    'request_type', p_request_type,
    'status', 'pending'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 6. Update create_guest_order RPC to Return access_token
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
    0,
    0,
    0,
    0,
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
      0,
      v_cart_item->>'specialInstructions'
    ) RETURNING id INTO v_order_item_id;

    v_selected_opt_ids := '{}';

    -- Validate and process selected modifiers
    IF v_cart_item->'selectedModifiers' IS NOT NULL AND jsonb_array_length(v_cart_item->'selectedModifiers') > 0 THEN
      FOR v_modifier_item IN SELECT * FROM jsonb_array_elements(v_cart_item->'selectedModifiers')
      LOOP
        v_option_id := (v_modifier_item->>'optionId')::UUID;

        IF v_option_id = ANY(v_selected_opt_ids) THEN
          RAISE EXCEPTION 'DUPLICATE_MODIFIER_OPTION:%', v_option_id;
        END IF;
        v_selected_opt_ids := array_append(v_selected_opt_ids, v_option_id);

        SELECT mo.id, mo.name, mo.additional_price_cents, mo.is_active, mo.deleted_at,
               mg.id AS group_id, mg.name AS group_name, mg.menu_item_id, mg.is_active AS group_is_active, mg.deleted_at AS group_deleted_at
        INTO v_option
        FROM public.modifier_options mo
        JOIN public.modifier_groups mg ON mg.id = mo.modifier_group_id
        WHERE mo.id = v_option_id;

        IF v_option.id IS NULL OR v_option.is_active = false OR v_option.deleted_at IS NOT NULL OR v_option.group_is_active = false OR v_option.group_deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'MODIFIER_OPTION_UNAVAILABLE:%', v_option_id;
        END IF;

        IF v_option.menu_item_id <> v_item.id THEN
          RAISE EXCEPTION 'CROSS_ITEM_MODIFIER_INJECTION:%', v_option_id;
        END IF;

        v_item_modifiers_total := v_item_modifiers_total + v_option.additional_price_cents;

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

    -- Validate Group Selection Rules
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

    v_item_line_subtotal := (v_unit_price + v_item_modifiers_total) * v_item_quantity;
    
    UPDATE public.order_items
    SET line_subtotal_cents = v_item_line_subtotal
    WHERE id = v_order_item_id;

    v_order_subtotal := v_order_subtotal + v_item_line_subtotal;
  END LOOP;

  -- 9. Update Master Order Totals
  UPDATE public.orders
  SET subtotal_cents = v_order_subtotal,
      total_cents = v_order_subtotal
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
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- 7. Enable Supabase Realtime Publication for orders and waiter_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waiter_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_requests;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if publication does not exist in local dev
  null;
END $$;
