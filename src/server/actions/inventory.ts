'use server';

import { revalidatePath } from 'next/cache';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { InventoryService } from '@/server/services/inventory.service';
import {
  createInventoryCategorySchema,
  createStorageLocationSchema,
  createInventoryItemSchema,
  stockAdjustmentSchema,
  recordWasteSchema,
  createStockCountSchema,
  submitStockCountSchema,
  createStockTransferSchema,
  receiveStockTransferSchema,
} from '@/lib/validation/inventory';

/**
 * Creates an inventory category.
 */
export async function createInventoryCategoryAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.items.manage',
    resource: branchResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Item management permission required.' };
  }

  const parsed = createInventoryCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createCategory(authContext.businessId, parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
  }
  return res;
}

/**
 * Creates a storage location.
 */
export async function createStorageLocationAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.locations.manage',
    resource: branchResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Location management permission required.' };
  }

  const parsed = createStorageLocationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createLocation(authContext.businessId, parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/locations');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

/**
 * Creates a new inventory item.
 */
export async function createInventoryItemAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.items.manage',
    resource: branchResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Item management permission required.' };
  }

  const parsed = createInventoryItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const { resolveActiveBusinessContext } = await import('@/server/tenant/resolver');
  const tenantCtx = await resolveActiveBusinessContext();
  const businessCurrency = tenantCtx?.activeBranch?.currency || tenantCtx?.business?.defaultCurrency || 'USD';

  const res = await InventoryService.createInventoryItem(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    businessCurrency,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
    if (res.item?.id) {
      revalidatePath(`/dashboard/inventory/items/${res.item.id}`);
    }
  }
  return res;
}

/**
 * Records manual stock adjustment.
 */
export async function recordStockAdjustmentAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const parsed = stockAdjustmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const locResource = { type: 'inventory_location' as const, id: parsed.data.locationId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.adjust',
    resource: locResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock adjustment permission required.' };
  }

  const res = await InventoryService.recordStockAdjustment(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath(`/dashboard/inventory/items/${parsed.data.itemId}`);
  }
  return res;
}

/**
 * Records food & beverage waste.
 */
export async function recordWasteAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const parsed = recordWasteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const locResource = { type: 'inventory_location' as const, id: parsed.data.locationId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.waste.record',
    resource: locResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Waste recording permission required.' };
  }

  const res = await InventoryService.recordWaste(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/waste');
    revalidatePath('/dashboard/inventory');
    revalidatePath(`/dashboard/inventory/items/${parsed.data.itemId}`);
  }
  return res;
}

/**
 * Creates physical stock count.
 */
export async function createStockCountAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.counts.manage',
    resource: branchResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count management permission required.' };
  }

  const parsed = createStockCountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const { resolveActiveBusinessContext } = await import('@/server/tenant/resolver');
  const tenantCtx = await resolveActiveBusinessContext();
  const businessCurrency = tenantCtx?.activeBranch?.currency || tenantCtx?.business?.defaultCurrency || 'USD';

  const res = await InventoryService.createStockCount(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    businessCurrency,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/counts');
  }
  return res;
}

/**
 * Submits physical stock count entries.
 */
export async function submitStockCountAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const parsed = submitStockCountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const countResource = { type: 'inventory_count' as const, id: parsed.data.countId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.counts.manage',
    resource: countResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count management permission required.' };
  }

  const res = await InventoryService.submitStockCount(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/counts');
    revalidatePath(`/dashboard/inventory/counts/${parsed.data.countId}`);
  }
  return res;
}

/**
 * Approves physical stock count and commits balance reconciliations.
 */
export async function approveStockCountAction(countId: string) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const countResource = { type: 'inventory_count' as const, id: countId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.counts.approve',
    resource: countResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count approval permission required.' };
  }

  const res = await InventoryService.approveStockCount(
    authContext.businessId,
    authContext.activeBranchId,
    authContext.userId,
    countId
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/counts');
    revalidatePath(`/dashboard/inventory/counts/${countId}`);
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
  }
  return res;
}

/**
 * Creates draft stock transfer.
 */
export async function createStockTransferAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.transfers.manage',
    resource: branchResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer management permission required.' };
  }

  const parsed = createStockTransferSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const { resolveActiveBusinessContext } = await import('@/server/tenant/resolver');
  const tenantCtx = await resolveActiveBusinessContext();
  const businessCurrency = tenantCtx?.activeBranch?.currency || tenantCtx?.business?.defaultCurrency || 'USD';

  const res = await InventoryService.createStockTransfer(
    authContext.businessId,
    authContext.userId,
    businessCurrency,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
    return {
      success: true,
      transferId: res.transferId,
      transferNumber: res.transferNumber,
      message: `Transfer ${res.transferNumber ? res.transferNumber + ' ' : ''}created successfully.`,
    };
  }
  return res;
}

/**
 * Dispatches stock transfer.
 */
export async function sendStockTransferAction(transferId: string) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const transferResource = { type: 'inventory_transaction' as const, id: transferId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.transfers.manage',
    resource: transferResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer management permission required.' };
  }

  const res = await InventoryService.sendStockTransfer(
    authContext.businessId,
    authContext.userId,
    transferId
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
  }
  return res;
}

/**
 * Receives stock transfer.
 */
export async function receiveStockTransferAction(rawInput: unknown) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.activeBranchId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const parsed = receiveStockTransferSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const transferResource = { type: 'inventory_transaction' as const, id: parsed.data.transferId };
  const hasPerm = await can({
    context: authContext,
    permission: 'inventory.transfers.receive',
    resource: transferResource,
  });
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer receipt permission required.' };
  }

  const res = await InventoryService.receiveStockTransfer(
    authContext.businessId,
    authContext.userId,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
  }
  return res;
}
