-- ============================================================================
-- WSNexa Phase 17.1 Schema & Storage Migration
-- Venue Public Media Storage Bucket & Canonical Slug Constraint Update
-- ============================================================================

-- 1. Create Public Storage Bucket for Venue Media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'venue-media',
  'venue-media',
  true,
  8388608, -- 8 MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Storage RLS Policies for venue-media bucket
-- Public READ access for any venue image
DROP POLICY IF EXISTS "Public select venue media" ON storage.objects;
CREATE POLICY "Public select venue media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'venue-media');

-- Authenticated INSERT/UPDATE/DELETE access for authorized staff
DROP POLICY IF EXISTS "Authenticated insert venue media" ON storage.objects;
CREATE POLICY "Authenticated insert venue media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'venue-media'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Authenticated update venue media" ON storage.objects;
CREATE POLICY "Authenticated update venue media"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'venue-media'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Authenticated delete venue media" ON storage.objects;
CREATE POLICY "Authenticated delete venue media"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'venue-media'
    AND auth.role() = 'authenticated'
  );

-- 3. Update Slug Check Constraint on venue_public_profiles
ALTER TABLE public.venue_public_profiles
  DROP CONSTRAINT IF EXISTS venue_public_profiles_slug_check;

ALTER TABLE public.venue_public_profiles
  ADD CONSTRAINT venue_public_profiles_slug_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
