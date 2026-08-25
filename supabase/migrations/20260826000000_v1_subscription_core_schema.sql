-- Migration: V1 Subscription Core Schema & Backfill
-- Version: 20260826000000

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.subscription_lifecycle_status AS ENUM (
    'trialing',
    'active',
    'grace_period',
    'suspended',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_actor_type AS ENUM (
    'super_admin',
    'business_owner',
    'system_cron',
    'gateway_webhook',
    'system_reconciliation'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Business Subscriptions Table
CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'growth', 'enterprise')),
  status public.subscription_lifecycle_status NOT NULL DEFAULT 'trialing',
  
  -- Lifecycle & Expiry Timestamps
  trial_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_starts_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Custom Enterprise & Override Limits (NULL = use plan default)
  max_branches_override INTEGER,
  max_staff_override INTEGER,
  max_tables_override INTEGER,
  max_menu_items_override INTEGER,
  max_custom_roles_override INTEGER,
  
  -- Tracking & Metadata
  activation_source TEXT NOT NULL DEFAULT 'onboarding_trial',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_subscriptions_business_id ON public.business_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_status ON public.business_subscriptions(status);

-- 3. Create Business Subscription Events Table (with UNIQUE dedupe_key for Idempotency)
CREATE TABLE IF NOT EXISTS public.business_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type public.subscription_actor_type NOT NULL DEFAULT 'system_reconciliation',
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_plan TEXT,
  new_plan TEXT NOT NULL,
  reason TEXT,
  dedupe_key VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_business_id ON public.business_subscription_events(business_id);

-- 4. Enable RLS & Security Privileges
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscription_events ENABLE ROW LEVEL SECURITY;

-- Revoke direct client mutations from unprivileged roles
REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscription_events FROM PUBLIC, anon, authenticated;

-- Allow authenticated users with active membership to SELECT their own business subscription
CREATE POLICY select_own_business_subscription ON public.business_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = business_subscriptions.business_id
        AND bm.user_id = auth.uid()
        AND bm.membership_status = 'active'
    )
  );

CREATE POLICY select_own_business_subscription_events ON public.business_subscription_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.business_id = business_subscription_events.business_id
        AND bm.user_id = auth.uid()
        AND bm.membership_status = 'active'
    )
  );

-- Grant service_role full privileges for server-side management
GRANT ALL ON TABLE public.business_subscriptions TO service_role;
GRANT ALL ON TABLE public.business_subscription_events TO service_role;

-- 5. Backfill Existing Businesses (Complimentary Dev/Pilot Access)
INSERT INTO public.business_subscriptions (
  business_id,
  plan_code,
  status,
  activation_source,
  current_period_starts_at,
  current_period_ends_at,
  notes
)
SELECT 
  id AS business_id,
  'growth' AS plan_code,
  'active'::public.subscription_lifecycle_status AS status,
  'manual_admin' AS activation_source,
  NOW() AS current_period_starts_at,
  NOW() + INTERVAL '365 days' AS current_period_ends_at,
  'V1 Migration Backfill: Pilot/Dev Complimentary Access' AS notes
FROM public.businesses
ON CONFLICT (business_id) DO NOTHING;

-- Insert initial migration backfill subscription event
INSERT INTO public.business_subscription_events (
  business_id,
  actor_type,
  event_type,
  previous_status,
  new_status,
  previous_plan,
  new_plan,
  reason,
  dedupe_key,
  metadata
)
SELECT 
  id AS business_id,
  'system_reconciliation'::public.subscription_actor_type AS actor_type,
  'activated' AS event_type,
  'none' AS previous_status,
  'active' AS new_status,
  'none' AS previous_plan,
  'growth' AS new_plan,
  'V1 Migration Backfill: Pilot/Dev Complimentary Access' AS reason,
  CONCAT('activated:backfill:', id) AS dedupe_key,
  '{"source": "v1_migration_backfill"}'::jsonb AS metadata
FROM public.businesses
ON CONFLICT (dedupe_key) DO NOTHING;
