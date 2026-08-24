-- ============================================================================
-- WSNexa Phase 33 Step 1 Schema Migration
-- Guest Data Foundation, Unified Customer Profile & Consent Schema
-- ============================================================================

-- 1. Insert CRM permissions into public.permissions table
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES
  ('customers.view', 'View Customer CRM', 'Allows staff to view guest profiles and customer directory', 'customers', 'low'),
  ('customers.manage', 'Manage Customer Profiles', 'Allows staff to update customer profile notes and details', 'customers', 'medium'),
  ('customers.contact_view', 'View Full Customer Contact Details', 'Allows viewing unmasked customer phone numbers and emails', 'customers', 'high')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 2. Map permissions to built-in roles in public.role_permissions
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT v.role_key, v.permission_key
FROM (VALUES
  ('business_owner', 'customers.view'),
  ('business_owner', 'customers.manage'),
  ('business_owner', 'customers.contact_view'),
  ('branch_manager', 'customers.view')
) AS v(role_key, permission_key)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_key = v.role_key
    AND rp.permission_key = v.permission_key
    AND rp.business_id IS NULL
);

-- 3. Create public.crm_customers table
CREATE TABLE IF NOT EXISTS public.crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT CHECK (display_name IS NULL OR (char_length(trim(display_name)) >= 1 AND char_length(display_name) <= 100)),
  email_normalized TEXT CHECK (email_normalized IS NULL OR char_length(email_normalized) <= 255),
  phone_normalized TEXT CHECK (phone_normalized IS NULL OR char_length(phone_normalized) <= 30),
  identity_type TEXT NOT NULL DEFAULT 'ANONYMOUS' CHECK (identity_type IN ('REGISTERED', 'KNOWN_GUEST', 'ANONYMOUS')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique indexes for business-scoped identity collision prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_biz_auth
  ON public.crm_customers (business_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_biz_email
  ON public.crm_customers (business_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_biz_phone
  ON public.crm_customers (business_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_biz_last_seen
  ON public.crm_customers (business_id, last_seen_at DESC);

-- 4. Create public.crm_customer_identities table
CREATE TABLE IF NOT EXISTS public.crm_customer_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('AUTH_USER', 'EMAIL', 'PHONE')),
  normalized_value TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'ORDER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, type, normalized_value)
);

CREATE INDEX IF NOT EXISTS idx_crm_identities_cust
  ON public.crm_customer_identities (crm_customer_id);

-- 5. Add additive CRM columns to public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS crm_customer_id UUID REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_email TEXT CHECK (guest_email IS NULL OR char_length(guest_email) <= 255);

CREATE INDEX IF NOT EXISTS idx_orders_crm_customer
  ON public.orders (crm_customer_id)
  WHERE crm_customer_id IS NOT NULL;

-- 6. Create public.crm_consent_records table
CREATE TABLE IF NOT EXISTS public.crm_consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('TRANSACTIONAL_CONTACT', 'MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_WHATSAPP', 'PROFILE_PERSONALIZATION')),
  status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('GRANTED', 'DENIED', 'OPTED_OUT', 'UNKNOWN')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, crm_customer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_crm_consent_cust
  ON public.crm_consent_records (crm_customer_id);

-- 7. Create public.crm_consent_events table
CREATE TABLE IF NOT EXISTS public.crm_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('TRANSACTIONAL_CONTACT', 'MARKETING_EMAIL', 'MARKETING_SMS', 'MARKETING_WHATSAPP', 'PROFILE_PERSONALIZATION')),
  action TEXT NOT NULL CHECK (action IN ('GRANT', 'DENY', 'OPT_OUT', 'SYSTEM_DEFAULT')),
  source TEXT NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_consent_events_cust
  ON public.crm_consent_events (crm_customer_id, created_at DESC);

-- 8. Enable Row Level Security
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customer_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_consent_events ENABLE ROW LEVEL SECURITY;

-- Server-only privilege protection: Revoke direct client access and grant service_role
REVOKE ALL ON TABLE public.crm_customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_customer_identities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_consent_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.crm_consent_events FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_customer_identities TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_consent_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_consent_events TO service_role;

