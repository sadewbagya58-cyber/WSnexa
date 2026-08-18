-- Migration: 20260818020000_phase29_positions_assignments.sql
-- Description: Phase 29 Step 1 — Positions and Staff Assignments

-- 1. Create Organization Positions Table
CREATE TABLE IF NOT EXISTS public.organization_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE RESTRICT,
  unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE RESTRICT,
  job_title_id UUID NOT NULL REFERENCES public.organization_job_titles(id) ON DELETE RESTRICT,
  position_code TEXT NULL CHECK (position_code IS NULL OR char_length(position_code) <= 30),
  name_override TEXT NULL CHECK (name_override IS NULL OR char_length(name_override) <= 120),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'vacant', 'frozen', 'archived')),
  headcount_limit INT NOT NULL DEFAULT 1 CHECK (headcount_limit >= 1),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);

-- 2. Validation Trigger for Positions
CREATE OR REPLACE FUNCTION public.check_position_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jt_biz_id UUID;
  branch_biz_id UUID;
  dept_biz_id UUID;
  dept_branch_id UUID;
  unit_biz_id UUID;
  unit_dept_id UUID;
  unit_branch_id UUID;
BEGIN
  -- Validate job title belongs to business
  SELECT business_id INTO jt_biz_id
  FROM public.organization_job_titles
  WHERE id = NEW.job_title_id;

  IF jt_biz_id IS NULL OR jt_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Job title % does not belong to business %', NEW.job_title_id, NEW.business_id;
  END IF;

  -- Validate branch if specified
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO branch_biz_id FROM public.branches WHERE id = NEW.branch_id;
    IF branch_biz_id IS NULL OR branch_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Position branch % does not belong to business %', NEW.branch_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate department if specified
  IF NEW.department_id IS NOT NULL THEN
    SELECT business_id, branch_id INTO dept_biz_id, dept_branch_id
    FROM public.organization_departments
    WHERE id = NEW.department_id;

    IF dept_biz_id IS NULL OR dept_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Position department % does not belong to business %', NEW.department_id, NEW.business_id;
    END IF;

    IF dept_branch_id IS NOT NULL AND NEW.branch_id IS NOT NULL AND dept_branch_id <> NEW.branch_id THEN
      RAISE EXCEPTION 'Position branch % does not match department branch %', NEW.branch_id, dept_branch_id;
    END IF;
  END IF;

  -- Validate unit if specified
  IF NEW.unit_id IS NOT NULL THEN
    SELECT business_id, department_id, branch_id INTO unit_biz_id, unit_dept_id, unit_branch_id
    FROM public.organization_units
    WHERE id = NEW.unit_id;

    IF unit_biz_id IS NULL OR unit_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Position unit % does not belong to business %', NEW.unit_id, NEW.business_id;
    END IF;

    IF NEW.department_id IS NOT NULL AND unit_dept_id <> NEW.department_id THEN
      RAISE EXCEPTION 'Position unit % department % does not match position department %', NEW.unit_id, unit_dept_id, NEW.department_id;
    END IF;

    IF unit_branch_id IS NOT NULL AND NEW.branch_id IS NOT NULL AND unit_branch_id <> NEW.branch_id THEN
      RAISE EXCEPTION 'Position branch % does not match unit branch %', NEW.branch_id, unit_branch_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_position_integrity ON public.organization_positions;
CREATE TRIGGER trg_check_position_integrity
  BEFORE INSERT OR UPDATE ON public.organization_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_position_integrity();

-- 3. Create Staff Assignments Table
CREATE TABLE IF NOT EXISTS public.staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_membership_id UUID NOT NULL REFERENCES public.business_memberships(id) ON DELETE RESTRICT,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE RESTRICT,
  unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE RESTRICT,
  position_id UUID NULL REFERENCES public.organization_positions(id) ON DELETE RESTRICT,
  job_title_id UUID NOT NULL REFERENCES public.organization_job_titles(id) ON DELETE RESTRICT,
  assignment_type TEXT NOT NULL DEFAULT 'primary' CHECK (assignment_type IN ('primary', 'additional', 'cross_property', 'temporary', 'acting', 'secondment')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled', 'scheduled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NULL,
  acting_for_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE RESTRICT,
  reports_to_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE RESTRICT,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_assignment_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT chk_assignment_self_acting CHECK (acting_for_assignment_id IS NULL OR acting_for_assignment_id <> id),
  CONSTRAINT chk_assignment_self_reports CHECK (reports_to_assignment_id IS NULL OR reports_to_assignment_id <> id),
  CONSTRAINT chk_assignment_primary_parity CHECK ((assignment_type = 'primary' AND is_primary = true) OR (assignment_type <> 'primary' AND is_primary = false))
);

