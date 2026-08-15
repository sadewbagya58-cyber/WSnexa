-- Migration: Super Admin Platform Control, Venue Suspension & Security Guard
-- Version: 20260815000000

-- 1. Add suspension columns to venue_public_profiles
ALTER TABLE public.venue_public_profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 2. Performance indexes for suspension & status lookups
CREATE INDEX IF NOT EXISTS idx_venue_profiles_is_suspended 
  ON public.venue_public_profiles (is_suspended) 
  WHERE is_suspended = TRUE;

CREATE INDEX IF NOT EXISTS idx_businesses_status 
  ON public.businesses (status);

-- 3. Trigger to prevent non-super-admins from mutating is_super_admin on user_profiles
CREATE OR REPLACE FUNCTION public.protect_user_profile_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_is_super BOOLEAN := FALSE;
BEGIN
  -- If is_super_admin is being changed
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    -- Check if calling user is super admin
    IF auth.uid() IS NOT NULL THEN
      SELECT is_super_admin INTO v_caller_is_super
      FROM public.user_profiles
      WHERE id = auth.uid();
    END IF;

    -- If caller is not a verified super admin and not service role (auth.uid() is null for service role)
    IF auth.uid() IS NOT NULL AND (v_caller_is_super IS NOT TRUE) THEN
      RAISE EXCEPTION 'Forbidden: Only verified Super Admins can alter platform administrator privileges.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_profile_super_admin ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_super_admin
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_profile_super_admin();

-- 4. Update user profile creation to bootstrap configured platform admin
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted_first_name TEXT;
  extracted_last_name TEXT;
  is_admin_email BOOLEAN := FALSE;
BEGIN
  -- Extract names safely from raw_user_meta_data
  extracted_first_name := COALESCE(NULLIF(trim(new.raw_user_meta_data->>'first_name'), ''), 'User');
  extracted_last_name  := NULLIF(trim(new.raw_user_meta_data->>'last_name'), '');

  -- Check if user email matches configured platform super admin
  IF lower(trim(new.email)) = 'sadewbagya58@gmail.com' THEN
    is_admin_email := TRUE;
  END IF;

  -- Insert profile, setting is_super_admin if configured admin email
  INSERT INTO public.user_profiles (
    id,
    first_name,
    last_name,
    account_status,
    onboarding_status,
    is_super_admin
  )
  VALUES (
    new.id,
    extracted_first_name,
    extracted_last_name,
    'active',
    'not_started',
    is_admin_email
  )
  ON CONFLICT (id) DO UPDATE SET
    is_super_admin = CASE WHEN lower(trim(new.email)) = 'sadewbagya58@gmail.com' THEN TRUE ELSE user_profiles.is_super_admin END;

  RETURN new;
END;
$$;

-- 5. Secure Audit Logs RLS Policy
-- Business members see their own business logs; platform-level logs (business_id IS NULL) are only visible to super admins
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
DROP POLICY IF EXISTS "Business owners can view business audit logs" ON public.audit_logs;

CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    (business_id IS NOT NULL AND public.auth_has_business_access(business_id))
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() AND user_profiles.is_super_admin = TRUE
    )
  );

-- 6. RPC for safe super admin privilege grant/revocation with last-admin guard
CREATE OR REPLACE FUNCTION public.set_super_admin_status(
  target_user_id UUID,
  new_status BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_is_super BOOLEAN;
  v_super_admin_count INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Authentication required.';
  END IF;

  -- Verify caller is super admin
  SELECT is_super_admin INTO v_caller_is_super
  FROM public.user_profiles
  WHERE id = v_caller_id;

  IF v_caller_is_super IS NOT TRUE THEN
    RAISE EXCEPTION 'Forbidden: Super Admin authority required.';
  END IF;

  -- Prevent self-lockout or removing final super admin
  IF new_status IS FALSE THEN
    SELECT COUNT(*) INTO v_super_admin_count
    FROM public.user_profiles
    WHERE is_super_admin = TRUE;

    IF v_super_admin_count <= 1 THEN
      RAISE EXCEPTION 'Safety Violation: Cannot revoke the final remaining Super Admin account.';
    END IF;
  END IF;

  UPDATE public.user_profiles
  SET is_super_admin = new_status, updated_at = NOW()
  WHERE id = target_user_id;

  -- Record audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    payload
  ) VALUES (
    v_caller_id,
    CASE WHEN new_status THEN 'super_admin.granted' ELSE 'super_admin.revoked' END,
    'user',
    target_user_id::text,
    jsonb_build_object('target_user_id', target_user_id, 'is_super_admin', new_status)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', CASE WHEN new_status THEN 'Super Admin privilege granted successfully.' ELSE 'Super Admin privilege revoked successfully.' END
  );
END;
$$;
