-- Migration: 20260812010000_phase21_1_staff_invitation_areas.sql
-- Description: Relational staff_invitation_areas table mapping pending invitations to assigned service areas

CREATE TABLE IF NOT EXISTS public.staff_invitation_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.staff_invitations(id) ON DELETE CASCADE,
  service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_invitation_areas UNIQUE (invitation_id, service_area_id)
);

-- Indexes for performance & security checks
CREATE INDEX IF NOT EXISTS idx_staff_invitation_areas_invitation ON public.staff_invitation_areas(invitation_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_areas_area ON public.staff_invitation_areas(service_area_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitation_areas_branch ON public.staff_invitation_areas(branch_id);

-- Enable RLS
ALTER TABLE public.staff_invitation_areas ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Business members can SELECT invitation areas for their business
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'staff_invitation_areas' AND policyname = 'staff_invitation_areas_select_policy'
  ) THEN
    CREATE POLICY staff_invitation_areas_select_policy ON public.staff_invitation_areas
      FOR SELECT TO authenticated
      USING (public.auth_has_business_access(business_id));
  END IF;
END $$;
