-- Migration: 20260811000000_add_loyalty_reward_redemption_to_orders.sql
-- Description: Adds discount, reward snapshot, and points redeemed fields to public.orders for Phase 19.2 QR Menu Loyalty Redemption.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount_cents') THEN
    ALTER TABLE public.orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reward_id') THEN
    ALTER TABLE public.orders ADD COLUMN reward_id UUID REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reward_title_snapshot') THEN
    ALTER TABLE public.orders ADD COLUMN reward_title_snapshot TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reward_points_redeemed_snapshot') THEN
    ALTER TABLE public.orders ADD COLUMN reward_points_redeemed_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (reward_points_redeemed_snapshot >= 0);
  END IF;
END $$;
