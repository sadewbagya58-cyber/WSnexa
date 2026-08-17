'use server';

import { revalidatePath } from 'next/cache';
import { PurchasingService } from '@/server/services/purchasing.service';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PermissionService } from '@/server/services/permission.service';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierItemSchema,
  createPurchaseOrderSchema,
  recordGoodsReceiptSchema,
  supplierReturnSchema,
  cancelPurchaseOrderSchema,
  CreateSupplierInput,
  UpdateSupplierInput,
  SupplierItemInput,
  CreatePurchaseOrderInput,
  RecordGoodsReceiptInput,
  SupplierReturnInput,
  CancelPurchaseOrderInput,
} from '@/lib/validation/purchasing';

export async function createSupplierAction(input: CreateSupplierInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'suppliers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Supplier management permission required.' };
  }

  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid supplier data.' };
  }

  const res = await PurchasingService.createSupplier(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/suppliers');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function updateSupplierAction(input: UpdateSupplierInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'suppliers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Supplier management permission required.' };
  }

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid supplier update data.' };
  }

  const res = await PurchasingService.updateSupplier(parsed.data);
  if (res.success) {
    revalidatePath(`/dashboard/inventory/suppliers/${input.id}`);
    revalidatePath('/dashboard/inventory/suppliers');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function upsertSupplierItemAction(input: SupplierItemInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'suppliers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Supplier management permission required.' };
  }

  const parsed = supplierItemSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid supplier item catalog data.' };
  }

  const res = await PurchasingService.upsertSupplierItem(parsed.data);
  if (res.success) {
    revalidatePath(`/dashboard/inventory/suppliers/${input.supplierId}`);
    revalidatePath(`/dashboard/inventory/items/${input.itemId}`);
    revalidatePath('/dashboard/inventory/suppliers');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/purchasing/new');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function removeSupplierItemAction(supplierId: string, itemId: string) {
  if (!supplierId || !itemId) {
    return { success: false, message: 'Invalid supplier or item identifier.' };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'suppliers.manage'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Supplier management permission required.' };
  }

  const res = await PurchasingService.removeSupplierItem(supplierId, itemId);
  if (res.success) {
    revalidatePath(`/dashboard/inventory/suppliers/${supplierId}`);
    revalidatePath(`/dashboard/inventory/items/${itemId}`);
    revalidatePath('/dashboard/inventory/suppliers');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory/purchasing/new');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function getSupplierItemPriceHistoryAction(supplierId: string, itemId: string) {
  if (!supplierId || !itemId) {
    return { success: false, history: [] };
  }

  const context = await resolveActiveBusinessContext();
  if (!context || !context.business || !context.activeBranch) {
    return { success: false, history: [] };
  }

  const hasCostPermission = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.costs.view'
  );

  const history = await PurchasingService.getSupplierItemPriceHistory(
    context.business.id,
    supplierId,
    itemId,
    { hasCostPermission }
  );

  return { success: true, history };
}

export async function createPurchaseOrderAction(input: CreatePurchaseOrderInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.create'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Purchasing creation permission required.' };
  }

  const parsed = createPurchaseOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid purchase order data.' };
  }

  const res = await PurchasingService.createPurchaseOrder(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function approvePurchaseOrderAction(poId: string) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.approve'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Purchasing approval permission required.' };
  }

  const res = await PurchasingService.approvePurchaseOrder(poId);
  if (res.success) {
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath(`/dashboard/inventory/purchasing/${poId}`);
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function cancelPurchaseOrderAction(input: CancelPurchaseOrderInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasApprovePerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.approve'
  );
  const hasCreatePerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.create'
  );

  if (!hasApprovePerm && !hasCreatePerm) {
    return { success: false, message: 'Forbidden. Purchasing cancellation permission required.' };
  }

  const parsed = cancelPurchaseOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid cancel request.' };
  }

  const res = await PurchasingService.cancelPurchaseOrder(parsed.data.poId, parsed.data.reason || undefined);
  if (res.success) {
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath(`/dashboard/inventory/purchasing/${parsed.data.poId}`);
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function recordGoodsReceiptAction(input: RecordGoodsReceiptInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasPerm = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.receive'
  );
  if (!hasPerm) {
    return { success: false, message: 'Forbidden. Goods receipt permission required.' };
  }

  const parsed = recordGoodsReceiptSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid goods receipt data.' };
  }

  const res = await PurchasingService.recordGoodsReceipt(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/receiving');
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function recordSupplierReturnAction(input: SupplierReturnInput) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const hasSuppliersManage = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'suppliers.manage'
  );
  const hasWasteRecord = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'inventory.waste.record'
  );
  const hasReceiving = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'purchasing.receive'
  );

  if (!hasSuppliersManage && !hasWasteRecord && !hasReceiving) {
    return { success: false, message: 'Forbidden. Supplier return permission required.' };
  }

  const parsed = supplierReturnSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || 'Invalid supplier return data.' };
  }

  const res = await PurchasingService.recordSupplierReturn(parsed.data);
  if (res.success) {
    revalidatePath('/dashboard/inventory/receiving');
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath('/dashboard/inventory/items');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}
