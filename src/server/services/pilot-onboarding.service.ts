import { createAdminClient } from '@/lib/supabase/server';
import { normalizeVenueSlug, VenueType } from '@/lib/validation/venue';

export interface InitializePilotInput {
  businessName: string;
  venueDisplayName: string;
  venueType: VenueType;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  template: 'resort' | 'restaurant' | 'cafe';
}

export interface PilotOnboardingResult {
  success: boolean;
  businessId?: string;
  branchId?: string;
  venueProfileId?: string;
  venueSlug?: string;
  tablesCount?: number;
  menuItemsCount?: number;
  message?: string;
}

export class PilotOnboardingService {
  /**
   * Initialize a production-safe pilot venue template for launch demonstration or partner onboarding.
   */
  static async initializePilot(input: InitializePilotInput, superAdminUserId: string): Promise<PilotOnboardingResult> {
    const admin = createAdminClient();
    const timestamp = Date.now();
    const slug = normalizeVenueSlug(`${input.venueDisplayName}-${timestamp.toString().slice(-4)}`);

    try {
      // 1. Create Business
      const { data: business, error: bizErr } = await admin
        .from('businesses')
        .insert({
          name: input.businessName,
          slug: `pilot-${slug}`,
          created_by: superAdminUserId,
          is_pilot_demo: true,
        })
        .select('id')
        .single();

      if (bizErr || !business) {
        return { success: false, message: `Failed to create pilot business: ${bizErr?.message}` };
      }

      // 2. Add Super Admin membership as owner
      await admin.from('business_memberships').insert({
        business_id: business.id,
        user_id: superAdminUserId,
        role: 'business_owner',
      });

      // 3. Create Main Branch
      const { data: branch, error: branchErr } = await admin
        .from('branches')
        .insert({
          business_id: business.id,
          name: `${input.city} Main Branch`,
          code: 'MAIN',
          is_default: true,
          status: 'active',
          address_line_1: `${input.venueDisplayName} Boulevard`,
          city: input.city,
          latitude: input.latitude,
          longitude: input.longitude,
        })
        .select('id')
        .single();

      if (branchErr || !branch) {
        return { success: false, message: `Failed to create pilot main branch: ${branchErr?.message}` };
      }

      // 4. Create Venue Public Profile
      const { data: profile, error: profileErr } = await admin
        .from('venue_public_profiles')
        .insert({
          business_id: business.id,
          featured_branch_id: branch.id,
          display_name: input.venueDisplayName,
          slug,
          venue_type: input.venueType,
          short_description: `Premier ${input.venueType} located in ${input.city}, ${input.country}.`,
          description: `Welcome to ${input.venueDisplayName}. Experience premium hospitality, seamless digital ordering, and exceptional local cuisine.`,
          address_public: `${input.venueDisplayName} Boulevard`,
          city: input.city,
          country: input.country,
          latitude: input.latitude,
          longitude: input.longitude,
          price_level: 3,
          is_published: true,
          is_accepting_orders: true,
        })
        .select('id')
        .single();

      if (profileErr || !profile) {
        return { success: false, message: `Failed to create pilot venue profile: ${profileErr?.message}` };
      }

      // 5. Populate Sample Menu Categories & Items
      const categories = [
        { name: 'Signature Dishes', slug: `signature-${timestamp}`, display_order: 1 },
        { name: 'Beverages & Cocktails', slug: `beverages-${timestamp}`, display_order: 2 },
        { name: 'Desserts', slug: `desserts-${timestamp}`, display_order: 3 },
      ];

      let totalMenuItems = 0;
      for (const cat of categories) {
        const { data: category } = await admin
          .from('menu_categories')
          .insert({
            business_id: business.id,
            branch_id: branch.id,
            name: cat.name,
            slug: cat.slug,
            display_order: cat.display_order,
          })
          .select('id')
          .single();

        if (category) {
          const sampleItems = [
            { name: `${cat.name} Special A`, price_cents: 1800, description: `Freshly prepared chef specialty.` },
            { name: `${cat.name} Deluxe B`, price_cents: 2400, description: `Premium imported ingredients.` },
          ];

          for (const item of sampleItems) {
            await admin.from('menu_items').insert({
              business_id: business.id,
              branch_id: branch.id,
              category_id: category.id,
              name: item.name,
              description: item.description,
              price_cents: item.price_cents,
              availability_status: 'available',
              is_active: true,
            });
            totalMenuItems++;
          }
        }
      }

      // 6. Create Service Area & Tables with QR Codes
      const { data: area } = await admin
        .from('service_areas')
        .insert({
          business_id: business.id,
          branch_id: branch.id,
          name: 'Main Dining Lounge',
          code: `LOUNGE_${timestamp.toString().slice(-4)}`,
        })
        .select('id')
        .single();

      let tablesCreated = 0;
      if (area) {
        const tablesToCreate = [
          { name: 'Table A1', code: 'TBL-A1', number: 1 },
          { name: 'Table A2', code: 'TBL-A2', number: 2 },
          { name: 'Table A3', code: 'TBL-A3', number: 3 },
        ];

        for (const tbl of tablesToCreate) {
          const { data: newTable } = await admin
            .from('dining_tables')
            .insert({
              business_id: business.id,
              branch_id: branch.id,
              service_area_id: area.id,
              name: tbl.name,
              code: tbl.code,
              table_number: tbl.number,
              capacity: 4,
              status: 'available',
              is_active: true,
            })
            .select('id')
            .single();

          if (newTable) {
            tablesCreated++;
            // Generate QR Token
            await admin.from('branch_qr_codes').insert({
              business_id: business.id,
              branch_id: branch.id,
              table_id: newTable.id,
              token: `PILOT-QR-${branch.id.slice(0, 4)}-${tbl.number}-${timestamp.toString().slice(-4)}`,
              qr_type: 'table',
              status: 'active',
            });
          }
        }
      }

      return {
        success: true,
        businessId: business.id,
        branchId: branch.id,
        venueProfileId: profile.id,
        venueSlug: slug,
        tablesCount: tablesCreated,
        menuItemsCount: totalMenuItems,
        message: `Pilot venue "${input.venueDisplayName}" initialized successfully with ${tablesCreated} tables & ${totalMenuItems} menu items!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, message: `Pilot initialization unexpected error: ${msg}` };
    }
  }
}
