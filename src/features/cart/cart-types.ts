export interface SelectedModifierSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  additionalPriceCents: number;
}

export interface CartLine {
  lineId: string;
  menuItemId: string;
  itemName: string;
  imageUrl?: string | null;
  quantity: number;
  basePriceCents: number;
  selectedModifiers: SelectedModifierSnapshot[];
  specialInstructions?: string;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface ConfirmedTableContext {
  branchId: string;
  tableId: string;
  tableName: string;
  tableCode: string;
  signedTableAccessProof?: string;
  verifiedAt: string;
  expiresAt?: string;
}

/**
 * Derives whether table access is valid and verified based on a non-expired signed proof.
 */
export function isTableAccessVerified(table: ConfirmedTableContext | null | undefined): boolean {
  if (!table) return false;
  if (!table.signedTableAccessProof || table.signedTableAccessProof.trim().length === 0) return false;
  if (table.expiresAt && new Date(table.expiresAt).getTime() < Date.now()) return false;
  return true;
}

export interface CartState {
  branchId: string;
  currency: string;
  confirmedTable: ConfirmedTableContext | null;
  lines: CartLine[];
  subtotalCents: number;
  totalQuantity: number;
  updatedAt: string;
  isHydrated: boolean;
}
