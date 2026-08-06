-- Migration: 20260807000000_create_payment_schema.sql
-- Description: Phase 11 Payments, Payment Events Audit Trail, and Private Atomic Settlement RPC

-- 1. Extend Payment Status Enum
DO $$ BEGIN
  ALTER TYPE public.payment_status ADD VALUE 'partially_paid';
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE public.payment_status ADD VALUE 'voided';
EXCEPTION WHEN OTHERS THEN null; END $$;

-- 2. Create Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  payment_method public.payment_method NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed' CHECK (payment_status IN ('completed', 'voided', 'refunded')),
  received_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_reference TEXT CHECK (external_reference IS NULL OR char_length(external_reference) <= 100),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_idempotency
  ON public.payments (order_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_payments_branch_created
  ON public.payments (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON public.payments (order_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_reference
  ON public.payments (payment_reference);

-- 3. Create Payment Events Audit Table
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_recorded', 'payment_voided', 'refund_issued', 'status_overridden')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id
  ON public.payment_events (order_id, created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Staff Select / Insert RLS Policies
DROP POLICY IF EXISTS "Staff select payments" ON public.payments;
CREATE POLICY "Staff select payments"
  ON public.payments FOR SELECT
  USING (public.auth_has_branch_access(branch_id));

DROP POLICY IF EXISTS "Staff select payment events" ON public.payment_events;
CREATE POLICY "Staff select payment events"
  ON public.payment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_events.order_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

-- 5. Atomic Private Service-Role Payment Settlement RPC
CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_id UUID,
  p_amount_cents INTEGER,
  p_payment_method public.payment_method,
  p_external_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_existing_payment RECORD;
  v_total_paid_before INTEGER := 0;
  v_total_paid_after INTEGER := 0;
  v_balance_due INTEGER := 0;
  v_new_payment_status public.payment_status;
  v_payment_id UUID;
  v_payment_ref TEXT;
  v_payment_count INTEGER;
BEGIN
  -- 1. Validate Input
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_ORDER_ID');
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MISSING_IDEMPOTENCY_KEY');
  END IF;

  -- 2. Lock Order Row for Update
  SELECT id, business_id, branch_id, order_number_formatted, status, payment_status, total_cents, currency
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_NOT_FOUND');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANCELLED_ORDER_NOT_PAYABLE');
  END IF;

  -- 3. Check Idempotency (Prevent Duplicate Payment Entries)
  SELECT id, payment_reference, amount_cents, payment_status
  INTO v_existing_payment
  FROM public.payments
  WHERE order_id = p_order_id AND idempotency_key = p_idempotency_key;

  IF v_existing_payment.id IS NOT NULL THEN
    -- Recalculate totals for response
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid_after
    FROM public.payments
    WHERE order_id = p_order_id AND payment_status = 'completed';

    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'payment_id', v_existing_payment.id,
      'payment_reference', v_existing_payment.payment_reference,
      'order_id', p_order_id,
      'total_cents', v_order.total_cents,
      'paid_cents', v_total_paid_after,
      'balance_due_cents', GREATEST(0, v_order.total_cents - v_total_paid_after),
      'payment_status', v_order.payment_status
    );
  END IF;

  -- 4. Calculate Current Paid Total & Balance Due from Database
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_total_paid_before
  FROM public.payments
  WHERE order_id = p_order_id AND payment_status = 'completed';

  v_balance_due := v_order.total_cents - v_total_paid_before;

  IF v_balance_due <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'ORDER_ALREADY_FULLY_PAID');
  END IF;

  -- Reject Overpayment
  IF p_amount_cents > v_balance_due THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'OVERPAYMENT_NOT_ALLOWED',
      'max_payable_cents', v_balance_due
    );
  END IF;

  -- 5. Generate Payment Reference
  SELECT COUNT(*) + 1 INTO v_payment_count
  FROM public.payments
  WHERE branch_id = v_order.branch_id;

  v_payment_ref := '#PAY-' || replace(v_order.order_number_formatted, '#', '') || '-' || v_payment_count;

  -- 6. Insert Payment Record
  INSERT INTO public.payments (
    business_id,
    branch_id,
    order_id,
    payment_reference,
    idempotency_key,
    amount_cents,
    currency,
    payment_method,
    payment_status,
    received_by,
    external_reference,
    notes,
    paid_at
  ) VALUES (
    v_order.business_id,
    v_order.branch_id,
    p_order_id,
    v_payment_ref,
    p_idempotency_key,
    p_amount_cents,
    v_order.currency,
    p_payment_method,
    'completed',
    p_actor_id,
    p_external_reference,
    p_notes,
    NOW()
  ) RETURNING id INTO v_payment_id;

  v_total_paid_after := v_total_paid_before + p_amount_cents;

  -- 7. Derive New Order Payment Status
  IF v_total_paid_after >= v_order.total_cents THEN
    v_new_payment_status := 'paid'::public.payment_status;
  ELSE
    v_new_payment_status := 'partially_paid'::public.payment_status;
  END IF;

  -- 8. Update Master Order Payment Status & Primary Payment Method
  UPDATE public.orders
  SET payment_status = v_new_payment_status,
      payment_method = p_payment_method,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- 9. Insert Payment Audit Event
  INSERT INTO public.payment_events (
    payment_id,
    order_id,
    event_type,
    previous_status,
    new_status,
    amount_cents,
    actor_id,
    metadata
  ) VALUES (
    v_payment_id,
    p_order_id,
    'payment_recorded',
    v_order.payment_status::text,
    v_new_payment_status::text,
    p_amount_cents,
    p_actor_id,
    jsonb_build_object(
      'payment_reference', v_payment_ref,
      'payment_method', p_payment_method,
      'external_reference', p_external_reference,
      'notes', p_notes,
      'total_cents', v_order.total_cents,
      'paid_after_cents', v_total_paid_after,
      'balance_due_cents', GREATEST(0, v_order.total_cents - v_total_paid_after)
    )
  );

  -- 10. Log Order Status History
  INSERT INTO public.order_status_history (
    order_id,
    previous_status,
    new_status,
    changed_by,
    notes
  ) VALUES (
    p_order_id,
    v_order.status,
    v_order.status,
    p_actor_id,
    'Payment of ' || p_amount_cents || ' ' || v_order.currency || ' recorded (' || p_payment_method || ')'
  );

  -- 11. Return Success Result
  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'payment_id', v_payment_id,
    'payment_reference', v_payment_ref,
    'order_id', p_order_id,
    'total_cents', v_order.total_cents,
    'paid_cents', v_total_paid_after,
    'balance_due_cents', GREATEST(0, v_order.total_cents - v_total_paid_after),
    'payment_status', v_new_payment_status::text,
    'currency', v_order.currency
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Security Rule: Revoke direct execution permissions from public, anon, and authenticated roles.
-- Only service_role (used by Next.js Server Action with createAdminClient) can execute record_order_payment.
REVOKE EXECUTE ON FUNCTION public.record_order_payment(uuid, integer, public.payment_method, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_payment(uuid, integer, public.payment_method, text, text, text, uuid) TO service_role;
