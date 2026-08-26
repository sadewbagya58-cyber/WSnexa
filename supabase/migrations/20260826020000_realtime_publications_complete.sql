-- Migration: 20260826020000_realtime_publications_complete.sql
-- Description: Ensure all production realtime tables (business_subscriptions, businesses, notifications, orders, waiter_requests) are idempotently included in the supabase_realtime publication

DO $$
BEGIN
  -- 1. business_subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'business_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_subscriptions;
  END IF;

  -- 2. businesses
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'businesses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;
  END IF;

  -- 3. notifications
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- 4. orders
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  -- 5. waiter_requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'waiter_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_requests;
  END IF;
EXCEPTION WHEN OTHERS THEN
  null;
END $$;
