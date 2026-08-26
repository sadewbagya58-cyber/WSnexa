-- Migration: V1 Subscription Payments Schema (Phase 36 Step 1)
-- Version: 20260826030000
-- Purpose: Dedicated SaaS subscription billing payment history domain for WSNexa (Business Owner -> WSNexa)

-- 1. Create Business Subscription Payments Table
CREATE TABLE IF NOT EXISTS public.business_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.business_subscriptions(id) ON DELETE SET NULL,
  
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'growth', 'enterprise')),
  billing_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_interval IN ('monthly')),
  
  amount_lkr INTEGER NOT NULL CHECK (amount_lkr >= 0),
  currency TEXT NOT NULL DEFAULT 'LKR' CHECK (currency = 'LKR'),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'expired', 'refunded')
  ),
  
  provider TEXT,
  provider_checkout_id TEXT,
  provider_transaction_id TEXT,
  provider_reference TEXT,
  
  idempotency_key TEXT UNIQUE NOT NULL,
  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_metadata JSONB DEFAULT '{}'::jsonb,
  
  failure_code TEXT,
  failure_message TEXT,
  
  initiated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  processing_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- 2. Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_sub_payments_business_id ON public.business_subscription_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_subscription_id ON public.business_subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.business_subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_provider_tx ON public.business_subscription_payments(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

-- 3. Row Level Security & Access Control
ALTER TABLE public.business_subscription_payments ENABLE ROW LEVEL SECURITY;

-- Business Owners can read payment history for their business
CREATE POLICY "Business owners can read own business subscription payments"
  ON public.business_subscription_payments FOR SELECT
  TO authenticated
  USING (public.auth_is_business_owner(business_id));

-- Direct client mutation is blocked; trusted server admin client performs insertions & status updates
REVOKE INSERT, UPDATE, DELETE ON TABLE public.business_subscription_payments FROM anon, authenticated;
