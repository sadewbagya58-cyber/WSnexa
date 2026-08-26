-- Migration: V1 Subscription Payments Provider-Neutral Architecture & Purpose Tracking
-- Version: 20260826040000
-- Purpose: Adds explicit payment_purpose column and provider transaction uniqueness constraint for SaaS subscription billing

-- 1. Add Payment Purpose Column
ALTER TABLE public.business_subscription_payments
  ADD COLUMN IF NOT EXISTS payment_purpose TEXT NOT NULL DEFAULT 'new_subscription'
  CHECK (payment_purpose IN ('new_subscription', 'upgrade', 'downgrade', 'renewal', 'reactivation'));

-- 2. Provider Transaction Uniqueness Index (Partial Index for non-null provider transactions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_payments_provider_tx_unique
  ON public.business_subscription_payments(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
