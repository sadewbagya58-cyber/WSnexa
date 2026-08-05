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
  verifiedAt: string;
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
