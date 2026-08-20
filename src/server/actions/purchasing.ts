'use server';

import { revalidatePath } from 'next/cache';
import { PurchasingService } from '@/server/services/purchasing.service';
import { can, resolveAuthorizationContext } from '@/server/auth';
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = authContext.activeBranchId ? { type: 'branch' as const, id: authContext.activeBranchId } : undefined;
  const hasPerm = await can({
    context: authContext,
    permission: 'suppliers.manage',
    resource: branchResource,
  });
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const supplierResource = { type: 'supplier' as const, id: input.id };
  const hasPerm = await can({
    context: authContext,
    permission: 'suppliers.manage',
    resource: supplierResource,
  });
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const supplierResource = { type: 'supplier' as const, id: input.supplierId };
  const hasPerm = await can({
    context: authContext,
    permission: 'suppliers.manage',
    resource: supplierResource,
  });
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

  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const supplierResource = { type: 'supplier' as const, id: supplierId };
  const hasPerm = await can({
    context: authContext,
    permission: 'suppliers.manage',
    resource: supplierResource,
  });
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

  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, history: [] };
  }

  const supplierResource = { type: 'supplier' as const, id: supplierId };
  const hasCostPermission = await can({
    context: authContext,
    permission: 'inventory.costs.view',
    resource: supplierResource,
  });

  const history = await PurchasingService.getSupplierItemPriceHistory(
    authContext.businessId,
    supplierId,
    itemId,
    { hasCostPermission }
  );

  return { success: true, history };
}

export async function createPurchaseOrderAction(input: CreatePurchaseOrderInput) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const branchResource = input.branchId
    ? { type: 'branch' as const, id: input.branchId }
    : authContext.activeBranchId
      ? { type: 'branch' as const, id: authContext.activeBranchId }
      : undefined;

  const hasPerm = await can({
    context: authContext,
    permission: 'purchasing.create',
    resource: branchResource,
  });
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const poResource = { type: 'purchase_order' as const, id: poId };
  const hasPerm = await can({
    context: authContext,
    permission: 'purchasing.approve',
    resource: poResource,
  });
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const poResource = { type: 'purchase_order' as const, id: input.poId };
  const hasApprovePerm = await can({
    context: authContext,
    permission: 'purchasing.approve',
    resource: poResource,
  });
  const hasCreatePerm = await can({
    context: authContext,
    permission: 'purchasing.create',
    resource: poResource,
  });

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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const targetResource = input.poId
    ? { type: 'purchase_order' as const, id: input.poId }
    : input.branchId
      ? { type: 'branch' as const, id: input.branchId }
      : undefined;

  const hasPerm = await can({
    context: authContext,
    permission: 'purchasing.receive',
    resource: targetResource,
  });
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
  const authContext = await resolveAuthorizationContext();
  if (!authContext || !authContext.businessId) {
    return { success: false, message: 'Unauthorized or active context not found.' };
  }

  const targetResource = input.supplierId
    ? { type: 'supplier' as const, id: input.supplierId }
    : input.branchId
      ? { type: 'branch' as const, id: input.branchId }
      : undefined;

  const hasSuppliersManage = await can({
    context: authContext,
    permission: 'suppliers.manage',
    resource: targetResource,
  });
  const hasWasteRecord = await can({
    context: authContext,
    permission: 'inventory.waste.record',
    resource: targetResource,
  });
  const hasReceiving = await can({
    context: authContext,
    permission: 'purchasing.receive',
    resource: targetResource,
  });

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
