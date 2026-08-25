-- Description: Phase 35 Step 3 — Guest Booking Journey schema additions
-- Add guest_access_token for secure guest reservation lookups and consent_promotional flag

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_access_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS consent_promotional BOOLEAN NOT NULL DEFAULT false;

-- Create index on guest_access_token for fast secure token lookups
CREATE INDEX IF NOT EXISTS idx_reservations_guest_access_token
  ON public.reservations (guest_access_token)
  WHERE guest_access_token IS NOT NULL;
