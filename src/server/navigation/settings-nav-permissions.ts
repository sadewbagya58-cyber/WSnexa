import { can, resolveAuthorizationContext } from '@/server/auth';

export interface SettingsSubNavPermissions {
  canViewBusiness: boolean;
  canViewVenueProfile: boolean;
  canViewBranches: boolean;
  canManageBranches: boolean;
  canViewOrderSecurity: boolean;
  canViewPayments: boolean;
  canManageInventorySettings: boolean;
  canViewSubscription: boolean;
}

/**
 * Authoritatively resolves all secondary workspace capabilities for the Settings module.
 * Every subnavigation tab and card is gated on its individual canonical permission.
 * A role with only `business.view` receives ONLY `canViewBusiness = true`.
 */
export async function resolveSettingsSubNavPermissions(
  authContext?: Awaited<ReturnType<typeof resolveAuthorizationContext>> | null,
  branchId?: string | null,
  businessId?: string | null
): Promise<SettingsSubNavPermissions> {
  if (!authContext) {
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return {
        canViewBusiness: false,
        canViewVenueProfile: false,
        canViewBranches: false,
        canManageBranches: false,
        canViewOrderSecurity: false,
        canViewPayments: false,
        canManageInventorySettings: false,
        canViewSubscription: false,
      };
    }
  }

  if (!authContext) {
    return {
      canViewBusiness: false,
      canViewVenueProfile: false,
      canViewBranches: false,
      canManageBranches: false,
      canViewOrderSecurity: false,
      canViewPayments: false,
      canManageInventorySettings: false,
      canViewSubscription: false,
    };
  }

  if (authContext.isBusinessOwner) {
    return {
      canViewBusiness: true,
      canViewVenueProfile: true,
      canViewBranches: true,
      canManageBranches: true,
      canViewOrderSecurity: true,
      canViewPayments: true,
      canManageInventorySettings: true,
      canViewSubscription: true,
    };
  }

  const targetBranchId = branchId || authContext.activeBranchId || null;
  const targetBusinessId = businessId || authContext.businessId || '';

  const branchResource = targetBranchId
    ? {
        resourceType: 'branch' as const,
        resourceId: targetBranchId,
        businessId: targetBusinessId,
        branchId: targetBranchId,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      }
    : undefined;

  const [
    hasBusinessView,
    hasBusinessSettingsManage,
    hasVenueProfileView,
    hasVenueProfileManage,
    hasBranchesView,
    hasBranchesManage,
    hasBranchesOpManage,
    hasOrderSecurityView,
    hasOrderSecurityManage,
    hasInventorySettingsManage,
  ] = await Promise.all([
    can({ context: authContext, permission: 'business.view', resource: branchResource }),
    can({ context: authContext, permission: 'business.settings.manage', resource: branchResource }),
    can({ context: authContext, permission: 'venue_profile.view', resource: branchResource }),
    can({ context: authContext, permission: 'venue_profile.manage', resource: branchResource }),
    can({ context: authContext, permission: 'branches.view', resource: branchResource }),
    can({ context: authContext, permission: 'branches.manage', resource: branchResource }),
    can({ context: authContext, permission: 'branches.operational.manage', resource: branchResource }),
    can({ context: authContext, permission: 'order_security.view', resource: branchResource }),
    can({ context: authContext, permission: 'order_security.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.settings.manage', resource: branchResource }),
  ]);

  return {
    canViewBusiness: hasBusinessView || hasBusinessSettingsManage,
    canViewVenueProfile: hasVenueProfileView || hasVenueProfileManage,
    canViewBranches: hasBranchesView || hasBranchesManage || hasBranchesOpManage,
    canManageBranches: hasBranchesManage || hasBranchesOpManage,
    canViewOrderSecurity: hasOrderSecurityView || hasOrderSecurityManage,
    canViewPayments: hasBranchesManage || hasBusinessSettingsManage,
    canManageInventorySettings: hasInventorySettingsManage,
    canViewSubscription: false, // strictly owner only
  };
}
