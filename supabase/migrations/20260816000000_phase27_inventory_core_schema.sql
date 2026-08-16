-- Migration: 20260816000000_phase27_inventory_core_schema.sql
-- Description: Creates Phase 27 Advanced Inventory Core schema, RLS policies, indexes, and atomic RPCs

-- ============================================================================
-- 1. NORMALIZE & SEED INVENTORY PERMISSIONS & ROLE GRANTS
-- ============================================================================

-- 1.1 Safely deduplicate historical duplicate built-in role permissions (preserving earliest created row)
DELETE FROM public.role_permissions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY role_key, permission_key
        ORDER BY created_at ASC, id ASC
      ) AS rnum
    FROM public.role_permissions
    WHERE custom_role_id IS NULL
      AND business_id IS NULL
  ) duplicates
  WHERE duplicates.rnum > 1
);

-- 1.2 Safely deduplicate any duplicate custom role permissions (if present)
DELETE FROM public.role_permissions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY custom_role_id, permission_key
        ORDER BY created_at ASC, id ASC
      ) AS rnum
    FROM public.role_permissions
    WHERE custom_role_id IS NOT NULL
  ) duplicates
  WHERE duplicates.rnum > 1
);

-- 1.3 Ensure unique indexes exist for built-in and custom role permissions
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permissions_builtin
  ON public.role_permissions (role_key, permission_key)
  WHERE custom_role_id IS NULL AND business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permissions_custom
  ON public.role_permissions (custom_role_id, permission_key)
  WHERE custom_role_id IS NOT NULL;

-- 1.4 Seed Phase 27 inventory permissions catalog
INSERT INTO public.permissions (key, name, description, category, risk_level) VALUES
  ('inventory.view', 'View Inventory', 'View stock balances, inventory items, and storage locations', 'Inventory', 'low'),
  ('inventory.items.manage', 'Manage Inventory Items', 'Create, edit, and archive inventory items and categories', 'Inventory', 'medium'),
  ('inventory.costs.view', 'View Inventory Costs & Valuation', 'View unit costs, total stock valuation, variance values, and waste cost metrics', 'Inventory', 'high'),
  ('inventory.adjust', 'Adjust Stock Levels', 'Perform manual stock additions, deductions, and opening balance corrections', 'Inventory', 'high'),
  ('inventory.counts.manage', 'Perform Stock Counts', 'Create, conduct, and submit physical stock audit sheets', 'Inventory', 'medium'),
  ('inventory.counts.approve', 'Approve Stock Counts', 'Approve physical stock count variances and commit balance reconciliations', 'Inventory', 'high'),
  ('inventory.waste.record', 'Record Waste & Spoilage', 'Record kitchen and bar food/beverage waste with reason codes', 'Inventory', 'medium'),
  ('inventory.transfers.manage', 'Manage Stock Transfers', 'Create, dispatch, and cancel same-branch and cross-branch stock transfers', 'Inventory', 'medium'),
  ('inventory.transfers.receive', 'Receive Stock Transfers', 'Acknowledge, verify, and receive inbound stock transfers with discrepancy tracking', 'Inventory', 'medium'),
  ('inventory.locations.manage', 'Manage Storage Locations', 'Create, edit, and archive branch storage locations', 'Inventory', 'medium'),
  ('inventory.reports.view', 'View Inventory Analytics', 'View inventory health scores, waste trends, and stock valuation summaries', 'Inventory', 'low')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- Grant permissions to default role templates
-- Branch Manager: Full operational inventory access
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('branch_manager', 'inventory.view'),
  ('branch_manager', 'inventory.items.manage'),
  ('branch_manager', 'inventory.costs.view'),
  ('branch_manager', 'inventory.adjust'),
  ('branch_manager', 'inventory.counts.manage'),
  ('branch_manager', 'inventory.counts.approve'),
  ('branch_manager', 'inventory.waste.record'),
  ('branch_manager', 'inventory.transfers.manage'),
  ('branch_manager', 'inventory.transfers.receive'),
  ('branch_manager', 'inventory.locations.manage'),
  ('branch_manager', 'inventory.reports.view'),
  -- Kitchen Staff: Physical stock viewing, counting, and waste recording (cost-redacted by default)
  ('kitchen_staff', 'inventory.view'),
  ('kitchen_staff', 'inventory.counts.manage'),
  ('kitchen_staff', 'inventory.waste.record')
