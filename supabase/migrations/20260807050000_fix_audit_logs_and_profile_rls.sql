-- Migration: 20260807050000_fix_audit_logs_and_profile_rls.sql
-- Description: Ensure public.audit_logs has SELECT RLS policy for authenticated users with business access

-- 1. Create audit_logs SELECT Policy if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select_policy'
  ) THEN
    CREATE POLICY audit_logs_select_policy ON public.audit_logs
      FOR SELECT TO authenticated
      USING (business_id IS NULL OR public.auth_has_business_access(business_id));
  END IF;
END $$;
