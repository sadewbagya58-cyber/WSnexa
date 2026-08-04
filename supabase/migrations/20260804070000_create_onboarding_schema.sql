-- Migration: Onboarding Schema, Operating Hours, Drafts, Storage & Atomic RPC
-- Version: 20260804070000

-- 1. Extend Businesses Table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT;

-- 2. Create Branch Operating Hours Table
CREATE TABLE IF NOT EXISTS public.branch_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  opens_at TIME DEFAULT '08:00:00',
  closes_at TIME DEFAULT '22:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, day_of_week)
);

-- 3. Create Onboarding Drafts Table
CREATE TABLE IF NOT EXISTS public.onboarding_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'business',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

-- 4. Enable RLS
ALTER TABLE public.branch_operating_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Operating Hours
CREATE POLICY "Users can read authorized branch operating hours"
  ON public.branch_operating_hours FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Business owners can manage branch operating hours"
  ON public.branch_operating_hours FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND public.auth_is_business_owner(b.business_id)
    )
  );

-- 6. RLS Policies for Onboarding Drafts
CREATE POLICY "Users can read own onboarding draft"
  ON public.onboarding_drafts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding draft"
  ON public.onboarding_drafts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding draft"
  ON public.onboarding_drafts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own onboarding draft"
  ON public.onboarding_drafts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 7. Supabase Storage Bucket Setup for Business Assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public Read Access for Business Assets"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-assets');

CREATE POLICY "Authenticated Upload to Business Assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'logos'
  );

CREATE POLICY "Authenticated Delete from Business Assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'logos'
  );

-- 8. Atomic Complete Business Onboarding PostgreSQL RPC
CREATE OR REPLACE FUNCTION public.complete_business_onboarding(
  p_name TEXT,
  p_slug TEXT,
  p_business_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT 'US',
  p_default_currency TEXT DEFAULT 'USD',
  p_timezone TEXT DEFAULT 'UTC',
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_branch_name TEXT DEFAULT 'Main Branch',
  p_branch_code TEXT DEFAULT 'MAIN',
  p_branch_address_line_1 TEXT DEFAULT NULL,
  p_branch_address_line_2 TEXT DEFAULT NULL,
  p_branch_city TEXT DEFAULT NULL,
  p_branch_region TEXT DEFAULT NULL,
  p_branch_postal_code TEXT DEFAULT NULL,
  p_hours JSONB DEFAULT '[]'::jsonb
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
  v_hour_item JSONB;
  v_result JSONB;
BEGIN
  -- 1. Derive user ID strictly from authenticated session
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized. Authenticated user session required.';
  END IF;

  -- 2. Prevent duplicate business creation if user is already an active business owner
  IF EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE user_id = v_user_id
      AND role = 'business_owner'
      AND membership_status = 'active'
  ) THEN
    RAISE EXCEPTION 'User already owns an active business.';
  END IF;

  -- 3. Create Business
  INSERT INTO public.businesses (
    name,
    slug,
    business_type,
    description,
    country_code,
    default_currency,
    timezone,
    email,
    phone,
    website,
    logo_url,
    status,
    created_by
  )
  VALUES (
    p_name,
    p_slug,
    COALESCE(p_business_type, 'restaurant'),
    p_description,
    COALESCE(p_country_code, 'US'),
    COALESCE(p_default_currency, 'USD'),
    COALESCE(p_timezone, 'UTC'),
    p_email,
    p_phone,
    p_website,
    p_logo_url,
    'active',
    v_user_id
  )
  RETURNING id INTO v_business_id;

  -- 4. Create Default Branch
  INSERT INTO public.branches (
    business_id,
    name,
    code,
    address_line_1,
    address_line_2,
    city,
    region,
    postal_code,
    country_code,
    phone,
    email,
    timezone,
    status,
    is_default
  )
  VALUES (
    v_business_id,
    COALESCE(NULLIF(trim(p_branch_name), ''), 'Main Branch'),
    COALESCE(NULLIF(trim(p_branch_code), ''), 'MAIN'),
    p_branch_address_line_1,
    p_branch_address_line_2,
    p_branch_city,
    p_branch_region,
    p_branch_postal_code,
    COALESCE(p_country_code, 'US'),
    p_phone,
    p_email,
    COALESCE(p_timezone, 'UTC'),
    'active',
    TRUE
  )
  RETURNING id INTO v_branch_id;

  -- 5. Create Owner Membership
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

  -- 6. Create Operating Hours (7 Days)
  IF jsonb_array_length(p_hours) > 0 THEN
    FOR v_hour_item IN SELECT * FROM jsonb_array_elements(p_hours)
    LOOP
      INSERT INTO public.branch_operating_hours (
        branch_id,
        day_of_week,
        is_closed,
        opens_at,
        closes_at
      )
      VALUES (
        v_branch_id,
        (v_hour_item->>'day_of_week')::SMALLINT,
        (v_hour_item->>'is_closed')::BOOLEAN,
        (v_hour_item->>'opens_at')::TIME,
        (v_hour_item->>'closes_at')::TIME
      )
      ON CONFLICT (branch_id, day_of_week) DO UPDATE
      SET is_closed = EXCLUDED.is_closed,
          opens_at = EXCLUDED.opens_at,
          closes_at = EXCLUDED.closes_at;
    END LOOP;
  ELSE
    -- Default 7-day schedule (Mon-Sun, 08:00 - 22:00)
    FOR i IN 0..6 LOOP
      INSERT INTO public.branch_operating_hours (branch_id, day_of_week, is_closed, opens_at, closes_at)
      VALUES (v_branch_id, i, FALSE, '08:00:00'::TIME, '22:00:00'::TIME);
    END LOOP;
  END IF;

  -- 7. Create Audit Log
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
    'business.onboarding_completed',
    'business',
    v_business_id::text,
    jsonb_build_object(
      'business_name', p_name,
      'slug', p_slug,
      'default_branch_id', v_branch_id,
      'owner_membership_id', v_membership_id
    )
  );

  -- 8. Delete Onboarding Draft
  DELETE FROM public.onboarding_drafts WHERE user_id = v_user_id;

  -- 9. Update User Profile Onboarding Status
  UPDATE public.user_profiles
  SET onboarding_status = 'completed',
      updated_at = NOW()
  WHERE id = v_user_id;

  v_result := jsonb_build_object(
    'business_id', v_business_id,
    'branch_id', v_branch_id,
    'membership_id', v_membership_id,
    'slug', p_slug
  );

  RETURN v_result;
END;
$$;
