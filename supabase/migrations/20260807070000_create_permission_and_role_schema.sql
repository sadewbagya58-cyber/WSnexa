-- Migration: 20260807070000_create_permission_and_role_schema.sql
-- Description: Create permissions, custom_roles, role_permissions, and member_permission_overrides tables

-- 1. Create public.permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create public.custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  role_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- 3. Create public.role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE, -- NULL for global built-in role templates
  role_key TEXT, -- Built-in role key e.g. 'cashier' or 'branch_manager'
  custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_role_permission_target CHECK (
    (role_key IS NOT NULL AND custom_role_id IS NULL) OR
    (role_key IS NULL AND custom_role_id IS NOT NULL)
  )
);

-- 4. Create public.member_permission_overrides table
CREATE TABLE IF NOT EXISTS public.member_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_membership_id UUID NOT NULL REFERENCES public.business_memberships(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_membership_id, permission_key)
);

-- 5. Add custom_role_id to business_memberships and staff_invitations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'business_memberships' AND column_name = 'custom_role_id'
  ) THEN
    ALTER TABLE public.business_memberships ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_invitations' AND column_name = 'custom_role_id'
  ) THEN
    ALTER TABLE public.staff_invitations ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);
CREATE INDEX IF NOT EXISTS idx_custom_roles_business_id ON public.custom_roles(business_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_key ON public.role_permissions(role_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_custom_role_id ON public.role_permissions(custom_role_id);
CREATE INDEX IF NOT EXISTS idx_member_permission_overrides_membership_id ON public.member_permission_overrides(business_membership_id);

-- 7. Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_permission_overrides ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
DO $$ BEGIN
  -- Permissions: readable by authenticated users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'permissions' AND policyname = 'permissions_read_policy') THEN
    CREATE POLICY permissions_read_policy ON public.permissions FOR SELECT TO authenticated USING (true);
  END IF;

  -- Custom Roles: readable by business members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_roles' AND policyname = 'custom_roles_select_policy') THEN
    CREATE POLICY custom_roles_select_policy ON public.custom_roles FOR SELECT TO authenticated USING (public.auth_has_business_access(business_id));
  END IF;

  -- Role Permissions: readable by business members or null business_id
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'role_permissions' AND policyname = 'role_permissions_select_policy') THEN
    CREATE POLICY role_permissions_select_policy ON public.role_permissions FOR SELECT TO authenticated USING (business_id IS NULL OR public.auth_has_business_access(business_id));
  END IF;

  -- Member Permission Overrides: readable by business members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'member_permission_overrides' AND policyname = 'member_overrides_select_policy') THEN
    CREATE POLICY member_overrides_select_policy ON public.member_permission_overrides FOR SELECT TO authenticated USING (
      EXISTS (
        SELECT 1 FROM public.business_memberships bm
        WHERE bm.id = business_membership_id AND public.auth_has_business_access(bm.business_id)
      )
    );
  END IF;
END $$;

