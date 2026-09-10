-- ============================================================================
-- WSNexa QA-7: Order Cancellation Policy Database Constraint Fix
-- Migration: 20260910110000_qa7_cancellation_policy_constraint.sql
-- ============================================================================

-- 1. Drop all previous constraint variations (including PostgreSQL 63-character truncation variants)
ALTER TABLE public.branch_order_security_settings
  DROP CONSTRAINT IF EXISTS branch_order_security_settin_customer_cancellation_policy_check;

ALTER TABLE public.branch_order_security_settings
  DROP CONSTRAINT IF EXISTS branch_order_security_setting_customer_cancellation_policy_check;

ALTER TABLE public.branch_order_security_settings
  DROP CONSTRAINT IF EXISTS branch_order_security_settings_customer_cancellation_policy_check;

ALTER TABLE public.branch_order_security_settings
  DROP CONSTRAINT IF EXISTS branch_order_sec_cancellation_policy_check;

-- 2. Add standardized check constraint supporting all 6 stage policies
-- Constraint identifier length (38 chars) is well within PostgreSQL NAMEDATALEN (63 chars)
ALTER TABLE public.branch_order_security_settings
  ADD CONSTRAINT branch_order_sec_cancellation_policy_check
  CHECK (customer_cancellation_policy IN (
    'disabled',
    'before_confirmation',
    'within_time_limit',
    'before_preparation',
    'during_preparation',
    'until_ready'
  ));
