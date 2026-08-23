import { requireAnalyticsAccess } from './analytics-auth';
import { resolveAnalyticsDateRange } from '@/lib/analytics/time-range';
import { AnalyticsDateRange, SummaryAnalyticsDTO, ResolvedDateRange, BranchComparisonItemDTO } from '@/lib/analytics/analytics-types';
import { getSalesAnalytics, SalesAnalyticsResult, getGroupedSalesByBranch } from './sales-analytics';
import { getOperationsAnalytics, OperationsAnalyticsResult, getGroupedOperationsByBranch } from './operations-analytics';
import { getMenuAnalytics, MenuAnalyticsResult } from './menu-analytics';
import { getInventoryAnalytics, InventoryAnalyticsResult, getGroupedInventoryByBranch } from './inventory-analytics';
import { getReviewAnalytics, ReviewAnalyticsResult, getGroupedReviewsByBranch } from './review-analytics';

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
  branchComparison?: BranchComparisonItemDTO[];
  authorizedBranches: { id: string; name: string }[];
  isMultiBranchAuthorized: boolean;
}

export class AnalyticsService {
  /**
   * Fetches Sales & Revenue Analytics metrics.
   */
  static async getSalesSummary(input: AnalyticsQueryInput): Promise<{
    sales: SalesAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
    currency: string;
    hasFinancialAccess: boolean;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const sales = await getSalesAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess);

    return {
      sales,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
      hasFinancialAccess: auth.hasFinancialAccess,
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
    hasFinancialAccess: boolean;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const menu = await getMenuAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess);

    return {
      menu,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
      hasFinancialAccess: auth.hasFinancialAccess,
    };
  }

  /**
   * Fetches Inventory & Stock Movement Analytics metrics.
   */
  static async getInventorySummary(input: AnalyticsQueryInput): Promise<{
    inventory: InventoryAnalyticsResult;
    resolvedDateRange: ResolvedDateRange;
    currency: string;
    hasFinancialAccess: boolean;
  }> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    const inventory = await getInventoryAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess);

    return {
      inventory,
      resolvedDateRange: resolvedBounds,
      currency: auth.currency,
      hasFinancialAccess: auth.hasFinancialAccess,
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
   * Computes multi-branch comparison dataset using batched grouped domain queries across authorized target branches.
   * Query complexity is O(1) constant (4 grouped queries total) regardless of branch count.
   */
  static async getBranchComparison(
    businessId: string,
    targetBranchDetails: { id: string; name: string }[],
    resolvedBounds: ResolvedDateRange,
    currency: string,
    hasFinancialAccess: boolean
  ): Promise<BranchComparisonItemDTO[]> {
    if (targetBranchDetails.length <= 1) {
      return [];
    }

    const targetBranchIds = targetBranchDetails.map((b) => b.id);

    // Grouped/batched retrieval: exactly 4 domain queries total across ALL target branches
    const [salesMap, opsMap, invMap, revMap] = await Promise.all([
      getGroupedSalesByBranch(businessId, targetBranchIds, resolvedBounds, currency, hasFinancialAccess),
      getGroupedOperationsByBranch(businessId, targetBranchIds, resolvedBounds),
      getGroupedInventoryByBranch(businessId, targetBranchIds, resolvedBounds, currency, hasFinancialAccess),
      getGroupedReviewsByBranch(businessId, targetBranchIds, resolvedBounds),
    ]);

    // In-memory composition of DTOs
    const comparisonList: BranchComparisonItemDTO[] = targetBranchDetails.map((b) => {
      const sales = salesMap.get(b.id);
      const ops = opsMap.get(b.id);
      const inv = invMap.get(b.id);
      const rev = revMap.get(b.id);

      return {
        branchId: b.id,
        branchName: b.name,
        grossSalesCents: sales?.grossSalesCents ?? null,
        completedOrdersCount: sales?.completedOrdersCount ?? 0,
        aovCents: sales?.aovCents ?? null,
        completionRate: ops?.completionRate ?? 0,
        avgPreparationTimeSeconds: ops?.avgPreparationTimeSeconds ?? null,
        wasteCostCents: inv?.wasteCostCents ?? null,
        avgRating: rev?.avgRating ?? null,
      };
    });

    return comparisonList;
  }


  /**
   * Fetches complete Executive Overview combining independent domain metric families in parallel.
   */
  static async getExecutiveOverview(input: AnalyticsQueryInput): Promise<ExecutiveOverviewDTO> {
    const auth = await requireAnalyticsAccess(input.branchId, input.branchIds);
    const resolvedBounds = resolveAnalyticsDateRange(input.dateRange, input.timezone);

    // Parallelize independent domain analytics queries with Promise.all
    const [sales, operations, menu, inventory, reviews] = await Promise.all([
      getSalesAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess),
      getOperationsAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds),
      getMenuAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess),
      getInventoryAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds, auth.currency, auth.hasFinancialAccess),
      getReviewAnalytics(auth.businessId, auth.targetBranchIds, resolvedBounds),
    ]);

    // Fetch multi-branch comparison if user is authorized for multiple branches & requesting overview
    let branchComparison: BranchComparisonItemDTO[] = [];
    if (auth.isMultiBranchAuthorized && auth.authorizedBranchDetails.length > 1 && (!input.branchId || input.branchId === 'all')) {
      branchComparison = await AnalyticsService.getBranchComparison(
        auth.businessId,
        auth.authorizedBranchDetails,
        resolvedBounds,
        auth.currency,
        auth.hasFinancialAccess
      );
    }

    const dataQualityNotes: string[] = [];
    let overallQuality = sales.grossSales.quality;

    if (!auth.hasFinancialAccess) {
      dataQualityNotes.push('Financial metrics are redacted. Financial report permission required.');
    }

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
      hasFinancialAccess: auth.hasFinancialAccess,
    };

    return {
      sales,
      operations,
      menu,
      inventory,
      reviews,
      summary: summaryDTO,
      branchComparison,
      authorizedBranches: auth.authorizedBranchDetails,
      isMultiBranchAuthorized: auth.isMultiBranchAuthorized,
    };
  }
}
