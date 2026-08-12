-- Migration: 20260814000000_phase23_maps_and_booking_links.sql
-- Description: Phase 23 Maps, Nearby Discovery, External Booking Links & Ordering Badges

ALTER TABLE public.venue_public_profiles
  ADD COLUMN IF NOT EXISTS booking_url TEXT CHECK (booking_url IS NULL OR char_length(booking_url) <= 500),
  ADD COLUMN IF NOT EXISTS agoda_url TEXT CHECK (agoda_url IS NULL OR char_length(agoda_url) <= 500),
  ADD COLUMN IF NOT EXISTS external_booking_url TEXT CHECK (external_booking_url IS NULL OR char_length(external_booking_url) <= 500);

CREATE INDEX IF NOT EXISTS idx_venue_profiles_coords 
  ON public.venue_public_profiles (latitude, longitude) 
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_branches_coords 
  ON public.branches (latitude, longitude) 
  WHERE status = 'active';