ON CONFLICT (role_key, permission_key) WHERE custom_role_id IS NULL AND business_id IS NULL DO NOTHING;

-- ============================================================================
-- 2. INVENTORY CATEGORIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📦',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_categories_business_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_categories_business ON public.inventory_categories(business_id);

-- ============================================================================
-- 3. INVENTORY UNITS (Standard & Custom Units)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('weight', 'volume', 'count', 'custom')),
  base_unit_code TEXT,
  conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_units_global_code
  ON public.inventory_units (code)
  WHERE business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_units_tenant_code
  ON public.inventory_units (business_id, code)
  WHERE business_id IS NOT NULL;

-- Seed global standard units (business_id is NULL for platform global standards)
INSERT INTO public.inventory_units (business_id, code, name, unit_type, base_unit_code, conversion_factor) VALUES
  (NULL, 'kg', 'Kilogram', 'weight', 'kg', 1.0),
  (NULL, 'g', 'Gram', 'weight', 'kg', 0.001),
  (NULL, 'l', 'Litre', 'volume', 'l', 1.0),
  (NULL, 'ml', 'Millilitre', 'volume', 'l', 0.001),
  (NULL, 'pcs', 'Pieces', 'count', 'pcs', 1.0),
  (NULL, 'bottle', 'Bottle', 'count', 'pcs', 1.0),
  (NULL, 'can', 'Can', 'count', 'pcs', 1.0),
  (NULL, 'pack', 'Pack', 'count', 'pcs', 1.0),
  (NULL, 'box', 'Box', 'count', 'pcs', 1.0),
  (NULL, 'portion', 'Portion', 'count', 'pcs', 1.0)
ON CONFLICT (code) WHERE business_id IS NULL DO NOTHING;