-- 9. Atomic CRM Customer Resolution & Identity Ledger RPC
CREATE OR REPLACE FUNCTION public.resolve_or_create_crm_customer_identity(
  p_business_id UUID,
  p_auth_user_id UUID DEFAULT NULL,
  p_email_normalized TEXT DEFAULT NULL,
  p_phone_normalized TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  business_id UUID,
  auth_user_id UUID,
  display_name TEXT,
  email_normalized TEXT,
  phone_normalized TEXT,
  identity_type TEXT,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  identity_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_cust RECORD;
  v_existing_id UUID;
  v_existing_auth UUID;
  v_existing_type TEXT;
  v_safe_email TEXT := p_email_normalized;
  v_safe_phone TEXT := p_phone_normalized;
  v_has_email_conflict BOOLEAN := false;
  v_has_phone_conflict BOOLEAN := false;
  v_display_name TEXT;
BEGIN
  -- Task 5: Fully anonymous check
  IF p_auth_user_id IS NULL AND (p_email_normalized IS NULL OR p_email_normalized = '') AND (p_phone_normalized IS NULL OR p_phone_normalized = '') THEN
    RETURN;
  END IF;

  v_display_name := COALESCE(NULLIF(trim(p_display_name), ''), CASE WHEN p_auth_user_id IS NOT NULL THEN 'Registered Guest' ELSE 'Guest' END);

  -- Priority 1: Auth User ID match (highest authority)
  IF p_auth_user_id IS NOT NULL THEN
    SELECT c.id, c.business_id, c.auth_user_id, c.display_name, c.email_normalized, c.phone_normalized, c.identity_type, c.first_seen_at, c.last_seen_at
    INTO v_cust
    FROM public.crm_customers c
    WHERE c.business_id = p_business_id AND c.auth_user_id = p_auth_user_id
    LIMIT 1;

    IF v_cust.id IS NOT NULL THEN
      -- Check email claim safety for existing auth user
      IF p_email_normalized IS NOT NULL AND p_email_normalized <> '' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.crm_customer_identities ci
          WHERE ci.business_id = p_business_id AND ci.type = 'EMAIL' AND ci.normalized_value = p_email_normalized AND ci.crm_customer_id <> v_cust.id
        ) AND NOT EXISTS (
          SELECT 1 FROM public.crm_customers c2
          WHERE c2.business_id = p_business_id AND c2.email_normalized = p_email_normalized AND c2.id <> v_cust.id
        ) THEN
          IF v_cust.email_normalized IS NULL THEN
            UPDATE public.crm_customers SET email_normalized = p_email_normalized WHERE crm_customers.id = v_cust.id;
            v_cust.email_normalized := p_email_normalized;
          END IF;
          INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
          VALUES (p_business_id, v_cust.id, 'EMAIL', p_email_normalized, 'ORDER')
          ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
        ELSE
          v_has_email_conflict := true;
        END IF;
      END IF;

      -- Check phone claim safety for existing auth user
      IF p_phone_normalized IS NOT NULL AND p_phone_normalized <> '' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.crm_customer_identities ci
          WHERE ci.business_id = p_business_id AND ci.type = 'PHONE' AND ci.normalized_value = p_phone_normalized AND ci.crm_customer_id <> v_cust.id
        ) AND NOT EXISTS (
          SELECT 1 FROM public.crm_customers c2
          WHERE c2.business_id = p_business_id AND c2.phone_normalized = p_phone_normalized AND c2.id <> v_cust.id
        ) THEN
          IF v_cust.phone_normalized IS NULL THEN
            UPDATE public.crm_customers SET phone_normalized = p_phone_normalized WHERE crm_customers.id = v_cust.id;
            v_cust.phone_normalized := p_phone_normalized;
          END IF;
          INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
          VALUES (p_business_id, v_cust.id, 'PHONE', p_phone_normalized, 'ORDER')
          ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
        ELSE
          v_has_phone_conflict := true;
        END IF;
      END IF;

      UPDATE public.crm_customers SET last_seen_at = v_now WHERE crm_customers.id = v_cust.id;

      RETURN QUERY SELECT
        v_cust.id, v_cust.business_id, v_cust.auth_user_id, COALESCE(v_cust.display_name, v_display_name),
        v_cust.email_normalized, v_cust.phone_normalized, 'REGISTERED'::TEXT,
        v_cust.first_seen_at, v_now,
        CASE WHEN v_has_email_conflict OR v_has_phone_conflict THEN 'IDENTITY_CONFLICT' ELSE 'RESOLVED' END;
      RETURN;
    END IF;
  END IF;

  -- Priority 2: Normalized Email match
  IF p_email_normalized IS NOT NULL AND p_email_normalized <> '' THEN
    SELECT c.id, c.auth_user_id, c.identity_type INTO v_existing_id, v_existing_auth, v_existing_type
    FROM public.crm_customers c
    WHERE c.business_id = p_business_id AND c.email_normalized = p_email_normalized
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      SELECT ci.crm_customer_id, c.auth_user_id, c.identity_type INTO v_existing_id, v_existing_auth, v_existing_type
      FROM public.crm_customer_identities ci
      JOIN public.crm_customers c ON c.id = ci.crm_customer_id
      WHERE ci.business_id = p_business_id AND ci.type = 'EMAIL' AND ci.normalized_value = p_email_normalized
      LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      -- Auth Conflict Protection: If existing identity belongs to a different auth_user_id, DO NOT MERGE!
      IF p_auth_user_id IS NOT NULL AND v_existing_auth IS NOT NULL AND v_existing_auth <> p_auth_user_id THEN
        v_has_email_conflict := true;
        v_safe_email := NULL;
      ELSE
        -- Safe to merge into existing KNOWN_GUEST / account
        IF p_auth_user_id IS NOT NULL AND v_existing_auth IS NULL THEN
          UPDATE public.crm_customers
          SET auth_user_id = p_auth_user_id, identity_type = 'REGISTERED', last_seen_at = v_now
          WHERE crm_customers.id = v_existing_id;

          INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
          VALUES (p_business_id, v_existing_id, 'AUTH_USER', p_auth_user_id::TEXT, 'AUTH')
          ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
        ELSE
          UPDATE public.crm_customers SET last_seen_at = v_now WHERE crm_customers.id = v_existing_id;
        END IF;

        SELECT c.id, c.business_id, c.auth_user_id, c.display_name, c.email_normalized, c.phone_normalized, c.identity_type, c.first_seen_at, c.last_seen_at
        INTO v_cust
        FROM public.crm_customers c WHERE c.id = v_existing_id;

        RETURN QUERY SELECT
          v_cust.id, v_cust.business_id, v_cust.auth_user_id, COALESCE(v_cust.display_name, v_display_name),
          v_cust.email_normalized, v_cust.phone_normalized, v_cust.identity_type,
          v_cust.first_seen_at, v_now, 'RESOLVED'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Priority 3: Normalized Phone match
  IF p_phone_normalized IS NOT NULL AND p_phone_normalized <> '' THEN
    SELECT c.id, c.auth_user_id, c.identity_type INTO v_existing_id, v_existing_auth, v_existing_type
    FROM public.crm_customers c
    WHERE c.business_id = p_business_id AND c.phone_normalized = p_phone_normalized
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      SELECT ci.crm_customer_id, c.auth_user_id, c.identity_type INTO v_existing_id, v_existing_auth, v_existing_type
      FROM public.crm_customer_identities ci
      JOIN public.crm_customers c ON c.id = ci.crm_customer_id
      WHERE ci.business_id = p_business_id AND ci.type = 'PHONE' AND ci.normalized_value = p_phone_normalized
      LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      -- Auth Conflict Protection: If existing identity belongs to a different auth_user_id, DO NOT MERGE!
      IF p_auth_user_id IS NOT NULL AND v_existing_auth IS NOT NULL AND v_existing_auth <> p_auth_user_id THEN
        v_has_phone_conflict := true;
        v_safe_phone := NULL;
      ELSE
        IF p_auth_user_id IS NOT NULL AND v_existing_auth IS NULL THEN
          UPDATE public.crm_customers
          SET auth_user_id = p_auth_user_id, identity_type = 'REGISTERED', last_seen_at = v_now
          WHERE crm_customers.id = v_existing_id;

          INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
          VALUES (p_business_id, v_existing_id, 'AUTH_USER', p_auth_user_id::TEXT, 'AUTH')
          ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
        ELSE
          UPDATE public.crm_customers SET last_seen_at = v_now WHERE crm_customers.id = v_existing_id;
        END IF;

        SELECT c.id, c.business_id, c.auth_user_id, c.display_name, c.email_normalized, c.phone_normalized, c.identity_type, c.first_seen_at, c.last_seen_at
        INTO v_cust
        FROM public.crm_customers c WHERE c.id = v_existing_id;

        RETURN QUERY SELECT
          v_cust.id, v_cust.business_id, v_cust.auth_user_id, COALESCE(v_cust.display_name, v_display_name),
          v_cust.email_normalized, v_cust.phone_normalized, v_cust.identity_type,
          v_cust.first_seen_at, v_now, 'RESOLVED'::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Pre-creation check for taken contact info
  IF v_safe_email IS NOT NULL AND v_safe_email <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.crm_customer_identities ci
      WHERE ci.business_id = p_business_id AND ci.type = 'EMAIL' AND ci.normalized_value = v_safe_email
    ) OR EXISTS (
      SELECT 1 FROM public.crm_customers c WHERE c.business_id = p_business_id AND c.email_normalized = v_safe_email
    ) THEN
      v_has_email_conflict := true;
      v_safe_email := NULL;
    END IF;
  END IF;

  IF v_safe_phone IS NOT NULL AND v_safe_phone <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.crm_customer_identities ci
      WHERE ci.business_id = p_business_id AND ci.type = 'PHONE' AND ci.normalized_value = v_safe_phone
    ) OR EXISTS (
      SELECT 1 FROM public.crm_customers c WHERE c.business_id = p_business_id AND c.phone_normalized = v_safe_phone
    ) THEN
      v_has_phone_conflict := true;
      v_safe_phone := NULL;
    END IF;
  END IF;

  -- Priority 4: Create new CRM Customer Entity safely
  INSERT INTO public.crm_customers (
    business_id, auth_user_id, display_name, email_normalized, phone_normalized,
    identity_type, first_seen_at, last_seen_at
  )
  VALUES (
    p_business_id, p_auth_user_id, v_display_name, v_safe_email, v_safe_phone,
    CASE WHEN p_auth_user_id IS NOT NULL THEN 'REGISTERED' ELSE 'KNOWN_GUEST' END,
    v_now, v_now
  )
  ON CONFLICT (business_id, auth_user_id) WHERE auth_user_id IS NOT NULL
  DO UPDATE SET last_seen_at = v_now
  RETURNING crm_customers.id, crm_customers.business_id, crm_customers.auth_user_id, crm_customers.display_name,
            crm_customers.email_normalized, crm_customers.phone_normalized, crm_customers.identity_type,
            crm_customers.first_seen_at, crm_customers.last_seen_at
  INTO v_cust;

  -- Insert Canonical Identity Ledger Entries
  IF p_auth_user_id IS NOT NULL THEN
    INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
    VALUES (p_business_id, v_cust.id, 'AUTH_USER', p_auth_user_id::TEXT, 'AUTH')
    ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
  END IF;

  IF v_safe_email IS NOT NULL AND v_safe_email <> '' THEN
    INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
    VALUES (p_business_id, v_cust.id, 'EMAIL', v_safe_email, 'ORDER')
    ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
  END IF;

  IF v_safe_phone IS NOT NULL AND v_safe_phone <> '' THEN
    INSERT INTO public.crm_customer_identities (business_id, crm_customer_id, type, normalized_value, source)
    VALUES (p_business_id, v_cust.id, 'PHONE', v_safe_phone, 'ORDER')
    ON CONFLICT (business_id, type, normalized_value) DO NOTHING;
  END IF;

  RETURN QUERY SELECT
    v_cust.id, v_cust.business_id, v_cust.auth_user_id, v_cust.display_name,
    v_cust.email_normalized, v_cust.phone_normalized, v_cust.identity_type,
    v_cust.first_seen_at, v_cust.last_seen_at,
    CASE WHEN v_has_email_conflict OR v_has_phone_conflict THEN 'IDENTITY_CONFLICT' ELSE 'CREATED' END;
  RETURN;
END;
$$;

-- REVOKE execute from PUBLIC, anon, authenticated
REVOKE EXECUTE ON FUNCTION public.resolve_or_create_crm_customer_identity FROM PUBLIC, anon, authenticated;
-- GRANT execute strictly to service_role
GRANT EXECUTE ON FUNCTION public.resolve_or_create_crm_customer_identity TO service_role;