-- 4. Unique Partial Index: Enforce at most ONE active primary assignment per business membership
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_primary_assignment
  ON public.staff_assignments (business_membership_id)
  WHERE is_primary = true AND status = 'active';

-- 5. Validation Trigger for Staff Assignments
CREATE OR REPLACE FUNCTION public.check_staff_assignment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mem_biz_id UUID;
  branch_biz_id UUID;
  dept_biz_id UUID;
  unit_biz_id UUID;
  pos_biz_id UUID;
  jt_biz_id UUID;
  acting_biz_id UUID;
  reports_biz_id UUID;
BEGIN
  -- Validate canonical primary parity
  IF (NEW.assignment_type = 'primary' AND NEW.is_primary = false) OR (NEW.assignment_type <> 'primary' AND NEW.is_primary = true) THEN
    RAISE EXCEPTION 'assignment_type must be primary if and only if is_primary is true (got assignment_type=%, is_primary=%)', NEW.assignment_type, NEW.is_primary;
  END IF;

  -- Validate business membership
  SELECT business_id INTO mem_biz_id
  FROM public.business_memberships
  WHERE id = NEW.business_membership_id;

  IF mem_biz_id IS NULL OR mem_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Business membership % does not belong to business %', NEW.business_membership_id, NEW.business_id;
  END IF;

  -- Validate job title
  SELECT business_id INTO jt_biz_id
  FROM public.organization_job_titles
  WHERE id = NEW.job_title_id;

  IF jt_biz_id IS NULL OR jt_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Job title % does not belong to business %', NEW.job_title_id, NEW.business_id;
  END IF;

  -- Validate branch if specified
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO branch_biz_id FROM public.branches WHERE id = NEW.branch_id;
    IF branch_biz_id IS NULL OR branch_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Assignment branch % does not belong to business %', NEW.branch_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate department if specified
  IF NEW.department_id IS NOT NULL THEN
    SELECT business_id INTO dept_biz_id FROM public.organization_departments WHERE id = NEW.department_id;
    IF dept_biz_id IS NULL OR dept_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Assignment department % does not belong to business %', NEW.department_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate unit if specified
  IF NEW.unit_id IS NOT NULL THEN
    SELECT business_id INTO unit_biz_id FROM public.organization_units WHERE id = NEW.unit_id;
    IF unit_biz_id IS NULL OR unit_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Assignment unit % does not belong to business %', NEW.unit_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate position if specified
  IF NEW.position_id IS NOT NULL THEN
    SELECT business_id INTO pos_biz_id FROM public.organization_positions WHERE id = NEW.position_id;
    IF pos_biz_id IS NULL OR pos_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Assignment position % does not belong to business %', NEW.position_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate acting reference if specified
  IF NEW.acting_for_assignment_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.acting_for_assignment_id = NEW.id THEN
      RAISE EXCEPTION 'Assignment cannot act for itself';
    END IF;

    SELECT business_id INTO acting_biz_id FROM public.staff_assignments WHERE id = NEW.acting_for_assignment_id;
    IF acting_biz_id IS NULL OR acting_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Acting assignment % does not belong to business %', NEW.acting_for_assignment_id, NEW.business_id;
    END IF;
  END IF;

  -- Validate reports_to reference if specified
  IF NEW.reports_to_assignment_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.reports_to_assignment_id = NEW.id THEN
      RAISE EXCEPTION 'Assignment cannot report to itself';
    END IF;

    SELECT business_id INTO reports_biz_id FROM public.staff_assignments WHERE id = NEW.reports_to_assignment_id;
    IF reports_biz_id IS NULL OR reports_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Reports-to assignment % does not belong to business %', NEW.reports_to_assignment_id, NEW.business_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_staff_assignment_integrity ON public.staff_assignments;
CREATE TRIGGER trg_check_staff_assignment_integrity
  BEFORE INSERT OR UPDATE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_staff_assignment_integrity();
