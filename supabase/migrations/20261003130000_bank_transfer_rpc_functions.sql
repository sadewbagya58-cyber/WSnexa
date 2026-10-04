-- ============================================================================
-- Migration: 20261003130000_bank_transfer_rpc_functions.sql
-- Description: SECURITY DEFINER Transactional Functions for Manual Bank Transfer:
--              1. register_bank_reference_claim (Customer Submission + Conflict Isolation)
--              2. apply_atomic_subscription_settlement (Super Admin Verified Settlement)
--              3. reject_bank_transfer_payment (Super Admin Payment Rejection)
-- ============================================================================

-- Defensive lock timeout: Fail fast if an exclusive lock cannot be acquired within 5s
SET LOCAL lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 0. PREREQUISITE: auth_is_super_admin()
-- Description: Authoritative check against public.user_profiles for active super admin privilege.
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 1. FUNCTION: register_bank_reference_claim
-- Description: Submits payment proof & registers normalized reference claim with
--              anti-replay checks and automatic disputed_conflict detection.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_bank_reference_claim(
  p_payment_id UUID,
  p_raw_reference TEXT,
  p_file_path TEXT,
  p_file_size_bytes BIGINT,
  p_mime_type TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_user_id UUID;
  v_payment RECORD;
  v_business RECORD;
  v_norm_ref TEXT;
  v_other_active RECORD;
  v_existing_claim_for_payment RECORD;
  v_proof_id UUID;
  v_claim_id UUID;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_claim_status TEXT := 'active';
BEGIN
  -- 1. Security & Identity Check
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'WSNEXA_ERR_UNAUTHENTICATED: Valid user session required.';
  END IF;

  -- 2. Input Validations
  IF p_raw_reference IS NULL OR TRIM(p_raw_reference) = '' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_REFERENCE: Bank reference cannot be empty.';
  END IF;

  IF p_file_path IS NULL OR TRIM(p_file_path) = '' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_FILE: Storage file path is required.';
  END IF;

  IF p_file_size_bytes <= 0 OR p_file_size_bytes > 5242880 THEN
    RAISE EXCEPTION 'WSNEXA_ERR_FILE_SIZE_LIMIT: Proof file size must be between 1 byte and 5 MB.';
  END IF;

  IF p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_MIME: Allowed file types are JPEG, PNG, WEBP, or PDF.';
  END IF;

  -- Normalize reference: remove whitespace and hyphens, uppercase
  v_norm_ref := UPPER(TRIM(regexp_replace(p_raw_reference, '[\s\-]', '', 'g')));
  IF LENGTH(v_norm_ref) < 4 OR LENGTH(v_norm_ref) > 64 THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_REFERENCE: Normalized bank reference length must be between 4 and 64 characters.';
  END IF;

  -- Concurrency Control: Acquire transaction-scoped advisory lock for the normalized reference.
  -- Serializes all concurrent transactions attempting to claim or verify the same bank reference,
  -- eliminating the phantom-read race condition where simultaneous submissions could otherwise
  -- both register as active without deterministic conflict quarantine.
  PERFORM pg_advisory_xact_lock(hashtext('bank_ref:' || v_norm_ref));

  -- 3. Locking Hierarchy: Level 1 (Business) -> Level 3 (Payment) -> Level 4 (Claim)
  SELECT business_id INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WSNEXA_ERR_NOT_FOUND: Payment % does not exist.', p_payment_id;
  END IF;

  -- Lock Level 1: businesses
  SELECT * INTO v_business
  FROM public.businesses
  WHERE id = v_payment.business_id
  FOR UPDATE;

  -- Verify caller is authorized Business Owner of THIS business
  IF NOT public.auth_is_business_owner(v_business.id) THEN
    RAISE EXCEPTION 'WSNEXA_ERR_FORBIDDEN: Caller is not the authorized owner of business %.', v_business.id;
  END IF;

  -- Lock Level 3: business_subscription_payments
  SELECT * INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment.status = 'paid' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_ALREADY_PAID: Payment % is already paid and settled.', p_payment_id;
  END IF;

  IF v_payment.status IN ('failed', 'cancelled', 'expired', 'refunded') THEN
    RAISE EXCEPTION 'WSNEXA_ERR_PAYMENT_TERMINAL: Payment % is in terminal status %.', p_payment_id, v_payment.status;
  END IF;

  IF v_payment.payment_method IS NOT NULL AND v_payment.payment_method <> 'manual_bank_transfer' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_METHOD: Payment % is % and cannot accept bank transfer proof.',
      p_payment_id, v_payment.payment_method;
  END IF;

  -- 4. Anti-Replay: Check if reference was ever settled globally
  IF EXISTS (
    SELECT 1 FROM public.business_subscription_payment_reference_claims
    WHERE normalized_reference = v_norm_ref AND claim_status = 'settled_paid'
  ) THEN
    RAISE EXCEPTION 'WSNEXA_ERR_REF_ALREADY_SETTLED: Bank transfer reference "%" has already been settled and cannot be reused.', v_norm_ref;
  END IF;

  -- 5. Concurrency Collision Check:
  -- Check if another business currently holds an active claim on this normalized reference
  SELECT * INTO v_other_active
  FROM public.business_subscription_payment_reference_claims
  WHERE normalized_reference = v_norm_ref
    AND business_id <> v_business.id
    AND claim_status IN ('active', 'under_review')
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Collision: Quarantine BOTH claims into disputed_conflict state
    v_claim_status := 'disputed_conflict';
    UPDATE public.business_subscription_payment_reference_claims
    SET
      claim_status = 'disputed_conflict',
      conflict_metadata = jsonb_build_object(
        'conflict_detected_at', v_now,
        'conflicting_business_id', v_business.id,
        'conflicting_payment_id', p_payment_id
      ),
      updated_at = v_now
    WHERE id = v_other_active.id;
  END IF;

  -- 6. Check existing claim for this payment (Typo Correction workflow)
  SELECT * INTO v_existing_claim_for_payment
  FROM public.business_subscription_payment_reference_claims
  WHERE payment_id = p_payment_id AND claim_status IN ('active', 'under_review', 'disputed_conflict')
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_claim_for_payment.normalized_reference <> v_norm_ref THEN
      -- Typo correction: supersede old reference claim, preserving history
      UPDATE public.business_subscription_payment_reference_claims
      SET
        claim_status = 'superseded_typo',
        conflict_metadata = jsonb_build_object(
          'superseded_by_ref', v_norm_ref,
          'superseded_at', v_now
        ),
        updated_at = v_now
      WHERE id = v_existing_claim_for_payment.id;
    ELSE
      -- Resubmission of the exact same reference
      v_claim_id := v_existing_claim_for_payment.id;
    END IF;
  END IF;

  -- Insert new claim if not reusing existing
  IF v_claim_id IS NULL THEN
    INSERT INTO public.business_subscription_payment_reference_claims (
      payment_id,
      business_id,
      raw_reference,
      normalized_reference,
      claim_status,
      claimed_by_user_id,
      conflict_metadata,
      created_at,
      updated_at
    ) VALUES (
      p_payment_id,
      v_business.id,
      p_raw_reference,
      v_norm_ref,
      v_claim_status,
      v_actor_user_id,
      CASE WHEN v_claim_status = 'disputed_conflict' THEN
        jsonb_build_object(
          'conflict_detected_at', v_now,
          'conflicting_business_id', v_other_active.business_id,
          'conflicting_payment_id', v_other_active.payment_id
        )
      ELSE '{}'::jsonb END,
      v_now,
      v_now
    ) RETURNING id INTO v_claim_id;
  END IF;

  -- 7. Insert Proof Record
  INSERT INTO public.business_subscription_proofs (
    payment_id,
    business_id,
    file_path,
    file_size_bytes,
    mime_type,
    review_status,
    uploaded_by_user_id,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_payment_id,
    v_business.id,
    p_file_path,
    p_file_size_bytes,
    p_mime_type,
    'under_review',
    v_actor_user_id,
    p_notes,
    v_now,
    v_now
  ) RETURNING id INTO v_proof_id;

  -- 8. Advance Payment Intent to processing + under_review
  UPDATE public.business_subscription_payments
  SET
    status = 'processing',
    payment_method = 'manual_bank_transfer',
    review_status = 'under_review',
    processing_at = COALESCE(processing_at, v_now),
    updated_at = v_now
  WHERE id = p_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'claim_id', v_claim_id,
    'proof_id', v_proof_id,
    'claim_status', v_claim_status,
    'normalized_reference', v_norm_ref
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_bank_reference_claim FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_bank_reference_claim TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. FUNCTION: apply_atomic_subscription_settlement
-- Description: Super Admin atomic settlement of verified manual bank transfer.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_atomic_subscription_settlement(
  p_payment_id UUID,
  p_expected_plan_id TEXT,
  p_expected_amount_lkr NUMERIC,
  p_reconciliation_note TEXT,
  p_external_bank_statement_ref TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_profile RECORD;
  v_payment RECORD;
  v_sub RECORD;
  v_proof RECORD;
  v_claim RECORD;
  v_business RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_target_start_at TIMESTAMPTZ;
  v_new_period_ends_at TIMESTAMPTZ;
  v_target_max_branches INT;
  v_target_max_staff INT;
  v_current_branches INT;
  v_current_staff INT;
  v_pricing_breakdown JSONB;
  v_audit_id UUID;
  v_event_id UUID;
BEGIN
  -- 1. Security & Identity Check
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'WSNEXA_ERR_UNAUTHENTICATED: Valid user session required.';
  END IF;

  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'WSNEXA_ERR_FORBIDDEN: Actor % is not an authorized Super Admin.', v_actor_user_id;
  END IF;

  IF p_reconciliation_note IS NULL OR TRIM(p_reconciliation_note) = '' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_REASON_REQUIRED: A reconciliation note is mandatory for manual settlement.';
  END IF;

  IF p_external_bank_statement_ref IS NULL OR TRIM(p_external_bank_statement_ref) = '' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_STATEMENT_REF_REQUIRED: Bank statement reference is mandatory for verified settlement.';
  END IF;

  SELECT id, full_name, email INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = v_actor_user_id;

  -- 2. Hierarchical Row Locking: Level 1 (Business) -> Level 2 (Subscription) -> Level 3 (Payment) -> Level 4 (Claim)
  SELECT business_id INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WSNEXA_ERR_NOT_FOUND: Payment % does not exist.', p_payment_id;
  END IF;

  -- Lock Level 1: businesses (serializes all operations on this business root)
  SELECT * INTO v_business
  FROM public.businesses
  WHERE id = v_payment.business_id
  FOR UPDATE;

  -- Lock Level 2: business_subscriptions
  SELECT * INTO v_sub
  FROM public.business_subscriptions
  WHERE business_id = v_business.id
  FOR UPDATE;

  -- Lock Level 3: business_subscription_payments
  SELECT * INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  -- 3. Payment Invariants & State Pre-Conditions
  IF v_payment.status = 'paid' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_ALREADY_PAID: Payment % has already been settled.', p_payment_id;
  END IF;

  IF v_payment.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_STATUS: Payment % is in status %, expected pending or processing.',
      p_payment_id, v_payment.status;
  END IF;

  IF v_payment.payment_method <> 'manual_bank_transfer' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_METHOD: Payment % method is %, expected manual_bank_transfer. Online gateway payments cannot be settled via manual RPC.',
      p_payment_id, v_payment.payment_method;
  END IF;

  IF v_payment.plan_code <> p_expected_plan_id THEN
    RAISE EXCEPTION 'WSNEXA_ERR_PLAN_MISMATCH: Payment plan "%" does not match expected plan "%".',
      v_payment.plan_code, p_expected_plan_id;
  END IF;

  IF v_payment.amount_lkr <> p_expected_amount_lkr OR v_payment.currency <> 'LKR' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_AMOUNT_MISMATCH: Payment amount % % does not match expected % LKR.',
      v_payment.amount_lkr, v_payment.currency, p_expected_amount_lkr;
  END IF;

  -- 4. Proof & Claim Validation
  SELECT * INTO v_proof
  FROM public.business_subscription_proofs
  WHERE payment_id = p_payment_id AND business_id = v_business.id
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WSNEXA_ERR_PROOF_MISSING: No proof record found for payment %.', p_payment_id;
  END IF;

  -- Lock Level 4: Claim
  SELECT * INTO v_claim
  FROM public.business_subscription_payment_reference_claims
  WHERE payment_id = p_payment_id AND business_id = v_business.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WSNEXA_ERR_CLAIM_MISSING: No reference claim found for payment %.', p_payment_id;
  END IF;

  IF v_claim.claim_status NOT IN ('active', 'under_review') THEN
    RAISE EXCEPTION 'WSNEXA_ERR_CLAIM_INVALID: Reference claim % is in status "%" and cannot be settled.',
      v_claim.id, v_claim.claim_status;
  END IF;

  -- 5. Enterprise Quota Validation & Plan Limits
  IF v_payment.plan_code = 'enterprise' THEN
    v_pricing_breakdown := v_payment.pricing_snapshot->'breakdown';
    IF v_pricing_breakdown IS NULL OR v_pricing_breakdown = 'null'::jsonb THEN
      RAISE EXCEPTION 'WSNEXA_ERR_ENTERPRISE_MALFORMED: Missing pricing breakdown in snapshot for payment %.', p_payment_id;
    END IF;

    IF (v_pricing_breakdown->>'requestedBranches') IS NULL OR (v_pricing_breakdown->>'requestedStaff') IS NULL THEN
      RAISE EXCEPTION 'WSNEXA_ERR_ENTERPRISE_MALFORMED: Enterprise snapshot missing requestedBranches or requestedStaff.';
    END IF;

    v_target_max_branches := (v_pricing_breakdown->>'requestedBranches')::INT;
    v_target_max_staff := (v_pricing_breakdown->>'requestedStaff')::INT;

    IF v_target_max_branches < 5 OR v_target_max_staff < 75 THEN
      RAISE EXCEPTION 'WSNEXA_ERR_ENTERPRISE_BOUNDS: Enterprise quotas below minimums (requestedBranches=%, requestedStaff=%).',
        v_target_max_branches, v_target_max_staff;
    END IF;
  ELSIF v_payment.plan_code = 'growth' THEN
    v_target_max_branches := 3;
    v_target_max_staff := 40;
  ELSIF v_payment.plan_code = 'starter' THEN
    v_target_max_branches := 1;
    v_target_max_staff := 10;
  ELSE
    RAISE EXCEPTION 'WSNEXA_ERR_UNKNOWN_PLAN: Unrecognized plan code %.', v_payment.plan_code;
  END IF;

  -- Verify current business resource usage does not violate target limits
  SELECT COUNT(*) INTO v_current_branches
  FROM public.branches
  WHERE business_id = v_business.id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_current_staff
  FROM public.business_memberships
  WHERE business_id = v_business.id AND membership_status = 'active';

  IF v_target_max_branches IS NOT NULL AND v_current_branches > v_target_max_branches THEN
    RAISE EXCEPTION 'WSNEXA_ERR_RESOURCE_OVERFLOW: Business has % active branches, exceeding target plan limit of %.',
      v_current_branches, v_target_max_branches;
  END IF;

  IF v_target_max_staff IS NOT NULL AND v_current_staff > v_target_max_staff THEN
    RAISE EXCEPTION 'WSNEXA_ERR_RESOURCE_OVERFLOW: Business has % active staff members, exceeding target plan limit of %.',
      v_current_staff, v_target_max_staff;
  END IF;

  -- 6. Canonical Billing Date Calculation (Calendar Month)
  IF v_sub.id IS NOT NULL AND v_sub.status = 'active' AND v_sub.current_period_ends_at > v_now THEN
    v_target_start_at := v_sub.current_period_ends_at;
  ELSE
    v_target_start_at := v_now;
  END IF;

  v_new_period_ends_at := v_target_start_at + INTERVAL '1 month';

  -- 7. ATOMIC MUTATIONS
  -- A. Update Payment Intent
  UPDATE public.business_subscription_payments
  SET
    status = 'paid',
    review_status = 'approved',
    paid_at = v_now,
    verified_at = v_now,
    verified_by_user_id = v_actor_user_id,
    reconciliation_notes = p_reconciliation_note,
    bank_statement_ref = p_external_bank_statement_ref,
    updated_at = v_now
  WHERE id = p_payment_id;

  -- B. Update Reference Claim to settled_paid (permanent uniqueness enforced by index)
  UPDATE public.business_subscription_payment_reference_claims
  SET
    claim_status = 'settled_paid',
    settled_at = v_now,
    settled_by_user_id = v_actor_user_id,
    settlement_payment_id = p_payment_id,
    updated_at = v_now
  WHERE id = v_claim.id;

  -- C. Update Proof to approved
  UPDATE public.business_subscription_proofs
  SET
    review_status = 'approved',
    updated_at = v_now
  WHERE id = v_proof.id;

  -- D. Upsert Subscription Record
  IF v_sub.id IS NOT NULL THEN
    UPDATE public.business_subscriptions
    SET
      plan_code = v_payment.plan_code,
      status = 'active',
      current_period_starts_at = v_target_start_at,
      current_period_ends_at = v_new_period_ends_at,
      trial_ends_at = NULL,
      grace_ends_at = NULL,
      suspended_at = NULL,
      cancelled_at = NULL,
      max_branches_override = CASE WHEN v_payment.plan_code = 'enterprise' THEN v_target_max_branches ELSE NULL END,
      max_staff_override = CASE WHEN v_payment.plan_code = 'enterprise' THEN v_target_max_staff ELSE NULL END,
      activation_source = 'manual_bank_transfer_verified',
      updated_at = v_now
    WHERE id = v_sub.id;
  ELSE
    INSERT INTO public.business_subscriptions (
      business_id,
      plan_code,
      status,
      current_period_starts_at,
      current_period_ends_at,
      max_branches_override,
      max_staff_override,
      activation_source,
      created_at,
      updated_at
    ) VALUES (
      v_business.id,
      v_payment.plan_code,
      'active',
      v_target_start_at,
      v_new_period_ends_at,
      CASE WHEN v_payment.plan_code = 'enterprise' THEN v_target_max_branches ELSE NULL END,
      CASE WHEN v_payment.plan_code = 'enterprise' THEN v_target_max_staff ELSE NULL END,
      'manual_bank_transfer_verified',
      v_now,
      v_now
    ) RETURNING id INTO v_sub.id;
  END IF;

  -- E. Insert Subscription Lifecycle Event
  INSERT INTO public.business_subscription_events (
    business_id,
    actor_id,
    actor_type,
    event_type,
    previous_status,
    new_status,
    previous_plan,
    new_plan,
    reason,
    dedupe_key,
    metadata,
    created_at
  ) VALUES (
    v_business.id,
    v_actor_user_id,
    'super_admin',
    'payment_verified_settlement',
    COALESCE(v_sub.status::TEXT, 'none'),
    'active',
    v_sub.plan_code,
    v_payment.plan_code,
    p_reconciliation_note,
    'settlement:' || p_payment_id::TEXT,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'payment_method', 'manual_bank_transfer',
      'amount_lkr', v_payment.amount_lkr,
      'currency', v_payment.currency,
      'reference', v_claim.normalized_reference,
      'statement_ref', p_external_bank_statement_ref,
      'period_starts_at', v_target_start_at,
      'period_ends_at', v_new_period_ends_at
    ),
    v_now
  ) RETURNING id INTO v_event_id;

  -- F. Insert Central Permanent Audit Log
  INSERT INTO public.audit_logs (
    business_id,
    actor_id,
    actor_name_snapshot,
    actor_role_snapshot,
    action,
    entity_type,
    entity_id,
    target_type,
    target_id,
    old_values,
    new_values,
    reason,
    metadata,
    payload,
    created_at
  ) VALUES (
    v_business.id,
    v_actor_user_id,
    COALESCE(v_actor_profile.full_name, 'Super Admin'),
    'Super Admin',
    'subscription.payment.settle_manual_bank_transfer',
    'business_subscription_payments',
    p_payment_id::TEXT,
    'business_subscription_payments',
    p_payment_id::TEXT,
    jsonb_build_object('status', v_payment.status, 'review_status', v_payment.review_status, 'sub_status', v_sub.status),
    jsonb_build_object('status', 'paid', 'review_status', 'approved', 'sub_status', 'active', 'period_ends_at', v_new_period_ends_at),
    p_reconciliation_note,
    jsonb_build_object('bank_statement_ref', p_external_bank_statement_ref, 'reference', v_claim.normalized_reference),
    jsonb_build_object('event_id', v_event_id, 'payment_id', p_payment_id, 'amount_lkr', v_payment.amount_lkr),
    v_now
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'business_id', v_business.id,
    'subscription_id', v_sub.id,
    'plan_code', v_payment.plan_code,
    'period_starts_at', v_target_start_at,
    'period_ends_at', v_new_period_ends_at,
    'audit_id', v_audit_id,
    'event_id', v_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_atomic_subscription_settlement FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_atomic_subscription_settlement TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. FUNCTION: reject_bank_transfer_payment
-- Description: Super Admin rejection of unverified or fraudulent transfer proof.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_bank_transfer_payment(
  p_payment_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_user_id UUID;
  v_actor_profile RECORD;
  v_payment RECORD;
  v_business RECORD;
  v_claim RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_audit_id UUID;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'WSNEXA_ERR_UNAUTHENTICATED: Valid user session required.';
  END IF;

  IF NOT public.auth_is_super_admin() THEN
    RAISE EXCEPTION 'WSNEXA_ERR_FORBIDDEN: Actor is not an authorized Super Admin.';
  END IF;

  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_REASON_REQUIRED: A rejection reason is required.';
  END IF;

  SELECT id, full_name, email INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = v_actor_user_id;

  -- Lock Level 1: Business
  SELECT business_id INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WSNEXA_ERR_NOT_FOUND: Payment % does not exist.', p_payment_id;
  END IF;

  SELECT * INTO v_business
  FROM public.businesses
  WHERE id = v_payment.business_id
  FOR UPDATE;

  -- Lock Level 3: Payment
  SELECT * INTO v_payment
  FROM public.business_subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_payment.status = 'paid' THEN
    RAISE EXCEPTION 'WSNEXA_ERR_ALREADY_PAID: Cannot reject payment % because it has already been settled.', p_payment_id;
  END IF;

  IF v_payment.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'WSNEXA_ERR_INVALID_STATUS: Payment % is in status % and cannot be rejected.', p_payment_id, v_payment.status;
  END IF;

  -- Lock Level 4: Claim
  SELECT * INTO v_claim
  FROM public.business_subscription_payment_reference_claims
  WHERE payment_id = p_payment_id
  FOR UPDATE;

  -- Update Payment Intent to failed + rejected
  UPDATE public.business_subscription_payments
  SET
    status = 'failed',
    review_status = 'rejected',
    failure_code = 'MANUAL_TRANSFER_REJECTED',
    failure_message = p_rejection_reason,
    failed_at = v_now,
    updated_at = v_now
  WHERE id = p_payment_id;

  -- Update Claim to rejected_claim
  IF v_claim.id IS NOT NULL THEN
    UPDATE public.business_subscription_payment_reference_claims
    SET
      claim_status = 'rejected_claim',
      updated_at = v_now
    WHERE id = v_claim.id;
  END IF;

  -- Update Proof to rejected
  UPDATE public.business_subscription_proofs
  SET
    review_status = 'rejected',
    rejection_reason = p_rejection_reason,
    updated_at = v_now
  WHERE payment_id = p_payment_id;

  -- Central Audit Log
  INSERT INTO public.audit_logs (
    business_id,
    actor_id,
    actor_name_snapshot,
    actor_role_snapshot,
    action,
    entity_type,
    entity_id,
    target_type,
    target_id,
    old_values,
    new_values,
    reason,
    metadata,
    payload,
    created_at
  ) VALUES (
    v_business.id,
    v_actor_user_id,
    COALESCE(v_actor_profile.full_name, 'Super Admin'),
    'Super Admin',
    'subscription.payment.reject_manual_bank_transfer',
    'business_subscription_payments',
    p_payment_id::TEXT,
    'business_subscription_payments',
    p_payment_id::TEXT,
    jsonb_build_object('status', v_payment.status, 'review_status', v_payment.review_status),
    jsonb_build_object('status', 'failed', 'review_status', 'rejected'),
    p_rejection_reason,
    jsonb_build_object('reference', v_claim.normalized_reference),
    jsonb_build_object('payment_id', p_payment_id),
    v_now
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'business_id', v_business.id,
    'audit_id', v_audit_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_bank_transfer_payment FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_bank_transfer_payment TO authenticated;
