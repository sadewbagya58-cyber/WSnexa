-- ═══════════════════════════════════════════════════════════════════════════════
-- WSNexa Phase 28 Follow-Up Migration: Production Invariants & Security Controls
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Schema Enhancements: replaces_item_id on Modifier Overrides ───────────

ALTER TABLE public.inventory_modifier_overrides
  ADD COLUMN IF NOT EXISTS replaces_item_id UUID NULL REFERENCES public.inventory_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_modifier_overrides_replaces
  ON public.inventory_modifier_overrides (replaces_item_id);

-- ── 2. Dedicated Immutable Reversals Table with UNIQUE(consumption_id) ────────

CREATE TABLE IF NOT EXISTS public.inventory_consumption_reversals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  consumption_id UUID NOT NULL REFERENCES public.inventory_order_consumptions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  quantity_reversed_base NUMERIC(15, 4) NOT NULL CHECK (quantity_reversed_base > 0),
  disposition TEXT NOT NULL CHECK (disposition IN ('return_to_stock', 'record_waste', 'no_change')),
  cost_cents_snapshot INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL,
  actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_consumption_reversal UNIQUE (consumption_id)
);

CREATE INDEX IF NOT EXISTS idx_consumption_reversals_order
  ON public.inventory_consumption_reversals (order_id);

CREATE INDEX IF NOT EXISTS idx_consumption_reversals_consumption
  ON public.inventory_consumption_reversals (consumption_id);

ALTER TABLE public.inventory_consumption_reversals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for inventory_consumption_reversals" ON public.inventory_consumption_reversals;
CREATE POLICY "Tenant isolation for inventory_consumption_reversals"
  ON public.inventory_consumption_reversals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = inventory_consumption_reversals.business_id
        AND bm.user_id = auth.uid()
        AND bm.membership_status = 'active'
    )
  );

-- ── 3. Internal Database-Level RBAC & Branch Validation Helper ───────────────

CREATE OR REPLACE FUNCTION public.check_user_permission(
  p_user_id UUID,
  p_business_id UUID,
  p_branch_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mem RECORD;
  v_override TEXT;
  v_has_perm BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_business_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Active Membership Verification
  SELECT * INTO v_mem
  FROM public.business_memberships
  WHERE user_id = p_user_id AND business_id = p_business_id AND membership_status = 'active';

  IF v_mem.id IS NULL THEN
    RETURN false;
  END IF;

  -- 2. Business Owner has full access across all branches
  IF v_mem.role = 'business_owner' THEN
    RETURN true;
  END IF;

  -- 3. Strict Branch Isolation (Managers and staff MUST have explicit branch assignment)
  IF p_branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branch_assignments
      WHERE business_membership_id = v_mem.id AND branch_id = p_branch_id
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- 4. Explicit Member Permission Override (deny takes absolute precedence)
  SELECT effect INTO v_override
  FROM public.member_permission_overrides
  WHERE business_membership_id = v_mem.id AND permission_key = p_permission_key;

  IF v_override = 'deny' THEN
    RETURN false;
  ELSIF v_override = 'allow' THEN
    RETURN true;
  END IF;

  -- 5. Custom Role Permissions
  IF v_mem.custom_role_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.role_permissions
      WHERE custom_role_id = v_mem.custom_role_id AND permission_key = p_permission_key
    ) INTO v_has_perm;
    IF v_has_perm THEN
      RETURN true;
    END IF;
  END IF;

  -- 6. Built-in Role Permissions
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_key = v_mem.role AND permission_key = p_permission_key
  ) INTO v_has_perm;

  RETURN v_has_perm;
END;
$$;

