-- Migration: Menu Catalog Management Schema (Categories, Items, Images, Triggers, RLS)
-- Version: 20260804071500

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.menu_item_availability AS ENUM (
    'available',
    'out_of_stock',
    'hidden'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Menu Categories Table
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  slug TEXT NOT NULL CHECK (char_length(trim(slug)) >= 1 AND char_length(slug) <= 120),
  description TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique category slug per branch for non-deleted rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_category_slug
  ON public.menu_categories (branch_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_categories_biz_branch
  ON public.menu_categories (business_id, branch_id, is_active, display_order);

-- 3. Create Menu Items Table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  slug TEXT NOT NULL CHECK (char_length(trim(slug)) >= 1 AND char_length(slug) <= 120),
  description TEXT,
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) = 3),
  preparation_time_minutes INTEGER CHECK (preparation_time_minutes IS NULL OR preparation_time_minutes >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  availability_status public.menu_item_availability NOT NULL DEFAULT 'available',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  primary_image_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique item slug per branch for non-deleted rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_item_slug
  ON public.menu_items (branch_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_cat_branch
  ON public.menu_items (category_id, branch_id, availability_status, is_active);

-- 4. Create Menu Item Images Table
CREATE TABLE IF NOT EXISTS public.menu_item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  alt_text TEXT,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 5. Database Integrity Helper Triggers

-- Trigger function: Ensure menu item category belongs to the same business & branch and is active
CREATE OR REPLACE FUNCTION public.check_menu_item_category_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_biz_id UUID;
  cat_branch_id UUID;
  cat_deleted TIMESTAMPTZ;
BEGIN
  SELECT business_id, branch_id, deleted_at 
  INTO cat_biz_id, cat_branch_id, cat_deleted
  FROM public.menu_categories 
  WHERE id = NEW.category_id;

  IF cat_biz_id IS NULL THEN
    RAISE EXCEPTION 'Referenced menu category does not exist.';
  END IF;

  IF cat_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add or update menu items under an archived category.';
  END IF;

  IF cat_biz_id <> NEW.business_id OR cat_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'Menu item category must belong to the exact same business and branch.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_menu_item_category ON public.menu_items;
CREATE TRIGGER trg_check_menu_item_category
  BEFORE INSERT OR UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_menu_item_category_branch();

-- 6. Enable RLS
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_images ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Menu Categories Policies
CREATE POLICY "Users can read authorized menu categories"
  ON public.menu_categories FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create menu categories"
  ON public.menu_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update menu categories"
  ON public.menu_categories FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete menu categories"
  ON public.menu_categories FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

-- Menu Items Policies
CREATE POLICY "Users can read authorized menu items"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create menu items"
  ON public.menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update menu items"
  ON public.menu_items FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete menu items"
  ON public.menu_items FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

-- Menu Item Images Policies
CREATE POLICY "Users can read authorized menu item images"
  ON public.menu_item_images FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can manage menu item images"
  ON public.menu_item_images FOR ALL
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

-- 8. Storage RLS Policies for Menu Item Images (in business-assets bucket)
CREATE POLICY "Authenticated Upload to Menu Item Images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'menu-items'
  );

CREATE POLICY "Authenticated Delete from Menu Item Images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'menu-items'
  );
