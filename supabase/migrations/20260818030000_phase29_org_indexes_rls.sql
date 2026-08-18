-- Migration: 20260818030000_phase29_org_indexes_rls.sql
-- Description: Phase 29 Step 1 — Indexes and RLS Policies for Organization Tables

-- 1. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_org_hierarchy_levels_biz
  ON public.organization_hierarchy_levels (business_id, rank);

CREATE INDEX IF NOT EXISTS idx_org_departments_biz_branch
  ON public.organization_departments (business_id, branch_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_departments_parent
  ON public.organization_departments (parent_department_id);

CREATE INDEX IF NOT EXISTS idx_org_units_biz_dept
  ON public.organization_units (business_id, department_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_units_parent
  ON public.organization_units (parent_unit_id);

CREATE INDEX IF NOT EXISTS idx_org_job_titles_biz_rank
  ON public.organization_job_titles (business_id, hierarchy_level_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_positions_biz_dept
  ON public.organization_positions (business_id, branch_id, department_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_positions_job_title
  ON public.organization_positions (job_title_id);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_member
  ON public.staff_assignments (business_id, business_membership_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_branch
  ON public.staff_assignments (business_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_position
  ON public.staff_assignments (position_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_dept
  ON public.staff_assignments (department_id, status);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.organization_hierarchy_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_assignments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Tenant Isolation Policies
-- Hierarchy Levels
DROP POLICY IF EXISTS "Tenant isolation for organization_hierarchy_levels" ON public.organization_hierarchy_levels;
CREATE POLICY "Tenant isolation for organization_hierarchy_levels"
  ON public.organization_hierarchy_levels
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Departments
DROP POLICY IF EXISTS "Tenant isolation for organization_departments" ON public.organization_departments;
CREATE POLICY "Tenant isolation for organization_departments"
  ON public.organization_departments
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Organization Units
DROP POLICY IF EXISTS "Tenant isolation for organization_units" ON public.organization_units;
CREATE POLICY "Tenant isolation for organization_units"
  ON public.organization_units
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Job Titles
DROP POLICY IF EXISTS "Tenant isolation for organization_job_titles" ON public.organization_job_titles;
CREATE POLICY "Tenant isolation for organization_job_titles"
  ON public.organization_job_titles
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Positions
DROP POLICY IF EXISTS "Tenant isolation for organization_positions" ON public.organization_positions;
CREATE POLICY "Tenant isolation for organization_positions"
  ON public.organization_positions
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Staff Assignments
DROP POLICY IF EXISTS "Tenant isolation for staff_assignments" ON public.staff_assignments;
CREATE POLICY "Tenant isolation for staff_assignments"
  ON public.staff_assignments
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));
