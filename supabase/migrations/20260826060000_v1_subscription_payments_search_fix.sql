-- Migration: V1 Subscription Payments Search Fix (id_text Generated Column)
-- Version: 20260826060000
-- Purpose: Adds stored generated id_text column to allow safe text ILIKE partial matching and short-reference searching on UUID payment IDs

-- 1. Add Generated Text Column
ALTER TABLE public.business_subscription_payments
  ADD COLUMN IF NOT EXISTS id_text TEXT GENERATED ALWAYS AS (id::text) STORED;

-- 2. Add Text Index for Fast Search Performance
CREATE INDEX IF NOT EXISTS idx_sub_payments_id_text
  ON public.business_subscription_payments(id_text);
