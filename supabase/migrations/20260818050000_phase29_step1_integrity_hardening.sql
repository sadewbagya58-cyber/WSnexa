-- Migration: 20260818050000_phase29_step1_integrity_hardening.sql
-- Description: Phase 29 Step 1 — Integrity Hardening: Replace CASCADE with RESTRICT on Organization FKs, Enforce Primary Parity & Self-Reference Constraints, and Rebuild Multi-Tenant Defense Triggers

-- ====================================================================
-- 1. Hardening Foreign Keys: Organization Departments
-- ====================================================================
ALTER TABLE public.organization_departments
  DROP CONSTRAINT IF EXISTS organization_departments_branch_id_fkey;

ALTER TABLE public.organization_departments
  ADD CONSTRAINT organization_departments_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_departments
  DROP CONSTRAINT IF EXISTS organization_departments_parent_department_id_fkey;

ALTER TABLE public.organization_departments
  ADD CONSTRAINT organization_departments_parent_department_id_fkey
  FOREIGN KEY (parent_department_id) REFERENCES public.organization_departments(id) ON DELETE RESTRICT;

-- ====================================================================
-- 2. Hardening Foreign Keys: Organization Units
-- ====================================================================
ALTER TABLE public.organization_units
  DROP CONSTRAINT IF EXISTS organization_units_branch_id_fkey;

ALTER TABLE public.organization_units
  ADD CONSTRAINT organization_units_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_units
  DROP CONSTRAINT IF EXISTS organization_units_department_id_fkey;

