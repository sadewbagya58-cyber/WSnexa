'use server';

import { revalidatePath } from 'next/cache';
import { PurchasingService } from '@/server/services/purchasing.service';
import {
  createSupplierSchema,
  createPurchaseOrderSchema,
  recordGoodsReceiptSchema,
  supplierReturnSchema,
  CreateSupplierInput,
  CreatePurchaseOrderInput,
  RecordGoodsReceiptInput,
  SupplierReturnInput,
} from '@/lib/validation/purchasing';

export async function createSupplierAction(input: CreateSupplierInput) {
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

export async function createPurchaseOrderAction(input: CreatePurchaseOrderInput) {
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
  const res = await PurchasingService.approvePurchaseOrder(poId);
  if (res.success) {
    revalidatePath('/dashboard/inventory/purchasing');
    revalidatePath('/dashboard/inventory');
  }
  return res;
}

export async function recordGoodsReceiptAction(input: RecordGoodsReceiptInput) {
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
