-- Migration: 20260904120000_central_audit_history_and_operational_activity.sql
-- Description: Central Audit History and Operational Activity Tracking schema enhancements

-- 1. Add Additive Nullable Snapshot Columns to public.audit_logs
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS actor_role_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS old_values JSONB,
  ADD COLUMN IF NOT EXISTS new_values JSONB,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 2. Create High-Performance Compound Indexes on public.audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created
  ON public.audit_logs (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_created
  ON public.audit_logs (branch_id, created_at DESC)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (business_id, entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs (business_id, actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs (business_id, action, created_at DESC);

-- 3. Update Audit Logs SELECT Policy for Multi-Tenant & Branch Scoped Security
DO $$ BEGIN
  DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
  DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;

  CREATE POLICY audit_logs_select_policy ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
      business_id IS NULL
      OR public.auth_has_business_access(business_id)
    );
END $$;