ALTER TABLE public.organization_units
  ADD CONSTRAINT organization_units_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.organization_departments(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_units
  DROP CONSTRAINT IF EXISTS organization_units_parent_unit_id_fkey;

ALTER TABLE public.organization_units
  ADD CONSTRAINT organization_units_parent_unit_id_fkey
  FOREIGN KEY (parent_unit_id) REFERENCES public.organization_units(id) ON DELETE RESTRICT;

-- ====================================================================
-- 3. Hardening Foreign Keys: Organization Job Titles
-- ====================================================================
ALTER TABLE public.organization_job_titles
  DROP CONSTRAINT IF EXISTS organization_job_titles_hierarchy_level_id_fkey;

ALTER TABLE public.organization_job_titles
  ADD CONSTRAINT organization_job_titles_hierarchy_level_id_fkey
  FOREIGN KEY (hierarchy_level_id) REFERENCES public.organization_hierarchy_levels(id) ON DELETE RESTRICT;

-- ====================================================================
-- 4. Hardening Foreign Keys: Organization Positions
-- ====================================================================
ALTER TABLE public.organization_positions
  DROP CONSTRAINT IF EXISTS organization_positions_branch_id_fkey;

ALTER TABLE public.organization_positions
  ADD CONSTRAINT organization_positions_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_positions
  DROP CONSTRAINT IF EXISTS organization_positions_department_id_fkey;

ALTER TABLE public.organization_positions
  ADD CONSTRAINT organization_positions_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.organization_departments(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_positions
  DROP CONSTRAINT IF EXISTS organization_positions_unit_id_fkey;

ALTER TABLE public.organization_positions
  ADD CONSTRAINT organization_positions_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.organization_units(id) ON DELETE RESTRICT;

ALTER TABLE public.organization_positions
  DROP CONSTRAINT IF EXISTS organization_positions_job_title_id_fkey;

ALTER TABLE public.organization_positions
  ADD CONSTRAINT organization_positions_job_title_id_fkey
  FOREIGN KEY (job_title_id) REFERENCES public.organization_job_titles(id) ON DELETE RESTRICT;

-- ====================================================================
-- 5. Hardening Foreign Keys & Constraints: Staff Assignments
-- ====================================================================
ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_business_membership_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_business_membership_id_fkey
  FOREIGN KEY (business_membership_id) REFERENCES public.business_memberships(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_branch_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_department_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_department_id_fkey
  FOREIGN KEY (department_id) REFERENCES public.organization_departments(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_unit_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.organization_units(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_position_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_position_id_fkey
  FOREIGN KEY (position_id) REFERENCES public.organization_positions(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_job_title_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_job_title_id_fkey
  FOREIGN KEY (job_title_id) REFERENCES public.organization_job_titles(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_acting_for_assignment_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_acting_for_assignment_id_fkey
  FOREIGN KEY (acting_for_assignment_id) REFERENCES public.staff_assignments(id) ON DELETE RESTRICT;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_reports_to_assignment_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_reports_to_assignment_id_fkey
  FOREIGN KEY (reports_to_assignment_id) REFERENCES public.staff_assignments(id) ON DELETE RESTRICT;

-- Parity and self-reference check constraints
ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_primary_parity;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT chk_assignment_primary_parity
  CHECK ((assignment_type = 'primary' AND is_primary = true) OR (assignment_type <> 'primary' AND is_primary = false));

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_self_acting;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT chk_assignment_self_acting
  CHECK (acting_for_assignment_id IS NULL OR acting_for_assignment_id <> id);

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_self_reports;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT chk_assignment_self_reports
  CHECK (reports_to_assignment_id IS NULL OR reports_to_assignment_id <> id);

-- Ensure Unique Partial Index for active primary assignments
DROP INDEX IF EXISTS public.idx_one_active_primary_assignment;
CREATE UNIQUE INDEX idx_one_active_primary_assignment
  ON public.staff_assignments (business_membership_id)
  WHERE is_primary = true AND status = 'active';

-- ====================================================================
-- 6. Trigger Functions & Re-installation
-- ====================================================================

-- 6a. Department Hierarchy & Tenant Integrity Trigger
CREATE OR REPLACE FUNCTION public.check_department_hierarchy_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr_id UUID;
  visited_ids UUID[] := ARRAY[]::UUID[];
  parent_biz_id UUID;
  parent_branch_id UUID;
  branch_biz_id UUID;
BEGIN
  -- Validate branch belongs to the same business
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO branch_biz_id FROM public.branches WHERE id = NEW.branch_id;
    IF branch_biz_id IS NULL OR branch_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Department branch_id % does not belong to business %', NEW.branch_id, NEW.business_id;
    END IF;
  END IF;

  -- If parent_department_id is set, validate business and cycle
  IF NEW.parent_department_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.parent_department_id = NEW.id THEN
      RAISE EXCEPTION 'Department cannot be its own parent';
    END IF;

    SELECT business_id, branch_id INTO parent_biz_id, parent_branch_id
    FROM public.organization_departments
    WHERE id = NEW.parent_department_id;

    IF parent_biz_id IS NULL OR parent_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Parent department % does not belong to business %', NEW.parent_department_id, NEW.business_id;
    END IF;

    -- Transitive Cycle Prevention
    curr_id := NEW.parent_department_id;
    WHILE curr_id IS NOT NULL LOOP
      IF curr_id = NEW.id THEN
        RAISE EXCEPTION 'Circular reference detected in department hierarchy: % is in its own parent ancestry chain', NEW.id;
      END IF;

      IF curr_id = ANY(visited_ids) THEN
        RAISE EXCEPTION 'Loop detected in department ancestor chain';
      END IF;

      visited_ids := array_append(visited_ids, curr_id);

      SELECT parent_department_id INTO curr_id
      FROM public.organization_departments
      WHERE id = curr_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_department_integrity ON public.organization_departments;
CREATE TRIGGER trg_check_department_integrity
  BEFORE INSERT OR UPDATE ON public.organization_departments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_department_hierarchy_integrity();

-- 6b. Unit Hierarchy & Tenant Integrity Trigger
CREATE OR REPLACE FUNCTION public.check_unit_hierarchy_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr_id UUID;
  visited_ids UUID[] := ARRAY[]::UUID[];
  dept_biz_id UUID;
  dept_branch_id UUID;
  branch_biz_id UUID;
  parent_biz_id UUID;
  parent_dept_id UUID;
BEGIN
  -- Validate department belongs to same business
  SELECT business_id, branch_id INTO dept_biz_id, dept_branch_id
  FROM public.organization_departments
  WHERE id = NEW.department_id;

  IF dept_biz_id IS NULL OR dept_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Unit department % does not belong to business %', NEW.department_id, NEW.business_id;
  END IF;

  -- Validate branch if specified
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO branch_biz_id FROM public.branches WHERE id = NEW.branch_id;
    IF branch_biz_id IS NULL OR branch_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Unit branch % does not belong to business %', NEW.branch_id, NEW.business_id;
    END IF;

    -- If department is property-scoped, unit branch must match
    IF dept_branch_id IS NOT NULL AND dept_branch_id <> NEW.branch_id THEN
      RAISE EXCEPTION 'Unit branch % does not match property-scoped department branch %', NEW.branch_id, dept_branch_id;
    END IF;
  ELSE
    -- If department is property-scoped, default unit branch to department branch if null
    IF dept_branch_id IS NOT NULL THEN
      NEW.branch_id := dept_branch_id;
    END IF;
  END IF;

  -- Validate parent unit if specified
  IF NEW.parent_unit_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.parent_unit_id = NEW.id THEN
      RAISE EXCEPTION 'Organization unit cannot be its own parent';
    END IF;

    SELECT business_id, department_id INTO parent_biz_id, parent_dept_id
    FROM public.organization_units
    WHERE id = NEW.parent_unit_id;

    IF parent_biz_id IS NULL OR parent_biz_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Parent unit % does not belong to business %', NEW.parent_unit_id, NEW.business_id;
    END IF;

    -- Transitive Cycle Prevention
    curr_id := NEW.parent_unit_id;
    WHILE curr_id IS NOT NULL LOOP
      IF curr_id = NEW.id THEN
        RAISE EXCEPTION 'Circular reference detected in unit hierarchy: % is in its own parent ancestry chain', NEW.id;
      END IF;

      IF curr_id = ANY(visited_ids) THEN
        RAISE EXCEPTION 'Loop detected in unit ancestor chain';
      END IF;

      visited_ids := array_append(visited_ids, curr_id);

      SELECT parent_unit_id INTO curr_id
      FROM public.organization_units
      WHERE id = curr_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_unit_integrity ON public.organization_units;
CREATE TRIGGER trg_check_unit_integrity
  BEFORE INSERT OR UPDATE ON public.organization_units
  FOR EACH ROW
  EXECUTE FUNCTION public.check_unit_hierarchy_integrity();

-- 6c. Job Title Tenant Integrity Trigger
CREATE OR REPLACE FUNCTION public.check_job_title_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  level_biz_id UUID;
BEGIN
  SELECT business_id INTO level_biz_id
  FROM public.organization_hierarchy_levels
  WHERE id = NEW.hierarchy_level_id;

  IF level_biz_id IS NULL OR level_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Hierarchy level % does not belong to business %', NEW.hierarchy_level_id, NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_job_title_integrity ON public.organization_job_titles;
CREATE TRIGGER trg_check_job_title_integrity
  BEFORE INSERT OR UPDATE ON public.organization_job_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_job_title_integrity();

-- 6d. Position Tenant Integrity Trigger
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

-- 6e. Staff Assignment Tenant Integrity Trigger
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
