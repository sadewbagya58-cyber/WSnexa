-- Migration: 20260828010000_staff_invitations_organization_position.sql
-- Description: Add position_id, department_id, unit_id, and job_title_id to staff_invitations table

ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.organization_positions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.organization_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.organization_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title_id UUID REFERENCES public.organization_job_titles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_staff_invitations_position_id ON public.staff_invitations(position_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_department_id ON public.staff_invitations(department_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_job_title_id ON public.staff_invitations(job_title_id);
