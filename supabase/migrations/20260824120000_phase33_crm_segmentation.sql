-- Migration: 20260824120000_phase33_crm_segmentation.sql
-- Description: Phase 33 Step 2 — Guest CRM Behavioral Segmentation & Intelligence Engine
-- Status: SOURCE READY / PRODUCTION NOT YET APPLIED

BEGIN;

-- ============================================================================
-- 1. SEGMENTS DEFINITION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT DEFAULT '#6B7280',
    is_system BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT crm_segments_business_code_key UNIQUE (business_id, code)
);

-- Index for fast lookup by business
CREATE INDEX IF NOT EXISTS idx_crm_segments_business 
    ON public.crm_segments(business_id);


-- ============================================================================
-- 2. CUSTOMER SEGMENTS JUNCTION & INTELLIGENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crm_customer_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
    segment_code VARCHAR(64) NOT NULL,
    rfm_score JSONB NOT NULL DEFAULT '{}'::jsonb,
    retention_risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT crm_customer_segments_cust_code_key UNIQUE (customer_id, segment_code)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_crm_customer_segments_business 
    ON public.crm_customer_segments(business_id);

CREATE INDEX IF NOT EXISTS idx_crm_customer_segments_customer 
    ON public.crm_customer_segments(customer_id);

CREATE INDEX IF NOT EXISTS idx_crm_customer_segments_code 
    ON public.crm_customer_segments(business_id, segment_code);

CREATE INDEX IF NOT EXISTS idx_crm_customer_segments_risk 
    ON public.crm_customer_segments(business_id, retention_risk_score DESC);


-- ============================================================================
-- 3. ROW LEVEL SECURITY & SERVICE ROLE PRIVILEGES
-- ============================================================================

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_segments ENABLE ROW LEVEL SECURITY;

-- Revoke direct client access from un-trusted roles
REVOKE ALL ON public.crm_segments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.crm_customer_segments FROM PUBLIC, anon, authenticated;

-- Grant server-only service_role access
GRANT ALL ON public.crm_segments TO service_role;
GRANT ALL ON public.crm_customer_segments TO service_role;

COMMIT;
