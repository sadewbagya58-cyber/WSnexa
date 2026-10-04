-- ============================================================================
-- Migration: 20261003123000_bank_transfer_storage.sql
-- Description: Private Storage Bucket for Bank Transfer Receipts & Hardened Storage RLS.
-- Notice: Decoupled from core payment schema to eliminate cross-table lock cycles.
-- Prerequisite: 20261003120000 (public.auth_is_super_admin must exist).
-- ============================================================================

-- Defensive lock timeout: Fail fast if an exclusive lock cannot be acquired within 5s
SET LOCAL lock_timeout = '5s';

-- 1. Private Storage Bucket for Bank Transfer Receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-transfer-receipts',
  'bank-transfer-receipts',
  false, -- STRICTLY PRIVATE
  5242880, -- 5 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- 2. Hardened Storage RLS Policies for Bank Transfer Receipts
-- Path convention: receipts/{business_id}/{payment_id}/{uuid}.{ext}
-- storage.foldername(name) array: ['receipts', '<business_id>', '<payment_id>']

-- INSERT: Authenticated business owners uploading receipts for their own pending payment intents
DROP POLICY IF EXISTS "Authenticated owners can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated owners can upload receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bank-transfer-receipts'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = 'receipts'
    AND array_length(storage.foldername(name), 1) >= 3
    AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND public.auth_is_business_owner((storage.foldername(name))[2]::uuid)
    AND EXISTS (
      SELECT 1 FROM public.business_subscription_payments p
      WHERE p.id = (storage.foldername(name))[3]::uuid
        AND p.business_id = (storage.foldername(name))[2]::uuid
        AND p.status = 'pending'
    )
  );

-- SELECT: Super Admins or Business Owners reading receipts for their own business payments
DROP POLICY IF EXISTS "Authorized users can read receipts" ON storage.objects;
CREATE POLICY "Authorized users can read receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bank-transfer-receipts'
    AND (
      public.auth_is_super_admin()
      OR (
        (storage.foldername(name))[1] = 'receipts'
        AND array_length(storage.foldername(name), 1) >= 3
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.auth_is_business_owner((storage.foldername(name))[2]::uuid)
        AND EXISTS (
          SELECT 1 FROM public.business_subscription_payments p
          WHERE p.id = (storage.foldername(name))[3]::uuid
            AND p.business_id = (storage.foldername(name))[2]::uuid
        )
      )
    )
  );

-- DELETE: Super Admins or Business Owners removing unreviewed receipts (client compensation on failed submission)
DROP POLICY IF EXISTS "Authorized owners and admins can delete unreviewed receipts" ON storage.objects;
CREATE POLICY "Authorized owners and admins can delete unreviewed receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bank-transfer-receipts'
    AND (
      public.auth_is_super_admin()
      OR (
        (storage.foldername(name))[1] = 'receipts'
        AND array_length(storage.foldername(name), 1) >= 3
        AND (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND (storage.foldername(name))[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.auth_is_business_owner((storage.foldername(name))[2]::uuid)
        AND EXISTS (
          SELECT 1 FROM public.business_subscription_payments p
          WHERE p.id = (storage.foldername(name))[3]::uuid
            AND p.business_id = (storage.foldername(name))[2]::uuid
            AND p.review_status IN ('none', 'pending_proof', 'under_review', 'rejected')
            AND p.status != 'paid'
        )
      )
    )
  );
