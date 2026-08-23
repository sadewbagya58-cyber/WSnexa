'use server';

import { AnalyticsService } from '@/server/analytics/analytics.service';
import { reportFilterSchema, reportExportInputSchema, ReportFilterInput, ReportExportInput } from '@/lib/validation/report';
import { AnalyticsDatePreset } from '@/lib/analytics/analytics-types';

import { InsightEngine } from '@/server/insights/insight-engine';
import { requireAnalyticsAccess } from '@/server/analytics/analytics-auth';
import { createAdminClient } from '@/lib/supabase/server';

function normalizePreset(preset: string): AnalyticsDatePreset {
  if (preset === '7d') return 'last_7_days';
  if (preset === '30d') return 'last_30_days';
  return preset as AnalyticsDatePreset;
}

export async function fetchAnalyticsAction(rawInput: ReportFilterInput) {
  try {
    const validated = reportFilterSchema.parse(rawInput);
    const overview = await AnalyticsService.getExecutiveOverview({
      branchId: validated.branchId,
      dateRange: {
        preset: normalizePreset(validated.preset || 'today'),
        startDate: validated.startDate,
        endDate: validated.endDate,
      },
    });

    const insights = await InsightEngine.evaluate(overview);

    return { success: true, data: { ...overview, insights } };
  } catch (err: unknown) {
    console.error('[fetchAnalyticsAction Error]:', err);
    let msg = 'Analytics are temporarily unavailable. Please try again later.';
    if (err instanceof Error) {
      if (
        err.message.includes('column') ||
        err.message.includes('relation') ||
        err.message.includes('syntax') ||
        err.message.includes('Postgres') ||
        err.message.includes('DATABASE_ERROR')
      ) {
        msg = 'Executive analytics are temporarily unavailable due to a system issue. Please try again later.';
      } else {
        msg = err.message;
      }
    }
    return { success: false, message: msg };
  }
}

export async function dismissInsightServerAction(ruleKey: string, fingerprint: string, branchId?: string | null) {
  try {
    const auth = await requireAnalyticsAccess(branchId);
    const admin = createAdminClient();

    const { error } = await admin
      .from('analytics_insight_states')
      .upsert(
        {
          business_id: auth.businessId,
          branch_id: branchId || null,
          rule_key: ruleKey,
          fingerprint,
          status: 'DISMISSED',
          dismissed_by: auth.authContext.userId,
          dismissed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'business_id,fingerprint' }
      );

    if (error) {
      console.error('[dismissInsightServerAction Error]:', error);
      return { success: false, message: 'Failed to dismiss insight.' };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Dismiss action failed';
    return { success: false, message: msg };
  }
}

export async function restoreInsightServerAction(ruleKey: string, fingerprint: string, branchId?: string | null) {
  try {
    const auth = await requireAnalyticsAccess(branchId);
    const admin = createAdminClient();

    const { error } = await admin
      .from('analytics_insight_states')
      .update({
        status: 'ACTIVE',
        dismissed_by: null,
        dismissed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', auth.businessId)
      .eq('fingerprint', fingerprint);

    if (error) {
      console.error('[restoreInsightServerAction Error]:', error);
      return { success: false, message: 'Failed to restore insight.' };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Restore action failed';
    return { success: false, message: msg };
  }
}



export async function exportReportAction(rawInput: ReportExportInput) {
  try {
    const validated = reportExportInputSchema.parse(rawInput);
    const overview = await AnalyticsService.getExecutiveOverview({
      branchId: validated.branchId,
      dateRange: {
        preset: normalizePreset(validated.preset || 'today'),
        startDate: validated.startDate,
        endDate: validated.endDate,
      },
    });

    const { buildAnalyticsReport } = await import('@/server/reports/report-generator');
    const result = await buildAnalyticsReport(overview, validated.reportType, validated.format);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    return { success: false, message: msg };
  }
}
