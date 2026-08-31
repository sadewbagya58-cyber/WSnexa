-- ============================================================================
-- Migration: 20260831170000_area_level_qr_codes.sql
-- Description: Area-Level QR Code Storage, Dual-Scope Resolution, and Service Area Floor Isolation
-- Safety: Fully additive, non-destructive, idempotent migration with tenant isolation and strict RLS.
-- ============================================================================

-- 1. Create area_qr_codes Table for persistent Area QR management, revocation, and version tracking
CREATE TABLE IF NOT EXISTS public.area_qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    encrypted_token TEXT NOT NULL,
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
    CONSTRAINT chk_area_qr_revoked_not_active CHECK (NOT (is_active = true AND revoked_at IS NOT NULL))
);

-- 2. Ensure exactly ONE active QR code per service area
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_qr_per_service_area 
    ON public.area_qr_codes(service_area_id) 
    WHERE (is_active = true);

-- 3. Multi-Tenant Performance Indexes
CREATE INDEX IF NOT EXISTS idx_area_qr_codes_biz_branch ON public.area_qr_codes(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_area_qr_codes_token_hash ON public.area_qr_codes(token_hash);
CREATE INDEX IF NOT EXISTS idx_area_qr_codes_area ON public.area_qr_codes(service_area_id);

-- 4. Enable Row Level Security (RLS) on area_qr_codes
ALTER TABLE public.area_qr_codes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for area_qr_codes (Tenant & Role Isolated)
DROP POLICY IF EXISTS p_area_qr_codes_owner_mgr_all ON public.area_qr_codes;
CREATE POLICY p_area_qr_codes_owner_mgr_all ON public.area_qr_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = area_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = area_qr_codes.branch_id)
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            LEFT JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = area_qr_codes.business_id
              AND bm.membership_status = 'active'
              AND (
                  bm.role = 'business_owner'
                  OR (bm.role = 'branch_manager' AND ba.branch_id = area_qr_codes.branch_id)
              )
        )
    );

DROP POLICY IF EXISTS p_area_qr_codes_staff_read ON public.area_qr_codes;
CREATE POLICY p_area_qr_codes_staff_read ON public.area_qr_codes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = area_qr_codes.business_id
              AND bm.membership_status = 'active'
        )
    );

-- 6. Trigger to enforce strict composite tenant match (service_area must belong to the exact business_id and branch_id)
CREATE OR REPLACE FUNCTION public.fn_validate_area_qr_tenant_match()
RETURNS TRIGGER AS $$
DECLARE
    v_area_biz UUID;
    v_area_branch UUID;
BEGIN
    SELECT business_id, branch_id INTO v_area_biz, v_area_branch
    FROM public.service_areas
    WHERE id = NEW.service_area_id;

    IF v_area_biz IS NULL OR v_area_branch IS NULL THEN
        RAISE EXCEPTION 'Service Area % does not exist', NEW.service_area_id;
    END IF;

    IF v_area_biz <> NEW.business_id OR v_area_branch <> NEW.branch_id THEN
        RAISE EXCEPTION 'Cross-tenant mismatch: Service Area % belongs to business % branch %, but QR record specifies business % branch %',
            NEW.service_area_id, v_area_biz, v_area_branch, NEW.business_id, NEW.branch_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_area_qr_tenant ON public.area_qr_codes;
CREATE TRIGGER trg_validate_area_qr_tenant
    BEFORE INSERT OR UPDATE ON public.area_qr_codes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_validate_area_qr_tenant_match();

-- 7. Audit & Documentation Comments
COMMENT ON TABLE public.area_qr_codes IS 'Persistent cryptographic Area QR records for physical dining sections with revocation and versioning.';
COMMENT ON COLUMN public.area_qr_codes.token_hash IS 'SHA-256 hash of raw QR token for public lookup and revocation validation.';
COMMENT ON COLUMN public.area_qr_codes.encrypted_token IS 'AES-256-GCM encrypted raw token for owner dashboard view and card printing.';
