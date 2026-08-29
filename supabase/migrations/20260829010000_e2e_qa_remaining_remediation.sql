-- ==============================================================================
-- WSNexa — Consolidated Remaining E2E QA Remediation Migration
-- ==============================================================================

-- 1. Add Unique Constraint with NULLS NOT DISTINCT on inventory_settings
DO $$
BEGIN
  -- Drop older expression index if exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'inventory_settings'
      AND indexname = 'uq_inventory_settings_biz_branch'
  ) THEN
    DROP INDEX IF EXISTS public.uq_inventory_settings_biz_branch;
  END IF;

  -- Add canonical UNIQUE NULLS NOT DISTINCT constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_inventory_settings_business_branch'
  ) THEN
    ALTER TABLE public.inventory_settings
      ADD CONSTRAINT uq_inventory_settings_business_branch
      UNIQUE NULLS NOT DISTINCT (business_id, branch_id);
  END IF;
END $$;

-- 2. Ensure Order Security Approval & Rejection columns on orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'approved_by_user_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'rejected_by_user_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN rejected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- 3. Ensure waiter_requests columns for resolution accountability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'waiter_requests'
      AND column_name = 'resolved_by'
  ) THEN
    ALTER TABLE public.waiter_requests
      ADD COLUMN resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'waiter_requests'
      AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE public.waiter_requests
      ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. Update atomic waiter acceptance RPC function
CREATE OR REPLACE FUNCTION public.accept_waiter_request_atomic(
  p_request_id UUID,
  p_staff_user_id UUID,
  p_business_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  UPDATE public.waiter_requests
  SET
    status = 'accepted',
    accepted_by = p_staff_user_id,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id
    AND business_id = p_business_id
    AND branch_id = p_branch_id
    AND status = 'pending'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFLICT_ALREADY_ACCEPTED',
      'message', 'This request has already been accepted or handled by another staff member.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_updated_id,
    'message', 'Request accepted successfully.'
  );
END;
$$;
