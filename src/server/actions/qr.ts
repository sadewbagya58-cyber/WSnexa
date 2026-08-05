'use server';

import { QrService } from '@/server/services/qr.service';

export async function generateBranchQrAction() {
  return await QrService.generateBranchQr();
}

export async function regenerateBranchQrAction() {
  return await QrService.regenerateBranchQr();
}

export async function disableBranchQrAction() {
  return await QrService.disableBranchQr();
}

export async function updateBranchOrderingSettingsAction(settings: {
  require_table_selection?: boolean;
  require_table_pin?: boolean;
  table_pin_length?: number;
}) {
  return await QrService.updateBranchOrderingSettings(settings);
}
