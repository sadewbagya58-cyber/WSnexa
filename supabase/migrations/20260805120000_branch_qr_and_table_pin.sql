-- ============================================================================
-- WSNexa Phase 8 Architecture Migration — Branch-Level QR Codes & Table PIN
-- Migration File: 20260805120000_branch_qr_and_table_pin.sql
-- ============================================================================

-- 1. Add Branch Ordering Settings to branches table
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS require_table_selection BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS require_table_pin BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS table_pin_length INTEGER NOT NULL DEFAULT 4 CHECK (table_pin_length IN (4, 5, 6));

-- Ensure PIN cannot be required if Table Selection is disabled
DO $$ BEGIN
    ALTER TABLE public.branches
        ADD CONSTRAINT chk_pin_requires_selection 
        CHECK (NOT (require_table_pin = true AND require_table_selection = false));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add Table PIN Storage to dining_tables table (NO plain PIN stored!)
ALTER TABLE public.dining_tables
    ADD COLUMN IF NOT EXISTS table_pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS table_pin_updated_at TIMESTAMPTZ;

-- 3. Create branch_qr_codes Table
CREATE TABLE IF NOT EXISTS public.branch_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT,
    encrypted_token TEXT,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    is_active BOOLEAN NOT NULL DEFAULT true,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_regenerated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_branch_qr_revoked_not_active CHECK (NOT (is_active = true AND revoked_at IS NOT NULL))
);

-- Guarantee at most one active QR code per branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_qr_per_branch 
    ON public.branch_qr_codes(branch_id) 
    WHERE (is_active = true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_branch_qr_codes_biz_branch ON public.branch_qr_codes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_qr_codes_token_hash ON public.branch_qr_codes(token_hash);

-- 4. Enable Row Level Security (RLS) on branch_qr_codes
ALTER TABLE public.branch_qr_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for branch_qr_codes
DROP POLICY IF EXISTS p_branch_qr_codes_owner_mgr_all ON public.branch_qr_codes;
CREATE POLICY p_branch_qr_codes_owner_mgr_all ON public.branch_qr_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = branch_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = branch_qr_codes.branch_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = branch_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = branch_qr_codes.branch_id)
              )
        )
    );

DROP POLICY IF EXISTS p_branch_qr_codes_staff_read ON public.branch_qr_codes;
CREATE POLICY p_branch_qr_codes_staff_read ON public.branch_qr_codes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = branch_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND bm.role IN ('cashier', 'waiter')
              AND ba.branch_id = branch_qr_codes.branch_id
        )
    );

-- 5. Safe Data Migration: Convert first active per-table QR code into branch QR
DO $$
DECLARE
    rec RECORD;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'table_qr_codes') THEN
        FOR rec IN 
            SELECT DISTINCT ON (branch_id) id, business_id, branch_id, token_hash, token_prefix, version, is_active, generated_by, generated_at
            FROM public.table_qr_codes
            WHERE is_active = true
            ORDER BY branch_id, generated_at ASC
        LOOP
            INSERT INTO public.branch_qr_codes (
                business_id, branch_id, token_hash, token_prefix, version, is_active, generated_by, generated_at
            ) VALUES (
                rec.business_id, rec.branch_id, rec.token_hash, rec.token_prefix, rec.version, true, rec.generated_by, rec.generated_at
            ) ON CONFLICT (token_hash) DO NOTHING;
        END LOOP;

        -- Revoke obsolete per-table QR records
        UPDATE public.table_qr_codes
        SET is_active = false, revoked_at = now()
        WHERE is_active = true;
    END IF;
END $$;

