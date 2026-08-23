import { requireAnalyticsAccess } from './analytics-auth';
import { resolveAnalyticsDateRange } from '@/lib/analytics/time-range';
import { AnalyticsDateRange, SummaryAnalyticsDTO, ResolvedDateRange } from '@/lib/analytics/analytics-types';
import { getSalesAnalytics, SalesAnalyticsResult } from './sales-analytics';
import { getOperationsAnalytics, OperationsAnalyticsResult } from './operations-analytics';
import { getMenuAnalytics, MenuAnalyticsResult } from './menu-analytics';
import { getInventoryAnalytics, InventoryAnalyticsResult } from './inventory-analytics';
import { getReviewAnalytics, ReviewAnalyticsResult } from './review-analytics';

export interface AnalyticsQueryInput {
  branchId?: string | null;
  branchIds?: string[] | null;
  dateRange: AnalyticsDateRange;
  timezone?: string;
}

export interface ExecutiveOverviewDTO {
  sales: SalesAnalyticsResult;
  operations: OperationsAnalyticsResult;
  menu: MenuAnalyticsResult;
  inventory: InventoryAnalyticsResult;
  reviews: ReviewAnalyticsResult;
  summary: SummaryAnalyticsDTO;
}

export class AnalyticsService {
  /**
   * Fetches Sales & Revenue Analytics metrics.
   */
  static async getSalesSummary(input: AnalyticsQueryInput): Promise<{
    sales: SalesAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
    currency: string;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const sales = await getSalesAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency);

    return {
      sales,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
    };
  }

  /**
   * Fetches Operations & Kitchen Speed Analytics metrics.
   */
  static async getOperationsSummary(input: AnalyticsQueryInput): Promise<{
    operations: OperationsAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const operations = await getOperationsAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds);

    return {
      operations,
      resolvedDateRange: resolvedBounds,
    };
  }

  /**
   * Fetches Menu Performance & Recipe Cost Analytics metrics.
   */
  static async getMenuSummary(input: AnalyticsQueryInput): Promise<{
    menu: MenuAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
    currency: string;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const menu = await getMenuAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency);

    return {
      menu,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
    };
  }

  /**
   * Fetches Inventory & Stock Movement Analytics metrics.
   */
  static async getInventorySummary(input: AnalyticsQueryInput): Promise<{
    inventory: InventoryAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
    currency: string;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const inventory = await getInventoryAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency);

    return {
      inventory,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
    };
  }

  /**
   * Fetches Customer Review & Reputation Analytics metrics.
   */
  static async getReviewSummary(input: AnalyticsQueryInput): Promise<{
    reviews: ReviewAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const reviews = await getReviewAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds);

    return {
      reviews,
      resolvedDateRange: resolvedBounds,
    };
  }

  /**
   * Fetches complete Executive Overview combining independent domain metric families in parallel.
   */
  static async getExecutiveOverview(input: AnalyticsQueryInput): Promise<ExecutiveOverviewDTO> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    // Parallelize independent domain analytics queries with Promise.all
    const [sales, operations, menu, inventory, reviews] = await Promise.all([
      getSalesAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency),
      getOperationsAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds),
      getMenuAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency),
      getInventoryAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency),
      getReviewAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds),
    ]);

    const dataQualityNotes: string[] = [];
    let overallQuality = sales.grossSales.quality;

    if (menu.estimatedFoodCost.quality === 'PARTIAL' || menu.estimatedFoodCost.qualityNote) {
      dataQualityNotes.push(menu.estimatedFoodCost.qualityNote || 'Recipe cost calculation is partial.');
      if (overallQuality === 'COMPLETE') overallQuality = 'PARTIAL';
    }

    const summaryDTO: SummaryAnalyticsDTO = {
      metrics: {
        gross_sales: sales.grossSales,
        net_sales: sales.netSales,
        completed_orders: sales.completedOrders,
        placed_orders: sales.placedOrders,
        cancelled_orders: sales.cancelledOrders,
        rejected_orders: sales.rejectedOrders,
        aov: sales.aov,
        items_sold: sales.itemsSold,
        avg_items_per_order: sales.avgItemsPerOrder,
        avg_fulfillment_time: operations.avgFulfillmentTime,
        completion_rate: operations.completionRate,
        cancellation_rate: operations.cancellationRate,
        rejection_rate: operations.rejectionRate,
        estimated_food_cost: menu.estimatedFoodCost,
        contribution_margin: menu.contributionMargin,
        current_stock: inventory.currentStock,
        low_stock_item_count: inventory.lowStockItemCount,
        out_of_stock_item_count: inventory.outOfStockItemCount,
        avg_rating: reviews.avgRating,
        review_count: reviews.reviewCount,
      },
      dataQuality: overallQuality,
      dataQualityNotes,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
      tenantId: auth.businessId,
      branchIds: auth.targetBranchIds,
    };

    return {
      sales,
      operations,
      menu,
      inventory,
      reviews,
      summary: summaryDTO,
    };
  }
}