-- ── 4. Atomic consume_order_item_ingredients RPC ─────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_order_item_ingredients(
  p_order_id UUID,
  p_stage public.inventory_consumption_stage DEFAULT NULL,
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
  v_is_authorized BOOLEAN := false;
  v_order RECORD;
  v_order_item RECORD;
  v_recipe RECORD;
  v_sub_recipe RECORD;
  v_ing RECORD;
  v_target_item_id UUID;
  v_mod RECORD;
  v_mod_override RECORD;
  v_item_def RECORD;
  v_deduct_qty NUMERIC(15, 4);
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_location_id UUID;
  v_line_cost INT;
  v_consumed_count INT := 0;

  -- Configuration & Stage resolution
  v_settings RECORD;
  v_configured_stage public.inventory_consumption_stage;
  v_effective_stage public.inventory_consumption_stage;
  v_order_already_consumed BOOLEAN := false;

  v_item_req RECORD;
  v_line_req RECORD;
BEGIN
  -- 1. Caller Identity & Mutation Authority Verification
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

  IF v_caller_id IS NOT NULL THEN
    -- Requires operational kitchen mutation permission
    v_is_authorized := (
      public.check_user_permission(v_caller_id, v_order.business_id, v_order.branch_id, 'inventory.production.manage') OR
      public.check_user_permission(v_caller_id, v_order.business_id, v_order.branch_id, 'recipes.manage')
    );
    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;
  END IF;

  -- 2. Server-Side Authoritative Deduction Timing Resolution
  SELECT * INTO v_settings
  FROM public.inventory_settings
  WHERE business_id = v_order.business_id
    AND (branch_id = v_order.branch_id OR branch_id IS NULL)
  ORDER BY branch_id DESC NULLS LAST
  LIMIT 1;

  v_configured_stage := COALESCE(v_settings.deduction_timing, 'preparing'::public.inventory_consumption_stage);

  -- Check if order has already performed its lifecycle deduction at ANY stage
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_order_consumptions
    WHERE order_id = p_order_id
  ) INTO v_order_already_consumed;

  IF v_order_already_consumed THEN
    -- Lifecycle deduction already completed: Idempotent no-op
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'consumed_count', 0);
  END IF;

  -- If caller supplied a stage, verify it matches authoritative configuration
  IF p_stage IS NOT NULL AND p_stage != v_configured_stage THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'STAGE_MISMATCH',
      'configured_stage', v_configured_stage,
      'requested_stage', p_stage
    );
  END IF;

  v_effective_stage := v_configured_stage;

  -- 3. Resolve storage location for branch
  SELECT id INTO v_location_id
  FROM public.inventory_storage_locations
  WHERE branch_id = v_order.branch_id AND is_active = true
  ORDER BY is_default DESC, created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_STORAGE_LOCATION_FOUND');
  END IF;

  -- 4. Pre-flight requirements table keyed by (order_item_id, item_id)
  CREATE TEMP TABLE temp_order_requirements (
    order_item_id UUID,
    item_id UUID,
    recipe_id UUID,
    recipe_version INT,
    quantity_required NUMERIC(15, 4),
    is_modifier BOOLEAN DEFAULT false,
    mod_option_name TEXT DEFAULT NULL,
    PRIMARY KEY (order_item_id, item_id)
  ) ON COMMIT DROP;

  FOR v_order_item IN
    SELECT * FROM public.order_items WHERE order_id = p_order_id
  LOOP
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
        v_target_item_id := NULL;

        IF v_ing.item_id IS NOT NULL THEN
          v_target_item_id := v_ing.item_id;
        ELSIF v_ing.sub_recipe_id IS NOT NULL THEN
          -- Strictly validate sub-recipe and its output inventory item
          SELECT * INTO v_sub_recipe
          FROM public.inventory_recipes
          WHERE id = v_ing.sub_recipe_id
            AND business_id = v_order.business_id
            AND is_active = true;

          IF v_sub_recipe.id IS NULL OR v_sub_recipe.output_inventory_item_id IS NULL THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'INVALID_SUB_RECIPE',
              'sub_recipe_id', v_ing.sub_recipe_id
            );
          END IF;

          -- Verify output inventory item belongs to tenant
          IF NOT EXISTS (
            SELECT 1 FROM public.inventory_items
            WHERE id = v_sub_recipe.output_inventory_item_id
              AND business_id = v_order.business_id
          ) THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'SUB_RECIPE_OUTPUT_ITEM_NOT_FOUND',
              'item_id', v_sub_recipe.output_inventory_item_id
            );
          END IF;

          v_target_item_id := v_sub_recipe.output_inventory_item_id;
        END IF;

        IF v_target_item_id IS NOT NULL THEN
          v_deduct_qty := (v_ing.quantity_base / v_ing.yield_factor) * v_order_item.quantity;

          -- Evaluate modifiers affecting this specific ingredient
          FOR v_mod IN
            SELECT * FROM public.order_item_modifiers WHERE order_item_id = v_order_item.id
          LOOP
            SELECT * INTO v_mod_override
            FROM public.inventory_modifier_overrides
            WHERE modifier_option_id = v_mod.modifier_option_id;

            IF v_mod_override.id IS NOT NULL THEN
              -- Scale Modifier Targeting: Only scale if targeted at this item or global
              IF v_mod_override.effect_type = 'scale' THEN
                IF v_mod_override.item_id IS NULL OR v_mod_override.item_id = v_target_item_id THEN
                  v_deduct_qty := v_deduct_qty * v_mod_override.quantity;
                END IF;
              ELSIF v_mod_override.effect_type = 'remove' AND v_mod_override.item_id = v_target_item_id THEN
                v_deduct_qty := GREATEST(0.0, v_deduct_qty - (v_mod_override.quantity_base * v_order_item.quantity));
              ELSIF v_mod_override.effect_type = 'substitute' AND v_mod_override.replaces_item_id = v_target_item_id THEN
                v_deduct_qty := 0.0;
              END IF;
            END IF;
          END LOOP;

          IF v_deduct_qty > 0 THEN
            INSERT INTO temp_order_requirements (
              order_item_id, item_id, recipe_id, recipe_version, quantity_required, is_modifier
            ) VALUES (
              v_order_item.id, v_target_item_id, v_recipe.id, v_recipe.version, v_deduct_qty, false
            ) ON CONFLICT (order_item_id, item_id) DO UPDATE
              SET quantity_required = temp_order_requirements.quantity_required + EXCLUDED.quantity_required;
          END IF;
        END IF;
      END LOOP;

      -- Check Add / Substitute Modifiers introducing separate items
      FOR v_mod IN
        SELECT * FROM public.order_item_modifiers WHERE order_item_id = v_order_item.id
      LOOP
        SELECT * INTO v_mod_override
        FROM public.inventory_modifier_overrides
        WHERE modifier_option_id = v_mod.modifier_option_id
          AND effect_type IN ('add', 'substitute')
          AND item_id IS NOT NULL;

        IF v_mod_override.id IS NOT NULL THEN
          v_deduct_qty := v_mod_override.quantity_base * v_order_item.quantity;

          INSERT INTO temp_order_requirements (
            order_item_id, item_id, recipe_id, recipe_version, quantity_required, is_modifier, mod_option_name
          ) VALUES (
            v_order_item.id, v_mod_override.item_id, v_recipe.id, v_recipe.version, v_deduct_qty, true, v_mod.option_name_snapshot
          ) ON CONFLICT (order_item_id, item_id) DO UPDATE
            SET quantity_required = temp_order_requirements.quantity_required + EXCLUDED.quantity_required;
        END IF;
      END LOOP;

    END IF;
  END LOOP;

  -- 5. DETERMINISTIC TOTAL STOCK PRE-FLIGHT CHECK (Ordered by item_id ASC)
  FOR v_item_req IN
    SELECT item_id, SUM(quantity_required) AS total_qty_required
    FROM temp_order_requirements
    GROUP BY item_id
    ORDER BY item_id ASC
  LOOP
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE branch_id = v_order.branch_id AND location_id = v_location_id AND item_id = v_item_req.item_id
    FOR UPDATE;

    IF v_balance.id IS NULL OR v_balance.current_quantity < v_item_req.total_qty_required THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'item_id', v_item_req.item_id,
        'required_quantity', v_item_req.total_qty_required,
        'available_quantity', COALESCE(v_balance.current_quantity, 0.0)
      );
    END IF;
  END LOOP;

  -- 6. ATOMIC EXECUTION PASS: Deduct stock and record distinct line snapshots
  FOR v_line_req IN SELECT * FROM temp_order_requirements ORDER BY item_id ASC LOOP
    SELECT * INTO v_item_def FROM public.inventory_items WHERE id = v_line_req.item_id;
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE branch_id = v_order.branch_id AND location_id = v_location_id AND item_id = v_line_req.item_id
    FOR UPDATE;

    v_current_qty := v_balance.current_quantity;
    v_new_qty := v_current_qty - v_line_req.quantity_required;
    v_line_cost := ROUND(v_line_req.quantity_required * v_item_def.cost_per_unit_cents);

    UPDATE public.inventory_balances
    SET current_quantity = v_new_qty, last_movement_at = now(), updated_at = now()
    WHERE id = v_balance.id;

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
      idempotency_key
    ) VALUES (
      v_order.business_id,
      v_order.branch_id,
      p_order_id,
      v_line_req.order_item_id,
      v_line_req.recipe_id,
      v_line_req.recipe_version,
      v_line_req.item_id,
      v_location_id,
      v_line_req.quantity_required,
      v_item_def.cost_per_unit_cents,
      v_line_cost,
      v_item_def.currency,
      v_effective_stage,
      p_order_id::text || '_' || v_line_req.order_item_id::text || '_' || v_line_req.item_id::text || '_' || v_effective_stage::text
    );

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
      v_line_req.item_id,
      'recipe_consumption',
      'out',
      v_line_req.quantity_required,
      v_item_def.base_unit,
      v_line_req.quantity_required,
      v_current_qty,
      v_new_qty,
      v_item_def.cost_per_unit_cents,
      v_line_cost,
      v_item_def.currency,
      CASE
        WHEN v_line_req.is_modifier THEN 'Order #' || COALESCE(v_order.order_number::text, v_order.id::text) || ' modifier consumption (' || COALESCE(v_line_req.mod_option_name, '') || ')'
        ELSE 'Order #' || COALESCE(v_order.order_number::text, v_order.id::text) || ' consumption'
      END,
      v_actor_id,
      p_order_id::text
    );

    v_consumed_count := v_consumed_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'consumed_count', v_consumed_count, 'stage', v_effective_stage);
