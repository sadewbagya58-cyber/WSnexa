-- Migration: 20260818060000_phase29_reporting_engine.sql
-- Description: Phase 29 Step 2 — Assignment & Reporting Engine: Reporting History Table, Multi-Hop Cycle Defense, Position Occupancy & Atomic Transition RPCs

-- ====================================================================
-- 1. Create Organization Reporting History Table
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.organization_reporting_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES public.staff_assignments(id) ON DELETE CASCADE,
  previous_manager_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE SET NULL,
  new_manager_assignment_id UUID NULL REFERENCES public.staff_assignments(id) ON DELETE SET NULL,
  reason TEXT NULL,
  changed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & audit queries
CREATE INDEX IF NOT EXISTS idx_org_reporting_history_assignment
  ON public.organization_reporting_history (business_id, assignment_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_reporting_history_biz_time
  ON public.organization_reporting_history (business_id, changed_at DESC);

-- Enable RLS
ALTER TABLE public.organization_reporting_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reporting history within their business"
  ON public.organization_reporting_history
  FOR SELECT
  TO authenticated
  USING (public.auth_has_business_access(business_id));

CREATE POLICY "Users can manage reporting history within their business"
  ON public.organization_reporting_history
  FOR ALL
  TO authenticated
  USING (public.auth_has_business_access(business_id))
  WITH CHECK (public.auth_has_business_access(business_id));

-- Additional performance indexes on staff_assignments
CREATE INDEX IF NOT EXISTS idx_staff_assignments_reporting
  ON public.staff_assignments (business_id, reports_to_assignment_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_position
  ON public.staff_assignments (business_id, position_id, status);

CREATE INDEX IF NOT EXISTS idx_staff_assignments_dates
  ON public.staff_assignments (business_id, starts_at, ends_at);

-- ====================================================================
-- 2. Enhanced Multi-Hop Reporting Cycle Prevention Trigger
-- ====================================================================
CREATE OR REPLACE FUNCTION public.check_staff_reporting_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  curr_id UUID;
  visited_ids UUID[] := ARRAY[]::UUID[];
  mgr_biz_id UUID;
  mgr_status TEXT;
BEGIN
  -- If reports_to_assignment_id is not set, allow
  IF NEW.reports_to_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Direct Self-Reporting Rejection
  IF NEW.id IS NOT NULL AND NEW.reports_to_assignment_id = NEW.id THEN
    RAISE EXCEPTION 'Assignment cannot report to itself (self-reporting is strictly forbidden)';
  END IF;

  -- 2. Validate Reporting Manager belongs to same business & is active/valid
  SELECT business_id, status INTO mgr_biz_id, mgr_status
  FROM public.staff_assignments
  WHERE id = NEW.reports_to_assignment_id;

  IF mgr_biz_id IS NULL OR mgr_biz_id <> NEW.business_id THEN
    RAISE EXCEPTION 'Reporting manager assignment % does not belong to business %', NEW.reports_to_assignment_id, NEW.business_id;
  END IF;

  IF mgr_status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot report to an assignment with status %', mgr_status;
  END IF;

  -- 3. Multi-Hop Transitive Cycle Detection
  curr_id := NEW.reports_to_assignment_id;
  visited_ids := ARRAY[NEW.id];

  WHILE curr_id IS NOT NULL LOOP
    IF curr_id = NEW.id THEN
      RAISE EXCEPTION 'Circular reporting relationship detected: assignment % is in its own reporting ancestry chain', NEW.id;
    END IF;

    IF curr_id = ANY(visited_ids) THEN
      RAISE EXCEPTION 'Circular reporting relationship detected in manager hierarchy';
    END IF;

    visited_ids := array_append(visited_ids, curr_id);

    SELECT reports_to_assignment_id INTO curr_id
    FROM public.staff_assignments
    WHERE id = curr_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_staff_reporting_cycle ON public.staff_assignments;
CREATE TRIGGER trg_check_staff_reporting_cycle
  BEFORE INSERT OR UPDATE ON public.staff_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_staff_reporting_cycle();

-- ====================================================================
-- 3. Atomic Database RPC: Primary Staff Assignment Transition
-- ====================================================================
CREATE OR REPLACE FUNCTION public.transition_staff_primary_assignment(
  p_business_id UUID,
  p_current_assignment_id UUID,
  p_new_position_id UUID DEFAULT NULL,
  p_new_job_title_id UUID DEFAULT NULL,
  p_new_branch_id UUID DEFAULT NULL,
  p_new_department_id UUID DEFAULT NULL,
  p_new_unit_id UUID DEFAULT NULL,
  p_new_reports_to_id UUID DEFAULT NULL,
  p_transition_type TEXT DEFAULT 'promotion',
  p_reason TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_transition_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curr RECORD;
  v_pos RECORD;
  v_jt RECORD;
  v_effective_occupants INT;
  v_new_assignment_id UUID;
  v_final_job_title_id UUID;
  v_final_branch_id UUID;
  v_final_dept_id UUID;
  v_final_unit_id UUID;
BEGIN
  -- 1. Lock and validate current primary assignment
  SELECT * INTO v_curr
  FROM public.staff_assignments
  WHERE id = p_current_assignment_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current staff assignment % not found in business %', p_current_assignment_id, p_business_id;
  END IF;

  IF v_curr.status <> 'active' THEN
    RAISE EXCEPTION 'Current staff assignment is not active (status=%)', v_curr.status;
  END IF;

  -- 2. If target position is specified, lock and validate position capacity & hierarchy
  IF p_new_position_id IS NOT NULL THEN
    SELECT * INTO v_pos
    FROM public.organization_positions
    WHERE id = p_new_position_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target position % not found in business %', p_new_position_id, p_business_id;
    END IF;

    IF v_pos.status IN ('frozen', 'archived') THEN
      RAISE EXCEPTION 'Target position % is % and cannot accept new assignments', p_new_position_id, v_pos.status;
    END IF;

    -- Count effective occupants for position (excluding current assignment if moving from same position)
    SELECT COUNT(*) INTO v_effective_occupants
    FROM public.staff_assignments
    WHERE position_id = p_new_position_id
      AND business_id = p_business_id
      AND status = 'active'
      AND starts_at <= p_transition_time
      AND (ends_at IS NULL OR ends_at > p_transition_time)
      AND id <> p_current_assignment_id;

    IF v_effective_occupants >= v_pos.headcount_limit THEN
      RAISE EXCEPTION 'Target position % has reached maximum headcount limit (% / % occupied)',
        p_new_position_id, v_effective_occupants, v_pos.headcount_limit;
    END IF;

    v_final_job_title_id := COALESCE(p_new_job_title_id, v_pos.job_title_id);
    IF v_final_job_title_id <> v_pos.job_title_id THEN
      RAISE EXCEPTION 'Job title % does not match target position job title %', v_final_job_title_id, v_pos.job_title_id;
    END IF;

    v_final_branch_id := COALESCE(p_new_branch_id, v_pos.branch_id);
    v_final_dept_id := COALESCE(p_new_department_id, v_pos.department_id);
    v_final_unit_id := COALESCE(p_new_unit_id, v_pos.unit_id);
  ELSE
    IF p_new_job_title_id IS NULL THEN
      RAISE EXCEPTION 'Either a target position or a target job title must be specified';
    END IF;

    SELECT * INTO v_jt
    FROM public.organization_job_titles
    WHERE id = p_new_job_title_id AND business_id = p_business_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Target job title % not found in business %', p_new_job_title_id, p_business_id;
    END IF;

    v_final_job_title_id := p_new_job_title_id;
    v_final_branch_id := p_new_branch_id;
    v_final_dept_id := p_new_department_id;
    v_final_unit_id := p_new_unit_id;
  END IF;

  -- 3. End current primary assignment (preserve is_primary=true, assignment_type=primary)
  UPDATE public.staff_assignments
  SET status = 'ended',
      ends_at = p_transition_time,
      reason = COALESCE(p_reason, format('Ended due to %s', p_transition_type)),
      updated_at = NOW()
  WHERE id = p_current_assignment_id;

  -- 4. Create new primary assignment
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
    reports_to_assignment_id,
    reason
  )
  VALUES (
    p_business_id,
    v_curr.business_membership_id,
    v_final_branch_id,
    v_final_dept_id,
    v_final_unit_id,
    p_new_position_id,
    v_final_job_title_id,
    'primary',
    true,
    'active',
    p_transition_time,
    NULL,
    p_new_reports_to_id,
    COALESCE(p_reason, format('Started via %s', p_transition_type))
  )
  RETURNING id INTO v_new_assignment_id;

  -- 5. Record reporting history if manager specified
  IF p_new_reports_to_id IS NOT NULL OR v_curr.reports_to_assignment_id IS NOT NULL THEN
    INSERT INTO public.organization_reporting_history (
      business_id,
      assignment_id,
      previous_manager_assignment_id,
      new_manager_assignment_id,
      reason,
      changed_by,
      changed_at
    )
    VALUES (
      p_business_id,
      v_new_assignment_id,
      v_curr.reports_to_assignment_id,
      p_new_reports_to_id,
      COALESCE(p_reason, format('Reporting set on %s', p_transition_type)),
      p_actor_id,
      p_transition_time
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ended_assignment_id', p_current_assignment_id,
    'new_assignment_id', v_new_assignment_id,
    'transition_type', p_transition_type,
    'transition_time', p_transition_time
  );
END;
$$;

-- ====================================================================
-- 4. Atomic Database RPC: Create Staff Assignment with Capacity Check
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_staff_assignment_atomic(
  p_business_id UUID,
  p_business_membership_id UUID,
  p_job_title_id UUID,
  p_branch_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_unit_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL,
  p_assignment_type TEXT DEFAULT 'primary',
  p_is_primary BOOLEAN DEFAULT false,
  p_status TEXT DEFAULT 'active',
  p_starts_at TIMESTAMPTZ DEFAULT NOW(),
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_reports_to_id UUID DEFAULT NULL,
  p_acting_for_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos RECORD;
  v_effective_occupants INT;
  v_existing_primary_id UUID;
  v_new_assignment_id UUID;
  v_canonical_primary BOOLEAN;
  v_canonical_type TEXT;
BEGIN
  -- Canonical parity synchronization
  v_canonical_primary := COALESCE(p_is_primary, (p_assignment_type = 'primary'));
  IF v_canonical_primary THEN
    v_canonical_type := 'primary';
  ELSE
    v_canonical_type := CASE WHEN p_assignment_type = 'primary' THEN 'additional' ELSE p_assignment_type END;
  END IF;

  -- 1. Check primary uniqueness if active
  IF v_canonical_primary AND p_status = 'active' THEN
    SELECT id INTO v_existing_primary_id
    FROM public.staff_assignments
    WHERE business_membership_id = p_business_membership_id
      AND is_primary = true
      AND status = 'active'
    FOR UPDATE;

    IF v_existing_primary_id IS NOT NULL THEN
      RAISE EXCEPTION 'Business membership already has an active primary assignment (id: %). End or transfer the existing primary assignment before creating a new one.',
        v_existing_primary_id;
    END IF;
  END IF;

  -- 2. If position is specified, lock and validate capacity & status
  IF p_position_id IS NOT NULL THEN
    SELECT * INTO v_pos
    FROM public.organization_positions
    WHERE id = p_position_id AND business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Position % not found in business %', p_position_id, p_business_id;
    END IF;

    IF v_pos.status IN ('frozen', 'archived') THEN
      RAISE EXCEPTION 'Position % is % and cannot accept new assignments', p_position_id, v_pos.status;
    END IF;

    IF p_status = 'active' THEN
      SELECT COUNT(*) INTO v_effective_occupants
      FROM public.staff_assignments
      WHERE position_id = p_position_id
        AND business_id = p_business_id
        AND status = 'active'
        AND starts_at <= p_starts_at
        AND (ends_at IS NULL OR ends_at > p_starts_at);

      IF v_effective_occupants >= v_pos.headcount_limit THEN
        RAISE EXCEPTION 'Position % has reached maximum headcount limit (% / % occupied)',
          p_position_id, v_effective_occupants, v_pos.headcount_limit;
      END IF;
    END IF;

    IF p_job_title_id <> v_pos.job_title_id THEN
      RAISE EXCEPTION 'Job title % does not match position job title %', p_job_title_id, v_pos.job_title_id;
    END IF;
  END IF;

  -- 3. Insert assignment
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
    reports_to_assignment_id,
    acting_for_assignment_id,
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
    v_canonical_type,
    v_canonical_primary,
    p_status,
    p_starts_at,
    p_ends_at,
    p_reports_to_id,
    p_acting_for_id,
    p_reason
  )
  RETURNING id INTO v_new_assignment_id;

  -- 4. Record reporting history if manager assigned
  IF p_reports_to_id IS NOT NULL THEN
    INSERT INTO public.organization_reporting_history (
      business_id,
      assignment_id,
      previous_manager_assignment_id,
      new_manager_assignment_id,
      reason,
      changed_by,
      changed_at
    )
    VALUES (
      p_business_id,
      v_new_assignment_id,
      NULL,
      p_reports_to_id,
      COALESCE(p_reason, 'Initial reporting manager assignment'),
      p_actor_id,
      p_starts_at
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id
  );
END;
$$;

-- ====================================================================
-- 5. Atomic Database RPC: Set Staff Reporting Manager
-- ====================================================================
CREATE OR REPLACE FUNCTION public.set_staff_reporting_manager_atomic(
  p_business_id UUID,
  p_assignment_id UUID,
  p_new_reports_to_id UUID,
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
  v_old_mgr_id UUID;
BEGIN
  -- Lock assignment
  SELECT * INTO v_assign
  FROM public.staff_assignments
  WHERE id = p_assignment_id AND business_id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff assignment % not found in business %', p_assignment_id, p_business_id;
  END IF;

  v_old_mgr_id := v_assign.reports_to_assignment_id;

  -- If same manager, no-op
  IF (v_old_mgr_id IS NULL AND p_new_reports_to_id IS NULL) OR (v_old_mgr_id = p_new_reports_to_id) THEN
    RETURN jsonb_build_object(
      'success', true,
      'assignment_id', p_assignment_id,
      'previous_manager_assignment_id', v_old_mgr_id,
      'new_manager_assignment_id', p_new_reports_to_id,
      'unchanged', true
    );
  END IF;

  -- Update assignment (trigger check_staff_reporting_cycle validates cycle safety & same business)
  UPDATE public.staff_assignments
  SET reports_to_assignment_id = p_new_reports_to_id,
      updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Record reporting history
  INSERT INTO public.organization_reporting_history (
    business_id,
    assignment_id,
    previous_manager_assignment_id,
    new_manager_assignment_id,
    reason,
    changed_by,
    changed_at
  )
  VALUES (
    p_business_id,
    p_assignment_id,
    v_old_mgr_id,
    p_new_reports_to_id,
    p_reason,
    p_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'previous_manager_assignment_id', v_old_mgr_id,
    'new_manager_assignment_id', p_new_reports_to_id
  );
END;
$$;
