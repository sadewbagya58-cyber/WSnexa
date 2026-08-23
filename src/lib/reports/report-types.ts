import { ReportPreset, ReportType, ExportFormat } from '@/lib/validation/report';
import { OperationalInsightDTO } from '@/lib/insights/insight-types';

export interface AnalyticsReportRequest {
  reportType: ReportType | 'full_executive_report' | 'inventory_waste' | 'operations_performance' | 'reputation_summary';
  format: ExportFormat;
  preset?: ReportPreset;
  startDate?: string;
  endDate?: string;
  branchId?: string | null;
  includeInsights?: boolean;
}

export interface AnalyticsReportMetadata {
  reportTitle: string;
  businessName: string;
  branchScopeLabel: string;
  authorizedBranchCount: number;
  dateRangeLabel: string;
  timezone: string;
  currency: string;
  generatedAt: string;
  generatedByUserId?: string;
  dataQualityNotes: string[];
  hasFinancialAccess: boolean;
}

export interface AnalyticsReportMetricRow {
  label: string;
  value: string;
  changeLabel?: string;
  category?: string;
  isFinancial?: boolean;
}

export interface AnalyticsReportSection {
  id: string;
  title: string;
  description?: string;
  headers: string[];
  rows: (string | number)[][];
  summaryMetrics?: AnalyticsReportMetricRow[];
  dataQualityNote?: string;
}

export interface AnalyticsReportDataset {
  metadata: AnalyticsReportMetadata;
  sections: AnalyticsReportSection[];
  insights?: OperationalInsightDTO[];
}

export interface AnalyticsReportResult {
  success: boolean;
  fileContent?: string;
  mimeType?: string;
  filename?: string;
  dataset?: AnalyticsReportDataset;
  message?: string;
}
