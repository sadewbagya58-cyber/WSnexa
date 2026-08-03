-- Migration: Create user_profiles table and automatic creation trigger on auth.users
-- Version: 20260803163000

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL CHECK (char_length(trim(first_name)) >= 1 AND char_length(first_name) <= 100),
  last_name TEXT CHECK (last_name IS NULL OR char_length(last_name) <= 100),
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
  avatar_url TEXT CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500),
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (char_length(preferred_language) <= 10),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deactivated')),
  onboarding_status TEXT NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Policy 1: Authenticated users can view their own profile only
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Authenticated users can update allowed fields of their own profile
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4. Function & Trigger for Auto Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted_first_name TEXT;
  extracted_last_name TEXT;
BEGIN
  -- Extract names safely from raw_user_meta_data
  extracted_first_name := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'first_name'), ''), 'User');
  extracted_last_name  := NULLIF(trim(new.raw_user_meta_data->>'last_name'), '');

  -- Insert profile, ignoring conflicts if profile already exists
  INSERT INTO public.user_profiles (
    id,
    first_name,
    last_name,
    account_status,
    onboarding_status
  )
  VALUES (
    new.id,
    extracted_first_name,
    extracted_last_name,
    'active',
    'not_started'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- 5. Updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS set_user_profiles_updated_at ON public.user_profiles;

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
