-- Migration: Consolidated E2E QA Remediation Round
-- Version: 20260829000000

-- ── 1. Recipe Single-Active Authoritative Constraints & Backfill ────────────

-- 1a. Backfill existing duplicate active recipes per menu item:
-- Keep the latest updated / highest version active, and deactivate older duplicates.
WITH RankedRecipes AS (
  SELECT
    id,
    business_id,
    menu_item_id,
    branch_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, menu_item_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::UUID)
      ORDER BY updated_at DESC, version DESC, created_at DESC
    ) as rn
  FROM public.inventory_recipes
  WHERE menu_item_id IS NOT NULL AND is_active = true
)
UPDATE public.inventory_recipes r
SET is_active = false,
    updated_at = NOW()
FROM RankedRecipes rr
WHERE r.id = rr.id AND rr.rn > 1;

-- 1b. Partial Unique Indexes to strictly enforce exactly 1 active recipe per menu item at DB level
DROP INDEX IF EXISTS public.idx_unique_active_menu_item_recipe;
CREATE UNIQUE INDEX idx_unique_active_menu_item_recipe
  ON public.inventory_recipes (business_id, menu_item_id)
  WHERE (menu_item_id IS NOT NULL AND is_active = true AND branch_id IS NULL);

DROP INDEX IF EXISTS public.idx_unique_active_menu_item_branch_recipe;
CREATE UNIQUE INDEX idx_unique_active_menu_item_branch_recipe
  ON public.inventory_recipes (business_id, menu_item_id, branch_id)
  WHERE (menu_item_id IS NOT NULL AND is_active = true AND branch_id IS NOT NULL);


-- ── 2. Staff Action Accountability: Waiter Requests ─────────────────────────

DO $$ BEGIN
  ALTER TABLE public.waiter_requests
    ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.waiter_requests
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;


-- ── 3. Hardened Atomic consume_order_item_ingredients RPC ───────────────────

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
    -- Deterministic Authoritative Single Active Recipe Resolution:
    -- Prefer branch-specific active recipe first, fallback to business-wide active recipe
    SELECT * INTO v_recipe
    FROM public.inventory_recipes
    WHERE business_id = v_order.business_id
      AND menu_item_id = v_order_item.menu_item_id
      AND is_active = true
      AND (branch_id = v_order.branch_id OR branch_id IS NULL)
    ORDER BY branch_id DESC NULLS LAST, updated_at DESC, version DESC
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

REVOKE EXECUTE ON FUNCTION public.consume_order_item_ingredients(UUID, public.inventory_consumption_stage, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_order_item_ingredients(UUID, public.inventory_consumption_stage, UUID) TO authenticated, service_role;
