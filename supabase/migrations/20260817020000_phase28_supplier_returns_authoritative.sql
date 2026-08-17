-- Migration: Phase 28 — Authoritative Supplier Returns & Goods Return Workflow
-- Version: 20260817020000

-- ── 1. Enhance inventory_supplier_returns Schema with Idempotency ──────────────

DO $$ BEGIN
  ALTER TABLE public.inventory_supplier_returns ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_supplier_return_idempotency'
  ) THEN
    ALTER TABLE public.inventory_supplier_returns
      ADD CONSTRAINT uq_supplier_return_idempotency UNIQUE (business_id, idempotency_key);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN null;
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_supplier_returns_grn_item
  ON public.inventory_supplier_returns (grn_id, item_id);

CREATE INDEX IF NOT EXISTS idx_supplier_returns_supplier
  ON public.inventory_supplier_returns (supplier_id, created_at DESC);

-- ── 2. Robust Permission Check Helper with Explicit Role Cast ──────────────────

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
  IF v_mem.role::TEXT = 'business_owner' THEN
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

  -- 6. Built-in Role Permissions (explicit cast to avoid text = user_role error)
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role_key = v_mem.role::TEXT AND permission_key = p_permission_key
  ) INTO v_has_perm;

  RETURN v_has_perm;
END;
$$;

-- ── 3. Authoritative Database RPC: record_supplier_return ─────────────────────

