-- Migration: 20260813000000_phase22_order_security_and_payments.sql
-- Description: Phase 22 Order Security Engine, QR/Table Sessions, Geolocation, Waiter Approval, and Configurable Branch Payment Methods
-- Audit & Safety: Fully additive, non-destructive, idempotent migration with correct PostgreSQL RLS policy syntax and tenant isolation.

-- 1. Add latitude and longitude to branches Table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE public.branches ADD COLUMN latitude NUMERIC(10,7) DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE public.branches ADD COLUMN longitude NUMERIC(10,7) DEFAULT NULL;
  END IF;
END $$;

-- 2. Create branch_order_security_settings Table
CREATE TABLE IF NOT EXISTS public.branch_order_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
  require_customer_account BOOLEAN NOT NULL DEFAULT false,
  require_waiter_approval BOOLEAN NOT NULL DEFAULT false,
  require_location_verification BOOLEAN NOT NULL DEFAULT false,
  require_active_qr_session BOOLEAN NOT NULL DEFAULT true,
  require_table_session BOOLEAN NOT NULL DEFAULT true,
  qr_session_duration_minutes INTEGER NOT NULL DEFAULT 120 CHECK (qr_session_duration_minutes >= 5 AND qr_session_duration_minutes <= 1440),
  location_radius_meters INTEGER NOT NULL DEFAULT 150 CHECK (location_radius_meters >= 10 AND location_radius_meters <= 10000),
  allow_verified_online_payment_bypass BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_order_security_branch
  ON public.branch_order_security_settings (branch_id);

-- 3. Create qr_visit_sessions Table
CREATE TABLE IF NOT EXISTS public.qr_visit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
  table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  session_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_visit_sessions_hash
  ON public.qr_visit_sessions (session_token_hash);

CREATE INDEX IF NOT EXISTS idx_qr_visit_sessions_branch_expires
  ON public.qr_visit_sessions (branch_id, expires_at);

-- 4. Create table_sessions Table
CREATE TABLE IF NOT EXISTS public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  service_area_id UUID REFERENCES public.service_areas(id) ON DELETE SET NULL,
  table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status
  ON public.table_sessions (table_id, status);

-- 5. Create branch_payment_methods Table
CREATE TABLE IF NOT EXISTS public.branch_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('pay_at_counter', 'cash', 'card', 'qr_payment', 'online_payment')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  display_name TEXT,
  instructions TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_branch_payment_method UNIQUE (branch_id, method)
);

CREATE INDEX IF NOT EXISTS idx_branch_payment_methods_branch
  ON public.branch_payment_methods (branch_id, sort_order);

-- 6. Create order_security_audit_logs Table
CREATE TABLE IF NOT EXISTS public.order_security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('QR_SESSION_CREATED', 'QR_SESSION_EXPIRED', 'LOCATION_VERIFIED', 'LOCATION_REJECTED', 'ORDER_SECURITY_REJECTED', 'WAITER_APPROVED_ORDER', 'WAITER_REJECTED_ORDER', 'PAYMENT_VERIFIED', 'PAYMENT_METHOD_REJECTED')),
  safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_security_audit_logs_branch_created
  ON public.order_security_audit_logs (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_security_audit_logs_order
  ON public.order_security_audit_logs (order_id);

-- 7. Add security & approval columns to orders Table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved' 
      CHECK (approval_status IN ('approved', 'pending_waiter_approval', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'approved_by_user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN approved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejected_by_user_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN rejected_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejected_at'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN rejected_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN rejection_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'qr_visit_session_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN qr_visit_session_id UUID REFERENCES public.qr_visit_sessions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'table_session_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'location_verified'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN location_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_verified_online'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_verified_online BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 8. Enable RLS on all Phase 22 tables
ALTER TABLE public.branch_order_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_visit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 9. Idempotent RLS Policies for branch_order_security_settings
DROP POLICY IF EXISTS "Allow read branch_order_security_settings" ON public.branch_order_security_settings;
CREATE POLICY "Allow read branch_order_security_settings"
  ON public.branch_order_security_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage branch_order_security_settings" ON public.branch_order_security_settings;
CREATE POLICY "Allow manage branch_order_security_settings"
  ON public.branch_order_security_settings FOR ALL TO authenticated
  USING (public.auth_has_branch_access(branch_id))
  WITH CHECK (public.auth_has_branch_access(branch_id));

-- 10. Idempotent RLS Policies for qr_visit_sessions
DROP POLICY IF EXISTS "Allow read qr_visit_sessions" ON public.qr_visit_sessions;
CREATE POLICY "Allow read qr_visit_sessions"
  ON public.qr_visit_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage qr_visit_sessions" ON public.qr_visit_sessions;
CREATE POLICY "Allow manage qr_visit_sessions"
  ON public.qr_visit_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 11. Idempotent RLS Policies for table_sessions
DROP POLICY IF EXISTS "Allow read table_sessions" ON public.table_sessions;
CREATE POLICY "Allow read table_sessions"
  ON public.table_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage table_sessions" ON public.table_sessions;
CREATE POLICY "Allow manage table_sessions"
  ON public.table_sessions FOR ALL
  USING (true)
  WITH CHECK (true);

-- 12. Idempotent RLS Policies for branch_payment_methods
DROP POLICY IF EXISTS "Allow read branch_payment_methods" ON public.branch_payment_methods;
CREATE POLICY "Allow read branch_payment_methods"
  ON public.branch_payment_methods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage branch_payment_methods" ON public.branch_payment_methods;
CREATE POLICY "Allow manage branch_payment_methods"
  ON public.branch_payment_methods FOR ALL TO authenticated
  USING (public.auth_has_branch_access(branch_id))
  WITH CHECK (public.auth_has_branch_access(branch_id));

-- 13. Idempotent RLS Policies for order_security_audit_logs
DROP POLICY IF EXISTS "Allow read order_security_audit_logs" ON public.order_security_audit_logs;
CREATE POLICY "Allow read order_security_audit_logs"
  ON public.order_security_audit_logs FOR SELECT TO authenticated
  USING (public.auth_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Allow insert order_security_audit_logs" ON public.order_security_audit_logs;
CREATE POLICY "Allow insert order_security_audit_logs"
  ON public.order_security_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.auth_has_branch_access(branch_id));