-- ============================================================================
-- 4. INVENTORY STORAGE LOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_inventory_locations_branch_code UNIQUE (branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_branch ON public.inventory_storage_locations(branch_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 5. INVENTORY ITEMS (Canonical Business Catalog)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  item_type TEXT NOT NULL DEFAULT 'raw_ingredient' CHECK (item_type IN ('raw_ingredient', 'semi_finished', 'finished_item', 'packaging', 'operational_supply')),
  base_unit TEXT NOT NULL,
  cost_per_unit_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  min_stock_level NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  target_stock_level NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  track_batches BOOLEAN NOT NULL DEFAULT false,
  track_expiry BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  CONSTRAINT uq_inventory_items_biz_name UNIQUE (business_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_biz_active ON public.inventory_items(business_id, is_active) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(business_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_barcode ON public.inventory_items(business_id, barcode) WHERE barcode IS NOT NULL;

-- ============================================================================
-- 6. INVENTORY BALANCES (Fast-Read Branch + Location Stock)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  current_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  reserved_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  last_movement_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_balances_branch_loc_item UNIQUE (branch_id, location_id, item_id),
  CONSTRAINT chk_inventory_balances_non_negative CHECK (current_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_branch_loc ON public.inventory_balances(branch_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_balances_item ON public.inventory_balances(item_id);

-- ============================================================================
-- 7. INVENTORY ITEM BATCHES (Optional Batch & Expiry Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  batch_code TEXT NOT NULL,
  initial_quantity NUMERIC(15, 4) NOT NULL,
  remaining_quantity NUMERIC(15, 4) NOT NULL CHECK (remaining_quantity >= 0),
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_branch ON public.inventory_item_batches(item_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON public.inventory_item_batches(expiry_date) WHERE status = 'active';

-- ============================================================================
-- 8. INVENTORY STOCK MOVEMENTS (Immutable Audit-Proof Ledger)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_item_batches(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
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
    'recipe_consumption_reserved'
  )),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out', 'set')),
  quantity NUMERIC(15, 4) NOT NULL,
  unit TEXT NOT NULL,
  quantity_base NUMERIC(15, 4) NOT NULL,
  previous_balance_base NUMERIC(15, 4) NOT NULL,
  new_balance_base NUMERIC(15, 4) NOT NULL,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  total_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  reason TEXT,
  notes TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_created ON public.inventory_stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_created ON public.inventory_stock_movements(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_stock_movements(movement_type);

-- ============================================================================
-- 9. INVENTORY STOCK COUNTS & COUNT ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  count_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'counting', 'submitted', 'approved', 'cancelled')),
  is_blind_count BOOLEAN NOT NULL DEFAULT false,
  category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  counted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  total_items_counted INT NOT NULL DEFAULT 0,
  total_variance_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_counts_branch ON public.inventory_stock_counts(branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES public.inventory_stock_counts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  expected_quantity_base NUMERIC(15, 4) NOT NULL DEFAULT 0.0,
  counted_quantity_base NUMERIC(15, 4),
  counted_unit TEXT,
  counted_raw_quantity NUMERIC(15, 4),
  variance_quantity_base NUMERIC(15, 4),
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  variance_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  notes TEXT,
  is_counted BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT uq_inventory_count_items UNIQUE (count_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_count_items_count ON public.inventory_stock_count_items(count_id);

-- ============================================================================
-- 10. INVENTORY WASTE RECORDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_waste_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_item_batches(id) ON DELETE SET NULL,
  quantity NUMERIC(15, 4) NOT NULL,
  unit TEXT NOT NULL,
  quantity_base NUMERIC(15, 4) NOT NULL,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  total_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  reason TEXT NOT NULL CHECK (reason IN ('expired', 'spoiled', 'prep_waste', 'overcooked', 'dropped', 'customer_return', 'staff_meal', 'damaged', 'other')),
  notes TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  movement_id UUID REFERENCES public.inventory_stock_movements(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_waste_branch_date ON public.inventory_waste_records(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_waste_item ON public.inventory_waste_records(item_id);

-- ============================================================================
-- 11. INVENTORY STOCK TRANSFERS & TRANSFER ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  source_location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  destination_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  destination_location_id UUID NOT NULL REFERENCES public.inventory_storage_locations(id) ON DELETE RESTRICT,
  transfer_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'in_transit', 'received', 'cancelled')),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  discrepancy_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfers_source_branch ON public.inventory_stock_transfers(source_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transfers_dest_branch ON public.inventory_stock_transfers(destination_branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.inventory_stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.inventory_stock_transfers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES public.inventory_item_batches(id) ON DELETE SET NULL,
  quantity_sent NUMERIC(15, 4) NOT NULL,
  unit_sent TEXT NOT NULL,
  quantity_sent_base NUMERIC(15, 4) NOT NULL,
  quantity_received_base NUMERIC(15, 4),
  discrepancy_quantity_base NUMERIC(15, 4) DEFAULT 0.0,
  unit_cost_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  CONSTRAINT uq_inventory_transfer_items UNIQUE (transfer_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_transfer_items_transfer ON public.inventory_stock_transfer_items(transfer_id);

-- ============================================================================
-- 12. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Helper RLS policies for authenticated members of the business
CREATE POLICY "Allow members read inventory_categories" ON public.inventory_categories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_categories.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_units" ON public.inventory_units
  FOR SELECT TO authenticated
  USING (business_id IS NULL OR EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_units.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_storage_locations" ON public.inventory_storage_locations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_storage_locations.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_items" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_items.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_balances" ON public.inventory_balances
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_balances.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_item_batches" ON public.inventory_item_batches
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_item_batches.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_stock_movements" ON public.inventory_stock_movements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_stock_movements.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_stock_counts" ON public.inventory_stock_counts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_stock_counts.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_stock_count_items" ON public.inventory_stock_count_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_stock_counts sc JOIN public.business_memberships bm ON bm.business_id = sc.business_id WHERE sc.id = inventory_stock_count_items.count_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_waste_records" ON public.inventory_waste_records
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_waste_records.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_stock_transfers" ON public.inventory_stock_transfers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.business_memberships bm WHERE bm.business_id = inventory_stock_transfers.business_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

CREATE POLICY "Allow members read inventory_stock_transfer_items" ON public.inventory_stock_transfer_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.inventory_stock_transfers st JOIN public.business_memberships bm ON bm.business_id = st.business_id WHERE st.id = inventory_stock_transfer_items.transfer_id AND bm.user_id = auth.uid() AND bm.membership_status = 'active'));

-- ============================================================================
-- 13. ATOMIC POSTGRESQL TRANSACTION RPCS
-- ============================================================================

-- Function: get_or_create_default_storage_location
CREATE OR REPLACE FUNCTION public.get_or_create_default_storage_location(
  p_business_id UUID,
  p_branch_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_loc_id UUID;
BEGIN
  SELECT id INTO v_loc_id
  FROM public.inventory_storage_locations
  WHERE branch_id = p_branch_id AND is_default = true AND deleted_at IS NULL
  LIMIT 1;

  IF v_loc_id IS NULL THEN
    -- Try any active location in branch
    SELECT id INTO v_loc_id
    FROM public.inventory_storage_locations
    WHERE branch_id = p_branch_id AND deleted_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_loc_id IS NULL THEN
    -- Insert default 'Main Stock' location
    INSERT INTO public.inventory_storage_locations (
      business_id,
      branch_id,
      name,
      code,
      description,
      is_default,
      is_active
    ) VALUES (
      p_business_id,
      p_branch_id,
      'Main Stock',
      'MAIN_STORE',
      'Default primary storage location for this outlet',
      true,
      true
    )
    RETURNING id INTO v_loc_id;
  END IF;

  RETURN v_loc_id;
END;
$$;

-- Function: record_inventory_adjustment
CREATE OR REPLACE FUNCTION public.record_inventory_adjustment(
  p_business_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_item_id UUID,
  p_direction TEXT, -- 'in', 'out', 'set'
  p_quantity NUMERIC,
  p_unit TEXT,
  p_quantity_base NUMERIC,
  p_reason TEXT,
  p_notes TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT,
  p_movement_type TEXT DEFAULT 'adjustment_add'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_movement_id UUID;
  v_item RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4) := 0.0;
  v_new_qty NUMERIC(15, 4) := 0.0;
  v_movement_id UUID;
  v_total_cost BIGINT := 0;
  v_direction TEXT := p_direction;
  v_mov_type TEXT := p_movement_type;
BEGIN
  -- 1. Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_movement_id
    FROM public.inventory_stock_movements
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_movement_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'movement_id', v_existing_movement_id,
        'message', 'Duplicate adjustment request acknowledged.'
      );
    END IF;
  END IF;

  -- 2. Verify Item exists and belongs to business
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id AND business_id = p_business_id AND archived_at IS NULL;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ITEM_NOT_FOUND', 'message', 'Inventory item not found or archived.');
  END IF;

  -- 3. Lock or initialize Balance row with row-level lock
  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE branch_id = p_branch_id AND location_id = p_location_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_balance.id IS NOT NULL THEN
    v_current_qty := v_balance.current_quantity;
  ELSE
    v_current_qty := 0.0;
  END IF;

  -- 4. Calculate new quantity based on direction
  IF v_direction = 'in' THEN
    v_new_qty := v_current_qty + p_quantity_base;
    IF v_mov_type IS NULL OR v_mov_type = '' THEN
      v_mov_type := 'adjustment_add';
    END IF;
  ELSIF v_direction = 'out' THEN
    IF v_current_qty < p_quantity_base THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'message', 'Insufficient stock in storage location. Available: ' || v_current_qty || ' ' || v_item.base_unit || ', requested: ' || p_quantity_base || ' ' || v_item.base_unit
      );
    END IF;
    v_new_qty := v_current_qty - p_quantity_base;
    IF v_mov_type IS NULL OR v_mov_type = '' THEN
      v_mov_type := 'adjustment_remove';
    END IF;
  ELSIF v_direction = 'set' THEN
    IF p_quantity_base < 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'NEGATIVE_STOCK_NOT_ALLOWED', 'message', 'Quantity cannot be negative.');
    END IF;
    v_new_qty := p_quantity_base;
    IF v_new_qty >= v_current_qty THEN
      v_direction := 'in';
    ELSE
      v_direction := 'out';
    END IF;
    IF v_mov_type IS NULL OR v_mov_type = '' THEN
      v_mov_type := 'opening_balance';
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DIRECTION', 'message', 'Invalid movement direction.');
  END IF;

  -- 5. Calculate cost snapshot
  v_total_cost := ROUND(p_quantity_base * v_item.cost_per_unit_cents);

  -- 6. Upsert balance
  IF v_balance.id IS NOT NULL THEN
    UPDATE public.inventory_balances
    SET current_quantity = v_new_qty,
        last_movement_at = now(),
        updated_at = now()
    WHERE id = v_balance.id;
  ELSE
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
      p_item_id,
      v_new_qty,
      0.0,
      now(),
      now()
    );
  END IF;

  -- 7. Insert immutable stock movement
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
    notes,
    actor_id,
    idempotency_key
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_location_id,
    p_item_id,
    v_mov_type,
    p_direction,
    p_quantity,
    p_unit,
    p_quantity_base,
    v_current_qty,
    v_new_qty,
    v_item.cost_per_unit_cents,
    v_total_cost,
    v_item.currency,
    p_reason,
    p_notes,
    p_actor_id,
    p_idempotency_key
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'previous_quantity', v_current_qty,
    'new_quantity', v_new_qty,
    'base_unit', v_item.base_unit,
    'currency', v_item.currency,
    'cost_cents', v_total_cost
  );
END;
$$;

-- Function: record_inventory_waste
CREATE OR REPLACE FUNCTION public.record_inventory_waste(
  p_business_id UUID,
  p_branch_id UUID,
  p_location_id UUID,
  p_item_id UUID,
  p_batch_id UUID,
  p_quantity NUMERIC,
  p_unit TEXT,
  p_quantity_base NUMERIC,
  p_reason TEXT,
  p_notes TEXT,
  p_actor_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_waste_id UUID;
  v_item RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4) := 0.0;
  v_new_qty NUMERIC(15, 4) := 0.0;
  v_movement_id UUID;
  v_waste_id UUID;
  v_total_cost BIGINT := 0;
BEGIN
  -- 1. Idempotency Check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_waste_id
    FROM public.inventory_waste_records
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_waste_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'is_duplicate', true,
        'waste_id', v_existing_waste_id,
        'message', 'Duplicate waste recording acknowledged.'
      );
    END IF;
  END IF;

  -- 2. Verify Item
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id AND business_id = p_business_id AND archived_at IS NULL;

  IF v_item.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ITEM_NOT_FOUND', 'message', 'Inventory item not found.');
  END IF;

  -- 3. Lock balance
  SELECT * INTO v_balance
  FROM public.inventory_balances
  WHERE branch_id = p_branch_id AND location_id = p_location_id AND item_id = p_item_id
  FOR UPDATE;

  IF v_balance.id IS NULL OR v_balance.current_quantity < p_quantity_base THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_STOCK',
      'message', 'Cannot record waste exceeding available stock (' || COALESCE(v_balance.current_quantity, 0) || ' ' || v_item.base_unit || ' available).'
    );
  END IF;

  v_current_qty := v_balance.current_quantity;
  v_new_qty := v_current_qty - p_quantity_base;
  v_total_cost := ROUND(p_quantity_base * v_item.cost_per_unit_cents);

  -- 4. Deduct balance
  UPDATE public.inventory_balances
  SET current_quantity = v_new_qty,
      last_movement_at = now(),
      updated_at = now()
  WHERE id = v_balance.id;

  -- 5. Insert Movement
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
    notes,
    actor_id,
    idempotency_key
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_location_id,
    p_item_id,
    p_batch_id,
    'waste',
    'out',
    p_quantity,
    p_unit,
    p_quantity_base,
    v_current_qty,
    v_new_qty,
    v_item.cost_per_unit_cents,
    v_total_cost,
    v_item.currency,
    p_reason,
    p_notes,
    p_actor_id,
    p_idempotency_key
  )
  RETURNING id INTO v_movement_id;

  -- 6. Insert Waste Record
  INSERT INTO public.inventory_waste_records (
    business_id,
    branch_id,
    location_id,
    item_id,
    batch_id,
    quantity,
    unit,
    quantity_base,
    unit_cost_cents,
    total_cost_cents,
    currency,
    reason,
    notes,
    actor_id,
    movement_id,
    idempotency_key
  ) VALUES (
    p_business_id,
    p_branch_id,
    p_location_id,
    p_item_id,
    p_batch_id,
    p_quantity,
    p_unit,
    p_quantity_base,
    v_item.cost_per_unit_cents,
    v_total_cost,
    v_item.currency,
    p_reason,
    p_notes,
    p_actor_id,
    v_movement_id,
    p_idempotency_key
  )
  RETURNING id INTO v_waste_id;

  RETURN jsonb_build_object(
    'success', true,
    'waste_id', v_waste_id,
    'movement_id', v_movement_id,
    'previous_quantity', v_current_qty,
    'new_quantity', v_new_qty,
    'total_cost_cents', v_total_cost,
    'currency', v_item.currency
  );
END;
$$;

-- Function: execute_stock_transfer_send
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_send(
  p_transfer_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_balance RECORD;
  v_new_qty NUMERIC(15, 4);
BEGIN
  -- 1. Fetch Transfer
  SELECT * INTO v_transfer
  FROM public.inventory_stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF v_transfer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TRANSFER_NOT_FOUND');
  END IF;

  IF v_transfer.status <> 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Transfer is already ' || v_transfer.status);
  END IF;

  -- 2. Deduct all items from source location
  FOR v_item IN
    SELECT ti.*, ii.base_unit, ii.currency, ii.cost_per_unit_cents
    FROM public.inventory_stock_transfer_items ti
    JOIN public.inventory_items ii ON ii.id = ti.item_id
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE branch_id = v_transfer.source_branch_id
      AND location_id = v_transfer.source_location_id
      AND item_id = v_item.item_id
    FOR UPDATE;

    IF v_balance.id IS NULL OR v_balance.current_quantity < v_item.quantity_sent_base THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INSUFFICIENT_STOCK',
        'message', 'Insufficient stock for item at source location. Required: ' || v_item.quantity_sent_base
      );
    END IF;

    v_new_qty := v_balance.current_quantity - v_item.quantity_sent_base;

    UPDATE public.inventory_balances
    SET current_quantity = v_new_qty,
        last_movement_at = now(),
        updated_at = now()
    WHERE id = v_balance.id;

    -- Record transfer_out movement
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
      v_transfer.business_id,
      v_transfer.source_branch_id,
      v_transfer.source_location_id,
      v_item.item_id,
      v_item.batch_id,
      'transfer_out',
      'out',
      v_item.quantity_sent,
      v_item.unit_sent,
      v_item.quantity_sent_base,
      v_balance.current_quantity,
      v_new_qty,
      v_item.cost_per_unit_cents,
      ROUND(v_item.quantity_sent_base * v_item.cost_per_unit_cents),
      v_item.currency,
      'Stock Transfer #' || v_transfer.transfer_number || ' dispatch',
      p_actor_id,
      v_transfer.id::text
    );
  END LOOP;

  -- 3. Update transfer status
  UPDATE public.inventory_stock_transfers
  SET status = 'in_transit',
      sent_by = p_actor_id,
      sent_at = now(),
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'in_transit');
END;
$$;

-- Function: execute_stock_transfer_receive
CREATE OR REPLACE FUNCTION public.execute_stock_transfer_receive(
  p_transfer_id UUID,
  p_actor_id UUID,
  p_received_items JSONB, -- Array of { item_id, quantity_received_base }
  p_discrepancy_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_rec_entry JSONB;
  v_rec_qty NUMERIC(15, 4);
  v_discrepancy NUMERIC(15, 4);
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_new_qty NUMERIC(15, 4);
BEGIN
  -- 1. Fetch Transfer
  SELECT * INTO v_transfer
  FROM public.inventory_stock_transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF v_transfer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'TRANSFER_NOT_FOUND');
  END IF;

  IF v_transfer.status <> 'in_transit' AND v_transfer.status <> 'sent' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Transfer cannot be received. Current status: ' || v_transfer.status);
  END IF;

  -- 2. Process Received Items
  FOR v_item IN
    SELECT ti.*, ii.base_unit, ii.currency, ii.cost_per_unit_cents
    FROM public.inventory_stock_transfer_items ti
    JOIN public.inventory_items ii ON ii.id = ti.item_id
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    -- Look for entry in p_received_items
    v_rec_qty := v_item.quantity_sent_base; -- default to full sent quantity
    IF p_received_items IS NOT NULL AND jsonb_array_length(p_received_items) > 0 THEN
      FOR v_rec_entry IN SELECT * FROM jsonb_array_elements(p_received_items)
      LOOP
        IF (v_rec_entry->>'item_id')::uuid = v_item.item_id THEN
          v_rec_qty := (v_rec_entry->>'quantity_received_base')::numeric;
        END IF;
      END LOOP;
    END IF;

    IF v_rec_qty < 0 THEN
      v_rec_qty := 0;
    END IF;

    v_discrepancy := v_rec_qty - v_item.quantity_sent_base;

    -- Update transfer item
    UPDATE public.inventory_stock_transfer_items
    SET quantity_received_base = v_rec_qty,
        discrepancy_quantity_base = v_discrepancy
    WHERE id = v_item.id;

    -- Upsert destination balance
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE branch_id = v_transfer.destination_branch_id
      AND location_id = v_transfer.destination_location_id
      AND item_id = v_item.item_id
    FOR UPDATE;

    IF v_balance.id IS NOT NULL THEN
      v_current_qty := v_balance.current_quantity;
      v_new_qty := v_current_qty + v_rec_qty;

      UPDATE public.inventory_balances
      SET current_quantity = v_new_qty,
          last_movement_at = now(),
          updated_at = now()
      WHERE id = v_balance.id;
    ELSE
      v_current_qty := 0.0;
      v_new_qty := v_rec_qty;

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
        v_transfer.business_id,
        v_transfer.destination_branch_id,
        v_transfer.destination_location_id,
        v_item.item_id,
        v_new_qty,
        0.0,
        now(),
        now()
      );
    END IF;

    -- Record transfer_in movement
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
      v_transfer.business_id,
      v_transfer.destination_branch_id,
      v_transfer.destination_location_id,
      v_item.item_id,
      v_item.batch_id,
      'transfer_in',
      'in',
      v_rec_qty,
      v_item.base_unit,
      v_rec_qty,
      v_current_qty,
      v_new_qty,
      v_item.cost_per_unit_cents,
      ROUND(v_rec_qty * v_item.cost_per_unit_cents),
      v_item.currency,
      'Stock Transfer #' || v_transfer.transfer_number || ' receipt',
      p_actor_id,
      v_transfer.id::text
    );

    -- If discrepancy exists, record audit discrepancy movement
    IF v_discrepancy <> 0 THEN
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
        notes,
        actor_id,
        reference_id
      ) VALUES (
        v_transfer.business_id,
        v_transfer.destination_branch_id,
        v_transfer.destination_location_id,
        v_item.item_id,
        v_item.batch_id,
        'transfer_discrepancy',
        CASE WHEN v_discrepancy > 0 THEN 'in' ELSE 'out' END,
        ABS(v_discrepancy),
        v_item.base_unit,
        v_discrepancy,
        v_new_qty,
        v_new_qty,
        v_item.cost_per_unit_cents,
        ROUND(ABS(v_discrepancy) * v_item.cost_per_unit_cents),
        v_item.currency,
        'Transfer discrepancy: ' || COALESCE(p_discrepancy_reason, 'Unspecified transit variance'),
        p_discrepancy_reason,
        p_actor_id,
        v_transfer.id::text
      );
    END IF;
  END LOOP;

  -- 3. Update transfer status
  UPDATE public.inventory_stock_transfers
  SET status = 'received',
      received_by = p_actor_id,
      received_at = now(),
      discrepancy_reason = p_discrepancy_reason,
      updated_at = now()
  WHERE id = p_transfer_id;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id, 'status', 'received');
