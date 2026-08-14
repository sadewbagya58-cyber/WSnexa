import { createAdminClient } from '@/lib/supabase/server';

export interface CanonicalMenuItemOption {
  id: string;
  name: string;
  price_cents: number;
  is_available: boolean;
}

export interface CanonicalModifierGroup {
  id: string;
  name: string;
  description: string | null;
  selection_type: string;
  min_selections: number;
  max_selections: number;
  is_required: boolean;
  options: CanonicalMenuItemOption[];
}

export interface CanonicalMenuItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  availability_status: 'available' | 'out_of_stock' | 'hidden' | string;
  is_available: boolean;
  is_featured: boolean;
  primary_image_url: string | null;
  display_order: number;
  modifier_groups: CanonicalModifierGroup[];
}

export interface CanonicalMenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
}

export interface BranchMenuCatalog {
  business: {
    id: string;
    name: string;
    logo_url: string | null;
    description: string | null;
    currency: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    address_line1: string | null;
    city: string | null;
    require_table_selection: boolean;
    require_table_pin: boolean;
    table_pin_length: number;
    currency: string;
  };
  venue_profile?: {
    display_name: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
  } | null;
  categories: CanonicalMenuCategory[];
  items: CanonicalMenuItem[];
}

export type CatalogMenuItem = CanonicalMenuItem;

interface RawCategory {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  display_order?: number | null;
}

interface RawItem {
  id: string;
  category_id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  price_cents: number;
  availability_status: string;
  is_featured: boolean;
  primary_image_url: string | null;
  display_order: number;
}

interface RawGroup {
  id: string;
  menu_item_id: string;
  name: string;
  description?: string | null;
  selection_type?: string | null;
  min_selections?: number | null;
  max_selections?: number | null;
  is_required?: boolean | null;
}

interface RawOption {
  id: string;
  modifier_group_id: string;
  name: string;
  price_cents?: number | null;
  additional_price_cents?: number | null;
}

export class MenuCatalogService {
  /**
   * Resolves the single, canonical branch menu catalog for both Public QR Menu and Waiter Staff Menu.
   */
  static async getBranchMenuCatalog(
    businessId: string,
    branchId: string,
    adminClient?: unknown
  ): Promise<BranchMenuCatalog | null> {
    const admin = (adminClient as ReturnType<typeof createAdminClient>) || createAdminClient();

    // 1. Fetch Business
    const { data: business } = await admin
      .from('businesses')
      .select('id, name, logo_url, description, default_currency')
      .eq('id', businessId)
      .single();

    if (!business) return null;

    // 2. Fetch Branch
    const { data: branch } = await admin
      .from('branches')
      .select(
        'id, name, code, phone, address_line_1, city, require_table_selection, require_table_pin, table_pin_length'
      )
      .eq('id', branchId)
      .eq('business_id', businessId)
      .single();

    if (!branch) return null;

    // 3. Fetch Venue Public Profile for branding override (logo/name)
    const { data: profile } = await admin
      .from('venue_public_profiles')
      .select('display_name, logo_url, cover_image_url')
      .eq('business_id', businessId)
      .maybeSingle();

    // 4. Fetch Menu Categories for active branch ONLY
    const { data: categoriesData } = await admin
      .from('menu_categories')
      .select('id, name, slug, description, display_order')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    const categories: CanonicalMenuCategory[] = ((categoriesData || []) as RawCategory[]).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
      description: c.description || null,
      display_order: c.display_order ?? 0,
    }));

    // 5. Fetch Menu Items for active branch ONLY (Excluding hidden/deleted items)
    const { data: itemsData } = await admin
      .from('menu_items')
      .select(
        'id, category_id, name, slug, description, price_cents, availability_status, is_featured, primary_image_url, display_order'
      )
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .neq('availability_status', 'hidden')
      .is('deleted_at', null)
      .order('display_order', { ascending: true });

    const rawItems = (itemsData || []) as RawItem[];
    const itemIds = rawItems.map((i) => i.id);

    // 6. Fetch Modifier Groups & Options for active items
    const modifierGroupsMap: Record<string, CanonicalModifierGroup[]> = {};
    if (itemIds.length > 0) {
      const { data: groupsData } = await admin
        .from('modifier_groups')
        .select(
          'id, menu_item_id, name, description, selection_type, min_selections, max_selections, is_required'
        )
        .in('menu_item_id', itemIds);

      const rawGroups = (groupsData || []) as RawGroup[];
      const groupIds = rawGroups.map((g) => g.id);
      const optionsMap: Record<string, CanonicalMenuItemOption[]> = {};

      if (groupIds.length > 0) {
        const { data: optionsData } = await admin
          .from('modifier_options')
          .select('*')
          .in('modifier_group_id', groupIds)
          .order('display_order', { ascending: true });

        for (const opt of (optionsData || []) as RawOption[]) {
          if (!optionsMap[opt.modifier_group_id]) {
            optionsMap[opt.modifier_group_id] = [];
          }
          const priceCents = opt.price_cents ?? opt.additional_price_cents ?? 0;
          optionsMap[opt.modifier_group_id].push({
            id: opt.id,
            name: opt.name,
            price_cents: priceCents,
            is_available: true,
          });
        }
      }

      for (const grp of rawGroups) {
        if (!modifierGroupsMap[grp.menu_item_id]) {
          modifierGroupsMap[grp.menu_item_id] = [];
        }
        modifierGroupsMap[grp.menu_item_id].push({
          id: grp.id,
          name: grp.name,
          description: grp.description || null,
          selection_type: grp.selection_type || 'single',
          min_selections: grp.min_selections ?? 0,
          max_selections: grp.max_selections ?? 1,
          is_required: grp.is_required ?? false,
          options: optionsMap[grp.id] || [],
        });
      }
    }

    const defaultCurrency =
      (branch as unknown as { currency?: string }).currency || business.default_currency || 'USD';

    const items: CanonicalMenuItem[] = rawItems.map((item) => {
      const isAvailable = item.availability_status === 'available';
      const availStatus = item.availability_status || 'available';

      return {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        slug: item.slug || item.name.toLowerCase().replace(/\s+/g, '-'),
        description: item.description || null,
        price_cents: item.price_cents || 0,
        currency: defaultCurrency,
        availability_status: availStatus,
        is_available: isAvailable,
        is_featured: item.is_featured ?? false,
        primary_image_url: item.primary_image_url || null,
        display_order: item.display_order ?? 0,
        modifier_groups: modifierGroupsMap[item.id] || [],
      };
    });

    return {
      business: {
        id: business.id,
        name: business.name,
        logo_url: profile?.logo_url || business.logo_url || null,
        description: business.description || null,
        currency: business.default_currency || 'USD',
      },
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        phone: branch.phone || null,
        address_line1: branch.address_line_1 || null,
        city: branch.city || null,
        require_table_selection: branch.require_table_selection ?? true,
        require_table_pin: branch.require_table_pin ?? false,
        table_pin_length: branch.table_pin_length ?? 4,
        currency: defaultCurrency,
      },
      venue_profile: profile
        ? {
            display_name: profile.display_name || null,
            logo_url: profile.logo_url || null,
            cover_image_url: profile.cover_image_url || null,
          }
        : null,
      categories,
      items,
    };
  }
}
