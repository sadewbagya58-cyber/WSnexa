'use server';

import { revalidatePath } from 'next/cache';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.items.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Item management permission required.' };
  }

  const parsed = createInventoryCategorySchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createCategory(context.business.id, parsed.data);
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.locations.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Location management permission required.' };
  }

  const parsed = createStorageLocationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createLocation(context.business.id, parsed.data);
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.items.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Item management permission required.' };
  }

  const parsed = createInventoryItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createInventoryItem(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
    context.business.defaultCurrency || 'USD',
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.adjust'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock adjustment permission required.' };
  }

  const parsed = stockAdjustmentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.recordStockAdjustment(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.waste.record'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Waste recording permission required.' };
  }

  const parsed = recordWasteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.recordWaste(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.counts.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count management permission required.' };
  }

  const parsed = createStockCountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createStockCount(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
    context.business.defaultCurrency || 'USD',
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.counts.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count management permission required.' };
  }

  const parsed = submitStockCountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.submitStockCount(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.counts.approve'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Stock count approval permission required.' };
  }

  const res = await InventoryService.approveStockCount(
    context.business.id,
    context.activeBranch.id,
    context.user.id,
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
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.transfers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer management permission required.' };
  }

  const parsed = createStockTransferSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.createStockTransfer(
    context.business.id,
    context.user.id,
    context.business.defaultCurrency || 'USD',
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
  }
  return res;
}

/**
 * Dispatches stock transfer.
 */
export async function sendStockTransferAction(transferId: string) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.transfers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer management permission required.' };
  }

  const res = await InventoryService.sendStockTransfer(
    context.business.id,
    context.user.id,
    transferId
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

/**
 * Receives stock transfer.
 */
export async function receiveStockTransferAction(rawInput: unknown) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.transfers.receive'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Transfer receipt permission required.' };
  }

  const parsed = receiveStockTransferSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, message: 'Validation failed.', errors: parsed.error.flatten().fieldErrors };
  }

  const res = await InventoryService.receiveStockTransfer(
    context.business.id,
    context.user.id,
    parsed.data
  );

  if (res.success) {
    revalidatePath('/dashboard/inventory/transfers');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/inventory/items');
  }
  return res;
}