END;
$$;

-- ── 5. Fully Preflighted reverse_order_consumption RPC ───────────────────────

CREATE OR REPLACE FUNCTION public.reverse_order_consumption(
  p_order_id UUID,
  p_disposition TEXT, -- 'return_to_stock', 'record_waste', 'no_change'
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
  v_is_authorized BOOLEAN := false;
  v_order RECORD;
  v_cons RECORD;
  v_existing_rev RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
  v_item_def RECORD;
  v_reversed_count INT := 0;
  v_has_pending BOOLEAN := false;
BEGIN
  IF p_disposition NOT IN ('return_to_stock', 'record_waste', 'no_change') THEN
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

  IF v_caller_id IS NOT NULL THEN
    -- Strictly requires canonical order cancellation authority
    v_is_authorized := public.check_user_permission(v_caller_id, v_order.business_id, v_order.branch_id, 'orders.cancel');
    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;
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
      IF v_existing_rev.disposition != p_disposition THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'ALREADY_REVERSED',
          'consumption_id', v_cons.id,
          'existing_disposition', v_existing_rev.disposition,
          'requested_disposition', p_disposition
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
          v_actor_id,
          p_order_id::text
        );

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
        p_disposition,
        v_cons.total_cost_cents_snapshot,
        v_cons.currency,
        p_reason,
        v_actor_id,
        v_cons.id::text || '_' || p_disposition
      );

      v_reversed_count := v_reversed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reversed_count', v_reversed_count);
END;
$$;

-- ── 6. Explicit Privilege Lockdown for Security Functions ────────────────────

REVOKE EXECUTE ON FUNCTION public.consume_order_item_ingredients(UUID, public.inventory_consumption_stage, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_order_item_ingredients(UUID, public.inventory_consumption_stage, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_order_consumption(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_user_permission(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_permission(UUID, UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, UUID, UUID, TEXT) TO service_role;
