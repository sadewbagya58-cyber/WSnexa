-- Migration: Create Analytics Insight States Table
-- Version: 20260823193000

CREATE TABLE IF NOT EXISTS public.analytics_insight_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  rule_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISMISSED', 'RESOLVED')),
  dismissed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_insight_state_fingerprint UNIQUE (business_id, fingerprint)
);

-- Index for fast lookup by business and fingerprint
CREATE INDEX IF NOT EXISTS idx_insight_states_biz_status ON public.analytics_insight_states(business_id, status);
CREATE INDEX IF NOT EXISTS idx_insight_states_fingerprint ON public.analytics_insight_states(fingerprint);

-- Enable RLS
ALTER TABLE public.analytics_insight_states ENABLE ROW LEVEL SECURITY;

-- Revoke direct browser client access (server-only architecture)
REVOKE ALL ON TABLE public.analytics_insight_states FROM PUBLIC, anon, authenticated;

-- Grant access exclusively to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_insight_states TO service_role;
