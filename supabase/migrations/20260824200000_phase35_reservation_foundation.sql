-- Description: Create Phase 35 Reservation Foundation tables, indexes, RLS, and default role permissions

-- 1. Create public.reservations table
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  crm_customer_id UUID NULL REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  created_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_source TEXT NOT NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NULL,
  guest_phone TEXT NULL,
  reservation_date DATE NOT NULL,
  reservation_start_at TIMESTAMPTZ NOT NULL,
  reservation_end_at TIMESTAMPTZ NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED')),
  special_requests TEXT NULL,
  internal_notes TEXT NULL,
  occasion TEXT NULL,
  source TEXT NOT NULL CHECK (source IN ('PUBLIC_WEB', 'CUSTOMER_PORTAL', 'STAFF', 'PHONE', 'WALK_IN', 'IMPORT', 'API')),
  confirmation_code TEXT NOT NULL,
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason TEXT NULL,
  arrived_at TIMESTAMPTZ NULL,
  seated_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  no_show_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_reservations_end_after_start CHECK (reservation_end_at > reservation_start_at)
);

-- 2. Create public.reservation_status_events table (append-only status history)
CREATE TABLE IF NOT EXISTS public.reservation_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  from_status TEXT NULL,
  to_status TEXT NOT NULL CHECK (to_status IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED')),
  actor_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('STAFF', 'CUSTOMER', 'SYSTEM')),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create public.reservation_settings table (per-branch operational rules)
CREATE TABLE IF NOT EXISTS public.reservation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  reservations_enabled BOOLEAN NOT NULL DEFAULT true,
  default_duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (default_duration_minutes > 0),
  minimum_party_size INTEGER NOT NULL DEFAULT 1 CHECK (minimum_party_size > 0),
  maximum_party_size INTEGER NOT NULL DEFAULT 20 CHECK (maximum_party_size >= minimum_party_size),
  minimum_advance_minutes INTEGER NOT NULL DEFAULT 30 CHECK (minimum_advance_minutes >= 0),
  maximum_advance_days INTEGER NOT NULL DEFAULT 90 CHECK (maximum_advance_days > 0),
  allow_same_day BOOLEAN NOT NULL DEFAULT true,
  require_guest_phone BOOLEAN NOT NULL DEFAULT false,
  require_guest_email BOOLEAN NOT NULL DEFAULT false,
  auto_confirm BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reservation_settings_business_branch UNIQUE (business_id, branch_id)
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_bus_branch_start ON public.reservations(business_id, branch_id, reservation_start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_bus_branch_status_start ON public.reservations(business_id, branch_id, status, reservation_start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_crm_cust_start ON public.reservations(crm_customer_id, reservation_start_at);
CREATE INDEX IF NOT EXISTS idx_reservations_conf_code ON public.reservations(confirmation_code);
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON public.reservations(created_at);

CREATE INDEX IF NOT EXISTS idx_res_status_events_res_id ON public.reservation_status_events(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_status_events_bus_branch ON public.reservation_status_events(business_id, branch_id, created_at);

CREATE INDEX IF NOT EXISTS idx_reservation_settings_bus_branch ON public.reservation_settings(business_id, branch_id);

-- 5. Security & RLS Policies (Server-Authoritative Pattern)
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.reservation_status_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.reservation_settings FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.reservations TO service_role;
GRANT ALL ON public.reservation_status_events TO service_role;
GRANT ALL ON public.reservation_settings TO service_role;

-- 6. Seed Canonical Reservation Permissions in public.permissions
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES
  ('reservations.view', 'View Dining Reservations', 'View table reservation queue, guest details, and booking status', 'Reservations', 'low'),
  ('reservations.create', 'Create Dining Reservations', 'Book new staff or guest table reservations', 'Reservations', 'medium'),
  ('reservations.manage', 'Manage Dining Reservations', 'Confirm, seat, update, or complete dining reservations and settings', 'Reservations', 'medium'),
  ('reservations.cancel', 'Cancel Dining Reservations', 'Cancel active guest table reservations', 'Reservations', 'high')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 7. Seed Built-In Role Default Permissions for Reservations (Idempotent)
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT v.role_key, v.permission_key
FROM (VALUES
  ('business_owner', 'reservations.view'),
  ('business_owner', 'reservations.create'),
  ('business_owner', 'reservations.manage'),
  ('business_owner', 'reservations.cancel'),
  ('branch_manager', 'reservations.view'),
  ('branch_manager', 'reservations.create'),
  ('branch_manager', 'reservations.manage'),
  ('branch_manager', 'reservations.cancel'),
  ('cashier', 'reservations.view'),
  ('cashier', 'reservations.create'),
  ('waiter', 'reservations.view'),
  ('waiter', 'reservations.create')
) AS v(role_key, permission_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = v.role_key
    AND rp.permission_key = v.permission_key
    AND rp.business_id IS NULL
);
