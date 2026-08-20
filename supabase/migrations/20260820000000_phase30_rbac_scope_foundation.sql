-- Migration: 20260820000000_phase30_rbac_scope_foundation.sql
-- Description: Phase 30 Step 2 — RBAC & Scope V2 Additive Schema Foundation & Compatibility Backfill
-- Safety: 100% additive, non-destructive, backward-compatible, rollback-safe, idempotent.

-- ====================================================================
-- 1. Create Role Scope Presets Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.role_scope_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NULL REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL for system-wide built-in presets
  role_key TEXT NULL, -- Built-in role key e.g. 'business_owner', 'branch_manager'
  custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  default_scope TEXT NOT NULL CHECK (default_scope IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF')),
  max_scope TEXT NOT NULL CHECK (max_scope IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role_scope_preset_target CHECK (
    (role_key IS NOT NULL AND custom_role_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NOT NULL)
  ),
  CONSTRAINT uq_role_scope_preset_role_key UNIQUE (business_id, role_key),
  CONSTRAINT uq_role_scope_preset_custom_role UNIQUE (business_id, custom_role_id)
);

CREATE INDEX IF NOT EXISTS idx_role_scope_presets_lookup
  ON public.role_scope_presets (business_id, role_key, custom_role_id);

ALTER TABLE public.role_scope_presets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_scope_presets' AND policyname = 'role_scope_presets_select_policy') THEN
    CREATE POLICY role_scope_presets_select_policy ON public.role_scope_presets
      FOR SELECT TO authenticated
      USING (business_id IS NULL OR public.auth_has_business_access(business_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_scope_presets' AND policyname = 'role_scope_presets_manage_policy') THEN
    CREATE POLICY role_scope_presets_manage_policy ON public.role_scope_presets
      FOR ALL TO authenticated
      USING (business_id IS NOT NULL AND public.auth_has_business_access(business_id))
      WITH CHECK (business_id IS NOT NULL AND public.auth_has_business_access(business_id));
  END IF;
END $$;

-- ====================================================================
-- 2. Create Permission Scope Grants Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.permission_scope_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NULL REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL for system-wide built-in templates
  role_key TEXT NULL, -- Built-in role key e.g. 'business_owner'
  custom_role_id UUID NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  business_membership_id UUID NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF')),
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE CASCADE,
  organization_unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE CASCADE,
  service_area_id UUID NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  grant_source TEXT NOT NULL DEFAULT 'role_preset' CHECK (grant_source IN ('role_preset', 'custom_role', 'member_override', 'staff_assignment', 'acting_delegation')),
  source_id UUID NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_grant_principal CHECK (
    (role_key IS NOT NULL AND custom_role_id IS NULL AND business_membership_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NOT NULL AND business_membership_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NULL AND business_membership_id IS NOT NULL)
  ),
  CONSTRAINT chk_grant_scope_target_consistency CHECK (
    (scope_type = 'ORGANIZATION' AND branch_id IS NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'PROPERTY' AND branch_id IS NOT NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'DEPARTMENT' AND department_id IS NOT NULL AND organization_unit_id IS NULL AND service_area_id IS NULL) OR
    (scope_type = 'AREA_TEAM' AND ((organization_unit_id IS NOT NULL AND service_area_id IS NULL) OR (service_area_id IS NOT NULL AND organization_unit_id IS NULL)) AND branch_id IS NULL AND department_id IS NULL) OR
    (scope_type = 'SELF' AND branch_id IS NULL AND department_id IS NULL AND organization_unit_id IS NULL AND service_area_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_biz_role
  ON public.permission_scope_grants (business_id, role_key, permission_key);

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_custom_role
  ON public.permission_scope_grants (custom_role_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_membership
  ON public.permission_scope_grants (business_membership_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_branch
  ON public.permission_scope_grants (branch_id) WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_department
  ON public.permission_scope_grants (department_id) WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_unit
  ON public.permission_scope_grants (organization_unit_id) WHERE organization_unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perm_scope_grants_service_area
  ON public.permission_scope_grants (service_area_id) WHERE service_area_id IS NOT NULL;

-- Unique partial indexes to prevent duplicate concrete grants
CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_scope_grant_role_template
  ON public.permission_scope_grants (role_key, permission_key, scope_type)
  WHERE role_key IS NOT NULL AND business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_scope_grant_member_branch
  ON public.permission_scope_grants (business_membership_id, permission_key, scope_type, branch_id)
  WHERE business_membership_id IS NOT NULL AND branch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_scope_grant_member_service_area
  ON public.permission_scope_grants (business_membership_id, permission_key, scope_type, service_area_id)
  WHERE business_membership_id IS NOT NULL AND service_area_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_scope_grant_member_unit
  ON public.permission_scope_grants (business_membership_id, permission_key, scope_type, organization_unit_id)
  WHERE business_membership_id IS NOT NULL AND organization_unit_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_perm_scope_grant_member_department
  ON public.permission_scope_grants (business_membership_id, permission_key, scope_type, department_id)
  WHERE business_membership_id IS NOT NULL AND department_id IS NOT NULL;

ALTER TABLE public.permission_scope_grants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'permission_scope_grants' AND policyname = 'permission_scope_grants_select_policy') THEN
    CREATE POLICY permission_scope_grants_select_policy ON public.permission_scope_grants
      FOR SELECT TO authenticated
      USING (business_id IS NULL OR public.auth_has_business_access(business_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'permission_scope_grants' AND policyname = 'permission_scope_grants_manage_policy') THEN
    CREATE POLICY permission_scope_grants_manage_policy ON public.permission_scope_grants
      FOR ALL TO authenticated
      USING (business_id IS NOT NULL AND public.auth_has_business_access(business_id))
      WITH CHECK (business_id IS NOT NULL AND public.auth_has_business_access(business_id));
  END IF;
END $$;

-- ====================================================================
-- 3. Extend Member Permission Overrides with Additive Scope Columns
-- ====================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'member_permission_overrides' AND column_name = 'scope_type'
  ) THEN
    ALTER TABLE public.member_permission_overrides
      ADD COLUMN scope_type TEXT NULL
      CHECK (scope_type IS NULL OR scope_type IN ('ORGANIZATION', 'PROPERTY', 'DEPARTMENT', 'AREA_TEAM', 'SELF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'member_permission_overrides' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.member_permission_overrides
      ADD COLUMN branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'member_permission_overrides' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.member_permission_overrides
      ADD COLUMN department_id UUID NULL REFERENCES public.organization_departments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'member_permission_overrides' AND column_name = 'organization_unit_id'
  ) THEN
    ALTER TABLE public.member_permission_overrides
      ADD COLUMN organization_unit_id UUID NULL REFERENCES public.organization_units(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'member_permission_overrides' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE public.member_permission_overrides
      ADD COLUMN service_area_id UUID NULL REFERENCES public.service_areas(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_member_permission_overrides_scope
  ON public.member_permission_overrides (business_membership_id, permission_key, scope_type);

-- ====================================================================
-- 4. Scope Target Integrity Validation Trigger
-- ====================================================================
CREATE OR REPLACE FUNCTION public.check_scope_grant_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_biz_id UUID;
  dept_biz_id UUID;
  unit_biz_id UUID;
  sa_biz_id UUID;
  mem_biz_id UUID;
  custom_role_biz_id UUID;
BEGIN
  -- 1. Validate Business Membership match
  IF NEW.business_membership_id IS NOT NULL THEN
    SELECT business_id INTO mem_biz_id FROM public.business_memberships WHERE id = NEW.business_membership_id;
    IF mem_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced business_membership_id % does not exist', NEW.business_membership_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> mem_biz_id THEN
      RAISE EXCEPTION 'business_membership_id % business % does not match grant business %', NEW.business_membership_id, mem_biz_id, NEW.business_id;
    END IF;
    IF NEW.business_id IS NULL THEN
      NEW.business_id := mem_biz_id;
    END IF;
  END IF;

  -- 2. Validate Custom Role match
  IF NEW.custom_role_id IS NOT NULL THEN
    SELECT business_id INTO custom_role_biz_id FROM public.custom_roles WHERE id = NEW.custom_role_id;
    IF custom_role_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced custom_role_id % does not exist', NEW.custom_role_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> custom_role_biz_id THEN
      RAISE EXCEPTION 'custom_role_id % business % does not match grant business %', NEW.custom_role_id, custom_role_biz_id, NEW.business_id;
    END IF;
    IF NEW.business_id IS NULL THEN
      NEW.business_id := custom_role_biz_id;
    END IF;
  END IF;

  -- 3. Validate Branch Target match
  IF NEW.branch_id IS NOT NULL THEN
    SELECT business_id INTO target_biz_id FROM public.branches WHERE id = NEW.branch_id;
    IF target_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced branch_id % does not exist', NEW.branch_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> target_biz_id THEN
      RAISE EXCEPTION 'branch_id % business % does not match grant business %', NEW.branch_id, target_biz_id, NEW.business_id;
    END IF;
  END IF;

  -- 4. Validate Department Target match
  IF NEW.department_id IS NOT NULL THEN
    SELECT business_id INTO dept_biz_id FROM public.organization_departments WHERE id = NEW.department_id;
    IF dept_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced department_id % does not exist', NEW.department_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> dept_biz_id THEN
      RAISE EXCEPTION 'department_id % business % does not match grant business %', NEW.department_id, dept_biz_id, NEW.business_id;
    END IF;
  END IF;

  -- 5. Validate Organization Unit Target match
  IF NEW.organization_unit_id IS NOT NULL THEN
    SELECT business_id INTO unit_biz_id FROM public.organization_units WHERE id = NEW.organization_unit_id;
    IF unit_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced organization_unit_id % does not exist', NEW.organization_unit_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> unit_biz_id THEN
      RAISE EXCEPTION 'organization_unit_id % business % does not match grant business %', NEW.organization_unit_id, unit_biz_id, NEW.business_id;
    END IF;
  END IF;

  -- 6. Validate Service Area Target match
  IF NEW.service_area_id IS NOT NULL THEN
    SELECT business_id INTO sa_biz_id FROM public.service_areas WHERE id = NEW.service_area_id;
    IF sa_biz_id IS NULL THEN
      RAISE EXCEPTION 'Referenced service_area_id % does not exist', NEW.service_area_id;
    END IF;
    IF NEW.business_id IS NOT NULL AND NEW.business_id <> sa_biz_id THEN
      RAISE EXCEPTION 'service_area_id % business % does not match grant business %', NEW.service_area_id, sa_biz_id, NEW.business_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_scope_grant_integrity ON public.permission_scope_grants;
CREATE TRIGGER trg_check_scope_grant_integrity
  BEFORE INSERT OR UPDATE ON public.permission_scope_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.check_scope_grant_integrity();

-- ====================================================================
-- 5. Compatibility Backfill & System Presets
-- ====================================================================

-- 5.1 Seed Global Role Scope Presets (Built-in Roles)
INSERT INTO public.role_scope_presets (business_id, role_key, custom_role_id, default_scope, max_scope)
VALUES
  (NULL::uuid, 'business_owner', NULL::uuid, 'ORGANIZATION', 'ORGANIZATION'),
  (NULL::uuid, 'branch_manager', NULL::uuid, 'PROPERTY', 'PROPERTY'),
  (NULL::uuid, 'waiter', NULL::uuid, 'AREA_TEAM', 'PROPERTY'),
  (NULL::uuid, 'kitchen_staff', NULL::uuid, 'PROPERTY', 'PROPERTY'),
  (NULL::uuid, 'cashier', NULL::uuid, 'PROPERTY', 'PROPERTY')
ON CONFLICT (business_id, role_key) DO UPDATE
SET default_scope = EXCLUDED.default_scope,
    max_scope = EXCLUDED.max_scope,
    updated_at = NOW();

-- 5.2 Seed default role_scope_presets for existing custom roles
INSERT INTO public.role_scope_presets (business_id, role_key, custom_role_id, default_scope, max_scope)
SELECT
  cr.business_id,
  NULL::text,
  cr.id,
  'PROPERTY',
  'PROPERTY'
FROM public.custom_roles cr
ON CONFLICT (business_id, custom_role_id) DO NOTHING;

-- 5.3 Seed Built-in Role Template Permission Scope Grants for ORGANIZATION scope (business_owner)
INSERT INTO public.permission_scope_grants (
  business_id,
  role_key,
  custom_role_id,
  business_membership_id,
  permission_key,
  effect,
  scope_type,
  grant_source
)
SELECT
  NULL::uuid,
  'business_owner',
  NULL::uuid,
  NULL::uuid,
  rp.permission_key,
  'allow',
  'ORGANIZATION',
  'role_preset'
FROM public.role_permissions rp
WHERE rp.role_key = 'business_owner' AND rp.business_id IS NULL
ON CONFLICT DO NOTHING;

-- 5.4 Backfill Concrete PROPERTY Scope Grants for Active Members with Assigned Branches
-- (branch_manager, kitchen_staff, cashier)
INSERT INTO public.permission_scope_grants (
  business_id,
  role_key,
  custom_role_id,
  business_membership_id,
  permission_key,
  effect,
  scope_type,
  branch_id,
  grant_source
)
SELECT DISTINCT
  bm.business_id,
  NULL::text,
  NULL::uuid,
  bm.id,
  rp.permission_key,
  'allow',
  'PROPERTY',
  ba.branch_id,
  'role_preset'
FROM public.business_memberships bm
JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
JOIN public.role_permissions rp ON rp.role_key = bm.role::text AND rp.business_id IS NULL
WHERE bm.membership_status = 'active'
  AND bm.role::text IN ('branch_manager', 'kitchen_staff', 'cashier')
  AND ba.branch_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5.5 Backfill Concrete AREA_TEAM Scope Grants for Waiters with Staff Area Assignments
INSERT INTO public.permission_scope_grants (
  business_id,
  role_key,
  custom_role_id,
  business_membership_id,
  permission_key,
  effect,
  scope_type,
  service_area_id,
  grant_source
)
SELECT DISTINCT
  bm.business_id,
  NULL::text,
  NULL::uuid,
  bm.id,
  rp.permission_key,
  'allow',
  'AREA_TEAM',
  saa.service_area_id,
  'staff_assignment'
FROM public.business_memberships bm
JOIN public.staff_area_assignments saa ON saa.business_membership_id = bm.id
JOIN public.role_permissions rp ON rp.role_key = 'waiter' AND rp.business_id IS NULL
WHERE bm.membership_status = 'active'
  AND bm.role::text = 'waiter'
  AND rp.permission_key LIKE 'waiter.%'
  AND saa.service_area_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5.6 Backfill Concrete PROPERTY Scope Grants for Waiters (non-area permissions, or branch-wide waiters)
INSERT INTO public.permission_scope_grants (
  business_id,
  role_key,
  custom_role_id,
  business_membership_id,
  permission_key,
  effect,
  scope_type,
  branch_id,
  grant_source
)
SELECT DISTINCT
  bm.business_id,
  NULL::text,
  NULL::uuid,
  bm.id,
  rp.permission_key,
  'allow',
  'PROPERTY',
  ba.branch_id,
  'role_preset'
FROM public.business_memberships bm
JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
JOIN public.role_permissions rp ON rp.role_key = 'waiter' AND rp.business_id IS NULL
WHERE bm.membership_status = 'active'
  AND bm.role::text = 'waiter'
  AND ba.branch_id IS NOT NULL
  AND (
    rp.permission_key NOT LIKE 'waiter.%'
    OR NOT EXISTS (
      SELECT 1 FROM public.staff_area_assignments saa
      WHERE saa.business_membership_id = bm.id
    )
  )
ON CONFLICT DO NOTHING;

-- 5.7 Backfill Concrete PROPERTY Scope Grants for Custom Role Members with Assigned Branches
INSERT INTO public.permission_scope_grants (
  business_id,
  role_key,
  custom_role_id,
  business_membership_id,
  permission_key,
  effect,
  scope_type,
  branch_id,
  grant_source
)
SELECT DISTINCT
  bm.business_id,
  NULL::text,
  NULL::uuid,
  bm.id,
  rp.permission_key,
  'allow',
  'PROPERTY',
  ba.branch_id,
  'custom_role'
FROM public.business_memberships bm
JOIN public.branch_assignments ba ON ba.business_membership_id = bm.id
JOIN public.custom_roles cr ON cr.id = bm.custom_role_id
JOIN public.role_permissions rp ON rp.custom_role_id = cr.id
WHERE bm.membership_status = 'active'
  AND ba.branch_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5.8 Compatibility Backfill for Existing Member Permission Overrides
-- Business owner overrides operate organization-wide:
UPDATE public.member_permission_overrides mpo
SET scope_type = 'ORGANIZATION',
    branch_id = NULL::uuid
FROM public.business_memberships bm
WHERE bm.id = mpo.business_membership_id
  AND bm.role::text = 'business_owner'
  AND mpo.scope_type IS NULL;

-- Non-owner legacy overrides retain scope_type = NULL to preserve legacy membership-wide
-- authorization across all assigned branches without arbitrarily narrowing to a single branch.
