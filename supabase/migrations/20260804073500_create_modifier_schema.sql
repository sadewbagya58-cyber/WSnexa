-- Migration: Menu Modifiers & Item Customization Schema (Groups, Options, Triggers, RLS)
-- Version: 20260804073500

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.modifier_selection_type AS ENUM (
    'single',
    'multiple'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Modifier Groups Table
CREATE TABLE IF NOT EXISTS public.modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  description TEXT,
  selection_type public.modifier_selection_type NOT NULL DEFAULT 'single',
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  min_selections INTEGER NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections INTEGER CHECK (max_selections IS NULL OR max_selections >= min_selections),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT chk_single_selection_max CHECK (selection_type <> 'single' OR (max_selections IS NULL OR max_selections = 1)),
  CONSTRAINT chk_required_min CHECK (NOT is_required OR min_selections >= 1)
);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_item_branch
  ON public.modifier_groups (menu_item_id, branch_id, is_active, display_order);

-- 3. Create Modifier Options Table
CREATE TABLE IF NOT EXISTS public.modifier_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100),
  additional_price_cents BIGINT NOT NULL DEFAULT 0 CHECK (additional_price_cents >= 0),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique option name per active group
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_option_name
  ON public.modifier_options (modifier_group_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_modifier_options_group_branch
  ON public.modifier_options (modifier_group_id, branch_id, is_active, display_order);

-- 4. Integrity Triggers

-- Trigger function: Ensure modifier group menu item belongs to exact same business and branch & is active
CREATE OR REPLACE FUNCTION public.check_modifier_group_item_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_biz_id UUID;
  item_branch_id UUID;
  item_deleted TIMESTAMPTZ;
BEGIN
  SELECT business_id, branch_id, deleted_at 
  INTO item_biz_id, item_branch_id, item_deleted
  FROM public.menu_items 
  WHERE id = NEW.menu_item_id;

  IF item_biz_id IS NULL THEN
    RAISE EXCEPTION 'Referenced menu item does not exist.';
  END IF;

  IF item_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add modifier group to an archived menu item.';
  END IF;

  IF item_biz_id <> NEW.business_id OR item_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'Modifier group must belong to the exact same business and branch as the menu item.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_modifier_group_item ON public.modifier_groups;
CREATE TRIGGER trg_check_modifier_group_item
  BEFORE INSERT OR UPDATE ON public.modifier_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.check_modifier_group_item_branch();

-- Trigger function: Ensure modifier option group belongs to exact same business and branch & is active
CREATE OR REPLACE FUNCTION public.check_modifier_option_group_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_biz_id UUID;
  group_branch_id UUID;
  group_deleted TIMESTAMPTZ;
BEGIN
  SELECT business_id, branch_id, deleted_at 
  INTO group_biz_id, group_branch_id, group_deleted
  FROM public.modifier_groups 
  WHERE id = NEW.modifier_group_id;

  IF group_biz_id IS NULL THEN
    RAISE EXCEPTION 'Referenced modifier group does not exist.';
  END IF;

  IF group_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot add modifier option to an archived modifier group.';
  END IF;

  IF group_biz_id <> NEW.business_id OR group_branch_id <> NEW.branch_id THEN
    RAISE EXCEPTION 'Modifier option must belong to the exact same business and branch as the modifier group.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_modifier_option_group ON public.modifier_options;
CREATE TRIGGER trg_check_modifier_option_group
  BEFORE INSERT OR UPDATE ON public.modifier_options
  FOR EACH ROW
  EXECUTE FUNCTION public.check_modifier_option_group_branch();

-- 5. Enable RLS
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Modifier Groups Policies
CREATE POLICY "Users can read authorized modifier groups"
  ON public.modifier_groups FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create modifier groups"
  ON public.modifier_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update modifier groups"
  ON public.modifier_groups FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete modifier groups"
  ON public.modifier_groups FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

-- Modifier Options Policies
CREATE POLICY "Users can read authorized modifier options"
  ON public.modifier_options FOR SELECT
  TO authenticated
  USING (public.auth_has_branch_access(branch_id));

CREATE POLICY "Owners and Managers can create modifier options"
  ON public.modifier_options FOR INSERT
  TO authenticated
  WITH CHECK (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can update modifier options"
  ON public.modifier_options FOR UPDATE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );

CREATE POLICY "Owners and Managers can delete modifier options"
  ON public.modifier_options FOR DELETE
  TO authenticated
  USING (
    public.auth_is_business_owner(business_id) 
    OR (
      public.auth_has_business_role(business_id, ARRAY['branch_manager'::public.user_role]) 
      AND public.auth_has_branch_access(branch_id)
    )
  );