END;
$$;

-- Function: approve_stock_count_and_reconcile
CREATE OR REPLACE FUNCTION public.approve_stock_count_and_reconcile(
  p_count_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count RECORD;
  v_item RECORD;
  v_balance RECORD;
  v_current_qty NUMERIC(15, 4);
  v_variance NUMERIC(15, 4);
  v_total_var_cost BIGINT := 0;
  v_item_var_cost BIGINT := 0;
BEGIN
  -- 1. Fetch Count
  SELECT * INTO v_count
  FROM public.inventory_stock_counts
  WHERE id = p_count_id
  FOR UPDATE;

  IF v_count.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'COUNT_NOT_FOUND');
  END IF;

  IF v_count.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_APPROVED', 'message', 'This stock count has already been approved.');
  END IF;

  IF v_count.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANCELLED_COUNT', 'message', 'Cannot approve a cancelled count.');
  END IF;

  -- 2. Process each count item and generate variance adjustments
  FOR v_item IN
    SELECT ci.*, ii.base_unit, ii.currency, ii.cost_per_unit_cents
    FROM public.inventory_stock_count_items ci
    JOIN public.inventory_items ii ON ii.id = ci.item_id
    WHERE ci.count_id = p_count_id
  LOOP
    IF v_item.is_counted THEN
      -- Lock balance
      SELECT * INTO v_balance
      FROM public.inventory_balances
      WHERE branch_id = v_count.branch_id
        AND location_id = v_count.location_id
        AND item_id = v_item.item_id
      FOR UPDATE;

      IF v_balance.id IS NOT NULL THEN
        v_current_qty := v_balance.current_quantity;
      ELSE
        v_current_qty := 0.0;
      END IF;

      v_variance := v_item.counted_quantity_base - v_current_qty;
      v_item_var_cost := ROUND(v_variance * v_item.cost_per_unit_cents);
      v_total_var_cost := v_total_var_cost + v_item_var_cost;

      -- If variance exists, apply adjustment
      IF v_variance <> 0 THEN
        -- Upsert balance to counted_quantity_base
        IF v_balance.id IS NOT NULL THEN
          UPDATE public.inventory_balances
          SET current_quantity = v_item.counted_quantity_base,
              last_movement_at = now(),
              updated_at = now()
          WHERE id = v_balance.id;
        ELSE
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
            v_count.business_id,
            v_count.branch_id,
            v_count.location_id,
            v_item.item_id,
            v_item.counted_quantity_base,
            0.0,
            now(),
            now()
          );
        END IF;

        -- Record movement
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
          v_count.business_id,
          v_count.branch_id,
          v_count.location_id,
          v_item.item_id,
          'stock_count_adjustment',
          CASE WHEN v_variance > 0 THEN 'in' ELSE 'out' END,
          ABS(v_variance),
          v_item.base_unit,
          v_variance,
          v_current_qty,
          v_item.counted_quantity_base,
          v_item.cost_per_unit_cents,
          ABS(v_item_var_cost),
          v_item.currency,
          'Stock Count #' || v_count.count_number || ' reconciliation',
          p_actor_id,
          v_count.id::text
        );
      END IF;

      -- Update count item variance
      UPDATE public.inventory_stock_count_items
      SET variance_quantity_base = v_variance,
          variance_cost_cents = v_item_var_cost,
          unit_cost_cents = v_item.cost_per_unit_cents
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  -- 3. Update count status
  UPDATE public.inventory_stock_counts
  SET status = 'approved',
      approved_by = p_actor_id,
      approved_at = now(),
      total_variance_cost_cents = v_total_var_cost,
      updated_at = now()
  WHERE id = p_count_id;

  RETURN jsonb_build_object(
    'success', true,
    'count_id', p_count_id,
    'status', 'approved',
    'total_variance_cost_cents', v_total_var_cost
  );
END;
$$;
