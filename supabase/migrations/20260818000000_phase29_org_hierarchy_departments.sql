-- Migration: 20260818000000_phase29_org_hierarchy_departments.sql
-- Description: Phase 29 Step 1 — Organization Hierarchy Levels and Departments

-- 1. Create Organization Hierarchy Levels Table
CREATE TABLE IF NOT EXISTS public.organization_hierarchy_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  rank INT NOT NULL CHECK (rank >= 1),
  is_management BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_hierarchy_biz_rank UNIQUE (business_id, rank),
  CONSTRAINT uq_org_hierarchy_biz_name UNIQUE (business_id, name)
);

-- 2. Helper function to seed default hierarchy levels for a business
CREATE OR REPLACE FUNCTION public.seed_default_organization_hierarchy_levels(target_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_hierarchy_levels (business_id, rank, name, is_management)
  VALUES
    (target_business_id, 1, 'Owner / Board', true),
    (target_business_id, 2, 'Executive', true),
    (target_business_id, 3, 'Group / Regional Management', true),
    (target_business_id, 4, 'General Management', true),
    (target_business_id, 5, 'Department Leadership', true),
    (target_business_id, 6, 'Management', true),
    (target_business_id, 7, 'Supervisory', false),
    (target_business_id, 8, 'Operational', false)
  ON CONFLICT (business_id, rank) DO NOTHING;
END;
$$;

-- 3. Trigger to auto-seed default hierarchy levels upon business creation
CREATE OR REPLACE FUNCTION public.trg_auto_seed_business_hierarchy_levels()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_organization_hierarchy_levels(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_hierarchy_on_business_create ON public.businesses;
CREATE TRIGGER trg_seed_hierarchy_on_business_create
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_seed_business_hierarchy_levels();

-- Backfill existing businesses with default hierarchy levels
DO $$
DECLARE
  biz RECORD;
BEGIN
  FOR biz IN SELECT id FROM public.businesses LOOP
    PERFORM public.seed_default_organization_hierarchy_levels(biz.id);
  END LOOP;
END;
$$;

-- 4. Create Organization Departments Table
CREATE TABLE IF NOT EXISTS public.organization_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  parent_department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NULL CHECK (code IS NULL OR char_length(code) <= 30),
  department_type TEXT NULL CHECK (department_type IS NULL OR char_length(department_type) <= 50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_department_self_parent CHECK (parent_department_id IS NULL OR parent_department_id <> id)
);

-- 5. Cycle Prevention & Validation Trigger for Departments
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
