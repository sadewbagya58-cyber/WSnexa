import { OperationalInsightDTO } from '@/lib/insights/insight-types';
import { DataQualityFlag } from '@/lib/analytics/analytics-types';

export interface AIContextBusinessMeta {
  id: string;
  currency: string;
  timezone: string;
}

export interface AIContextScopeMeta {
  targetBranchIds: string[];
  isMultiBranch: boolean;
}

export interface AIContextPeriodMeta {
  preset: string;
  startUtc: string;
  endUtc: string;
  label: string;
}

export interface AIContextMetricsSnapshot {
  grossSalesCents?: number | null;
  netSalesCents?: number | null;
  completedOrders: number;
  placedOrders: number;
  aovCents?: number | null;
  avgKitchenPrepTimeSeconds?: number | null;
  completionRate?: number | null;
  outOfStockCount: number;
  lowStockCount: number;
  wasteCostCents?: number | null;
  avgRating?: number | null;
  reviewCount: number;
}

export interface AIContextSnapshot {
  business: AIContextBusinessMeta;
  scope: AIContextScopeMeta;
  period: AIContextPeriodMeta;
  metrics: AIContextMetricsSnapshot;
  activeInsights: OperationalInsightDTO[];
  dataQuality: DataQualityFlag;
  hasFinancialAccess: boolean;
}

export type AIQuestionCategory =
  | 'BUSINESS_PERFORMANCE'
  | 'BRANCH_COMPARISON'
  | 'MENU_PERFORMANCE'
  | 'OPERATIONS'
  | 'INVENTORY'
  | 'REPUTATION';

export interface AIInsightQuestion {
  category: AIQuestionCategory;
  questionText: string;
  branchId?: string | null;
}

export interface AIRecommendationResponse {
  summary: string;
  observationText: string;
  suggestedActions: string[];
  confidence: number;
  providerName: string;
}
