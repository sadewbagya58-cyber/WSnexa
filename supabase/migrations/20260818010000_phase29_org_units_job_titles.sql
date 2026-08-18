-- Migration: 20260818010000_phase29_org_units_job_titles.sql
-- Description: Phase 29 Step 1 — Organization Units and Job Titles

-- 1. Create Organization Units Table
CREATE TABLE IF NOT EXISTS public.organization_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES public.organization_departments(id) ON DELETE RESTRICT,
  parent_unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE RESTRICT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('team', 'area', 'section', 'station', 'outlet', 'operational_unit', 'other')),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NULL CHECK (code IS NULL OR char_length(code) <= 30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_unit_self_parent CHECK (parent_unit_id IS NULL OR parent_unit_id <> id)
);

-- 2. Cycle Prevention & Tenant Validation Trigger for Organization Units
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

-- 3. Create Organization Job Titles Table
CREATE TABLE IF NOT EXISTS public.organization_job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NULL CHECK (code IS NULL OR char_length(code) <= 30),
  hierarchy_level_id UUID NOT NULL REFERENCES public.organization_hierarchy_levels(id) ON DELETE RESTRICT,
  department_type TEXT NULL CHECK (department_type IS NULL OR char_length(department_type) <= 50),
  description TEXT NULL,
  is_management BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_job_title_biz_name UNIQUE (business_id, name)
);

-- 4. Validation Trigger for Job Titles
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
