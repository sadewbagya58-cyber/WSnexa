-- Migration: Dining Table & Service Area Management Schema
-- Version: 20260804151500

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.table_status AS ENUM (
    'available',
    'occupied',
    'reserved',
    'cleaning',
    'unavailable'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.table_shape AS ENUM (
    'square',
    'rectangle',
    'round',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create Service Areas Table
CREATE TABLE IF NOT EXISTS public.service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NOT NULL CHECK (char_length(trim(code)) >= 1 AND char_length(code) <= 50),
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique area code per branch for active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_area_code
  ON public.service_areas (branch_id, code)
  WHERE deleted_at IS NULL;

-- Unique area name per branch for active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_area_name
  ON public.service_areas (branch_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_areas_branch
  ON public.service_areas (business_id, branch_id, is_active, display_order);

-- 3. Create Dining Tables Table
CREATE TABLE IF NOT EXISTS public.dining_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NOT NULL CHECK (char_length(trim(code)) >= 1 AND char_length(code) <= 50),
  table_number INTEGER CHECK (table_number IS NULL OR table_number >= 1),
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity >= 1 AND capacity <= 50),
  status public.table_status NOT NULL DEFAULT 'available',
  shape public.table_shape DEFAULT 'square',
  position_x NUMERIC,
  position_y NUMERIC,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique table code per branch for active rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_code
  ON public.dining_tables (branch_id, code)
  WHERE deleted_at IS NULL;

-- Unique table number per branch for active rows (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_number
  ON public.dining_tables (branch_id, table_number)
  WHERE deleted_at IS NULL AND table_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dining_tables_area_branch
  ON public.dining_tables (service_area_id, branch_id, status, is_active);

-- 4. Database Integrity Helper Triggers

-- Trigger function: Ensure dining table service area belongs to exact same business and branch & is active
CREATE OR REPLACE FUNCTION public.check_dining_table_area_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  area_biz_id UUID;
  area_branch_id UUID;
  area_deleted TIMESTAMPTZ;
BEGIN
  SELECT business_id, branch_id, deleted_at 
  INTO area_biz_id, area_branch_id, area_deleted
  FROM public.service_areas 
  WHERE id = NEW.service_area_id;

  IF area_biz_id IS NULL THEN
    RAISE EXCEPTION 'Referenced service area does not exist.';
  END IF;

  IF area_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add dining table to an archived service area.';
  END IF;

  IF area_biz_id <> NEW.business_id OR area_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'Dining table must belong to the exact same business and branch as the service area.';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND NEW.status IN ('occupied', 'reserved') THEN
    RAISE EXCEPTION 'Archived tables cannot remain occupied or reserved.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_dining_table_area ON public.dining_tables;
CREATE TRIGGER trg_check_dining_table_area
  BEFORE INSERT OR UPDATE ON public.dining_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.check_dining_table_area_branch();

-- Trigger function: Prevent service area archival if active dining tables exist
CREATE OR REPLACE FUNCTION public.check_service_area_archival()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_table_count INTEGER;
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    SELECT COUNT(*) INTO active_table_count
    FROM public.dining_tables
    WHERE service_area_id = OLD.id AND deleted_at IS NULL;

    IF active_table_count > 0 THEN
      RAISE EXCEPTION 'Cannot archive service area while active tables exist. Please archive or move tables first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_service_area_archival ON public.service_areas;
CREATE TRIGGER trg_check_service_area_archival
  BEFORE UPDATE ON public.service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_service_area_archival();

-- 5. Atomic Bulk Table Generation RPC
CREATE OR REPLACE FUNCTION public.bulk_create_dining_tables(
  p_business_id UUID,
  p_branch_id UUID,
  p_service_area_id UUID,
  p_prefix TEXT,
  p_start_number INTEGER,
  p_count INTEGER,
  p_capacity INTEGER,
  p_shape public.table_shape DEFAULT 'square'
)
RETURNS Json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_area_biz_id UUID;
  v_area_branch_id UUID;
  v_area_deleted TIMESTAMPTZ;
  v_num INTEGER;
  v_code TEXT;
  v_name TEXT;
  v_created_count INTEGER := 0;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT (public.auth_is_business_owner(p_business_id) OR (public.auth_has_business_role(p_business_id, ARRAY['branch_manager'::public.user_role]) AND public.auth_has_branch_access(p_branch_id))) THEN
    RAISE EXCEPTION 'Forbidden. Owner or Branch Manager role required.';
  END IF;

  SELECT business_id, branch_id, deleted_at 
  INTO v_area_biz_id, v_area_branch_id, v_area_deleted
  FROM public.service_areas 
  WHERE id = p_service_area_id;

  IF v_area_biz_id IS NULL OR v_area_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid or archived service area.';
  END IF;

  IF v_area_biz_id <> p_business_id OR v_area_branch_id <> p_branch_id THEN
    RAISE EXCEPTION 'Service area does not belong to specified business and branch.';
  END IF;

  IF p_count < 1 OR p_count > 500 THEN
    RAISE EXCEPTION 'Bulk count must be between 1 and 500.';
  END IF;

  FOR i IN 0..(p_count - 1) LOOP
    v_num := p_start_number + i;
    v_code := UPPER(TRIM(p_prefix)) || v_num::TEXT;
    v_name := TRIM(p_prefix) || ' ' || v_num::TEXT;

    INSERT INTO public.dining_tables (
      business_id,
      branch_id,
      service_area_id,
      name,
      code,
      table_number,
      capacity,
      status,
      shape,
      display_order,
      is_active,
      created_by
    ) VALUES (
      p_business_id,
      p_branch_id,
      p_service_area_id,
      v_name,
      v_code,
      v_num,
      p_capacity,
      'available',
      p_shape,
      i,
      TRUE,
      v_actor_id
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  -- Record Audit Log
  INSERT INTO public.audit_logs (
    business_id,
    actor_id,
    action,
    target_type,
    target_id,
    payload
  ) VALUES (
    p_business_id,
    v_actor_id,
    'table.bulk_created',
    'service_area',
    p_service_area_id,
    jsonb_build_object(
      'count', v_created_count,
      'prefix', p_prefix,
      'start_number', p_start_number,
      'capacity', p_capacity,
      'branch_id', p_branch_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'count', v_created_count,
    'message', v_created_count || ' dining tables generated successfully.'
  );
END;
$$;

-- 6. Enable RLS
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dining_tables ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Service Areas Policies
CREATE POLICY "Users can read authorized service areas"
  ON public.service_areas FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create service areas"
  ON public.service_areas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update service areas"
  ON public.service_areas FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete service areas"
  ON public.service_areas FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

-- Dining Tables Policies
CREATE POLICY "Users can read authorized dining tables"
  ON public.dining_tables FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create dining tables"
  ON public.dining_tables FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update dining tables"
  ON public.dining_tables FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete dining tables"
  ON public.dining_tables FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );
