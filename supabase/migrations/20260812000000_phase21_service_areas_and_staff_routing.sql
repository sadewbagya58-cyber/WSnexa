-- Migration: 20260812000000_phase21_service_areas_and_staff_routing.sql
-- Description: Phase 21 Service Areas, Staff Area Assignments, Ordering Modes, and Order Snapshot Columns
-- Audit & Safety: 100% additive, idempotent, non-destructive.

-- 1. Create staff_area_assignments Table
CREATE TABLE IF NOT EXISTS public.staff_area_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  service_area_id UUID NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  business_membership_id UUID NOT NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_area_assignment UNIQUE (business_membership_id, service_area_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_area_assignments_branch_area
  ON public.staff_area_assignments (branch_id, service_area_id);

CREATE INDEX IF NOT EXISTS idx_staff_area_assignments_membership
  ON public.staff_area_assignments (business_membership_id);

-- 2. Add ordering_mode to branches Table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'ordering_mode'
  ) THEN
    ALTER TABLE public.branches ADD COLUMN ordering_mode TEXT NOT NULL DEFAULT 'qr_and_waiter' 
      CHECK (ordering_mode IN ('qr_only', 'waiter_only', 'qr_and_waiter'));
  END IF;
END $$;

-- 3. Add service_area_id, service_area_name_snapshot, order_source, and created_by_user_id to orders Table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'service_area_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'service_area_name_snapshot'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN service_area_name_snapshot TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_source'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN order_source TEXT NOT NULL DEFAULT 'qr_customer' 
      CHECK (order_source IN ('qr_customer', 'waiter', 'pos_cashier', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Enable RLS and Policies for staff_area_assignments
ALTER TABLE public.staff_area_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated staff to read staff_area_assignments"
    ON public.staff_area_assignments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated staff to manage staff_area_assignments"
    ON public.staff_area_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
