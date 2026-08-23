export type MetricCategory = 'sales' | 'operations' | 'menu' | 'inventory' | 'reputation';
export type MetricUnit = 'currency' | 'count' | 'percentage' | 'duration' | 'rating';
export type MetricGrain = 'order' | 'order_item' | 'payment' | 'inventory_movement' | 'review' | 'branch_day';
export type AggregationSemantics = 'sum' | 'count' | 'average' | 'weighted_average' | 'ratio';
export type AnalyticsFilterKey = 'date_range' | 'branch' | 'service_area' | 'menu_category' | 'payment_method';
export type AnalyticsDomain = 'orders' | 'payments' | 'menu' | 'inventory' | 'reviews';
export type DataQualityFlag = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export type AnalyticsMetricKey =
  // Sales Metrics
  | 'gross_sales'
  | 'net_sales'
  | 'completed_orders'
  | 'placed_orders'
  | 'cancelled_orders'
  | 'rejected_orders'
  | 'aov'
  | 'items_sold'
  | 'avg_items_per_order'
  | 'revenue_per_order'
  | 'revenue_per_branch'
  | 'revenue_per_service_area'
  | 'sales_by_payment_method'
  | 'sales_by_hour'
  | 'sales_by_day'
  // Operations Metrics
  | 'avg_order_acceptance_time'
  | 'avg_kitchen_preparation_time'
  | 'avg_fulfillment_time'
  | 'pending_order_count'
  | 'completion_rate'
  | 'cancellation_rate'
  | 'rejection_rate'
  // Menu Metrics
  | 'quantity_sold_by_item'
  | 'revenue_by_item'
  | 'item_order_count'
  | 'item_penetration_rate'
  | 'category_sales'
  | 'category_quantity'
  | 'estimated_food_cost'
  | 'contribution_margin'
  // Inventory Metrics
  | 'current_stock'
  | 'low_stock_item_count'
  | 'out_of_stock_item_count'
  | 'waste_quantity'
  | 'waste_cost_cents'
  | 'transfer_volume'
  // Review / Reputation Metrics
  | 'avg_rating'
  | 'review_count'
  | 'rating_distribution'
  | 'response_rate'
  | 'unresponded_review_count';

export interface MetricDefinition {
  key: AnalyticsMetricKey;
  label: string;
  description: string;
  category: MetricCategory;
  unit: MetricUnit;
  grain: MetricGrain;
  aggregationSemantics: AggregationSemantics;
  supportedFilters: AnalyticsFilterKey[];
  sourceDomains: AnalyticsDomain[];
  isCurrencyBased: boolean;
  isComparisonMeaningful: boolean;
  formula: string;
}

export type AnalyticsDatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'custom';

export interface AnalyticsDateRange {
  preset: AnalyticsDatePreset;
  startDate?: string | null;
  endDate?: string | null;
  timezone?: string;
}

export interface ResolvedDateRange {
  preset: AnalyticsDatePreset;
  startUtc: string;
  endUtc: string;
  timezone: string;
  label: string;
  previousRange?: {
    startUtc: string;
    endUtc: string;
    label: string;
  };
}

export interface MetricValueDTO {
  key: AnalyticsMetricKey;
  value: number | null;
  unit: MetricUnit;
  currency?: string;
  previousValue?: number | null;
  absoluteChange?: number | null;
  percentageChange?: number | null;
  quality: DataQualityFlag;
  qualityNote?: string;
}

export interface TimeSeriesPointDTO {
  period: string;
  value: number;
  ordersCount?: number;
  paidRevenueCents?: number;
}

export interface BreakdownItemDTO {
  key: string;
  label: string;
  value: number;
  subValue?: number;
  percentage?: number;
}

export interface BranchComparisonItemDTO {
  branchId: string;
  branchName: string;
  grossSalesCents: number | null;
  completedOrdersCount: number;
  aovCents: number | null;
  completionRate: number | null;
  avgPreparationTimeSeconds: number | null;
  wasteCostCents: number | null;
  avgRating: number | null;
}

export interface SummaryAnalyticsDTO {
  metrics: Record<string, MetricValueDTO>;
  dataQuality: DataQualityFlag;
  dataQualityNotes: string[];
  resolvedDateRange: ResolvedDateRange;
  currency: string;
  tenantId: string;
  branchIds: string[];
  hasFinancialAccess: boolean;
}

export type AnalyticsErrorCode =
  | 'ANALYTICS_FORBIDDEN'
  | 'INVALID_DATE_RANGE'
  | 'UNSUPPORTED_CURRENCY_ROLLUP'
  | 'UNSUPPORTED_METRIC'
  | 'OUTSIDE_SCOPE'
  | 'DATABASE_ERROR';

export class AnalyticsError extends Error {
  readonly code: AnalyticsErrorCode;

  constructor(code: AnalyticsErrorCode, message: string) {
    super(message);
    this.name = 'AnalyticsError';
    this.code = code;
  }
}
