import { can, resolveAuthorizationContext } from '@/server/auth';

export interface InventorySubNavPermissions {
  canViewInventory: boolean;
  canViewItems: boolean;
  canViewCounts: boolean;
  canViewRecipes: boolean;
  canViewPurchasing: boolean;
  canViewReceiving: boolean;
  canViewTransfers: boolean;
  canViewSuppliers: boolean;
  canViewLocations: boolean;
  canViewWaste: boolean;
  canViewSettings: boolean;
}

/**
 * Authoritatively resolves all secondary workspace capabilities for the Inventory module.
 * Every subnavigation tab is gated on its individual canonical permission.
 * A role with only `inventory.view` receives ONLY `canViewInventory` and `canViewItems`.
 */
export async function resolveInventorySubNavPermissions(
  authContext?: Awaited<ReturnType<typeof resolveAuthorizationContext>> | null,
  branchId?: string | null,
  businessId?: string | null
): Promise<InventorySubNavPermissions> {
  if (!authContext) {
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return {
        canViewInventory: false,
        canViewItems: false,
        canViewCounts: false,
        canViewRecipes: false,
        canViewPurchasing: false,
        canViewReceiving: false,
        canViewTransfers: false,
        canViewSuppliers: false,
        canViewLocations: false,
        canViewWaste: false,
        canViewSettings: false,
      };
    }
  }

  if (!authContext) {
    return {
      canViewInventory: false,
      canViewItems: false,
      canViewCounts: false,
      canViewRecipes: false,
      canViewPurchasing: false,
      canViewReceiving: false,
      canViewTransfers: false,
      canViewSuppliers: false,
      canViewLocations: false,
      canViewWaste: false,
      canViewSettings: false,
    };
  }

  if (authContext.isBusinessOwner) {
    return {
      canViewInventory: true,
      canViewItems: true,
      canViewCounts: true,
      canViewRecipes: true,
      canViewPurchasing: true,
      canViewReceiving: true,
      canViewTransfers: true,
      canViewSuppliers: true,
      canViewLocations: true,
      canViewWaste: true,
      canViewSettings: true,
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
    hasInvView,
    hasItemsManage,
    hasCountsManage,
    hasCountsApprove,
    hasRecipesView,
    hasRecipesManage,
    hasRecipesCostsView,
    hasPurchasingView,
    hasPurchasingCreate,
    hasPurchasingManage,
    hasPurchasingApprove,
    hasPurchasingReceive,
    hasTransfersManage,
    hasTransfersReceive,
    hasSuppliersView,
    hasSuppliersManage,
    hasLocationsManage,
    hasWasteRecord,
    hasSettingsManage,
    hasGeneralManage,
  ] = await Promise.all([
    can({ context: authContext, permission: 'inventory.view', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.items.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.counts.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.counts.approve', resource: branchResource }),
    can({ context: authContext, permission: 'recipes.view', resource: branchResource }),
    can({ context: authContext, permission: 'recipes.manage', resource: branchResource }),
    can({ context: authContext, permission: 'recipes.costs.view', resource: branchResource }),
    can({ context: authContext, permission: 'purchasing.view', resource: branchResource }),
    can({ context: authContext, permission: 'purchasing.create', resource: branchResource }),
    can({ context: authContext, permission: 'purchasing.manage', resource: branchResource }),
    can({ context: authContext, permission: 'purchasing.approve', resource: branchResource }),
    can({ context: authContext, permission: 'purchasing.receive', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.transfers.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.transfers.receive', resource: branchResource }),
    can({ context: authContext, permission: 'suppliers.view', resource: branchResource }),
    can({ context: authContext, permission: 'suppliers.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.locations.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.waste.record', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.settings.manage', resource: branchResource }),
    can({ context: authContext, permission: 'inventory.manage', resource: branchResource }),
  ]);

  return {
    canViewInventory: hasInvView || hasItemsManage || hasGeneralManage,
    canViewItems: hasInvView || hasItemsManage || hasGeneralManage,
    canViewCounts: hasCountsManage || hasCountsApprove || hasGeneralManage,
    canViewRecipes: hasRecipesView || hasRecipesManage || hasRecipesCostsView || hasGeneralManage,
    canViewPurchasing: hasPurchasingView || hasPurchasingCreate || hasPurchasingManage || hasPurchasingApprove || hasGeneralManage,
    canViewReceiving: hasPurchasingReceive || hasGeneralManage,
    canViewTransfers: hasTransfersManage || hasTransfersReceive || hasGeneralManage,
    canViewSuppliers: hasSuppliersView || hasSuppliersManage || hasGeneralManage,
    canViewLocations: hasLocationsManage || hasGeneralManage,
    canViewWaste: hasWasteRecord || hasItemsManage || hasGeneralManage,
    canViewSettings: hasSettingsManage || hasGeneralManage,
  };
}
