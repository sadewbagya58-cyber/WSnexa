-- Migration: 20260825000002_phase35_public_venue_feature_policy.sql
-- Description: Phase 35 Optional Public Venue Feature Policy (Public Table Reservations & Public Menu)

ALTER TABLE public.venue_public_profiles
ADD COLUMN IF NOT EXISTS public_reservations_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS public_menu_enabled BOOLEAN NOT NULL DEFAULT true;
