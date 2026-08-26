-- Migration: 20260826010000_realtime_subscriptions_and_businesses.sql
-- Description: Enable Supabase Realtime Publication for business_subscriptions & businesses, and make branch_id optional in notifications

-- 1. Enable Supabase Realtime Publication for business_subscriptions and businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_subscriptions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'businesses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  END IF;
EXCEPTION WHEN OTHERS THEN
  null;
END $$;

-- 2. Drop NOT NULL constraint on notifications.branch_id to allow business-level subscription notifications
DO $$
BEGIN
  ALTER TABLE public.notifications ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  null;
END $$;

-- 3. Data Backfill: Normalize manual activation sources
UPDATE public.business_subscriptions
SET activation_source = 'manual_admin'
WHERE activation_source IN ('bank_transfer', 'pilot_account', 'complimentary', 'gateway_issue', 'other');
