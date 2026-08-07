-- Migration: 20260807060000_create_staff_invitations_schema.sql
-- Description: Create public.staff_invitations table for secure manager and staff invitations

-- 1. Create public.staff_invitations table
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('manager', 'staff')),
  assigned_role public.user_role NOT NULL,
  invited_email TEXT CHECK (invited_email IS NULL OR char_length(trim(invited_email)) >= 3),
  token_hash TEXT UNIQUE NOT NULL,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'revoked')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_regenerated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for fast tenant lookups and security checks
CREATE INDEX IF NOT EXISTS idx_staff_invitations_business_id ON public.staff_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_branch_id ON public.staff_invitations(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_status ON public.staff_invitations(status);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_expires_at ON public.staff_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_token_hash ON public.staff_invitations(token_hash);

-- 3. Enable RLS
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Business members can SELECT invitations for their business
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_invitations' AND policyname = 'staff_invitations_select_policy'
  ) THEN
    CREATE POLICY staff_invitations_select_policy ON public.staff_invitations
      FOR SELECT TO authenticated
      USING (public.auth_has_business_access(business_id));
  END IF;
END $$;
