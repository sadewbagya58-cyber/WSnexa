-- ============================================================================
-- Migration: 20261003120000_manual_bank_transfer_schema.sql
-- Description: Manual Bank-Transfer Subscription Payment Schema, Anti-Replay Claims,
--              Proof History, Super Admin Authorization & Table RLS.
-- Notice: Storage bucket & policies decoupled to 20261003123000 to prevent cross-domain lock deadlocks.
-- ============================================================================

-- Defensive lock timeout: Fail fast if an exclusive lock cannot be acquired within 5s
SET LOCAL lock_timeout = '5s';

-- 1. Enhance public.business_subscription_payments
ALTER TABLE public.business_subscription_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS review_status TEXT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS verified_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS bank_statement_ref TEXT NULL;

-- Payment method constraint
DO $$ BEGIN
  ALTER TABLE public.business_subscription_payments
    ADD CONSTRAINT chk_sub_payment_method
    CHECK (payment_method IN ('manual_bank_transfer', 'online_gateway') OR payment_method IS NULL);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Review status constraint
DO $$ BEGIN
  ALTER TABLE public.business_subscription_payments
    ADD CONSTRAINT chk_sub_review_status
    CHECK (review_status IN ('none', 'pending_proof', 'under_review', 'approved', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Composite unique constraint to support composite foreign keys for anti-spoofing
DO $$ BEGIN
  ALTER TABLE public.business_subscription_payments
    ADD CONSTRAINT uq_subscription_payments_id_business
    UNIQUE (id, business_id);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- 2. Safe Legacy Data Backfill
-- Historical rows with a known provider are marked as 'online_gateway'.
-- Historical rows with provider IS NULL remain payment_method = NULL (abandoned/unselected intents).
UPDATE public.business_subscription_payments
SET payment_method = 'online_gateway'
WHERE provider IS NOT NULL AND payment_method IS NULL;

-- 3. Create Proof Submission Table
CREATE TABLE IF NOT EXISTS public.business_subscription_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  business_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'under_review' CHECK (review_status IN ('pending_proof', 'under_review', 'approved', 'rejected')),
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_proofs_payment_business FOREIGN KEY (payment_id, business_id)
    REFERENCES public.business_subscription_payments(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sub_proofs_payment_id ON public.business_subscription_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_sub_proofs_business_id ON public.business_subscription_proofs(business_id);

-- 4. Create Bank-Reference Claims Table (Hybrid Model B)
CREATE TABLE IF NOT EXISTS public.business_subscription_payment_reference_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  business_id UUID NOT NULL,
  raw_reference TEXT NOT NULL,
  normalized_reference TEXT NOT NULL,
  claim_status TEXT NOT NULL DEFAULT 'active' CHECK (claim_status IN ('active', 'under_review', 'settled_paid', 'disputed_conflict', 'superseded_typo', 'rejected_claim')),
  claimed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  settlement_payment_id UUID REFERENCES public.business_subscription_payments(id) ON DELETE SET NULL,
  conflict_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_claims_payment_business FOREIGN KEY (payment_id, business_id)
    REFERENCES public.business_subscription_payments(id, business_id) ON DELETE CASCADE
);

-- Unique index for settled payments (Permanent Anti-Replay: Once settled, NEVER reusable globally)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_payments_ref_settled_unique
  ON public.business_subscription_payment_reference_claims (normalized_reference)
  WHERE claim_status = 'settled_paid';

-- Search and lookup indexes for claims
CREATE INDEX IF NOT EXISTS idx_sub_payments_ref_norm
  ON public.business_subscription_payment_reference_claims (normalized_reference);

CREATE INDEX IF NOT EXISTS idx_sub_payments_claims_payment
  ON public.business_subscription_payment_reference_claims (payment_id);

CREATE INDEX IF NOT EXISTS idx_sub_payments_claims_business
  ON public.business_subscription_payment_reference_claims (business_id);

-- 4.1 Canonical Super Admin Authorization Helper
-- Authoritative check against public.user_profiles for platform super administrator privilege.
CREATE OR REPLACE FUNCTION public.auth_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND is_super_admin = TRUE
      AND account_status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_super_admin FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_super_admin TO authenticated, service_role;

-- 5. Row Level Security for Proofs & Claims
ALTER TABLE public.business_subscription_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscription_payment_reference_claims ENABLE ROW LEVEL SECURITY;

-- Business Owners can read proofs for their own business
DROP POLICY IF EXISTS "Business owners can read own subscription proofs" ON public.business_subscription_proofs;
CREATE POLICY "Business owners can read own subscription proofs"
  ON public.business_subscription_proofs FOR SELECT
  TO authenticated
  USING (public.auth_is_business_owner(business_id));

-- Super Admins can read all subscription proofs
DROP POLICY IF EXISTS "Super admins can read all subscription proofs" ON public.business_subscription_proofs;
CREATE POLICY "Super admins can read all subscription proofs"
  ON public.business_subscription_proofs FOR SELECT
  TO authenticated
  USING (public.auth_is_super_admin());

-- Business Owners can read reference claims for their own business
DROP POLICY IF EXISTS "Business owners can read own reference claims" ON public.business_subscription_payment_reference_claims;
CREATE POLICY "Business owners can read own reference claims"
  ON public.business_subscription_payment_reference_claims FOR SELECT
  TO authenticated
  USING (public.auth_is_business_owner(business_id));

-- Super Admins can read all reference claims
DROP POLICY IF EXISTS "Super admins can read all reference claims" ON public.business_subscription_payment_reference_claims;
CREATE POLICY "Super admins can read all reference claims"
  ON public.business_subscription_payment_reference_claims FOR SELECT
  TO authenticated
  USING (public.auth_is_super_admin());

-- Mutations directly on proofs and claims are revoked from public/anon/authenticated (SECURITY DEFINER RPCs manage state)
REVOKE INSERT, UPDATE, DELETE ON public.business_subscription_proofs FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.business_subscription_payment_reference_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_subscription_proofs TO service_role;
GRANT ALL ON public.business_subscription_payment_reference_claims TO service_role;
