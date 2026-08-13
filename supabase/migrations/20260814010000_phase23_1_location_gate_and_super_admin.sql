-- Migration: Phase 23.1 Super Admin Role & Venue Location Publishing Enforcement
-- Version: 20260814010000

-- 1. Add is_super_admin flag to user_profiles table
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Index for fast Super Admin lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_super_admin
  ON public.user_profiles(is_super_admin)
  WHERE is_super_admin = TRUE;

-- 3. Comments for database schema documentation
COMMENT ON COLUMN public.user_profiles.is_super_admin IS 'Authoritative Super Admin platform role flag. Only true for platform super administrators.';