-- 9. Seed central permissions catalog
INSERT INTO public.permissions (key, name, description, category, risk_level) VALUES
  ('orders.view', 'View Orders', 'View active and historical guest orders', 'Orders', 'low'),
  ('orders.update_status', 'Update Order Status', 'Update order progress (e.g. preparing, ready, completed)', 'Orders', 'medium'),
  ('orders.cancel', 'Cancel Orders', 'Cancel active orders', 'Orders', 'high'),
  ('kitchen.access', 'Access Kitchen Display', 'Access kitchen display and ticket queue', 'Kitchen', 'low'),
  ('kitchen.update', 'Update Kitchen Ticket', 'Mark kitchen items as preparing or ready', 'Kitchen', 'medium'),
  ('cashier.access', 'Access Cashier POS', 'Access cashier billing and settlement terminal', 'Cashier & Payments', 'medium'),
  ('payments.record', 'Record Payments', 'Confirm cash, card, or QR payments and mark orders paid', 'Cashier & Payments', 'high'),
  ('payments.view', 'View Payment Logs', 'View payment transaction history', 'Cashier & Payments', 'medium'),
  ('receipts.print', 'Print Receipts', 'Generate and print guest receipts', 'Cashier & Payments', 'low'),
  ('waiter.requests.view', 'View Waiter Requests', 'View guest table calls and assistance requests', 'Waiter', 'low'),
  ('waiter.requests.manage', 'Manage Waiter Requests', 'Acknowledge and clear waiter requests', 'Waiter', 'low'),
  ('menu.view', 'View Menu Catalog', 'View menu categories, items, and modifiers', 'Menu & Modifiers', 'low'),
  ('menu.manage', 'Manage Menu Catalog', 'Add, edit, or delete menu items and categories', 'Menu & Modifiers', 'medium'),
  ('tables.view', 'View Dining Tables', 'View dining tables and service areas', 'Dining & Tables', 'low'),
  ('tables.manage', 'Manage Dining Tables', 'Add, edit, bulk generate tables and service areas', 'Dining & Tables', 'medium'),
  ('qr.manage', 'Manage QR Codes', 'Generate and print table QR ordering codes', 'Dining & Tables', 'medium'),
  ('staff.view', 'View Staff Members', 'View staff directory and member statuses', 'Staff & Team', 'low'),
  ('staff.manage', 'Manage Staff Members', 'Assign roles, custom roles, and permission overrides', 'Staff & Team', 'high'),
  ('invitations.manage', 'Manage Staff Invitations', 'Create, revoke, and regenerate staff invitation codes', 'Staff & Team', 'high'),
  ('reports.view', 'View Sales Reports', 'View executive revenue and operational analytics', 'Reports & Analytics', 'medium'),
  ('reports.export', 'Export Reports', 'Export financial and sales data to CSV, XLSX, PDF', 'Reports & Analytics', 'high'),
  ('branches.manage', 'Manage Branches', 'Add, edit, or archive business branch locations', 'Branches', 'critical'),
  ('business.settings.manage', 'Manage Business Settings', 'Edit business profile, currency, and global configuration', 'Business Settings', 'critical'),
  ('owner.transfer', 'Transfer Ownership', 'Transfer business owner privileges', 'Business Settings', 'critical')
ON CONFLICT (key) DO NOTHING;

-- 10. Seed built-in role permissions
-- Branch Manager Default Permissions
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('branch_manager', 'orders.view'),
  ('branch_manager', 'orders.update_status'),
  ('branch_manager', 'orders.cancel'),
  ('branch_manager', 'kitchen.access'),
  ('branch_manager', 'kitchen.update'),
  ('branch_manager', 'cashier.access'),
  ('branch_manager', 'payments.record'),
  ('branch_manager', 'payments.view'),
  ('branch_manager', 'receipts.print'),
  ('branch_manager', 'waiter.requests.view'),
  ('branch_manager', 'waiter.requests.manage'),
  ('branch_manager', 'menu.view'),
  ('branch_manager', 'menu.manage'),
  ('branch_manager', 'tables.view'),
  ('branch_manager', 'tables.manage'),
  ('branch_manager', 'qr.manage'),
  ('branch_manager', 'staff.view'),
  ('branch_manager', 'reports.view'),
  ('branch_manager', 'reports.export')
ON CONFLICT DO NOTHING;

-- Cashier Default Permissions
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('cashier', 'orders.view'),
  ('cashier', 'orders.update_status'),
  ('cashier', 'cashier.access'),
  ('cashier', 'payments.record'),
  ('cashier', 'payments.view'),
  ('cashier', 'receipts.print'),
  ('cashier', 'menu.view'),
  ('cashier', 'tables.view'),
  ('cashier', 'reports.view')
ON CONFLICT DO NOTHING;

-- Kitchen Staff Default Permissions
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('kitchen_staff', 'orders.view'),
  ('kitchen_staff', 'kitchen.access'),
  ('kitchen_staff', 'kitchen.update')
ON CONFLICT DO NOTHING;

-- Waiter Default Permissions
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('waiter', 'orders.view'),
  ('waiter', 'waiter.requests.view'),
  ('waiter', 'waiter.requests.manage'),
  ('waiter', 'menu.view'),
  ('waiter', 'tables.view')
ON CONFLICT DO NOTHING;