-- 6. SECURITY DEFINER RPC to Resolve Public Branch Menu by Token Hash
CREATE OR REPLACE FUNCTION public.resolve_public_branch_menu(p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_qr RECORD;
    v_branch RECORD;
    v_business RECORD;
    v_service_areas JSONB;
    v_dining_tables JSONB;
    v_categories JSONB;
    v_items JSONB;
    v_result JSONB;
BEGIN
    -- 1. Find active branch QR code
    SELECT * INTO v_qr
    FROM public.branch_qr_codes
    WHERE token_hash = p_token_hash
      AND is_active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now());

    IF v_qr.id IS NULL THEN
        INSERT INTO public.qr_scan_events (is_valid, failure_reason)
        VALUES (false, 'Invalid or revoked branch QR token hash');

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR');
    END IF;

    -- 2. Validate Branch
    SELECT * INTO v_branch
    FROM public.branches
    WHERE id = v_qr.branch_id
      AND status = 'active'
      AND deleted_at IS NULL;

    IF v_branch.id IS NULL THEN
        INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, is_valid, failure_reason)
        VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, false, 'Branch inactive or archived');

        RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
    END IF;

    -- 3. Validate Business
    SELECT * INTO v_business
    FROM public.businesses
    WHERE id = v_qr.business_id;

    IF v_business.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BUSINESS_UNAVAILABLE');
    END IF;

    -- 4. Record Valid Scan Event
    INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, is_valid)
    VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, true);

    -- 5. Fetch Active Service Areas
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', sa.id,
            'name', sa.name,
            'code', sa.code,
            'display_order', sa.display_order
        ) ORDER BY sa.display_order ASC
    ), '[]'::jsonb) INTO v_service_areas
    FROM public.service_areas sa
    WHERE sa.business_id = v_qr.business_id
      AND sa.branch_id = v_qr.branch_id
      AND sa.is_active = true
      AND sa.deleted_at IS NULL;

    -- 6. Fetch Active Dining Tables (NEVER EXPOSE table_pin_hash!)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', dt.id,
            'name', dt.name,
            'code', dt.code,
            'table_number', dt.table_number,
            'capacity', dt.capacity,
            'service_area_id', dt.service_area_id,
            'has_pin', (dt.table_pin_hash IS NOT NULL)
        ) ORDER BY dt.display_order ASC
    ), '[]'::jsonb) INTO v_dining_tables
    FROM public.dining_tables dt
    WHERE dt.business_id = v_qr.business_id
      AND dt.branch_id = v_qr.branch_id
      AND dt.is_active = true
      AND dt.deleted_at IS NULL;

    -- 7. Fetch Active Categories
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'slug', c.slug,
            'description', c.description,
            'display_order', c.display_order
        ) ORDER BY c.display_order ASC
    ), '[]'::jsonb) INTO v_categories
    FROM public.menu_categories c
    WHERE c.business_id = v_qr.business_id
      AND c.branch_id = v_qr.branch_id
      AND c.is_active = true
      AND c.deleted_at IS NULL;

    -- 8. Fetch Active Menu Items with Modifiers
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', i.id,
            'category_id', i.category_id,
            'name', i.name,
            'slug', i.slug,
            'description', i.description,
            'price_cents', i.price_cents,
            'currency', i.currency,
            'availability_status', i.availability_status,
            'is_featured', i.is_featured,
            'primary_image_url', i.primary_image_url,
            'display_order', i.display_order,
            'modifier_groups', (
                SELECT COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'id', mg.id,
                        'name', mg.name,
                        'description', mg.description,
                        'selection_type', mg.selection_type,
                        'min_selections', mg.min_selections,
                        'max_selections', mg.max_selections,
                        'is_required', mg.is_required,
                        'display_order', mg.display_order,
                        'options', (
                            SELECT COALESCE(jsonb_agg(
                                jsonb_build_object(
                                    'id', mo.id,
                                    'name', mo.name,
                                    'price_cents', mo.additional_price_cents,
                                    'is_available', mo.is_active,
                                    'display_order', mo.display_order
                                ) ORDER BY mo.display_order ASC
                            ), '[]'::jsonb)
                            FROM public.modifier_options mo
                            WHERE mo.modifier_group_id = mg.id
                              AND mo.is_active = true
                              AND mo.deleted_at IS NULL
                        )
                    ) ORDER BY mg.display_order ASC
                ), '[]'::jsonb)
                FROM public.modifier_groups mg
                WHERE mg.menu_item_id = i.id
                  AND mg.is_active = true
                  AND mg.deleted_at IS NULL
            )
        ) ORDER BY i.display_order ASC
    ), '[]'::jsonb) INTO v_items
    FROM public.menu_items i
    WHERE i.business_id = v_qr.business_id
      AND i.branch_id = v_qr.branch_id
      AND i.is_active = true
      AND i.deleted_at IS NULL
      AND i.availability_status <> 'hidden';

    -- 9. Construct Final Payload
    v_result := jsonb_build_object(
        'success', true,
        'business', jsonb_build_object(
            'id', v_business.id,
            'name', v_business.name,
            'logo_url', v_business.logo_url,
            'description', v_business.description,
            'currency', v_business.default_currency
        ),
        'branch', jsonb_build_object(
            'id', v_branch.id,
            'name', v_branch.name,
            'code', v_branch.code,
            'phone', v_branch.phone,
            'address_line1', v_branch.address_line_1,
            'city', v_branch.city,
            'require_table_selection', v_branch.require_table_selection,
            'require_table_pin', v_branch.require_table_pin,
            'table_pin_length', v_branch.table_pin_length
        ),
        'service_areas', v_service_areas,
        'dining_tables', v_dining_tables,
        'categories', v_categories,
        'items', v_items
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant EXECUTE to public/anon for the branch public menu resolver
GRANT EXECUTE ON FUNCTION public.resolve_public_branch_menu(TEXT) TO anon, authenticated;

-- 7. SECURITY DEFINER RPC for Table & PIN Checkout Verification
CREATE OR REPLACE FUNCTION public.verify_table_checkout_access(
    p_branch_id UUID,
    p_table_id UUID,
    p_pin_hash TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_branch RECORD;
    v_table RECORD;
BEGIN
    -- 1. Fetch Branch Settings
    SELECT id, status, require_table_selection, require_table_pin, deleted_at
    INTO v_branch
    FROM public.branches
    WHERE id = p_branch_id;

    IF v_branch.id IS NULL OR v_branch.status <> 'active' OR v_branch.deleted_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
    END IF;

    -- If table selection is disabled, bypass table check
    IF v_branch.require_table_selection = false THEN
        RETURN jsonb_build_object('success', true, 'bypass_table', true);
    END IF;

    -- 2. Fetch Dining Table
    SELECT id, name, code, table_number, capacity, branch_id, table_pin_hash, is_active, deleted_at
    INTO v_table
    FROM public.dining_tables
    WHERE id = p_table_id;

    IF v_table.id IS NULL OR v_table.branch_id <> p_branch_id OR v_table.is_active = false OR v_table.deleted_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_NOT_FOUND');
    END IF;

    -- 3. Check Table PIN if enabled
    IF v_branch.require_table_pin = true THEN
        IF v_table.table_pin_hash IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'PIN_NOT_CONFIGURED');
        END IF;

        IF p_pin_hash IS NULL OR p_pin_hash <> v_table.table_pin_hash THEN
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_PIN');
        END IF;
    END IF;

    -- Success
    RETURN jsonb_build_object(
        'success', true,
        'table', jsonb_build_object(
            'id', v_table.id,
            'name', v_table.name,
            'code', v_table.code,
            'table_number', v_table.table_number,
            'capacity', v_table.capacity
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.verify_table_checkout_access(UUID, UUID, TEXT) TO anon, authenticated;
