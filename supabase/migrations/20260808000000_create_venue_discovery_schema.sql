-- Migration: 20260808000000_create_venue_discovery_schema.sql
-- Description: Phase 17 Public Venue Profiles, Discovery Search, Customer Favorites, and Verified Reviews

-- 1. Insert Phase 17 Permissions into permissions table
INSERT INTO public.permissions (key, name, description, category, risk_level)
VALUES 
  ('venue_profile.view', 'View Public Venue Profile', 'Allows viewing business public profile draft & configuration', 'venue', 'low'),
  ('venue_profile.manage', 'Manage Public Venue Profile', 'Allows editing and publishing the business public venue profile', 'venue', 'medium'),
  ('reviews.view', 'View Venue Reviews', 'Allows viewing customer reviews in the B2B dashboard', 'reviews', 'low'),
  ('reviews.respond', 'Respond to Customer Reviews', 'Allows responding to customer reviews on behalf of the business', 'reviews', 'medium'),
  ('reviews.moderate', 'Moderate Customer Reviews', 'Allows flagging or hiding inappropriate customer reviews', 'reviews', 'high')
ON CONFLICT (key) DO NOTHING;

-- Map permissions to built-in roles in role_permissions
INSERT INTO public.role_permissions (role_key, permission_key)
VALUES 
  ('business_owner', 'venue_profile.view'),
  ('business_owner', 'venue_profile.manage'),
  ('business_owner', 'reviews.view'),
  ('business_owner', 'reviews.respond'),
  ('business_owner', 'reviews.moderate'),
  ('branch_manager', 'venue_profile.view'),
  ('branch_manager', 'venue_profile.manage'),
  ('branch_manager', 'reviews.view'),
  ('branch_manager', 'reviews.respond')
ON CONFLICT DO NOTHING;

-- 2. Create Public Venue Profiles Table
CREATE TABLE IF NOT EXISTS public.venue_public_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) >= 2 AND char_length(slug) <= 120),
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) >= 1 AND char_length(display_name) <= 100),
  short_description TEXT CHECK (short_description IS NULL OR char_length(short_description) <= 300),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  venue_type TEXT NOT NULL DEFAULT 'restaurant' CHECK (venue_type IN ('restaurant', 'hotel', 'cafe', 'resort', 'villa', 'guest_house', 'food_court', 'cloud_kitchen', 'other')),
  logo_url TEXT,
  cover_image_url TEXT,
  phone_public TEXT CHECK (phone_public IS NULL OR char_length(phone_public) <= 30),
  email_public TEXT CHECK (email_public IS NULL OR char_length(email_public) <= 100),
  website_url TEXT CHECK (website_url IS NULL OR char_length(website_url) <= 200),
  address_public TEXT CHECK (address_public IS NULL OR char_length(address_public) <= 200),
  city TEXT NOT NULL CHECK (char_length(trim(city)) >= 1 AND char_length(city) <= 100),
  country TEXT NOT NULL DEFAULT 'US' CHECK (char_length(country) = 2),
  latitude NUMERIC(10, 7) CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude NUMERIC(10, 7) CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  price_level INTEGER NOT NULL DEFAULT 2 CHECK (price_level >= 1 AND price_level <= 4),
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_accepting_orders BOOLEAN NOT NULL DEFAULT true,
  featured_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Customer Favorite Venues Table
CREATE TABLE IF NOT EXISTS public.customer_favorite_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_profile_id UUID NOT NULL REFERENCES public.venue_public_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, venue_profile_id)
);

-- 4. Create Venue Reviews Table
CREATE TABLE IF NOT EXISTS public.venue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_profile_id UUID NOT NULL REFERENCES public.venue_public_profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT CHECK (review_text IS NULL OR char_length(review_text) <= 1000),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
  is_verified_visit BOOLEAN NOT NULL DEFAULT true,
  owner_response TEXT CHECK (owner_response IS NULL OR char_length(owner_response) <= 1000),
  owner_responded_at TIMESTAMPTZ,
  owner_responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes for Performance & Search
CREATE INDEX IF NOT EXISTS idx_venue_profiles_published_slug 
  ON public.venue_public_profiles (is_published, slug);

CREATE INDEX IF NOT EXISTS idx_venue_profiles_city_type 
  ON public.venue_public_profiles (city, venue_type);

CREATE INDEX IF NOT EXISTS idx_venue_profiles_business_id 
  ON public.venue_public_profiles (business_id);

CREATE INDEX IF NOT EXISTS idx_customer_favorites_user 
  ON public.customer_favorite_venues (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_venue_status 
  ON public.venue_reviews (venue_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_user 
  ON public.venue_reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_reviews_business 
  ON public.venue_reviews (business_id, created_at DESC);

-- 6. Enable Row Level Security
ALTER TABLE public.venue_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_favorite_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_reviews ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Venue Public Profiles: SELECT allowed for anyone if published, or staff with business access if unpublished
DROP POLICY IF EXISTS "Public select published profiles" ON public.venue_public_profiles;
CREATE POLICY "Public select published profiles"
  ON public.venue_public_profiles FOR SELECT
  USING (
    is_published = true OR 
    (auth.uid() IS NOT NULL AND public.auth_has_business_access(business_id))
  );

DROP POLICY IF EXISTS "Staff manage venue profiles" ON public.venue_public_profiles;
CREATE POLICY "Staff manage venue profiles"
  ON public.venue_public_profiles FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.auth_has_business_access(business_id)
  );

-- Customer Favorite Venues: Users manage only their own favorites
DROP POLICY IF EXISTS "Customers select own favorites" ON public.customer_favorite_venues;
CREATE POLICY "Customers select own favorites"
  ON public.customer_favorite_venues FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers insert own favorites" ON public.customer_favorite_venues;
CREATE POLICY "Customers insert own favorites"
  ON public.customer_favorite_venues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers delete own favorites" ON public.customer_favorite_venues;
CREATE POLICY "Customers delete own favorites"
  ON public.customer_favorite_venues FOR DELETE
  USING (auth.uid() = user_id);

-- Venue Reviews:
-- SELECT: Anyone can read 'published' reviews; authors read their own reviews; staff read their business reviews
DROP POLICY IF EXISTS "Read published reviews" ON public.venue_reviews;
CREATE POLICY "Read published reviews"
  ON public.venue_reviews FOR SELECT
  USING (
    status = 'published' OR 
    auth.uid() = user_id OR 
    (auth.uid() IS NOT NULL AND public.auth_has_business_access(business_id))
  );

DROP POLICY IF EXISTS "Customers insert own reviews" ON public.venue_reviews;
CREATE POLICY "Customers insert own reviews"
  ON public.venue_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers update own reviews" ON public.venue_reviews;
CREATE POLICY "Customers update own reviews"
  ON public.venue_reviews FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customers delete own reviews" ON public.venue_reviews;
CREATE POLICY "Customers delete own reviews"
  ON public.venue_reviews FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff update business reviews" ON public.venue_reviews;
CREATE POLICY "Staff update business reviews"
  ON public.venue_reviews FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND public.auth_has_business_access(business_id)
  );
