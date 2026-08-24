-- Description: Phase 35 Step 2 Table Allocation, Combinations, & Waitlist Schema

-- 1. Extend public.dining_tables with min_capacity and reservations_enabled
ALTER TABLE public.dining_tables
  ADD COLUMN IF NOT EXISTS min_capacity INTEGER NOT NULL DEFAULT 1 CHECK (min_capacity >= 1),
  ADD COLUMN IF NOT EXISTS reservations_enabled BOOLEAN NOT NULL DEFAULT true;

-- 2. Extend public.reservation_settings with buffer & combination limits
ALTER TABLE public.reservation_settings
  ADD COLUMN IF NOT EXISTS table_turnover_buffer_minutes INTEGER NOT NULL DEFAULT 15 CHECK (table_turnover_buffer_minutes >= 0),
  ADD COLUMN IF NOT EXISTS max_table_combination INTEGER NOT NULL DEFAULT 3 CHECK (max_table_combination >= 1);

-- 3. Create public.reservation_table_assignments table
CREATE TABLE IF NOT EXISTS public.reservation_table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.dining_tables(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('AUTO', 'MANUAL', 'WALK_IN')),
  assigned_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create public.reservation_waitlist_entries table
CREATE TABLE IF NOT EXISTS public.reservation_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  crm_customer_id UUID NULL REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL,
  guest_email TEXT NULL,
  guest_phone TEXT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  requested_start_at TIMESTAMPTZ NOT NULL,
  requested_end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('WAITING', 'OFFERED', 'SEATED', 'CANCELLED', 'EXPIRED')),
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seated_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_waitlist_end_after_start CHECK (requested_end_at > requested_start_at)
);

-- 5. Create Performance & Search Indexes
CREATE INDEX IF NOT EXISTS idx_res_table_assign_res_id ON public.reservation_table_assignments(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_table_assign_bus_branch ON public.reservation_table_assignments(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_res_table_assign_active ON public.reservation_table_assignments(table_id, released_at) WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_res_waitlist_bus_branch_status ON public.reservation_waitlist_entries(business_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_res_waitlist_crm_customer ON public.reservation_waitlist_entries(crm_customer_id);

-- 6. Server-Authoritative Security & RLS Policies
ALTER TABLE public.reservation_table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_waitlist_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reservation_table_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.reservation_waitlist_entries FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.reservation_table_assignments TO service_role;
GRANT ALL ON public.reservation_waitlist_entries TO service_role;

-- 7. Seed Canonical Allocation Capability Permissions in public.permissions
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES
  ('reservations.assign_tables', 'Assign Dining Tables', 'Manually or automatically assign dining tables to reservations', 'Reservations', 'medium'),
  ('reservations.waitlist_manage', 'Manage Reservation Waitlist', 'Add, reorder, promote, or cancel waitlist entries', 'Reservations', 'medium')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 8. Seed Built-In Role Default Permissions for Table Allocation & Waitlist (Idempotent)
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT v.role_key, v.permission_key
FROM (VALUES
  ('business_owner', 'reservations.assign_tables'),
  ('business_owner', 'reservations.waitlist_manage'),
  ('branch_manager', 'reservations.assign_tables'),
  ('branch_manager', 'reservations.waitlist_manage'),
  ('waiter', 'reservations.assign_tables'),
  ('waiter', 'reservations.waitlist_manage'),
  ('cashier', 'reservations.waitlist_manage')
) AS v(role_key, permission_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = v.role_key
    AND rp.permission_key = v.permission_key
    AND rp.business_id IS NULL
);
