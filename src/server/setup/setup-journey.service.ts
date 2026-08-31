import { createAdminClient } from '@/lib/supabase/server';
import {
  CANONICAL_SETUP_STAGES,
  SetupJourneyReport,
  SetupStageState,
  SetupStageStatus,
} from '@/lib/setup/setup-journey';
import { AuthorizationContext } from '@/types/authorization.types';

export class SetupJourneyService {
  /**
   * Resolves the comprehensive, data-derived setup journey report for the active business and branch.
   * Multi-branch safe: accurately scopes branch-specific tables to the activeBranch.
   */
  static async resolveSetupJourney(
    businessId: string,
    activeBranch?: { id: string; name: string } | null,
    _authContext?: AuthorizationContext
  ): Promise<SetupJourneyReport> {
    const admin = createAdminClient();

    // Determine target branch ID: if explicitly provided, evaluate it strictly.
    // If no branch context is supplied at all (fresh session/onboarding), resolve the business's default active branch.
    let targetBranchId: string | null = activeBranch?.id || null;
    let resolvedBranchName = activeBranch?.name || '';

    if (!targetBranchId) {
      const defaultBranchRes = await admin
        .from('branches')
        .select('id, name, address_line_1, status, require_table_pin, table_pin_length, deleted_at')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (defaultBranchRes.data) {
        targetBranchId = defaultBranchRes.data.id;
        resolvedBranchName = defaultBranchRes.data.name;
      }
    }

    // 1. Parallel batch fetch for all setup signals strictly scoped by business / branch
    const [
      businessRes,
      branchRes,
      serviceAreasRes,
      diningTablesRes,
      branchQrRes,
      menuCategoriesRes,
      menuItemsRes,
      securitySettingsRes,
      paymentSettingsRes,
      paymentMethodsRes,
      membershipsRes,
      invitationsRes,
      venueProfileRes,
      inventoryItemsRes,
      ordersRes,
    ] = await Promise.all([
      // Business basics
      admin
        .from('businesses')
        .select('name, country_code, default_currency, timezone')
        .eq('id', businessId)
        .maybeSingle(),

      // Branch details (strictly evaluate targetBranchId if known)
      targetBranchId
        ? admin
            .from('branches')
            .select('id, name, address_line_1, status, require_table_pin, table_pin_length, deleted_at')
            .eq('id', targetBranchId)
            .eq('business_id', businessId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      // Dining service areas (active branch)
      targetBranchId
        ? admin
            .from('service_areas')
            .select('id', { count: 'exact', head: true })
            .eq('business_id', businessId)
            .eq('branch_id', targetBranchId)
            .is('deleted_at', null)
        : Promise.resolve({ count: 0, data: null, error: null }),

      // Dining tables (active branch)
      targetBranchId
        ? admin
            .from('dining_tables')
            .select('id, table_pin_hash, is_active')
            .eq('business_id', businessId)
            .eq('branch_id', targetBranchId)
            .eq('is_active', true)
            .is('deleted_at', null)
        : Promise.resolve({ count: 0, data: [], error: null }),

      // Active Branch QR codes (active branch)
      targetBranchId
        ? admin
            .from('branch_qr_codes')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', targetBranchId)
            .eq('is_active', true)
            .is('revoked_at', null)
        : Promise.resolve({ count: 0, data: null, error: null }),

      // Menu categories (business-wide / branch-scoped)
      admin
        .from('menu_categories')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null),

      // Usable active menu items (business-wide / branch-scoped)
      admin
        .from('menu_items')
        .select('id, is_active, availability_status')
        .eq('business_id', businessId)
        .is('deleted_at', null),

      // Order security settings (active branch)
      targetBranchId
        ? admin
            .from('branch_order_security_settings')
            .select('id, require_waiter_approval, require_customer_account, qr_session_duration_minutes')
            .eq('branch_id', targetBranchId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      // Payment settings (active branch)
      targetBranchId
        ? admin
            .from('branch_payment_settings')
            .select('id, allow_cash, allow_card_pos, allow_online_payment')
            .eq('branch_id', targetBranchId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),

      // Payment methods (active branch)
      targetBranchId
        ? admin
            .from('branch_payment_methods')
            .select('id, method, is_enabled')
            .eq('branch_id', targetBranchId)
            .eq('is_enabled', true)
        : Promise.resolve({ data: [], error: null }),

      // Non-owner staff memberships (business-wide)
      admin
        .from('business_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('membership_status', 'active')
        .neq('role', 'business_owner'),

      // Valid unexpired pending staff invitations (business-wide)
      admin
        .from('staff_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()),

      // Public venue profile (business-wide)
      admin
        .from('venue_public_profiles')
        .select('id, display_name, city, address_public, description, is_published')
        .eq('business_id', businessId)
        .maybeSingle(),

      // Inventory items (optional check)
      admin
        .from('inventory_items')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null),

      // Orders placed (active branch)
      targetBranchId
        ? admin
            .from('orders')
            .select('id, status, approval_status, created_at')
            .eq('branch_id', targetBranchId)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Extracted counts & data
    const businessData = businessRes.data;
    const branchData = branchRes.data;
    const serviceAreasCount = serviceAreasRes.count || 0;
    const tables = diningTablesRes.data || [];
    const tablesCount = tables.length;
    const tablesWithPinCount = tables.filter((t) => Boolean(t.table_pin_hash)).length;
    const requireTablePin = Boolean((branchData as unknown as { require_table_pin?: boolean })?.require_table_pin);
    const hasActiveQr = (branchQrRes.count || 0) > 0;

    const categoriesCount = menuCategoriesRes.count || 0;
    const rawMenuItems = menuItemsRes.data || [];
    const usableMenuItems = rawMenuItems.filter(
      (i) => i.is_active !== false && i.availability_status !== 'hidden'
    );
    const usableMenuItemsCount = usableMenuItems.length;

    const securitySettings = securitySettingsRes.data;
    const paymentSettings = paymentSettingsRes.data;
    const enabledPaymentMethods = paymentMethodsRes.data || [];

    // Usable payments predicate: at least one active payment path (Cash, Card at venue, Counter, QR, Online)
    const hasUsablePaymentMethod =
      enabledPaymentMethods.length > 0 ||
      Boolean(
        paymentSettings?.allow_cash === true ||
        paymentSettings?.allow_card_pos === true ||
        paymentSettings?.allow_online_payment === true
      );

    // Exact order security predicate: DB row exists with valid ID (no unconditional true)
    const hasOrderSecurity = Boolean(securitySettings?.id);

    const staffMembershipsCount = membershipsRes.count || 0;
    const validPendingInvitationsCount = invitationsRes.count || 0;
    const venueProfile = venueProfileRes.data;
    const inventoryCount = inventoryItemsRes.count || 0;

    // Test order evaluation: only downstream operational progression (confirmed, preparing, ready, served, completed) counts
    const allOrders = ordersRes.data || [];
    const validOrders = allOrders.filter((o) =>
      ['confirmed', 'preparing', 'ready', 'served', 'completed'].includes(o.status)
    );
    const rejectedOrCancelledOnly = allOrders.length > 0 && validOrders.length === 0;

    const stages: SetupStageState[] = [];

    for (const config of CANONICAL_SETUP_STAGES) {
      let isCompleted = false;
      let status: SetupStageStatus = 'not_started';
      let completionDetail = '';
      let nextActionHref = config.href;
      let nextActionLabel = config.ctaLabel;
      let substeps: SetupStageState['substeps'];

      switch (config.id) {
        // 1. Business Basics
        case 'business_basics': {
          const hasName = Boolean(businessData?.name?.trim());
          const hasCurrency = Boolean(businessData?.default_currency);
          const hasTimezone = Boolean(businessData?.timezone);
          isCompleted = hasName && hasCurrency && hasTimezone;
          status = isCompleted ? 'completed' : 'in_progress';
          completionDetail = isCompleted
            ? `${businessData?.name} (${businessData?.default_currency}, ${businessData?.timezone})`
            : 'Fill in business name, currency, and timezone defaults.';
          substeps = [
            { id: 'b_name', label: 'Business Name', isCompleted: hasName, href: '/dashboard/business' },
            { id: 'b_curr', label: 'Default Currency & Timezone', isCompleted: hasCurrency && hasTimezone, href: '/dashboard/business' },
          ];
          break;
        }

        // 2. Primary Branch Outlet (Strictly requires status === 'active', non-deleted, non-empty name)
        case 'location': {
          const isBranchActive =
            Boolean(branchData) &&
            branchData?.status === 'active' &&
            !branchData?.deleted_at;
          const hasBranch = Boolean(branchData?.name?.trim()) && Boolean(isBranchActive);
          isCompleted = hasBranch;
          status = isCompleted ? 'completed' : 'in_progress';
          completionDetail = isCompleted
            ? branchData?.address_line_1
              ? `${branchData.name} • ${branchData.address_line_1}`
              : `${branchData?.name} • Primary branch ready`
            : 'Add your primary branch outlet.';
          substeps = [
            { id: 'l_branch', label: 'Branch Outlet Ready', isCompleted: hasBranch, href: '/dashboard/branches' },
          ];
          break;
        }



        // 3. Dining & QR
        case 'dining_qr': {
          const hasAreas = serviceAreasCount > 0;
          const hasTables = tablesCount > 0;
          const pinSatisfied = !requireTablePin || (tablesCount > 0 && tablesWithPinCount === tablesCount);

          isCompleted = hasAreas && hasTables && pinSatisfied && hasActiveQr;
          status = isCompleted ? 'completed' : hasAreas ? 'in_progress' : 'not_started';

          if (!hasAreas) {
            completionDetail = 'Create a Service Area (e.g. Main Dining, Patio) first.';
            nextActionHref = '/dashboard/areas';
            nextActionLabel = '+ Add Service Area';
          } else if (!hasTables) {
            completionDetail = `${serviceAreasCount} area(s) ready. Add dining tables.`;
            nextActionHref = '/dashboard/tables/new';
            nextActionLabel = '+ Add Table';
          } else if (!pinSatisfied) {
            completionDetail = `${tablesWithPinCount}/${tablesCount} tables have security PINs. PIN protection is enabled.`;
            nextActionHref = '/dashboard/tables/qr';
            nextActionLabel = 'Set Table PINs';
          } else if (!hasActiveQr) {
            completionDetail = `${tablesCount} table(s) ready. Generate active Branch QR code to enable customer menu ordering.`;
            nextActionHref = '/dashboard/tables/qr';
            nextActionLabel = 'Generate Branch QR';
          } else {
            completionDetail = `${tablesCount} table(s) configured with active QR code across ${serviceAreasCount} area(s).`;
            nextActionHref = '/dashboard/tables/qr';
            nextActionLabel = 'Manage QR Codes';
          }

          substeps = [
            { id: 'd_area', label: `Service Areas (${serviceAreasCount})`, isCompleted: hasAreas, href: '/dashboard/areas' },
            { id: 'd_table', label: `Dining Tables (${tablesCount})`, isCompleted: hasTables, href: '/dashboard/tables' },
            {
              id: 'd_qr',
              label: hasActiveQr ? 'Branch QR Code Active' : 'Generate Branch QR Code',
              isCompleted: hasActiveQr,
              href: '/dashboard/tables/qr',
            },
          ];
          break;
        }

        // 4. Menu Catalog
        case 'menu': {
          const hasCategories = categoriesCount > 0;
          const hasUsableItems = usableMenuItemsCount > 0;
          isCompleted = hasCategories && hasUsableItems;
          status = isCompleted ? 'completed' : hasCategories ? 'in_progress' : 'not_started';

          if (!hasCategories) {
            completionDetail = 'Start by creating a menu category (e.g. Mains, Beverages).';
            nextActionHref = '/dashboard/menu/categories';
            nextActionLabel = '+ Create Category';
          } else if (!hasUsableItems) {
            completionDetail = `${categoriesCount} category(s) ready. Add at least one active, available menu item.`;
            nextActionHref = '/dashboard/menu/items/new';
            nextActionLabel = '+ Add Menu Item';
          } else {
            completionDetail = `${usableMenuItemsCount} active item(s) in ${categoriesCount} category(s).`;
            nextActionHref = '/dashboard/menu/items';
            nextActionLabel = 'Manage Menu';
          }

          substeps = [
            { id: 'm_cat', label: `Menu Categories (${categoriesCount})`, isCompleted: hasCategories, href: '/dashboard/menu/categories' },
            { id: 'm_item', label: `Active Menu Items (${usableMenuItemsCount})`, isCompleted: hasUsableItems, href: '/dashboard/menu/items' },
          ];
          break;
        }

        // 5. Order Security & Payments
        case 'ordering_security': {
          isCompleted = hasOrderSecurity && hasUsablePaymentMethod;
          status = isCompleted ? 'completed' : 'in_progress';

          if (!hasOrderSecurity) {
            completionDetail = 'Order security settings record missing. Configure order security.';
            nextActionHref = '/dashboard/settings/order-security';
            nextActionLabel = 'Configure Order Security';
          } else if (!hasUsablePaymentMethod) {
            completionDetail = 'No active payment method enabled. Configure at least one payment method (Cash, Card, or Online).';
            nextActionHref = '/dashboard/settings/payments';
            nextActionLabel = 'Configure Payments';
          } else {
            completionDetail = 'Order security rules & operational payment methods ready.';
            nextActionHref = '/dashboard/settings/payments';
            nextActionLabel = 'Manage Payments';
          }

          substeps = [
            { id: 'o_sec', label: 'Order Security Settings', isCompleted: hasOrderSecurity, href: '/dashboard/settings/order-security' },
            { id: 'o_pay', label: 'Usable Payment Methods', isCompleted: hasUsablePaymentMethod, href: '/dashboard/settings/payments' },
          ];
          break;
        }

        // 6. Team & Staff Roles (Recommended)
        case 'team': {
          // Must reflect non-owner staff or valid pending invitations
          isCompleted = staffMembershipsCount > 0 || validPendingInvitationsCount > 0;
          status = isCompleted ? 'completed' : 'not_started';
          completionDetail = isCompleted
            ? `${staffMembershipsCount} operational staff, ${validPendingInvitationsCount} valid pending invitation(s).`
            : 'Invite your branch managers, cashiers, waiters, or kitchen staff.';
          substeps = [
            { id: 't_inv', label: 'Staff Invitations', isCompleted: isCompleted, href: '/dashboard/team/invites' },
            { id: 't_roles', label: 'Roles & Permissions', isCompleted: true, href: '/dashboard/access/roles' },
          ];
          break;
        }

        // 7. Venue Discovery Profile (Recommended)
        case 'venue_profile': {
          const hasName = Boolean(venueProfile?.display_name?.trim());
          const hasDetails =
            Boolean(venueProfile?.city?.trim()) ||
            Boolean(venueProfile?.address_public?.trim()) ||
            Boolean(venueProfile?.description?.trim());
          isCompleted = hasName && hasDetails;
          status = isCompleted ? 'completed' : hasName ? 'in_progress' : 'not_started';
          completionDetail = isCompleted
            ? `${venueProfile?.display_name} ${venueProfile?.is_published ? '• Published' : '• Draft'}`
            : 'Add public display name, description, and location details.';
          substeps = [
            { id: 'v_info', label: 'Public Display Details', isCompleted: isCompleted, href: '/dashboard/venue-profile' },
          ];
          break;
        }

        // 8. Operations & Inventory (Optional)
        case 'operations_inventory': {
          isCompleted = inventoryCount > 0;
          status = isCompleted ? 'completed' : 'not_started';
          completionDetail = isCompleted
            ? `${inventoryCount} stock item(s) tracked in inventory.`
            : 'Optional: track raw ingredients, recipes (BOM), and suppliers.';
          substeps = [
            { id: 'i_stock', label: `Stock Items (${inventoryCount})`, isCompleted: isCompleted, href: '/dashboard/inventory/items' },
          ];
          break;
        }

        // 9. Real Test Order
        case 'test_order': {
          const hasValidOrder = validOrders.length > 0;
          isCompleted = hasValidOrder;

          if (hasValidOrder) {
            status = 'completed';
            completionDetail = `${validOrders.length} operational order(s) confirmed / dispatched to kitchen or cashier.`;
          } else if (rejectedOrCancelledOnly) {
            status = 'in_progress';
            completionDetail = 'Previous test order was cancelled or rejected. Complete a valid operational order.';
          } else if (tablesCount > 0 && usableMenuItemsCount > 0) {
            status = 'in_progress';
            completionDetail = 'Place a test order to verify kitchen & cashier workflow progression.';
          } else {
            status = 'blocked';
            completionDetail = 'Blocked: configure dining tables and menu items first.';
          }

          nextActionHref = '/dashboard/orders';
          nextActionLabel = 'Open Orders Queue';
          substeps = [
            { id: 'test_place', label: 'Place Test Order (QR / POS)', isCompleted: isCompleted, href: '/dashboard/waiter' },
            { id: 'test_kds', label: 'Verify Kitchen Queue Receipt', isCompleted: isCompleted, href: '/dashboard/kitchen' },
            { id: 'test_pos', label: 'Settle in Cashier POS', isCompleted: isCompleted, href: '/dashboard/cashier' },
          ];
          break;
        }

        // 10. Core Setup Summary
        case 'launch_ready': {
          const coreCompleteSoFar = stages.filter((s) => s.tier === 'required').every((s) => s.isCompleted);
          isCompleted = coreCompleteSoFar && validOrders.length > 0;
          status = isCompleted ? 'completed' : coreCompleteSoFar ? 'in_progress' : 'blocked';
          completionDetail = isCompleted
            ? 'Core setup is complete.'
            : coreCompleteSoFar
            ? 'Core setup is complete. Perform a test order to finalize.'
            : 'Complete remaining core steps to achieve venue readiness.';
          substeps = [
            { id: 'lr_review', label: 'Review Venue Setup Checklist', isCompleted: isCompleted, href: '/dashboard/setup' },
          ];
          break;
        }
      }

      stages.push({
        ...config,
        status,
        isCompleted,
        completionDetail,
        nextActionHref,
        nextActionLabel,
        substeps,
      });
    }

    // Tally metrics
    const requiredStages = stages.filter((s) => s.tier === 'required');
    const recommendedStages = stages.filter((s) => s.tier === 'recommended');
    const optionalStages = stages.filter((s) => s.tier === 'optional');

    const totalRequired = requiredStages.length;
    const completedRequired = requiredStages.filter((s) => s.isCompleted).length;
    const totalRecommended = recommendedStages.length;
    const completedRecommended = recommendedStages.filter((s) => s.isCompleted).length;
    const totalOptional = optionalStages.length;
    const completedOptional = optionalStages.filter((s) => s.isCompleted).length;

    const isCoreSetupComplete = completedRequired === totalRequired;
    const overallPercentage = Math.round((completedRequired / Math.max(totalRequired, 1)) * 100);

    // Compute next logical action
    const nextStage =
      requiredStages.find((s) => !s.isCompleted) ||
      recommendedStages.find((s) => !s.isCompleted) ||
      null;

    return {
      businessId,
      businessName: businessData?.name || activeBranch?.name || 'Your Business',
      branchId: targetBranchId || activeBranch?.id || 'unassigned',
      branchName: branchData?.name || resolvedBranchName || activeBranch?.name || 'Primary Branch',
      totalRequired,
      completedRequired,
      totalRecommended,
      completedRecommended,
      totalOptional,
      completedOptional,
      isCoreSetupComplete,
      overallPercentage,
      nextStage,
      stages,
    };

  }
}