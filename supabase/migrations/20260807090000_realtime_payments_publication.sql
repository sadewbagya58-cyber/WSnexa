-- Migration: 20260807090000_realtime_payments_publication.sql
-- Description: Add public.payments to supabase_realtime publication for payment realtime updates

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if publication does not exist in local environment
  null;
END $$;
