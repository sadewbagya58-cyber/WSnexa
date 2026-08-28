-- Migration: 20260828000000_phase37_staff_invitation_encrypted_code.sql
-- Description: Add encrypted_code column to public.staff_invitations for persistent, secure code retrieval of valid pending invitations

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff_invitations'
      AND column_name = 'encrypted_code'
  ) THEN
    ALTER TABLE public.staff_invitations ADD COLUMN encrypted_code TEXT;
  END IF;
END $$;
