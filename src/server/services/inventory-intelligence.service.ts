import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';

export interface MenuEngineeringItem {
  itemId: string;
  itemName: string;
  categoryName: string;
  sellingPriceCents: number;
  foodCostCents: number;
  grossMarginCents: number;
  grossMarginPercentage: number;
  unitsSold: number;
  totalRevenueCents: number;
  totalCogsCents: number;
  totalGrossProfitCents: number;
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog' | 'Insufficient Data';
  classificationDescription: string;
}

export interface CogsFinancialReport {
  grossRevenueCents: number;
  taxCents: number;
  serviceChargeCents: number;
  netSalesCents: number;
  totalCogsCents: number;
  grossProfitCents: number;
  foodCostPercentage: number;
  grossMarginPercentage: number;
  totalWasteCostCents: number;
  unexplainedVarianceCostCents: number;
  currency: string;
}

export interface TheoreticalStockItem {
  itemId: string;
  itemName: string;
  baseUnit: string;
  currentStock: number;
  totalReceived: number;
  totalConsumed: number;
  totalWasted: number;
  theoreticalStock: number;
  unitCostCents: number;
}

export class InventoryIntelligenceService {
  /**
   * Generates Menu Engineering classification based on sales volume and actual recipe cost snapshots.
   */
  static async getMenuEngineeringMatrix(): Promise<{
    items: MenuEngineeringItem[];
    averageUnitsSold: number;
    averageMarginPercentage: number;
    hasSufficientData: boolean;
  }> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return { items: [], averageUnitsSold: 0, averageMarginPercentage: 0, hasSufficientData: false };
    }

    const admin = createAdminClient();

    // 1. Fetch menu items with recipe and category details
    const { data: menuItems } = await admin
      .from('menu_items')
      .select(`
        id,
        name,
        price_cents,
        category:menu_categories(id, name),
        recipes:inventory_recipes(
          id,
          yield_quantity,
          ingredients:inventory_recipe_ingredients!inventory_recipe_ingredients_recipe_id_fkey(
            quantity_base,
            yield_factor,
            inventory_items:item_id(cost_per_unit_cents)
          )
        )
      `)
      .eq('business_id', context.business.id)
      .is('deleted_at', null);

    // 2. Fetch total sales per menu item for the branch
    const { data: salesRows } = await admin
      .from('order_items')
      .select('menu_item_id, quantity, line_subtotal_cents, orders!inner(branch_id)')
      .eq('orders.branch_id', context.activeBranch.id);

    interface SalesRow {
      menu_item_id: string | null;
      quantity: number;
      line_subtotal_cents: number | null;
    }

    const salesMap = new Map<string, { quantity: number; revenueCents: number }>();
    let totalUnitsSoldAcrossMenu = 0;

    (salesRows as unknown as SalesRow[] || []).forEach((row) => {
      if (row.menu_item_id) {
        const curr = salesMap.get(row.menu_item_id) || { quantity: 0, revenueCents: 0 };
        curr.quantity += Number(row.quantity);
        curr.revenueCents += Number(row.line_subtotal_cents || 0);
        salesMap.set(row.menu_item_id, curr);
        totalUnitsSoldAcrossMenu += Number(row.quantity);
      }
    });

    const hasSufficientData = totalUnitsSoldAcrossMenu >= 5;

    const items: MenuEngineeringItem[] = [];
    let totalMarginSum = 0;
    let itemsWithSalesCount = 0;

    interface MenuItemWithRecipe {
      id: string;
      name: string;
      price_cents: number;
      category: { id: string; name: string } | null;
      recipes: Array<{
        id: string;
        yield_quantity: number;
        ingredients: Array<{
          quantity_base: number;
          yield_factor: number;
          inventory_items: { cost_per_unit_cents: number } | null;
        }>;
      }>;
    }

    (menuItems as unknown as MenuItemWithRecipe[] || []).forEach((item) => {
      const sales = salesMap.get(item.id) || { quantity: 0, revenueCents: 0 };
      const sellingPriceCents = Number(item.price_cents || 0);

      // Compute recipe cost
      let foodCostCents = 0;
      const activeRecipe = item.recipes?.[0];
      if (activeRecipe) {
        const yieldQty = Number(activeRecipe.yield_quantity) || 1.0;
        let recipeTotal = 0;
        (activeRecipe.ingredients || []).forEach((ing) => {
          const itemCost = ing.inventory_items?.cost_per_unit_cents || 0;
          const effQty = ing.yield_factor > 0 ? ing.quantity_base / ing.yield_factor : ing.quantity_base;
          recipeTotal += Math.round(effQty * itemCost);
        });
        foodCostCents = yieldQty > 0 ? Math.round(recipeTotal / yieldQty) : recipeTotal;
      }

      const grossMarginCents = Math.max(0, sellingPriceCents - foodCostCents);
      const grossMarginPercentage =
        sellingPriceCents > 0 ? Number(((grossMarginCents / sellingPriceCents) * 100).toFixed(1)) : 0;

      if (sales.quantity > 0) {
        totalMarginSum += grossMarginPercentage;
        itemsWithSalesCount++;
      }

      const totalCogsCents = sales.quantity * foodCostCents;
      const totalGrossProfitCents = sales.quantity * grossMarginCents;

      items.push({
        itemId: item.id,
        itemName: item.name,
        categoryName: item.category?.name || 'Uncategorized',
        sellingPriceCents,
        foodCostCents,
        grossMarginCents,
        grossMarginPercentage,
        unitsSold: sales.quantity,
        totalRevenueCents: sales.revenueCents,
        totalCogsCents,
        totalGrossProfitCents,
        classification: 'Insufficient Data',
        classificationDescription: 'More sales data is needed before computing reliable menu engineering categories.',
      });
    });

    const averageUnitsSold = items.length > 0 ? Math.round(totalUnitsSoldAcrossMenu / items.length) : 0;
    const averageMarginPercentage =
      itemsWithSalesCount > 0 ? Number((totalMarginSum / itemsWithSalesCount).toFixed(1)) : 70.0;

    // Apply BCG / Miller Matrix Classifications
    items.forEach((item) => {
      if (!hasSufficientData || item.unitsSold === 0) {
        item.classification = 'Insufficient Data';
        item.classificationDescription = 'More sales data is needed to categorize this item.';
      } else {
        const isHighPopularity = item.unitsSold >= averageUnitsSold;
        const isHighMargin = item.grossMarginPercentage >= averageMarginPercentage;

        if (isHighPopularity && isHighMargin) {
          item.classification = 'Star';
          item.classificationDescription = 'High popularity & high profitability. Maintain recipe quality and feature prominently.';
        } else if (isHighPopularity && !isHighMargin) {
          item.classification = 'Plowhorse';
          item.classificationDescription = 'High popularity but below-average margin. Consider modest price adjustment or ingredient portion optimization.';
        } else if (!isHighPopularity && isHighMargin) {
          item.classification = 'Puzzle';
          item.classificationDescription = 'High profitability but low sales volume. Promote via specials, waiter recommendations, and improved menu placement.';
        } else {
          item.classification = 'Dog';
          item.classificationDescription = 'Low popularity and low profitability. Consider recipe reformulation or menu retirement.';
        }
      }
    });

    return {
      items,
      averageUnitsSold,
      averageMarginPercentage,
      hasSufficientData,
    };
  }

  /**
   * Calculates COGS, Gross Profit, and Financial Ratios from Immutable Consumption Snapshots.
   */
  static async getCogsFinancialReport(dateRange?: { start?: string; end?: string }): Promise<CogsFinancialReport> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.business || !context.activeBranch) {
      return {
        grossRevenueCents: 0,
        taxCents: 0,
        serviceChargeCents: 0,
        netSalesCents: 0,
        totalCogsCents: 0,
        grossProfitCents: 0,
        foodCostPercentage: 0,
        grossMarginPercentage: 0,
        totalWasteCostCents: 0,
        unexplainedVarianceCostCents: 0,
        currency: 'USD',
      };
    }

    const admin = createAdminClient();
    const branchId = context.activeBranch.id;

    // 1. Query Sales Orders
    let ordersQuery = admin
      .from('orders')
      .select('subtotal_cents, tax_cents, service_charge_cents, total_cents')
      .eq('branch_id', branchId)
      .eq('status', 'completed');

    if (dateRange?.start) ordersQuery = ordersQuery.gte('created_at', dateRange.start);
    if (dateRange?.end) ordersQuery = ordersQuery.lte('created_at', dateRange.end);

    const { data: orders } = await ordersQuery;

    let grossRevenueCents = 0;
    let taxCents = 0;
    let serviceChargeCents = 0;
    let netSalesCents = 0;

    (orders || []).forEach((o) => {
      grossRevenueCents += o.total_cents || 0;
      taxCents += o.tax_cents || 0;
      serviceChargeCents += o.service_charge_cents || 0;
      netSalesCents += o.subtotal_cents || 0;
    });

    // 2. Query Consumption Cost Snapshots (Immutable COGS)
    let consQuery = admin
      .from('inventory_order_consumptions')
      .select('total_cost_cents_snapshot')
      .eq('branch_id', branchId)
      .eq('status', 'consumed');

    if (dateRange?.start) consQuery = consQuery.gte('created_at', dateRange.start);
    if (dateRange?.end) consQuery = consQuery.lte('created_at', dateRange.end);

    const { data: cons } = await consQuery;
    let totalCogsCents = 0;
    (cons || []).forEach((c) => {
      totalCogsCents += c.total_cost_cents_snapshot || 0;
    });

    // 3. Query Waste Records
    let wasteQuery = admin
      .from('inventory_waste_records')
      .select('total_cost_cents')
      .eq('branch_id', branchId);

    if (dateRange?.start) wasteQuery = wasteQuery.gte('created_at', dateRange.start);
    if (dateRange?.end) wasteQuery = wasteQuery.lte('created_at', dateRange.end);

    const { data: wastes } = await wasteQuery;
    let totalWasteCostCents = 0;
    (wastes || []).forEach((w) => {
      totalWasteCostCents += w.total_cost_cents || 0;
    });

    const grossProfitCents = Math.max(0, netSalesCents - totalCogsCents);
    const foodCostPercentage = netSalesCents > 0 ? Number(((totalCogsCents / netSalesCents) * 100).toFixed(1)) : 0;
    const grossMarginPercentage = netSalesCents > 0 ? Number(((grossProfitCents / netSalesCents) * 100).toFixed(1)) : 0;

    return {
      grossRevenueCents,
      taxCents,
      serviceChargeCents,
      netSalesCents,
      totalCogsCents,
      grossProfitCents,
      foodCostPercentage,
      grossMarginPercentage,
      totalWasteCostCents,
      unexplainedVarianceCostCents: 0,
      currency: context.business.defaultCurrency || 'USD',
    };
  }
}
