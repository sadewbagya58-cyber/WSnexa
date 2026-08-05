'use server';

import { QrService } from '@/server/services/qr.service';

export async function generateTableQrAction(tableId: string) {
  return await QrService.generateTableQr(tableId);
}

export async function regenerateTableQrAction(tableId: string) {
  return await QrService.regenerateTableQr(tableId);
}

export async function disableTableQrAction(tableId: string) {
  return await QrService.disableTableQr(tableId);
}

export async function bulkGenerateTableQrsAction(areaId?: string, overrideExisting: boolean = false) {
  return await QrService.bulkGenerateTableQrs(areaId, overrideExisting);
}
