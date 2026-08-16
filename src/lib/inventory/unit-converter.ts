export interface UnitDefinition {
  code: string;
  name: string;
  unitType: 'weight' | 'volume' | 'count' | 'custom';
  baseUnitCode: string;
  conversionFactor: number;
}

export const STANDARD_UNITS: Record<string, UnitDefinition> = {
  kg: { code: 'kg', name: 'Kilogram', unitType: 'weight', baseUnitCode: 'kg', conversionFactor: 1.0 },
  g: { code: 'g', name: 'Gram', unitType: 'weight', baseUnitCode: 'kg', conversionFactor: 0.001 },
  l: { code: 'l', name: 'Litre', unitType: 'volume', baseUnitCode: 'l', conversionFactor: 1.0 },
  ml: { code: 'ml', name: 'Millilitre', unitType: 'volume', baseUnitCode: 'l', conversionFactor: 0.001 },
  pcs: { code: 'pcs', name: 'Pieces', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
  bottle: { code: 'bottle', name: 'Bottle', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
  can: { code: 'can', name: 'Can', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
  pack: { code: 'pack', name: 'Pack', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
  box: { code: 'box', name: 'Box', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
  portion: { code: 'portion', name: 'Portion', unitType: 'count', baseUnitCode: 'pcs', conversionFactor: 1.0 },
};

export class UnitConverter {
  /**
   * Normalizes a quantity in a given unit to the target base unit.
   * Throws Error if dimensions are incompatible.
   */
  static normalizeToBase(
    quantity: number,
    fromUnit: string,
    targetBaseUnit: string,
    customUnits: UnitDefinition[] = []
  ): number {
    const normalizedFrom = fromUnit.toLowerCase().trim();
    const normalizedTarget = targetBaseUnit.toLowerCase().trim();

    // 1. Direct match
    if (normalizedFrom === normalizedTarget) {
      return quantity;
    }

    // 2. Lookup in standard units
    const allUnits: Record<string, UnitDefinition> = { ...STANDARD_UNITS };
    for (const u of customUnits) {
      allUnits[u.code.toLowerCase()] = u;
    }

    const fromDef = allUnits[normalizedFrom];
    const targetDef = allUnits[normalizedTarget];

    if (!fromDef) {
      throw new Error(`Unrecognized unit '${fromUnit}'.`);
    }

    if (!targetDef) {
      throw new Error(`Unrecognized target base unit '${targetBaseUnit}'.`);
    }

    // 3. Dimensional compatibility check
    if (fromDef.unitType !== targetDef.unitType && fromDef.unitType !== 'custom' && targetDef.unitType !== 'custom') {
      throw new Error(
        `Incompatible unit conversion: Cannot convert ${fromDef.unitType} unit '${fromUnit}' to ${targetDef.unitType} unit '${targetBaseUnit}'.`
      );
    }

    // 4. If fromDef base matches target
    if (fromDef.baseUnitCode === normalizedTarget) {
      return Number((quantity * fromDef.conversionFactor).toFixed(4));
    }

    // 5. If targetDef base matches fromDef base
    if (fromDef.baseUnitCode === targetDef.baseUnitCode) {
      // e.g. converting g to g or custom
      const inBase = quantity * fromDef.conversionFactor;
      return Number((inBase / targetDef.conversionFactor).toFixed(4));
    }

    throw new Error(
      `Cannot convert '${fromUnit}' to '${targetBaseUnit}'. No deterministic conversion path found.`
    );
  }

  /**
   * Checks if two units are dimensionally compatible.
   */
  static areCompatible(unitA: string, unitB: string): boolean {
    const a = unitA.toLowerCase().trim();
    const b = unitB.toLowerCase().trim();
    if (a === b) return true;

    const defA = STANDARD_UNITS[a];
    const defB = STANDARD_UNITS[b];
    if (!defA || !defB) return false;

    return defA.unitType === defB.unitType;
  }
}