CREATE OR REPLACE FUNCTION public.record_supplier_return(
  p_business_id UUID,
  p_branch_id UUID,
  p_supplier_id UUID,
  p_location_id UUID,
  p_item_id UUID,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_reason TEXT,
  p_grn_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_branch RECORD;
  v_location RECORD;
  v_supplier RECORD;
  v_item RECORD;
  v_grn RECORD;
  v_balance RECORD;
  v_existing_return RECORD;
  v_return_id UUID;
  v_return_number TEXT;
  v_quantity_base NUMERIC(15, 4);
  v_unit_cost_cents INT := 0;
  v_total_cost_cents INT := 0;
  v_total_received_base NUMERIC(15, 4) := 0;
  v_grn_unit_cost INT := 0;
  v_previously_returned_base NUMERIC(15, 4) := 0;
  v_remaining_returnable NUMERIC(15, 4) := 0;
  v_unit_clean TEXT;
  v_base_clean TEXT;
BEGIN
  -- 1. Authorization Preflight
  IF p_actor_id IS NOT NULL THEN
    IF NOT public.check_user_permission(p_actor_id, p_business_id, p_branch_id, 'purchasing.receive')
       AND NOT public.check_user_permission(p_actor_id, p_business_id, p_branch_id, 'purchasing.manage')
       AND NOT public.check_user_permission(p_actor_id, p_business_id, p_branch_id, 'purchasing.approve') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNAUTHORIZED',
        'message', 'User lacks purchasing authority to execute supplier returns.'
      );
    END IF;
  END IF;

  -- 2. Input Parameter Validations
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUANTITY',
      'message', 'Return quantity must be strictly greater than zero.'
    );
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_REASON',
      'message', 'Return reason is required (minimum 3 characters).'
    );
  END IF;

  -- 3. Idempotency Check
  IF p_idempotency_key IS NOT NULL AND char_length(trim(p_idempotency_key)) > 0 THEN
    SELECT * INTO v_existing_return
    FROM public.inventory_supplier_returns
    WHERE business_id = p_business_id AND idempotency_key = trim(p_idempotency_key);

    IF v_existing_return.id IS NOT NULL THEN
      IF v_existing_return.branch_id = p_branch_id
         AND v_existing_return.supplier_id = p_supplier_id
         AND v_existing_return.location_id = p_location_id
         AND v_existing_return.item_id = p_item_id
         AND v_existing_return.quantity = p_quantity THEN
        RETURN jsonb_build_object(
          'success', true,
          'idempotent_replay', true,
          'return_id', v_existing_return.id,
          'return_number', v_existing_return.return_number,
          'quantity_base', v_existing_return.quantity_base,
          'total_cost_cents', v_existing_return.total_cost_cents,
          'message', 'Supplier return already recorded.'
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CONFLICTING_IDEMPOTENCY_KEY',
          'message', 'A supplier return with this idempotency key already exists with conflicting parameters.'
        );
      END IF;
    END IF;
  END IF;

  -- 4. Multi-Tenant Entity Validations
  SELECT * INTO v_branch
  FROM public.branches
  WHERE id = p_branch_id AND business_id = p_business_id;

  IF v_branch.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_BRANCH', 'message', 'Branch not found or belongs to another tenant.');
  END IF;

  SELECT * INTO v_location
  FROM public.inventory_storage_locations
  WHERE id = p_location_id AND branch_id = p_branch_id AND business_id = p_business_id;

  IF v_location.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_LOCATION', 'message', 'Storage location not found in the specified branch.');
  END IF;

  SELECT * INTO v_supplier
  FROM public.inventory_suppliers
  WHERE id = p_supplier_id AND business_id = p_business_id;

  IF v_supplier.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_SUPPLIER', 'message', 'Supplier not found for this business.');
  END IF;

  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id AND business_id = p_business_id;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ITEM', 'message', 'Inventory item not found for this business.');
  END IF;

  -- 5. Deterministic Unit Conversion
  v_unit_clean := lower(trim(p_unit));
  v_base_clean := lower(trim(v_item.base_unit));

  IF v_unit_clean = v_base_clean THEN
    v_quantity_base := p_quantity;
  ELSIF v_base_clean = 'kg' AND v_unit_clean = 'g' THEN
    v_quantity_base := p_quantity / 1000.0;
  ELSIF v_base_clean = 'kg' AND v_unit_clean = 'mg' THEN
    v_quantity_base := p_quantity / 1000000.0;
  ELSIF v_base_clean = 'g' AND v_unit_clean = 'kg' THEN
    v_quantity_base := p_quantity * 1000.0;
  ELSIF v_base_clean = 'l' AND v_unit_clean = 'ml' THEN
    v_quantity_base := p_quantity / 1000.0;
  ELSIF v_base_clean = 'l' AND v_unit_clean = 'cl' THEN
    v_quantity_base := p_quantity / 1000.0 * 10.0;
  ELSIF v_base_clean = 'ml' AND v_unit_clean = 'l' THEN
    v_quantity_base := p_quantity * 1000.0;
  ELSIF (v_base_clean IN ('pcs', 'unit', 'portion', 'can', 'bottle') AND v_unit_clean IN ('pcs', 'unit', 'portion', 'can', 'bottle')) THEN
    v_quantity_base := p_quantity;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INCOMPATIBLE_UNIT',
      'message', format('Unit "%s" is incompatible with item base unit "%s".', p_unit, v_item.base_unit)
    );
  END IF;

  -- 6. GRN Linkage & Cumulative Return Limits
  IF p_grn_id IS NOT NULL THEN
    SELECT * INTO v_grn
    FROM public.inventory_goods_receipts
    WHERE id = p_grn_id AND business_id = p_business_id AND branch_id = p_branch_id AND supplier_id = p_supplier_id;

    IF v_grn.id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_GRN_REFERENCE',
        'message', 'Goods Receipt (GRN) not found for this supplier and branch.'
      );
    END IF;

    -- Query total received on this GRN for this item
    SELECT
      COALESCE(SUM(quantity_received_base), 0),
      COALESCE(MAX(unit_cost_cents), 0)
    INTO v_total_received_base, v_grn_unit_cost
    FROM public.inventory_goods_receipt_items
    WHERE grn_id = p_grn_id AND item_id = p_item_id;

    IF v_total_received_base <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ITEM_NOT_ON_GRN',
        'message', 'This item was not received on the specified Goods Receipt.'
      );
    END IF;

    -- Query previously returned quantity on this GRN
    SELECT COALESCE(SUM(quantity_base), 0)
    INTO v_previously_returned_base
    FROM public.inventory_supplier_returns
    WHERE grn_id = p_grn_id AND item_id = p_item_id;

    v_remaining_returnable := v_total_received_base - v_previously_returned_base;

    IF v_quantity_base > v_remaining_returnable THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'EXCEEDS_GRN_RETURNABLE_QUANTITY',
        'message', format('Requested return (%s %s) exceeds remaining returnable quantity from GRN #%s (%s %s remaining).',
          p_quantity, p_unit, v_grn.grn_number, v_remaining_returnable, v_item.base_unit)
      );
    END IF;

    -- Derive authoritative unit cost from GRN line
    v_unit_cost_cents := v_grn_unit_cost;
  ELSE
    -- For unlinked direct supplier return, use item's current unit cost
    v_unit_cost_cents := COALESCE(v_item.cost_per_unit_cents, 0);
  END IF;

  -- 7. Financial Valuation
  v_total_cost_cents := ROUND(v_quantity_base * v_unit_cost_cents);

  -- 8. Lock Inventory Balance & Verify Sufficient Physical Stock
  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE location_id = p_location_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_balance.id IS NULL OR v_balance.current_quantity < v_quantity_base THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'message', format('Insufficient stock on-hand at %s. Requested return: %s %s, Available: %s %s.',
        v_location.name, p_quantity, p_unit, COALESCE(v_balance.current_quantity, 0), v_item.base_unit)
    );
  END IF;

  -- 9. Generate Human-Readable Return Reference
  v_return_number := 'SR-' || LPAD(CAST(FLOOR(random() * 900000 + 100000) AS TEXT), 6, '0');

  -- 10. Insert Immutable Supplier Return Record
  INSERT INTO public.inventory_supplier_returns (
    business_id,
    branch_id,
    supplier_id,
    grn_id,
    location_id,
    item_id,
    return_number,
    quantity,
    unit,
    quantity_base,
    unit_cost_cents,
    total_cost_cents,
    reason,
    returned_by,
    idempotency_key,
    created_at
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_supplier_id,
    p_grn_id,
    p_location_id,
    p_item_id,
    v_return_number,
    p_quantity,
    v_unit_clean,
    v_quantity_base,
    v_unit_cost_cents,
    v_total_cost_cents,
    trim(p_reason),
    p_actor_id,
    p_idempotency_key,
    now()
  ) RETURNING id INTO v_return_id;

  -- 11. Deduct Stock Balance Exactly Once
  UPDATE public.inventory_balances
  SET current_quantity = current_quantity - v_quantity_base,
      last_movement_at = now(),
      updated_at = now()
  WHERE id = v_balance.id;

  -- 12. Create Immutable Stock Movement Audit Row
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
    reference_id,
    reason,
    notes,
    actor_id,
    created_at
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_location_id,
    p_item_id,
    'supplier_return',
    'out',
    p_quantity,
    v_unit_clean,
    v_quantity_base,
    v_balance.current_quantity,
    v_balance.current_quantity - v_quantity_base,
    v_unit_cost_cents,
    v_total_cost_cents,
    COALESCE(v_supplier.currency, 'USD'),
    v_return_id::TEXT,
    trim(p_reason),
    p_notes,
    p_actor_id,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'quantity_base', v_quantity_base,
    'total_cost_cents', v_total_cost_cents,
    'message', format('Supplier return %s recorded successfully.', v_return_number)
  );
END;
$$;

-- ── 4. Secure Function Permissions ───────────────────────────────────────────

REVOKE ALL ON FUNCTION public.record_supplier_return FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_supplier_return FROM anon;
GRANT EXECUTE ON FUNCTION public.record_supplier_return TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_supplier_return TO service_role;
