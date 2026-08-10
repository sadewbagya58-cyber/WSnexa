-- Migration: 20260811010000_atomic_guest_order_loyalty_redemption.sql
-- Description: Makes order creation and loyalty reward redemption 100% atomic in ONE PostgreSQL transaction/RPC.

-- 1. Ensure orders reward snapshot and customer_user_id columns exist idempotently
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_cents'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reward_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reward_title_snapshot'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN reward_title_snapshot TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reward_points_redeemed_snapshot'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN reward_points_redeemed_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (reward_points_redeemed_snapshot >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'customer_user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Drop existing overloaded create_guest_order RPC signatures
DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method);
DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method, uuid, uuid);

-- 3. Create Atomic create_guest_order RPC
CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_token_hash TEXT,
  p_table_id UUID DEFAULT NULL,
  p_table_access_verified BOOLEAN DEFAULT false,
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_cart_items JSONB DEFAULT '[]'::jsonb,
  p_payment_method public.payment_method DEFAULT 'pay_at_counter'::public.payment_method,
  p_customer_user_id UUID DEFAULT NULL,
  p_selected_reward_id UUID DEFAULT NULL
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
  v_order_total INTEGER := 0;
  v_order_item_id UUID;
  v_opt_count INTEGER;
  v_selected_opt_ids UUID[];
  v_option_id UUID;
  v_group_id UUID;
  v_pref_payment_method public.payment_method;

  -- Reward Redemption Variables
  v_reward RECORD;
  v_loyalty_account RECORD;
  v_discount_cents INTEGER := 0;
  v_reward_title_snapshot TEXT := NULL;
  v_reward_points_redeemed_snapshot INTEGER := 0;
  v_free_item_price INTEGER := 0;
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
  SELECT id, order_number_formatted, status, total_cents, discount_cents, reward_title_snapshot, reward_points_redeemed_snapshot, currency, access_token, payment_method, payment_status
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
      'discount_cents', v_existing_order.discount_cents,
      'reward_title_snapshot', v_existing_order.reward_title_snapshot,
      'reward_points_redeemed_snapshot', v_existing_order.reward_points_redeemed_snapshot,
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

  -- 7. Insert Master Order Header Record Initial Draft
  INSERT INTO public.orders (
    business_id,
    branch_id,
    table_id,
    customer_user_id,
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
    discount_cents,
    tax_cents,
    service_charge_cents,
    total_cents,
    currency
  ) VALUES (
    v_business.id,
    v_branch.id,
    p_table_id,
    p_customer_user_id,
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
        v_group_id := (v_modifier_item->>'groupId')::uuid;

        IF v_option_id = ANY(v_selected_opt_ids) THEN
          RAISE EXCEPTION 'DUPLICATE_MODIFIER: Modifier option % cannot be selected multiple times.', v_option_id;
        END IF;

        SELECT id, business_id, branch_id, modifier_group_id, name, additional_price_cents, is_active, deleted_at
        INTO v_option
        FROM public.modifier_options
        WHERE id = v_option_id;

        IF v_option.id IS NULL OR v_option.is_active = false OR v_option.deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'MODIFIER_UNAVAILABLE: Modifier option % is unavailable.', v_option_id;
        END IF;

        IF v_option.branch_id <> v_branch.id OR v_option.business_id <> v_business.id THEN
          RAISE EXCEPTION 'MODIFIER_BRANCH_MISMATCH: Modifier option % belongs to a different branch.', v_option_id;
        END IF;

        SELECT id, business_id, branch_id, menu_item_id, name, min_selections, max_selections, is_required, is_active, deleted_at
        INTO v_group
        FROM public.modifier_groups
        WHERE id = v_group_id;

        IF v_group.id IS NULL OR v_group.is_active = false OR v_group.deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'INVALID_MODIFIER_GROUP: Group % is unavailable.', v_group_id;
        END IF;

        IF v_group.branch_id <> v_branch.id OR v_group.business_id <> v_business.id THEN
          RAISE EXCEPTION 'INVALID_MODIFIER_GROUP_BRANCH: Group % belongs to a different branch.', v_group_id;
        END IF;

        IF v_group.menu_item_id <> v_item.id THEN
          RAISE EXCEPTION 'MODIFIER_ITEM_MISMATCH: Group % does not belong to menu item %.', v_group.id, v_item.id;
        END IF;

        IF v_group.id <> v_option.modifier_group_id THEN
          RAISE EXCEPTION 'INVALID_MODIFIER_GROUP_OPTION: Option % does not belong to group %.', v_option_id, v_group_id;
        END IF;

        v_selected_opt_ids := array_append(v_selected_opt_ids, v_option_id);
        v_item_modifiers_total := v_item_modifiers_total + COALESCE(v_option.additional_price_cents, 0);
      END LOOP;
    END IF;

    -- Validate Group Selection Limits
    FOR v_group IN
      SELECT id, name, min_selections, max_selections, is_required
      FROM public.modifier_groups
      WHERE menu_item_id = v_item.id AND is_active = true AND deleted_at IS NULL
    LOOP
      v_opt_count := 0;
      IF array_length(v_selected_opt_ids, 1) > 0 THEN
        SELECT COUNT(*) INTO v_opt_count
        FROM public.modifier_options
        WHERE modifier_group_id = v_group.id AND id = ANY(v_selected_opt_ids) AND is_active = true AND deleted_at IS NULL;
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
        SELECT mo.id, mo.modifier_group_id, mo.name as option_name, mo.additional_price_cents, mg.name as group_name
        FROM public.modifier_options mo
        JOIN public.modifier_groups mg ON mg.id = mo.modifier_group_id
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
          v_option.modifier_group_id,
          v_option.id,
          v_option.group_name,
          v_option.option_name,
          v_option.additional_price_cents
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 9. Optional Loyalty Reward Validation & Atomic Redemption
  IF p_selected_reward_id IS NOT NULL THEN
    IF p_customer_user_id IS NULL THEN
      RAISE EXCEPTION 'REWARD_AUTHENTICATION_REQUIRED: Must be logged in to redeem rewards.';
    END IF;

    -- Resolve & Verify Reward Record
    SELECT id, business_id, title, points_required, reward_type, discount_amount_cents, discount_percentage, free_menu_item_id, min_order_value_cents, is_active, valid_from, valid_until
    INTO v_reward
    FROM public.loyalty_rewards
    WHERE id = p_selected_reward_id;

    IF v_reward.id IS NULL OR v_reward.is_active = false THEN
      RAISE EXCEPTION 'REWARD_NOT_FOUND: Selected reward is unavailable or inactive.';
    END IF;

    IF v_reward.business_id <> v_business.id THEN
      RAISE EXCEPTION 'REWARD_VENUE_MISMATCH: Reward does not belong to this venue.';
    END IF;

    IF v_reward.valid_from IS NOT NULL AND v_reward.valid_from > NOW() THEN
      RAISE EXCEPTION 'REWARD_NOT_YET_ACTIVE: Reward validity period has not started.';
    END IF;

    IF v_reward.valid_until IS NOT NULL AND v_reward.valid_until < NOW() THEN
      RAISE EXCEPTION 'REWARD_EXPIRED: Reward has expired.';
    END IF;

    IF v_reward.min_order_value_cents > 0 AND v_order_subtotal < v_reward.min_order_value_cents THEN
      RAISE EXCEPTION 'REWARD_MIN_SPEND_NOT_MET: Order subtotal does not meet minimum reward requirement.';
    END IF;

    -- Lock Customer Loyalty Account FOR UPDATE
    SELECT id, points_balance, lifetime_points_earned
    INTO v_loyalty_account
    FROM public.customer_loyalty_accounts
    WHERE customer_user_id = p_customer_user_id AND business_id = v_business.id
    FOR UPDATE;

    IF v_loyalty_account.id IS NULL OR v_loyalty_account.points_balance < v_reward.points_required THEN
      RAISE EXCEPTION 'INSUFFICIENT_LOYALTY_POINTS: Insufficient points balance for selected reward.';
    END IF;

    -- Calculate Discount Server-Side
    IF v_reward.reward_type = 'fixed_discount' THEN
      v_discount_cents := LEAST(v_order_subtotal, COALESCE(v_reward.discount_amount_cents, 0));
    ELSIF v_reward.reward_type = 'percentage_discount' THEN
      v_discount_cents := ROUND((v_order_subtotal::numeric * COALESCE(v_reward.discount_percentage, 0)) / 100.0);
      v_discount_cents := LEAST(v_order_subtotal, v_discount_cents);
    ELSIF v_reward.reward_type = 'free_item' THEN
      v_discount_cents := COALESCE(v_reward.discount_amount_cents, 0);
      IF v_discount_cents = 0 AND v_reward.free_menu_item_id IS NOT NULL THEN
        SELECT price_cents INTO v_free_item_price FROM public.menu_items WHERE id = v_reward.free_menu_item_id;
        v_discount_cents := COALESCE(v_free_item_price, 0);
      END IF;
      v_discount_cents := LEAST(v_order_subtotal, v_discount_cents);
    ELSE
      v_discount_cents := LEAST(v_order_subtotal, COALESCE(v_reward.discount_amount_cents, 0));
    END IF;

    v_reward_title_snapshot := v_reward.title;
    v_reward_points_redeemed_snapshot := v_reward.points_required;

    -- Atomically Deduct Points Balance & Update Account
    UPDATE public.customer_loyalty_accounts
    SET points_balance = points_balance - v_reward.points_required,
        updated_at = NOW()
    WHERE id = v_loyalty_account.id;

    -- Insert Immutable Ledger Redeem Entry
    INSERT INTO public.loyalty_points_ledger (
      customer_user_id,
      business_id,
      order_id,
      transaction_type,
      points,
      reason,
      created_at
    ) VALUES (
      p_customer_user_id,
      v_business.id,
      v_order_id,
      'redeem',
      -v_reward.points_required,
      'Reward Redemption: ' || v_reward.title,
      NOW()
    );

    -- Insert Loyalty Reward Redemption Record
    INSERT INTO public.loyalty_reward_redemptions (
      business_id,
      customer_user_id,
      reward_id,
      order_id,
      points_spent,
      status,
      applied_at
    ) VALUES (
      v_business.id,
      p_customer_user_id,
      v_reward.id,
      v_order_id,
      v_reward.points_required,
      'applied',
      NOW()
    );
  END IF;

  v_order_total := GREATEST(0, v_order_subtotal - v_discount_cents);

  -- 10. Update Master Order Totals & Reward Snapshots
  UPDATE public.orders
  SET subtotal_cents = v_order_subtotal,
      discount_cents = v_discount_cents,
      total_cents = v_order_total,
      reward_id = p_selected_reward_id,
      reward_title_snapshot = v_reward_title_snapshot,
      reward_points_redeemed_snapshot = v_reward_points_redeemed_snapshot,
      customer_user_id = COALESCE(p_customer_user_id, customer_user_id),
      updated_at = NOW()
  WHERE id = v_order_id;

  -- 11. Record Order Status Initial History
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

  -- 12. Return Response Object
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'access_token', v_access_token,
    'order_number_formatted', v_order_num_formatted,
    'status', 'pending',
    'payment_method', v_pref_payment_method,
    'payment_status', 'unpaid',
    'subtotal_cents', v_order_subtotal,
    'discount_cents', v_discount_cents,
    'total_cents', v_order_total,
    'reward_title_snapshot', v_reward_title_snapshot,
    'reward_points_redeemed_snapshot', v_reward_points_redeemed_snapshot,
    'currency', v_business.default_currency
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant Execution to Service Role Only
REVOKE EXECUTE ON FUNCTION public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method, uuid, uuid) TO service_role;
