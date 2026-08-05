-- ============================================================================
-- WSNexa Phase 8 Migration — Secure Table QR Codes & Public Digital Menu
-- Migration File: 20260805000000_phase8_table_qr_codes.sql
-- ============================================================================

-- 1. Create table_qr_codes Table
CREATE TABLE IF NOT EXISTS public.table_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    dining_table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT,
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
    CONSTRAINT chk_revoked_not_active CHECK (NOT (is_active = true AND revoked_at IS NOT NULL))
);

-- Guarantee at most one active QR code per dining table
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_qr_per_table 
    ON public.table_qr_codes(dining_table_id) 
    WHERE (is_active = true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_table_qr_codes_biz_branch ON public.table_qr_codes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_table_qr_codes_token_hash ON public.table_qr_codes(token_hash);

-- 2. Create qr_scan_events Table
CREATE TABLE IF NOT EXISTS public.qr_scan_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    qr_code_id UUID REFERENCES public.table_qr_codes(id) ON DELETE SET NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    dining_table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_agent_hash TEXT,
    ip_hash TEXT,
    referrer TEXT,
    session_fingerprint_hash TEXT,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_events_biz_branch ON public.qr_scan_events(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_events_table ON public.qr_scan_events(dining_table_id);

-- 3. Trigger Function for Table QR Code Data Integrity
CREATE OR REPLACE FUNCTION public.fn_check_table_qr_code()
RETURNS TRIGGER AS $$
DECLARE
    v_table_biz UUID;
    v_table_branch UUID;
    v_table_deleted TIMESTAMPTZ;
    v_branch_status TEXT;
    v_branch_deleted TIMESTAMPTZ;
BEGIN
    -- 1. Fetch table details
    SELECT business_id, branch_id, deleted_at 
    INTO v_table_biz, v_table_branch, v_table_deleted
    FROM public.dining_tables
    WHERE id = NEW.dining_table_id;

    IF v_table_biz IS NULL THEN
        RAISE EXCEPTION 'Referenced dining table % does not exist', NEW.dining_table_id;
    END IF;

    IF v_table_biz <> NEW.business_id OR v_table_branch <> NEW.branch_id THEN
        RAISE EXCEPTION 'Dining table business/branch mismatch with QR code';
    END IF;

    IF NEW.is_active = true THEN
        IF v_table_deleted IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot create or activate QR code for an archived dining table';
        END IF;

        SELECT status, deleted_at INTO v_branch_status, v_branch_deleted
        FROM public.branches
        WHERE id = NEW.branch_id;

        IF v_branch_status <> 'active' OR v_branch_deleted IS NOT NULL THEN
            RAISE EXCEPTION 'Cannot create or activate QR code for an inactive or archived branch';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_table_qr_code ON public.table_qr_codes;
CREATE TRIGGER trg_check_table_qr_code
    BEFORE INSERT OR UPDATE ON public.table_qr_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_check_table_qr_code();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.table_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for table_qr_codes
DROP POLICY IF EXISTS p_table_qr_codes_owner_mgr_all ON public.table_qr_codes;
CREATE POLICY p_table_qr_codes_owner_mgr_all ON public.table_qr_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = table_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = table_qr_codes.branch_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = table_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = table_qr_codes.branch_id)
              )
        )
    );

DROP POLICY IF EXISTS p_table_qr_codes_staff_read ON public.table_qr_codes;
CREATE POLICY p_table_qr_codes_staff_read ON public.table_qr_codes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = table_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND bm.role IN ('cashier', 'waiter')
              AND ba.branch_id = table_qr_codes.branch_id
        )
    );

-- 6. RLS Policies for qr_scan_events
DROP POLICY IF EXISTS p_qr_scan_events_owner_mgr_read ON public.qr_scan_events;
CREATE POLICY p_qr_scan_events_owner_mgr_read ON public.qr_scan_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = qr_scan_events.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = qr_scan_events.branch_id)
              )
        )
    );

-- 7. SECURITY DEFINER RPC to Resolve Public Table Menu by Token Hash
CREATE OR REPLACE FUNCTION public.resolve_public_table_menu(p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
    v_qr RECORD;
    v_table RECORD;
    v_area RECORD;
    v_branch RECORD;
    v_business RECORD;
    v_categories JSONB;
    v_items JSONB;
    v_result JSONB;
BEGIN
    -- 1. Find active QR code
    SELECT * INTO v_qr
    FROM public.table_qr_codes
    WHERE token_hash = p_token_hash
      AND is_active = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now());

    IF v_qr.id IS NULL THEN
        INSERT INTO public.qr_scan_events (is_valid, failure_reason)
        VALUES (false, 'Invalid or revoked token hash');

        RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR');
    END IF;

    -- 2. Validate Table
    SELECT * INTO v_table
    FROM public.dining_tables
    WHERE id = v_qr.dining_table_id
      AND deleted_at IS NULL;

    IF v_table.id IS NULL THEN
        INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, dining_table_id, is_valid, failure_reason)
        VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, v_qr.dining_table_id, false, 'Table archived');
        RETURN jsonb_build_object('success', false, 'error', 'TABLE_UNAVAILABLE');
    END IF;

    -- 3. Validate Service Area
    SELECT * INTO v_area
    FROM public.service_areas
    WHERE id = v_table.service_area_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_area.id IS NULL THEN
        INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, dining_table_id, is_valid, failure_reason)
        VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, v_qr.dining_table_id, false, 'Service area inactive or archived');
        RETURN jsonb_build_object('success', false, 'error', 'AREA_UNAVAILABLE');
    END IF;

    -- 4. Validate Branch
    SELECT * INTO v_branch
    FROM public.branches
    WHERE id = v_qr.branch_id
      AND status = 'active'
      AND deleted_at IS NULL;

    IF v_branch.id IS NULL THEN
        INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, dining_table_id, is_valid, failure_reason)
        VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, v_qr.dining_table_id, false, 'Branch inactive or archived');
        RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
    END IF;

    -- 5. Validate Business
    SELECT * INTO v_business
    FROM public.businesses
    WHERE id = v_qr.business_id;

    IF v_business.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BUSINESS_UNAVAILABLE');
    END IF;

    -- 6. Record Valid Scan Event
    INSERT INTO public.qr_scan_events (qr_code_id, business_id, branch_id, dining_table_id, is_valid)
    VALUES (v_qr.id, v_qr.business_id, v_qr.branch_id, v_qr.dining_table_id, true);

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
            'city', v_branch.city
        ),
        'area', jsonb_build_object(
            'id', v_area.id,
            'name', v_area.name,
            'code', v_area.code
        ),
        'table', jsonb_build_object(
            'id', v_table.id,
            'name', v_table.name,
            'code', v_table.code,
            'table_number', v_table.table_number,
            'capacity', v_table.capacity
        ),
        'categories', v_categories,
        'items', v_items
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant EXECUTE to public/anon for the public menu resolver
GRANT EXECUTE ON FUNCTION public.resolve_public_table_menu(TEXT) TO anon, authenticated;
