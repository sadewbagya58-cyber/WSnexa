-- Migration: 20260807040000_create_unified_account_and_customer_schema.sql
-- Description: Phase 13 Unified Account Types, Onboarding Intent & Customer Profile Foundation

-- 1. Create Onboarding Intent & Workspace Mode Enums
DO $$ BEGIN
  CREATE TYPE public.onboarding_intent AS ENUM (
    'business_owner',
    'branch_manager',
    'staff',
    'customer'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.workspace_mode AS ENUM (
    'dashboard',
    'customer'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Add Additive Onboarding Columns to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_intent public.onboarding_intent,
  ADD COLUMN IF NOT EXISTS preferred_workspace public.workspace_mode DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS customer_profile_created_at TIMESTAMPTZ;

-- 3. Create Customer Profiles Table
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT CHECK (display_name IS NULL OR (char_length(trim(display_name)) >= 1 AND char_length(display_name) <= 100)),
  avatar_url TEXT,
  phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for User Customer Profile
CREATE INDEX IF NOT EXISTS idx_customer_profiles_user_id ON public.customer_profiles(user_id);

-- 4. Enable RLS on customer_profiles Table
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies for Customer Profiles
DROP POLICY IF EXISTS customer_profiles_select_own ON public.customer_profiles;
CREATE POLICY customer_profiles_select_own ON public.customer_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS customer_profiles_insert_own ON public.customer_profiles;
CREATE POLICY customer_profiles_insert_own ON public.customer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS customer_profiles_update_own ON public.customer_profiles;
CREATE POLICY customer_profiles_update_own ON public.customer_profiles
  FOR UPDATE USING (auth.uid() = user_id);
