-- Migration: Phase 28 — Purchase Price History & Cost Trend Tracking
-- Version: 20260817030000

CREATE TABLE IF NOT EXISTS public.inventory_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  supplier_id UUID NULL REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('catalog', 'purchase_order', 'goods_receipt', 'manual_adjustment')),
  source_id UUID NULL,
  purchasing_unit TEXT NOT NULL,
  conversion_to_base NUMERIC(15, 4) NOT NULL DEFAULT 1.0 CHECK (conversion_to_base > 0),
  pack_price_cents INT NOT NULL CHECK (pack_price_cents >= 0),
  normalized_price_per_base_cents INT NOT NULL CHECK (normalized_price_per_base_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  reference_number TEXT NULL,
  notes TEXT NULL,
  recorded_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance and multi-tenant scoping
CREATE INDEX IF NOT EXISTS idx_price_history_item_date
  ON public.inventory_price_history (business_id, item_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_supplier_item
  ON public.inventory_price_history (business_id, supplier_id, item_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_branch_date
  ON public.inventory_price_history (branch_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_source
  ON public.inventory_price_history (source_type, source_id);

-- Enable RLS
ALTER TABLE public.inventory_price_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view price history within their business" ON public.inventory_price_history;
  CREATE POLICY "Users can view price history within their business"
    ON public.inventory_price_history
    FOR SELECT
    TO authenticated
    USING (business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid);
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can insert price history within their business" ON public.inventory_price_history;
  CREATE POLICY "Users can insert price history within their business"
    ON public.inventory_price_history
    FOR INSERT
    TO authenticated
    WITH CHECK (business_id = (auth.jwt() -> 'app_metadata' ->> 'business_id')::uuid);
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Baseline backfill: for any existing supplier items, insert baseline catalog price history if none exists
INSERT INTO public.inventory_price_history (
  business_id,
  item_id,
  supplier_id,
  source_type,
  source_id,
  purchasing_unit,
  conversion_to_base,
  pack_price_cents,
  normalized_price_per_base_cents,
  currency,
  notes,
  recorded_at
)
SELECT
  s.business_id,
  si.item_id,
  si.supplier_id,
  'catalog',
  si.id,
  si.purchasing_unit,
  si.conversion_to_base,
  si.last_price_cents,
  CASE 
    WHEN si.conversion_to_base > 0 THEN ROUND(si.last_price_cents / si.conversion_to_base)
    ELSE si.last_price_cents
  END,
  si.currency,
  'Baseline catalog pricing',
  si.created_at
FROM public.inventory_supplier_items si
JOIN public.inventory_suppliers s ON s.id = si.supplier_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.inventory_price_history ph
  WHERE ph.supplier_id = si.supplier_id 
    AND ph.item_id = si.item_id 
    AND ph.source_type = 'catalog'
);
