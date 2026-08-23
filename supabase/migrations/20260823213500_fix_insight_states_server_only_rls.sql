-- Forward Migration: Hardening Analytics Insight States to Server-Only RLS
-- Version: 20260823213500

-- 1. Ensure RLS remains enabled on analytics_insight_states
ALTER TABLE public.analytics_insight_states ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing direct client RLS policies
DROP POLICY IF EXISTS "Business members can read insight states" ON public.analytics_insight_states;
DROP POLICY IF EXISTS "Business members can insert or update insight states" ON public.analytics_insight_states;

-- 3. Revoke direct browser client (anon/authenticated) privileges
REVOKE ALL ON TABLE public.analytics_insight_states FROM PUBLIC, anon, authenticated;

-- 4. Grant table management privileges exclusively to the trusted service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.analytics_insight_states TO service_role;
