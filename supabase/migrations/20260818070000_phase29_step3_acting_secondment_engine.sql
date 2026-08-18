-- Migration: 20260818070000_phase29_step3_acting_secondment_engine.sql
-- Description: Phase 29 Step 3 — Acting Positions, Temporary Assignments, Secondments, Absences & Effective Organization Engine

-- ====================================================================
-- 1. Create Organization Assignment Absences Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.organization_assignment_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.staff_assignments(id) ON DELETE RESTRICT,
  absence_type TEXT NOT NULL CHECK (absence_type IN ('leave', 'medical_leave', 'training', 'travel', 'suspension', 'temporary_unavailability', 'other')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_absence_dates CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_org_assignment_absences_dates
  ON public.organization_assignment_absences (business_id, assignment_id, starts_at, ends_at);

ALTER TABLE public.organization_assignment_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignment absences in business"
  ON public.organization_assignment_absences
  FOR SELECT
  TO authenticated
  USING (public.auth_has_business_access(business_id));

CREATE POLICY "Users can manage assignment absences in business"
  ON public.organization_assignment_absences
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- ====================================================================
-- 2. Extend Staff Assignments Table with Secondment & Absence Links
-- ====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_assignments' AND column_name = 'source_assignment_id'
  ) THEN
    ALTER TABLE public.staff_assignments
      ADD COLUMN source_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_assignments' AND column_name = 'coverage_absence_id'
  ) THEN
    ALTER TABLE public.staff_assignments
      ADD COLUMN coverage_absence_id UUID NULL REFERENCES public.organization_assignment_absences(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.staff_assignments
  DROP CONSTRAINT IF EXISTS chk_assignment_self_source;
ALTER TABLE public.staff_assignments
  ADD CONSTRAINT chk_assignment_self_source CHECK (source_assignment_id IS NULL OR source_assignment_id <> id);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_source
  ON public.staff_assignments (business_id, source_assignment_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_acting_dates
  ON public.staff_assignments (acting_for_assignment_id, starts_at, ends_at)
  WHERE acting_for_assignment_id IS NOT NULL;

-- ====================================================================
-- 3. Create Append-Only Assignment Event History Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.organization_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.staff_assignments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'scheduled', 'activated', 'extended', 'ended', 'cancelled',
    'acting_started', 'acting_ended', 'temporary_started', 'temporary_ended',
    'secondment_started', 'secondment_ended', 'promoted', 'transferred', 'reorganized'
  )),
  previous_status TEXT NULL,
  new_status TEXT NULL,
  related_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE SET NULL,
  metadata JSONB NULL,
  reason TEXT NULL,
  changed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_assignment_history_assign
  ON public.organization_assignment_history (business_id, assignment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_assignment_history_biz_time
  ON public.organization_assignment_history (business_id, changed_at DESC);

ALTER TABLE public.organization_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assignment history in business"
  ON public.organization_assignment_history
  FOR SELECT
  TO authenticated
  USING (public.auth_has_business_access(business_id));

CREATE POLICY "Users can manage assignment history in business"
  ON public.organization_assignment_history
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- ====================================================================
-- 4. Validation Trigger for Acting & Secondment Invariants
-- ====================================================================
CREATE OR REPLACE FUNCTION public.check_acting_secondment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acting_target RECORD;
  v_source_record RECORD;
  v_absence_record RECORD;
  v_overlap_count INT;
BEGIN
  -- 1. Acting Assignment Invariants
  IF NEW.assignment_type = 'acting' THEN
    IF NEW.acting_for_assignment_id IS NULL THEN
      RAISE EXCEPTION 'Acting assignment must specify an acting_for_assignment_id';
    END IF;

    IF NEW.ends_at IS NULL THEN
      RAISE EXCEPTION 'Acting assignment must have an ends_at date specified';
    END IF;

    -- Validate target assignment
    SELECT id, business_id, assignment_type, status INTO v_acting_target
    FROM public.staff_assignments
    WHERE id = NEW.acting_for_assignment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acting target assignment % not found', NEW.acting_for_assignment_id;
    END IF;

    IF v_acting_target.business_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Acting target assignment % does not belong to business %', NEW.acting_for_assignment_id, NEW.business_id;
    END IF;

    -- Block acting-for-acting chain
    IF v_acting_target.assignment_type = 'acting' THEN
      RAISE EXCEPTION 'Cannot create an acting assignment covering another acting assignment';
    END IF;

    -- Overlap Check for active or scheduled acting assignments covering the same target
    IF NEW.status IN ('active', 'scheduled') THEN
      SELECT COUNT(*) INTO v_overlap_count
      FROM public.staff_assignments
      WHERE acting_for_assignment_id = NEW.acting_for_assignment_id
        AND status IN ('active', 'scheduled')
        AND (NEW.id IS NULL OR id <> NEW.id)
        AND (
          (NEW.ends_at IS NULL AND (ends_at IS NULL OR ends_at > NEW.starts_at)) OR
          (NEW.ends_at IS NOT NULL AND starts_at < NEW.ends_at AND (ends_at IS NULL OR ends_at > NEW.starts_at))
        );

      IF v_overlap_count > 0 THEN
        RAISE EXCEPTION 'Conflicting overlapping acting assignment already exists for substantive assignment %', NEW.acting_for_assignment_id;
      END IF;
    END IF;
  END IF;

  -- 2. Secondment Assignment Invariants
  IF NEW.assignment_type = 'secondment' THEN
    IF NEW.source_assignment_id IS NULL THEN
      RAISE EXCEPTION 'Secondment assignment must specify a home source_assignment_id';
    END IF;

    SELECT id, business_id, status INTO v_source_record
    FROM public.staff_assignments
    WHERE id = NEW.source_assignment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Home source assignment % not found', NEW.source_assignment_id;
    END IF;

    IF v_source_record.business_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Home source assignment % does not belong to business %', NEW.source_assignment_id, NEW.business_id;
    END IF;
  END IF;

  -- 3. Source Assignment Tenant Validation (if set on any other type)
  IF NEW.source_assignment_id IS NOT NULL AND NEW.assignment_type <> 'secondment' THEN
    SELECT business_id INTO v_source_record
    FROM public.staff_assignments
    WHERE id = NEW.source_assignment_id;

    IF NOT FOUND OR v_source_record.business_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Source assignment % does not belong to business %', NEW.source_assignment_id, NEW.business_id;
    END IF;
  END IF;

  -- 4. Coverage Absence Tenant Validation
  IF NEW.coverage_absence_id IS NOT NULL THEN
    SELECT id, business_id, assignment_id INTO v_absence_record
    FROM public.organization_assignment_absences
    WHERE id = NEW.coverage_absence_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Coverage absence % not found', NEW.coverage_absence_id;
    END IF;

    IF v_absence_record.business_id <> NEW.business_id THEN
      RAISE EXCEPTION 'Coverage absence % does not belong to business %', NEW.coverage_absence_id, NEW.business_id;
    END IF;

    IF NEW.acting_for_assignment_id IS NOT NULL AND v_absence_record.assignment_id <> NEW.acting_for_assignment_id THEN
      RAISE EXCEPTION 'Coverage absence assignment % does not match acting target assignment %', v_absence_record.assignment_id, NEW.acting_for_assignment_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_acting_secondment_integrity ON public.staff_assignments;
CREATE TRIGGER trg_check_acting_secondment_integrity
  BEFORE INSERT OR UPDATE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_acting_secondment_integrity();

-- ====================================================================
-- 5. Atomic RPC: Create Acting Assignment
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_acting_assignment_atomic(
  p_business_id UUID,
  p_business_membership_id UUID,
  p_acting_for_assignment_id UUID,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_coverage_absence_id UUID DEFAULT NULL,
  p_reports_to_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_reason TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
  v_new_assignment_id UUID;
  v_final_reports_to UUID;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'End date (%) must be strictly after start date (%)', p_ends_at, p_starts_at;
  END IF;

  -- Lock substantive target assignment
  SELECT * INTO v_target
  FROM public.staff_assignments
  WHERE id = p_acting_for_assignment_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target substantive assignment % not found in business %', p_acting_for_assignment_id, p_business_id;
  END IF;

  IF v_target.assignment_type = 'acting' THEN
    RAISE EXCEPTION 'Cannot act for an acting assignment';
  END IF;

  -- Inherit reporting manager from target if not explicitly overridden
  v_final_reports_to := COALESCE(p_reports_to_id, v_target.reports_to_assignment_id);

  -- Insert acting assignment
  INSERT INTO public.staff_assignments (
    business_id,
    business_membership_id,
    branch_id,
    department_id,
    unit_id,
    position_id,
    job_title_id,
    assignment_type,
    is_primary,
    status,
    starts_at,
    ends_at,
    acting_for_assignment_id,
    coverage_absence_id,
    reports_to_assignment_id,
    reason
  )
  VALUES (
    p_business_id,
    p_business_membership_id,
    v_target.branch_id,
    v_target.department_id,
    v_target.unit_id,
    v_target.position_id,
    v_target.job_title_id,
    'acting',
    false,
    p_status,
    p_starts_at,
    p_ends_at,
    p_acting_for_assignment_id,
    p_coverage_absence_id,
    v_final_reports_to,
    p_reason
  )
  RETURNING id INTO v_new_assignment_id;

  -- Log event in assignment history
  INSERT INTO public.organization_assignment_history (
    business_id,
    assignment_id,
    event_type,
    previous_status,
    new_status,
    related_assignment_id,
    metadata,
    reason,
    changed_by,
    changed_at
  )
  VALUES (
    p_business_id,
    v_new_assignment_id,
    CASE WHEN p_status = 'scheduled' THEN 'scheduled' ELSE 'acting_started' END,
    NULL,
    p_status,
    p_acting_for_assignment_id,
    jsonb_build_object(
      'acting_for_assignment_id', p_acting_for_assignment_id,
      'coverage_absence_id', p_coverage_absence_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at
    ),
    p_reason,
    p_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'acting_for_assignment_id', p_acting_for_assignment_id,
    'starts_at', p_starts_at,
    'ends_at', p_ends_at
  );
END;
$$;

-- ====================================================================
-- 6. Atomic RPC: Extend Acting Assignment
-- ====================================================================
CREATE OR REPLACE FUNCTION public.extend_acting_assignment_atomic(
  p_business_id UUID,
  p_assignment_id UUID,
  p_new_ends_at TIMESTAMPTZ,
  p_reason TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assign RECORD;
  v_old_ends_at TIMESTAMPTZ;
BEGIN
  -- Lock assignment
  SELECT * INTO v_assign
  FROM public.staff_assignments
  WHERE id = p_assignment_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acting assignment % not found in business %', p_assignment_id, p_business_id;
  END IF;

  IF v_assign.assignment_type <> 'acting' THEN
    RAISE EXCEPTION 'Assignment % is not an acting assignment (type: %)', p_assignment_id, v_assign.assignment_type;
  END IF;

  IF v_assign.status NOT IN ('active', 'scheduled') THEN
    RAISE EXCEPTION 'Cannot extend acting assignment with status %', v_assign.status;
  END IF;

  IF p_new_ends_at <= v_assign.starts_at THEN
    RAISE EXCEPTION 'New end date (%) must be strictly after start date (%)', p_new_ends_at, v_assign.starts_at;
  END IF;

  v_old_ends_at := v_assign.ends_at;

  -- Update ends_at
  UPDATE public.staff_assignments
  SET ends_at = p_new_ends_at,
      reason = COALESCE(p_reason, reason),
      updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Log history event
  INSERT INTO public.organization_assignment_history (
    business_id,
    assignment_id,
    event_type,
    previous_status,
    new_status,
    related_assignment_id,
    metadata,
    reason,
    changed_by,
    changed_at
  )
  VALUES (
    p_business_id,
    p_assignment_id,
    'extended',
    v_assign.status,
    v_assign.status,
    v_assign.acting_for_assignment_id,
    jsonb_build_object(
      'previous_ends_at', v_old_ends_at,
      'new_ends_at', p_new_ends_at
    ),
    p_reason,
    p_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'previous_ends_at', v_old_ends_at,
    'new_ends_at', p_new_ends_at
  );
END;
$$;

-- ====================================================================
-- 7. Atomic RPC: Create Secondment
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_secondment_atomic(
  p_business_id UUID,
  p_business_membership_id UUID,
  p_source_assignment_id UUID,
  p_job_title_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NOW(),
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_reports_to_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'active',
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source RECORD;
  v_new_assignment_id UUID;
BEGIN
  -- Validate source home assignment
  SELECT * INTO v_source
  FROM public.staff_assignments
  WHERE id = p_source_assignment_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source home assignment % not found in business %', p_source_assignment_id, p_business_id;
  END IF;

  INSERT INTO public.staff_assignments (
    business_id,
    business_membership_id,
    branch_id,
    department_id,
    unit_id,
    position_id,
    job_title_id,
    assignment_type,
    is_primary,
    status,
    starts_at,
    ends_at,
    source_assignment_id,
    reports_to_assignment_id,
    reason
  )
  VALUES (
    p_business_id,
    p_business_membership_id,
    p_branch_id,
    p_department_id,
    p_unit_id,
    p_position_id,
    p_job_title_id,
    'secondment',
    false,
    p_status,
    p_starts_at,
    p_ends_at,
    p_source_assignment_id,
    p_reports_to_id,
    p_reason
  )
  RETURNING id INTO v_new_assignment_id;

  INSERT INTO public.organization_assignment_history (
    business_id,
    assignment_id,
    event_type,
    previous_status,
    new_status,
    related_assignment_id,
    metadata,
    reason,
    changed_by,
    changed_at
  )
  VALUES (
    p_business_id,
    v_new_assignment_id,
    CASE WHEN p_status = 'scheduled' THEN 'scheduled' ELSE 'secondment_started' END,
    NULL,
    p_status,
    p_source_assignment_id,
    jsonb_build_object(
      'source_assignment_id', p_source_assignment_id,
      'destination_branch_id', p_branch_id,
      'starts_at', p_starts_at,
      'ends_at', p_ends_at
    ),
    p_reason,
    p_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'source_assignment_id', p_source_assignment_id
  );
END;
$$;

-- ====================================================================
-- 8. Atomic RPC: Idempotent Lifecycle Reconciliation Engine
-- ====================================================================
CREATE OR REPLACE FUNCTION public.reconcile_temporary_staff_assignments(
  p_business_id UUID DEFAULT NULL,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated_count INT := 0;
  v_ended_count INT := 0;
  v_rec RECORD;
BEGIN
  -- 1. Activate scheduled assignments whose starts_at <= reference_time
  FOR v_rec IN
    SELECT id, business_id, assignment_type
    FROM public.staff_assignments
    WHERE status = 'scheduled'
      AND starts_at <= p_reference_time
      AND (p_business_id IS NULL OR business_id = p_business_id)
    FOR UPDATE
  LOOP
    UPDATE public.staff_assignments
    SET status = 'active',
        updated_at = NOW()
    WHERE id = v_rec.id;

    INSERT INTO public.organization_assignment_history (
      business_id,
      assignment_id,
      event_type,
      previous_status,
      new_status,
      reason,
      changed_at
    )
    VALUES (
      v_rec.business_id,
      v_rec.id,
      'activated',
      'scheduled',
      'active',
      'Activated by lifecycle reconciliation',
      NOW()
    );

    v_activated_count := v_activated_count + 1;
  END LOOP;

  -- 2. End active temporary/acting assignments whose ends_at <= reference_time
  FOR v_rec IN
    SELECT id, business_id, assignment_type
    FROM public.staff_assignments
    WHERE status = 'active'
      AND ends_at IS NOT NULL
      AND ends_at <= p_reference_time
      AND assignment_type IN ('acting', 'temporary', 'secondment')
      AND (p_business_id IS NULL OR business_id = p_business_id)
    FOR UPDATE
  LOOP
    UPDATE public.staff_assignments
    SET status = 'ended',
        updated_at = NOW()
    WHERE id = v_rec.id;

    INSERT INTO public.organization_assignment_history (
      business_id,
      assignment_id,
      event_type,
      previous_status,
      new_status,
      reason,
      changed_at
    )
    VALUES (
      v_rec.business_id,
      v_rec.id,
      CASE
        WHEN v_rec.assignment_type = 'acting' THEN 'acting_ended'
        WHEN v_rec.assignment_type = 'secondment' THEN 'secondment_ended'
        ELSE 'ended'
      END,
      'active',
      'ended',
      'Ended by lifecycle reconciliation due to expiration',
      NOW()
    );

    v_ended_count := v_ended_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'reference_time', p_reference_time,
    'activated_count', v_activated_count,
    'ended_count', v_ended_count
  );
END;
$$;
