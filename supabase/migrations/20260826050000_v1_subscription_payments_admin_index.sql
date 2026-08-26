-- Migration: V1 Subscription Payments Admin Management & Query Optimization
-- Version: 20260826050000
-- Purpose: Adds admin_reason column for audit compliance and query performance indexes for platform-wide admin filtering

-- 1. Add Optional Admin Action Reason Column
ALTER TABLE public.business_subscription_payments
  ADD COLUMN IF NOT EXISTS admin_reason TEXT NULL;

-- 2. Add Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_sub_payments_business_created
  ON public.business_subscription_payments(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_payments_status_created
  ON public.business_subscription_payments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_payments_plan_created
  ON public.business_subscription_payments(plan_code, created_at DESC);
