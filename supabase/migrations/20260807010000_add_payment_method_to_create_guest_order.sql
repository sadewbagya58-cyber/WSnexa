-- Migration: 20260807010000_add_payment_method_to_create_guest_order.sql
-- Description: Adds p_payment_method parameter to create_guest_order RPC.

DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method);

CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_token_hash TEXT,
  p_table_id UUID DEFAULT NULL,
  p_table_access_verified BOOLEAN DEFAULT false,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_cart_items JSONB DEFAULT '[]'::jsonb,
  p_payment_method public.payment_method DEFAULT 'pay_at_counter'::public.payment_method
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
  v_pref_payment_method public.payment_method;
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

  v_pref_payment_method := COALESCE(p_payment_method, 'pay_at_counter'::public.payment_method);

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
  SELECT id, order_number_formatted, status, total_cents, currency, access_token, payment_method, payment_status
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
      'payment_method', v_existing_order.payment_method,
      'payment_status', v_existing_order.payment_status,
      'total_cents', v_existing_order.total_cents,
      'currency', v_existing_order.currency
    );
  END IF;

  -- 5. Dining Table Verification
  IF v_branch.require_table_selection = true THEN
    IF p_table_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'TABLE_REQUIRED');
    END IF;

    SELECT id, name, code, table_number, capacity, branch_id, is_active, status, deleted_at
    INTO v_table
    FROM public.dining_tables
    WHERE id = p_table_id;

    IF v_table.id IS NULL OR v_table.branch_id <> v_branch.id OR v_table.is_active = false OR v_table.deleted_at IS NOT NULL OR v_table.status = 'unavailable' THEN
      RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
    END IF;

    IF v_branch.require_table_pin = true AND COALESCE(p_table_access_verified, false) = false THEN
      RETURN jsonb_build_object('success', false, 'error', 'TABLE_VERIFICATION_REQUIRED');
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
    v_pref_payment_method,
    p_guest_name,
    p_guest_phone,
    p_guest_notes,
    0,
    0,
    0,
    0,
    v_business.default_currency
  ) RETURNING id INTO v_order_id;

  -- 8. Process Cart Line Items
  FOR v_cart_item IN SELECT * FROM jsonb_array_elements(p_cart_items)
  LOOP
    SELECT id, business_id, branch_id, category_id, name, price_cents, availability_status, deleted_at
    INTO v_item
    FROM public.menu_items
    WHERE id = (v_cart_item->>'menuItemId')::uuid;

    IF v_item.id IS NULL OR v_item.branch_id <> v_branch.id OR v_item.deleted_at IS NOT NULL OR v_item.availability_status <> 'available' THEN
      RAISE EXCEPTION 'ITEM_UNAVAILABLE: Menu item % is not available.', (v_cart_item->>'menuItemId');
    END IF;

    v_item_quantity := (v_cart_item->>'quantity')::integer;
    IF v_item_quantity IS NULL OR v_item_quantity < 1 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be at least 1.';
    END IF;

    v_unit_price := v_item.price_cents;
    v_item_modifiers_total := 0;
    v_selected_opt_ids := ARRAY[]::uuid[];

    IF v_cart_item ? 'selectedModifiers' AND jsonb_array_length(v_cart_item->'selectedModifiers') > 0 THEN
      FOR v_modifier_item IN SELECT * FROM jsonb_array_elements(v_cart_item->'selectedModifiers')
      LOOP
        v_option_id := (v_modifier_item->>'optionId')::uuid;
        IF v_option_id = ANY(v_selected_opt_ids) THEN
          RAISE EXCEPTION 'DUPLICATE_MODIFIER: Modifier option % cannot be selected multiple times.', v_option_id;
        END IF;

        SELECT id, group_id, name, price_cents, availability_status, deleted_at
        INTO v_option
        FROM public.modifier_options
        WHERE id = v_option_id;

        IF v_option.id IS NULL OR v_option.availability_status <> 'available' OR v_option.deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'MODIFIER_UNAVAILABLE: Modifier option % is unavailable.', v_option_id;
        END IF;

        SELECT id, menu_item_id, name, min_selections, max_selections, is_required
        INTO v_group
        FROM public.modifier_groups
        WHERE id = (v_modifier_item->>'groupId')::uuid;

        IF v_group.id IS NULL OR v_group.id <> v_option.group_id THEN
          RAISE EXCEPTION 'INVALID_MODIFIER_GROUP: Option % does not belong to group %.', v_option_id, (v_modifier_item->>'groupId');
        END IF;

        v_selected_opt_ids := array_append(v_selected_opt_ids, v_option_id);
        v_item_modifiers_total := v_item_modifiers_total + COALESCE(v_option.price_cents, 0);
      END LOOP;
    END IF;

    -- Validate Group Selection Limits
    FOR v_group IN
      SELECT id, name, min_selections, max_selections, is_required
      FROM public.modifier_groups
      WHERE menu_item_id = v_item.id
    LOOP
      v_opt_count := 0;
      IF array_length(v_selected_opt_ids, 1) > 0 THEN
        SELECT COUNT(*) INTO v_opt_count
        FROM public.modifier_options
        WHERE group_id = v_group.id AND id = ANY(v_selected_opt_ids);
      END IF;

      IF v_group.is_required = true AND v_opt_count < COALESCE(v_group.min_selections, 1) THEN
        RAISE EXCEPTION 'MODIFIER_SELECTION_REQUIRED: Required modifier group "%" must have at least % selection(s).', v_group.name, COALESCE(v_group.min_selections, 1);
      END IF;

      IF v_group.max_selections IS NOT NULL AND v_opt_count > v_group.max_selections THEN
        RAISE EXCEPTION 'MODIFIER_SELECTION_EXCEEDED: Modifier group "%" allows maximum % selection(s).', v_group.name, v_group.max_selections;
      END IF;
    END LOOP;

    v_unit_price := v_unit_price + v_item_modifiers_total;
    v_item_line_subtotal := v_unit_price * v_item_quantity;
    v_order_subtotal := v_order_subtotal + v_item_line_subtotal;

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
      v_item_line_subtotal,
      v_cart_item->>'specialInstructions'
    ) RETURNING id INTO v_order_item_id;

    IF array_length(v_selected_opt_ids, 1) > 0 THEN
      FOR v_option IN
        SELECT mo.id, mo.group_id, mo.name as option_name, mo.price_cents, mg.name as group_name
        FROM public.modifier_options mo
        JOIN public.modifier_groups mg ON mg.id = mo.group_id
        WHERE mo.id = ANY(v_selected_opt_ids)
      LOOP
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
          v_option.option_name,
          v_option.price_cents
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 9. Update Master Order Totals
  UPDATE public.orders
  SET subtotal_cents = v_order_subtotal,
      total_cents = v_order_subtotal,
      updated_at = NOW()
  WHERE id = v_order_id;

  -- 10. Record Order Status Initial History
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    notes
  ) VALUES (
    v_order_id,
    NULL,
    'pending',
    'Guest order created successfully.'
  );

  -- 11. Return Response Object
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'access_token', v_access_token,
    'order_number_formatted', v_order_num_formatted,
    'status', 'pending',
    'payment_method', v_pref_payment_method,
    'payment_status', 'unpaid',
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

REVOKE EXECUTE ON FUNCTION public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method) TO service_role;
