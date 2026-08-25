-- Migration: 20260825150000_v1_notifications_schema.sql
-- Description: Phase 35 V1 Core Per-User Notification Schema with Server-Level Idempotency

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id TEXT NOT NULL,
  action_url VARCHAR(255) NOT NULL,
  dedupe_key VARCHAR(255) UNIQUE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read 
  ON public.notifications (recipient_user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_business_branch 
  ON public.notifications (business_id, branch_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Revoke direct client mutations (INSERT, UPDATE, DELETE)
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon, authenticated;

-- Grant execution to service_role
GRANT ALL ON public.notifications TO service_role;

-- SELECT RLS Policy: Users can ONLY view their own notifications
CREATE POLICY notifications_select_policy ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = auth.uid());
