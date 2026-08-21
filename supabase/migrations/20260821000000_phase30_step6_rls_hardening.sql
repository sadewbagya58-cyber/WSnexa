-- Migration: 20260821000000_phase30_step6_rls_hardening.sql
-- Description: Phase 30 Step 6 — Harden RLS policies on permission_scope_grants and role_scope_presets.
-- Prevents unprivileged authenticated business members from directly inserting/updating security configuration via client.
-- All mutations must be executed server-side via trusted RBAC V2 service-role pathways.

DO $$ BEGIN
  -- Drop overly-permissive client write policies if they exist
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'role_scope_presets' AND policyname = 'role_scope_presets_manage_policy'
  ) THEN
    DROP POLICY role_scope_presets_manage_policy ON public.role_scope_presets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'permission_scope_grants' AND policyname = 'permission_scope_grants_manage_policy'
  ) THEN
    DROP POLICY permission_scope_grants_manage_policy ON public.permission_scope_grants;
  END IF;
END $$;
