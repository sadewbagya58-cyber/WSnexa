import { AnalyticsMetricKey, DataQualityFlag } from '@/lib/analytics/analytics-types';

export type InsightSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export type InsightCategory = 'SALES' | 'OPERATIONS' | 'MENU' | 'INVENTORY' | 'REPUTATION' | 'BRANCH';

export type InsightStatus = 'ACTIVE' | 'DISMISSED' | 'RESOLVED';

export interface InsightEvidenceDTO {
  label: string;
  currentValue: string | number;
  previousValue?: string | number | null;
  changeFormatted?: string | null;
  sampleSize?: number | null;
  quality?: DataQualityFlag;
}

export interface InsightRecommendationDTO {
  title: string;
  action: string;
  cautiousReasoning: string;
}

export interface OperationalInsightDTO {
  id: string;
  ruleKey: string;
  fingerprint: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  summary: string;
  branchId?: string | null;
  branchName?: string | null;
  metricKeys: AnalyticsMetricKey[];
  evidence: InsightEvidenceDTO[];
  recommendation: InsightRecommendationDTO;
  detectedAt: string;
  dataQuality: DataQualityFlag;
  status: InsightStatus;
  dismissedAt?: string | null;
}
