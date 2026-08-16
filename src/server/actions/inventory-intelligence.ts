'use server';

import { InventoryIntelligenceService } from '@/server/services/inventory-intelligence.service';

export async function fetchMenuEngineeringAction() {
  try {
    const data = await InventoryIntelligenceService.getMenuEngineeringMatrix();
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load menu engineering matrix';
    return { success: false, message: msg };
  }
}

export async function fetchCogsReportAction(dateRange?: { start?: string; end?: string }) {
  try {
    const data = await InventoryIntelligenceService.getCogsFinancialReport(dateRange);
    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load COGS report';
    return { success: false, message: msg };
  }
}
