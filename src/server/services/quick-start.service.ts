import { createAdminClient } from '@/lib/supabase/server';
import { QuickStartProgress, QuickStartStep } from '@/content/help/types';

export class QuickStartService {
  /**
   * Evaluates real database readiness and setup progress for an active business and branch.
   */
  static async getReadinessProgress(
    businessId: string,
    branchId?: string
  ): Promise<QuickStartProgress> {
    const admin = createAdminClient();

    // Query real counts in parallel for optimal performance
    const [
      businessRes,
      branchesRes,
      menuItemsRes,
      serviceAreasRes,
      tablesRes,
      qrRes,
      membershipsRes,
      invitesRes,
      paymentsRes,
      securityRes,
      venueProfileRes,
    ] = await Promise.all([
      admin.from('businesses').select('id, name, currency').eq('id', businessId).single(),
      admin.from('branches').select('id').eq('business_id', businessId),
      admin.from('menu_items').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      branchId
        ? admin.from('service_areas').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
        : admin.from('service_areas').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      branchId
        ? admin.from('tables').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
        : admin.from('tables').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      branchId
        ? admin.from('branch_qr_codes').select('id', { count: 'exact', head: true }).eq('branch_id', branchId)
        : admin.from('branch_qr_codes').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('business_memberships').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('staff_invitations').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      branchId
        ? admin.from('branch_payment_methods').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('is_enabled', true)
        : { count: 0 },
      branchId
        ? admin.from('branch_order_security_settings').select('id').eq('branch_id', branchId).maybeSingle()
        : { data: null },
      admin.from('venue_public_profiles').select('id, is_published, address_line1, city, latitude, longitude').eq('business_id', businessId).maybeSingle(),
    ]);

    const hasBusiness = Boolean(businessRes.data?.name);
    const hasBranch = (branchesRes.data?.length || 0) > 0;
    const hasMenuItems = (menuItemsRes.count || 0) > 0;
    const hasServiceAreas = (serviceAreasRes.count || 0) > 0;
    const hasTables = (tablesRes.count || 0) > 0;
    const hasQrCodes = (qrRes.count || 0) > 0 || hasTables;
    const hasStaff = (membershipsRes.count || 0) > 1 || (invitesRes.count || 0) > 0;
    const hasPayments = (paymentsRes.count || 0) > 0;
    const hasSecurity = Boolean(securityRes.data);
    const profile = venueProfileRes.data;
    const hasLocation = Boolean(
      profile?.address_line1 &&
      profile?.city &&
      profile?.latitude !== null &&
      profile?.latitude !== undefined &&
      profile?.longitude !== null &&
      profile?.longitude !== undefined
    );
    const isPublished = Boolean(profile?.is_published);

    const steps: QuickStartStep[] = [
      {
        id: 'business-setup',
        title: 'Configure Business & Tax Settings',
        description: 'Set your venue name, currency, VAT/sales tax, and service charge percentage.',
        route: '/dashboard/business',
        guideSlug: 'setting-up-your-business',
        isCompleted: hasBusiness,
      },
      {
        id: 'branch-setup',
        title: 'Set Up Operating Branch Outlet',
        description: 'Configure your primary location address and operational ordering modes.',
        route: '/dashboard/branches',
        guideSlug: 'setting-up-your-first-branch',
        isCompleted: hasBranch,
      },
      {
        id: 'menu-catalog',
        title: 'Build Your Digital Menu',
        description: 'Add menu categories, food and drink items with prices and optional modifiers.',
        route: '/dashboard/menu/items',
        guideSlug: 'adding-menu-items-and-pricing',
        isCompleted: hasMenuItems,
      },
      {
        id: 'dining-areas',
        title: 'Configure Service Areas',
        description: 'Create dining zones (e.g. Indoor, Patio) to organize tables and staff routing.',
        route: '/dashboard/tables/areas',
        guideSlug: 'creating-service-areas-and-tables',
        isCompleted: hasServiceAreas,
      },
      {
        id: 'dining-tables',
        title: 'Add Dining Tables',
        description: 'Generate numbered tables with seating capacities for your floor plan.',
        route: '/dashboard/dining',
        guideSlug: 'creating-service-areas-and-tables',
        isCompleted: hasTables,
      },
      {
        id: 'qr-codes',
        title: 'Generate & Print Table QR Codes',
        description: 'Download high-resolution QR sheets for contactless guest ordering.',
        route: '/dashboard/tables/qr',
        guideSlug: 'generating-and-printing-qr-codes',
        isCompleted: hasQrCodes,
      },
      {
        id: 'staff-invitations',
        title: 'Invite Staff & Assign Roles',
        description: 'Add waiters, kitchen staff, managers, and cashiers to your workspace.',
        route: '/dashboard/team/invites',
        guideSlug: 'inviting-and-managing-staff-members',
        isCompleted: hasStaff,
      },
      {
        id: 'payment-methods',
        title: 'Configure Accepted Payment Methods',
        description: 'Enable Cash, Card terminal, or Pay at Counter for branch checkout.',
        route: '/dashboard/settings/payments',
        guideSlug: 'configuring-payment-methods',
        isCompleted: hasPayments,
      },
      {
        id: 'order-security',
        title: 'Review Order Security Rules',
        description: 'Choose between Low, Balanced, or High anti-tamper security levels.',
        route: '/dashboard/settings/order-security',
        guideSlug: 'understanding-order-security-levels',
        isCompleted: hasSecurity,
      },
      {
        id: 'venue-profile',
        title: 'Set Up Public Profile & Coordinates',
        description: 'Add photos, culinary description, and pin your map location.',
        route: '/dashboard/venue-profile',
        guideSlug: 'setting-up-public-venue-profile',
        isCompleted: hasLocation,
      },
      {
        id: 'publish-venue',
        title: 'Publish Venue to Discovery Directory',
        description: 'Launch your restaurant on WSNexa Explore for customer discovery.',
        route: '/dashboard/venue-profile',
        guideSlug: 'publishing-your-venue-checklist',
        isCompleted: isPublished,
      },
    ];

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const percentage = Math.round((completedCount / steps.length) * 100);

    return {
      totalSteps: steps.length,
      completedSteps: completedCount,
      percentage,
      steps,
    };
  }
}
