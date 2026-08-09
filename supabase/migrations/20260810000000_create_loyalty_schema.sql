-- ============================================================================
-- WSNexa Phase 19 Schema Migration
-- Loyalty, Rewards & Customer Retention System
-- ============================================================================

-- 1. Insert Loyalty Permissions into permissions table
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES
  ('loyalty.view', 'View Loyalty Program', 'Allows staff to view loyalty program settings, analytics, and accounts', 'loyalty', 'low'),
  ('loyalty.manage', 'Manage Loyalty Program', 'Allows editing loyalty program rules, earning rates, and settings', 'loyalty', 'medium'),
  ('loyalty.rewards.manage', 'Manage Loyalty Rewards', 'Allows creating, editing, and disabling rewards in the catalog', 'loyalty', 'medium'),
  ('loyalty.customers.view', 'View Loyalty Customers', 'Allows viewing customer loyalty point balances and transaction history', 'loyalty', 'low'),
  ('loyalty.points.adjust', 'Adjust Customer Points', 'Allows manual addition or deduction of customer loyalty points with audit reason', 'loyalty', 'high')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 2. Map permissions to built-in roles in role_permissions (using role_key)
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT v.role_key, v.permission_key
FROM (VALUES
  ('business_owner', 'loyalty.view'),
  ('business_owner', 'loyalty.manage'),
  ('business_owner', 'loyalty.rewards.manage'),
  ('business_owner', 'loyalty.customers.view'),
  ('business_owner', 'loyalty.points.adjust'),
  ('branch_manager', 'loyalty.view'),
  ('branch_manager', 'loyalty.rewards.manage'),
  ('branch_manager', 'loyalty.customers.view')
) AS v(role_key, permission_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = v.role_key
    AND rp.permission_key = v.permission_key
    AND rp.business_id IS NULL
);

-- 3. Create public.loyalty_program_settings table (1:1 with business)
CREATE TABLE IF NOT EXISTS public.loyalty_program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  earning_model TEXT NOT NULL DEFAULT 'spend_based' CHECK (earning_model IN ('spend_based', 'visit_based', 'combined')),
  spend_lkr_per_point NUMERIC(10, 2) NOT NULL DEFAULT 100.00 CHECK (spend_lkr_per_point > 0),
  points_per_visit INTEGER NOT NULL DEFAULT 10 CHECK (points_per_visit >= 0),
  minimum_order_spend_cents INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_spend_cents >= 0),
  min_redemption_balance INTEGER NOT NULL DEFAULT 0 CHECK (min_redemption_balance >= 0),
  max_points_per_order INTEGER NULL CHECK (max_points_per_order IS NULL OR max_points_per_order > 0),
  points_expiry_days INTEGER NULL CHECK (points_expiry_days IS NULL OR points_expiry_days > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create public.loyalty_tiers table
CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  min_lifetime_spend_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_lifetime_spend_cents >= 0),
  min_lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (min_lifetime_points >= 0),
  min_completed_visits INTEGER NOT NULL DEFAULT 0 CHECK (min_completed_visits >= 0),
  multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00 CHECK (multiplier >= 1.00),
  badge_color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id, tier_name)
);

-- 5. Create public.customer_loyalty_accounts table
CREATE TABLE IF NOT EXISTS public.customer_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points_earned >= 0),
  lifetime_points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points_redeemed >= 0),
  lifetime_visit_count INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_visit_count >= 0),
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_spend_cents >= 0),
  current_tier_id UUID REFERENCES public.loyalty_tiers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(customer_user_id, business_id)
);

-- 6. Create public.loyalty_rewards table
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('fixed_discount', 'percentage_discount', 'free_item', 'custom')),
  discount_amount_cents INTEGER CHECK (discount_amount_cents IS NULL OR discount_amount_cents >= 0),
  discount_percentage NUMERIC(5, 2) CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  free_menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  min_order_value_cents INTEGER NOT NULL DEFAULT 0 CHECK (min_order_value_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Create public.loyalty_points_ledger table (Immutable Transaction Log)
CREATE TABLE IF NOT EXISTS public.loyalty_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'refund_adjustment', 'manual_adjustment')),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to strictly prevent duplicate earning on the same order
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_ledger_order_earn
  ON public.loyalty_points_ledger(order_id)
  WHERE transaction_type = 'earn' AND order_id IS NOT NULL;

-- 8. Create public.loyalty_reward_redemptions table
CREATE TABLE IF NOT EXISTS public.loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL CHECK (points_spent > 0),
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'fulfilled', 'cancelled')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

-- Indexes for high-performance loyalty queries
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_cust_biz ON public.customer_loyalty_accounts(customer_user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_cust_biz ON public.loyalty_points_ledger(customer_user_id, business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_biz_active ON public.loyalty_rewards(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_cust ON public.loyalty_reward_redemptions(customer_user_id, business_id);

-- RLS Policies
ALTER TABLE public.loyalty_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Read policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_program_settings' AND policyname = 'loyalty_program_settings_read') THEN
    CREATE POLICY loyalty_program_settings_read ON public.loyalty_program_settings FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_rewards' AND policyname = 'loyalty_rewards_read') THEN
    CREATE POLICY loyalty_rewards_read ON public.loyalty_rewards FOR SELECT TO authenticated, anon USING (is_active = true OR public.auth_has_business_access(business_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_loyalty_accounts' AND policyname = 'customer_loyalty_accounts_read') THEN
    CREATE POLICY customer_loyalty_accounts_read ON public.customer_loyalty_accounts FOR SELECT TO authenticated USING (customer_user_id = auth.uid() OR public.auth_has_business_access(business_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_points_ledger' AND policyname = 'loyalty_points_ledger_read') THEN
    CREATE POLICY loyalty_points_ledger_read ON public.loyalty_points_ledger FOR SELECT TO authenticated USING (customer_user_id = auth.uid() OR public.auth_has_business_access(business_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loyalty_reward_redemptions' AND policyname = 'loyalty_reward_redemptions_read') THEN
    CREATE POLICY loyalty_reward_redemptions_read ON public.loyalty_reward_redemptions FOR SELECT TO authenticated USING (customer_user_id = auth.uid() OR public.auth_has_business_access(business_id));
  END IF;
END $$;
