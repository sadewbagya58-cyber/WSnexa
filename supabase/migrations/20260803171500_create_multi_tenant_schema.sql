-- Migration: Create Multi-Tenant Schema (Businesses, Branches, Memberships, Assignments, Audit Logs)
-- Version: 20260803171500

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'business_owner',
    'branch_manager',
    'kitchen_staff',
    'cashier',
    'waiter'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.business_status AS ENUM (
    'active',
    'suspended',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.branch_status AS ENUM (
    'active',
    'inactive',
    'archived'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM (
    'invited',
    'active',
    'suspended',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  slug TEXT UNIQUE NOT NULL CHECK (char_length(trim(slug)) >= 1 AND char_length(slug) <= 120),
  business_type TEXT NOT NULL DEFAULT 'restaurant',
  country_code TEXT NOT NULL DEFAULT 'US' CHECK (char_length(country_code) = 2),
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(default_currency) = 3),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status public.business_status NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 3. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  code TEXT NOT NULL CHECK (char_length(trim(code)) >= 1 AND char_length(code) <= 30),
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country_code TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status public.branch_status NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(business_id, code)
);

-- Ensure only ONE default branch exists per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_branch 
  ON public.branches (business_id) 
  WHERE is_default = TRUE;

-- 4. Create Business Memberships Table
CREATE TABLE IF NOT EXISTS public.business_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'business_owner',
  membership_status public.membership_status NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, user_id)
);

-- 5. Create Branch Assignments Table
CREATE TABLE IF NOT EXISTS public.branch_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_membership_id UUID NOT NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_membership_id, branch_id)
);

-- 6. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Enable RLS on All Tables
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. PostgreSQL Security Helper Functions
CREATE OR REPLACE FUNCTION public.auth_has_business_access(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND membership_status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_is_business_owner(target_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND role = 'business_owner'
      AND membership_status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_business_role(target_business_id UUID, allowed_roles public.user_role[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE user_id = auth.uid()
      AND business_id = target_business_id
      AND role = ANY(allowed_roles)
      AND membership_status = 'active'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  branch_biz_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT business_id INTO branch_biz_id FROM public.branches WHERE id = target_branch_id;
  IF branch_biz_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Business owners have access to all branches of their business
  IF public.auth_is_business_owner(branch_biz_id) THEN
    RETURN TRUE;
  END IF;

  -- Staff members have access if explicitly assigned to this branch
  RETURN EXISTS (
    SELECT 1 FROM public.branch_assignments ba
    JOIN public.business_memberships bm ON bm.id = ba.business_membership_id
    WHERE bm.user_id = auth.uid()
      AND bm.business_id = branch_biz_id
      AND bm.membership_status = 'active'
      AND ba.branch_id = target_branch_id
  );
END;
$$;

-- 9. Row Level Security Policies

-- Businesses RLS Policies
CREATE POLICY "Users can read businesses where they hold active membership"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (public.auth_has_business_access(id));

CREATE POLICY "Business owners can update allowed business fields"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (public.auth_is_business_owner(id))
  WITH CHECK (public.auth_is_business_owner(id));

-- Branches RLS Policies
CREATE POLICY "Users can read authorized branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(id));

CREATE POLICY "Business owners can update branches"
  ON public.branches FOR UPDATE
  TO authenticated
  USING (public.auth_is_business_owner(business_id))
  WITH CHECK (public.auth_is_business_owner(business_id));

CREATE POLICY "Business owners can create branches"
  ON public.branches FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_business_owner(business_id));

CREATE POLICY "Business owners can delete branches"
  ON public.branches FOR DELETE
  TO authenticated
  USING (public.auth_is_business_owner(business_id));

-- Business Memberships RLS Policies
CREATE POLICY "Users can read own membership or owners can read business memberships"
  ON public.business_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.auth_is_business_owner(business_id));

CREATE POLICY "Business owners can manage business memberships"
  ON public.business_memberships FOR ALL
  TO authenticated
  USING (public.auth_is_business_owner(business_id))
  WITH CHECK (public.auth_is_business_owner(business_id));

-- Branch Assignments RLS Policies
CREATE POLICY "Users can read own branch assignments or owners can read all"
  ON public.branch_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.id = business_membership_id
        AND (bm.user_id = auth.uid() OR public.auth_is_business_owner(bm.business_id))
    )
  );

CREATE POLICY "Business owners can manage branch assignments"
  ON public.branch_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_memberships bm
      WHERE bm.id = business_membership_id AND public.auth_is_business_owner(bm.business_id)
    )
  );

-- Audit Logs RLS Policies
CREATE POLICY "Business owners can view business audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (business_id IS NOT NULL AND public.auth_is_business_owner(business_id));

-- 10. Atomic Business Creation PostgreSQL RPC
CREATE OR REPLACE FUNCTION public.create_business_with_default_branch(
  p_name TEXT,
  p_slug TEXT,
  p_business_type TEXT DEFAULT 'restaurant',
  p_country_code TEXT DEFAULT 'US',
  p_default_currency TEXT DEFAULT 'USD',
  p_timezone TEXT DEFAULT 'UTC',
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'MAIN'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_business_id UUID;
  v_branch_id UUID;
  v_membership_id UUID;
  v_result JSONB;
BEGIN
  -- Derive user ID strictly from auth session
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized. Authenticated user session required.';
  END IF;

  -- 1. Create Business
  INSERT INTO public.businesses (
    name,
    slug,
    business_type,
    country_code,
    default_currency,
    timezone,
    status,
    created_by
  )
  VALUES (
    p_name,
    p_slug,
    COALESCE(p_business_type, 'restaurant'),
    COALESCE(p_country_code, 'US'),
    COALESCE(p_default_currency, 'USD'),
    COALESCE(p_timezone, 'UTC'),
    'active',
    v_user_id
  )
  RETURNING id INTO v_business_id;

  -- 2. Create Default Branch
  INSERT INTO public.branches (
    business_id,
    name,
    code,
    country_code,
    timezone,
    status,
    is_default
  )
  VALUES (
    v_business_id,
    COALESCE(NULLIF(trim(p_branch_name), ''), 'Main Branch'),
    COALESCE(NULLIF(trim(p_branch_code), ''), 'MAIN'),
    COALESCE(p_country_code, 'US'),
    COALESCE(p_timezone, 'UTC'),
    'active',
    TRUE
  )
  RETURNING id INTO v_branch_id;

  -- 3. Create Owner Membership
  INSERT INTO public.business_memberships (
    business_id,
    user_id,
    role,
    membership_status
  )
  VALUES (
    v_business_id,
    v_user_id,
    'business_owner',
    'active'
  )
  RETURNING id INTO v_membership_id;

  -- 4. Create Initial Audit Log
  INSERT INTO public.audit_logs (
    business_id,
    actor_id,
    action,
    target_type,
    target_id,
    payload
  )
  VALUES (
    v_business_id,
    v_user_id,
    'business.created',
    'business',
    v_business_id::text,
    jsonb_build_object(
      'business_name', p_name,
      'slug', p_slug,
      'default_branch_id', v_branch_id,
      'owner_membership_id', v_membership_id
    )
  );

  v_result := jsonb_build_object(
    'business_id', v_business_id,
    'branch_id', v_branch_id,
    'membership_id', v_membership_id,
    'slug', p_slug
  );

  RETURN v_result;
END;
$$;
