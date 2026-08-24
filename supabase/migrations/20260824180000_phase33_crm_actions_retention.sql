-- ============================================================================
-- WSNexa Phase 33 Step 3 Migration — CRM Actions, Retention & Notes/Tags Engine
-- Migration State: SOURCE READY / PRODUCTION NOT APPLIED
-- ============================================================================

-- 1. CRM CUSTOMER NOTES
CREATE TABLE IF NOT EXISTS public.crm_customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_cust ON public.crm_customer_notes(business_id, crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_branch ON public.crm_customer_notes(business_id, branch_id);

ALTER TABLE public.crm_customer_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_customer_notes FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_customer_notes TO service_role;

-- 2. CRM TAGS
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color_hex TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_crm_tags_slug UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_crm_tags_biz ON public.crm_tags(business_id);

ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_tags FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_tags TO service_role;

-- 3. CRM CUSTOMER TAG ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.crm_customer_tags (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, crm_customer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_cust_tags_cust ON public.crm_customer_tags(business_id, crm_customer_id);

ALTER TABLE public.crm_customer_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_customer_tags FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_customer_tags TO service_role;

-- 4. CRM ACTIONS
CREATE TABLE IF NOT EXISTS public.crm_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('FOLLOW_UP', 'RETENTION_REVIEW', 'LOYALTY_REVIEW', 'SERVICE_RECOVERY', 'VIP_RECOGNITION', 'REVIEW_RESPONSE', 'PROFILE_REVIEW', 'MANUAL_OUTREACH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED', 'COMPLETED', 'DISMISSED')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  source_segment TEXT,
  due_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_actions_cust ON public.crm_actions(business_id, crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_actions_branch ON public.crm_actions(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_crm_actions_status ON public.crm_actions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_actions_due ON public.crm_actions(business_id, due_at);
CREATE INDEX IF NOT EXISTS idx_crm_actions_assigned ON public.crm_actions(business_id, assigned_user_id);

-- Concurrency-Safe Deduplication Partial Unique Index
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_actions_open_dedupe 
  ON public.crm_actions (business_id, crm_customer_id, reason_code) 
  WHERE status IN ('OPEN', 'IN_PROGRESS', 'SNOOZED');

ALTER TABLE public.crm_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_actions TO service_role;

-- 5. CRM ACTION AUDIT EVENTS
CREATE TABLE IF NOT EXISTS public.crm_action_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.crm_actions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED', 'ASSIGNED', 'STARTED', 'SNOOZED', 'COMPLETED', 'DISMISSED', 'REOPENED')),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_action_events_act ON public.crm_action_events(business_id, action_id);

ALTER TABLE public.crm_action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_action_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_action_events TO service_role;
