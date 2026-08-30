-- Migration: 20260830150500_atomic_order_security_approval_status.sql
-- Description: Sets initial approval_status atomically in create_guest_order based on branch_order_security_settings

DROP FUNCTION IF EXISTS public.create_guest_order(text, uuid, boolean, text, text, text, text, jsonb, public.payment_method, uuid, uuid);

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

  -- Security & Approval Variables
  v_sec_settings RECORD;
  v_initial_approval_status TEXT := 'approved';

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

  -- Fallback: Resolve against Table QR codes if not a Branch QR
  IF v_qr.id IS NULL THEN
    SELECT tqr.id, tqr.business_id, tqr.branch_id, tqr.is_active, tqr.revoked_at, tqr.dining_table_id
    INTO v_qr
    FROM public.table_qr_codes tqr
    WHERE tqr.token_hash = p_token_hash;
    
    IF v_qr.id IS NOT NULL AND p_table_id IS NULL THEN
      p_table_id := v_qr.dining_table_id;
    END IF;
  END IF;

  IF v_qr.id IS NULL OR v_qr.is_active = false OR v_qr.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OR_REVOKED_QR');
  END IF;

  -- 3. Resolve Branch
  SELECT b.id, b.business_id, b.name, b.code, b.status, b.deleted_at, b.require_table_selection, b.require_table_pin
  INTO v_branch
  FROM public.branches b
  WHERE b.id = v_qr.branch_id;

  IF v_branch.id IS NULL OR v_branch.deleted_at IS NOT NULL OR v_branch.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
  END IF;

  -- 4. Resolve Business & Check Status
  SELECT biz.id, biz.name, biz.status, biz.deleted_at, biz.default_currency
  INTO v_business
  FROM public.businesses biz
  WHERE biz.id = v_branch.business_id;

  IF v_business.id IS NULL OR v_business.deleted_at IS NOT NULL OR v_business.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'BUSINESS_UNAVAILABLE');
  END IF;

  -- 4b. Check Idempotency Key
  SELECT id, access_token, order_number_formatted, status, subtotal_cents, discount_cents, total_cents, reward_title_snapshot, reward_points_redeemed_snapshot, currency
  INTO v_existing_order
  FROM public.orders
  WHERE branch_id = v_branch.id AND idempotency_key = p_idempotency_key;

  IF v_existing_order.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'order_id', v_existing_order.id,
      'access_token', v_existing_order.access_token,
      'order_number_formatted', v_existing_order.order_number_formatted,
      'status', v_existing_order.status,
      'subtotal_cents', v_existing_order.subtotal_cents,
      'discount_cents', v_existing_order.discount_cents,
      'total_cents', v_existing_order.total_cents,
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

  -- 5b. Resolve Order Security Settings for Atomic Approval Status
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branch_order_security_settings') THEN
    SELECT require_waiter_approval
    INTO v_sec_settings
    FROM public.branch_order_security_settings
    WHERE branch_id = v_branch.id;

    IF v_sec_settings.require_waiter_approval = true THEN
      v_initial_approval_status := 'pending_waiter_approval';
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
    approval_status,
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
    v_initial_approval_status,
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

        IF v_option.id IS NULL OR v_option.branch_id <> v_branch.id OR v_option.is_active = false OR v_option.deleted_at IS NOT NULL THEN
          RAISE EXCEPTION 'OPTION_UNAVAILABLE: Option % is unavailable.', v_option_id;
        END IF;

        v_selected_opt_ids := array_append(v_selected_opt_ids, v_option_id);
        v_item_modifiers_total := v_item_modifiers_total + v_option.additional_price_cents;
      END LOOP;
    END IF;

    -- Validate modifier group min/max selection counts
    FOR v_group IN
      SELECT mg.id, mg.name, mg.is_required, mg.min_selections, mg.max_selections
      FROM public.modifier_groups mg
      WHERE mg.menu_item_id = v_item.id AND mg.deleted_at IS NULL
    LOOP
      SELECT count(*) INTO v_opt_count
      FROM public.modifier_options mo
      WHERE mo.modifier_group_id = v_group.id AND mo.id = ANY(v_selected_opt_ids);

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
    'approval_status', v_initial_approval_status,
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

-- ====================================================================
-- Permission-Aware Direct Read RLS Hardening for Orders
-- ====================================================================

CREATE OR REPLACE FUNCTION public.auth_can_select_order(
  p_order_id UUID,
  p_business_id UUID,
  p_branch_id UUID,
  p_approval_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Must have valid branch access
  IF NOT public.auth_has_branch_access(p_branch_id) THEN
    RETURN FALSE;
  END IF;

  -- 2. Approved orders are operational and readable by authorized branch staff
  IF p_approval_status = 'approved' THEN
    RETURN TRUE;
  END IF;

  -- 3. If unapproved (pending_waiter_approval or rejected):
  -- Only waiter-approval-authorized staff or elevated management roles can read
  SELECT bm.id, bm.role, bm.custom_role_id
  INTO v_membership
  FROM public.business_memberships bm
  WHERE bm.user_id = v_uid
    AND bm.business_id = p_business_id
    AND bm.membership_status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Business owners and branch managers have elevated visibility
  IF v_membership.role IN ('business_owner'::public.user_role, 'branch_manager'::public.user_role) THEN
    RETURN TRUE;
  END IF;

  -- Check permission scope grants for custom roles or membership overrides
  IF EXISTS (
    SELECT 1 FROM public.permission_scope_grants psg
    WHERE (
      psg.business_membership_id = v_membership.id
      OR (psg.custom_role_id IS NOT NULL AND psg.custom_role_id = v_membership.custom_role_id)
      OR (psg.role_key IS NOT NULL AND psg.role_key = v_membership.role::text)
    )
    AND psg.permission_key IN ('waiter.access', 'waiter.requests.manage', 'orders.manage', 'orders.update_status', 'orders.view')
    AND psg.effect = 'allow'
    AND (
      psg.scope_type = 'ORGANIZATION'
      OR (psg.scope_type = 'PROPERTY' AND (psg.branch_id IS NULL OR psg.branch_id = p_branch_id))
    )
  ) THEN
    RETURN TRUE;
  END IF;

  -- Built-in waiter role fallback
  IF v_membership.role = 'waiter'::public.user_role THEN
    RETURN TRUE;
  END IF;

  -- Kitchen-only, Cashier-only, and unprivileged staff CANNOT read unapproved orders directly
  RETURN FALSE;
END;
$$;

DROP POLICY IF EXISTS "Staff select orders" ON public.orders;
CREATE POLICY "Staff select orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.auth_can_select_order(id, business_id, branch_id, approval_status)
  );

DROP POLICY IF EXISTS "Staff select order items" ON public.order_items;
CREATE POLICY "Staff select order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.auth_can_select_order(o.id, o.business_id, o.branch_id, o.approval_status)
    )
  );

