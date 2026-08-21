-- Migration: 20260821010000_phase30_step8_org_assignment_rls_hardening.sql
-- Description: Phase 30 Step 8 — Harden RLS policies on staff_assignments, assignment history, and absences.
-- Restricts authenticated client queries to SELECT only.
-- All mutations (INSERT, UPDATE, DELETE) must be executed server-side via trusted service_role pathways.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1. Enable RLS on all three tables
  ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organization_assignment_history ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.organization_assignment_absences ENABLE ROW LEVEL SECURITY;

  -- 2. Drop all non-SELECT or overly permissive policies on staff_assignments
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'staff_assignments'
      AND schemaname = 'public'
      AND (cmd <> 'SELECT' OR policyname ILIKE '%manage%' OR policyname ILIKE '%isolation%')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff_assignments', r.policyname);
  END LOOP;

  -- Ensure strict SELECT policy for staff_assignments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_assignments' AND policyname = 'staff_assignments_select_policy'
  ) THEN
    CREATE POLICY staff_assignments_select_policy
      ON public.staff_assignments
      FOR SELECT
      TO authenticated
      USING (public.auth_has_business_access(business_id));
  END IF;

  -- 3. Drop all non-SELECT or overly permissive policies on organization_assignment_history
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'organization_assignment_history'
      AND schemaname = 'public'
      AND (cmd <> 'SELECT' OR policyname ILIKE '%manage%' OR policyname ILIKE '%isolation%')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_assignment_history', r.policyname);
  END LOOP;

  -- Ensure strict SELECT policy for organization_assignment_history
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_assignment_history' AND policyname = 'org_assignment_history_select_policy'
  ) THEN
    CREATE POLICY org_assignment_history_select_policy
      ON public.organization_assignment_history
      FOR SELECT
      TO authenticated
      USING (public.auth_has_business_access(business_id));
  END IF;

  -- 4. Drop all non-SELECT or overly permissive policies on organization_assignment_absences
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'organization_assignment_absences'
      AND schemaname = 'public'
      AND (cmd <> 'SELECT' OR policyname ILIKE '%manage%' OR policyname ILIKE '%isolation%')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organization_assignment_absences', r.policyname);
  END LOOP;

  -- Ensure strict SELECT policy for organization_assignment_absences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organization_assignment_absences' AND policyname = 'org_assignment_absences_select_policy'
  ) THEN
    CREATE POLICY org_assignment_absences_select_policy
      ON public.organization_assignment_absences
      FOR SELECT
      TO authenticated
      USING (public.auth_has_business_access(business_id));
  END IF;
END $$;
