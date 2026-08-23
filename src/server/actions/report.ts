'use server';

import { AnalyticsService } from '@/server/analytics/analytics.service';
import { reportFilterSchema, reportExportInputSchema, ReportFilterInput, ReportExportInput } from '@/lib/validation/report';
import { generateCSV, generateXLSXTable, generateExecutivePDFHtml } from '@/lib/export/export-engine';
import { formatCurrency } from '@/features/cart/cart-calculations';
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

    const { sales, menu, summary, branchComparison } = overview;
    const currency = summary.currency;
    const title = `${validated.reportType.replace(/_/g, ' ').toUpperCase()} REPORT`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    switch (validated.reportType) {
      case 'menu_performance':
        headers = ['Item Name', 'Quantity Sold', 'Total Revenue', 'Orders Count', 'Average Price'];
        rows = menu.topSellingItems.map((item) => [
          item.itemName,
          item.quantitySold,
          item.revenueCents !== null ? formatCurrency(item.revenueCents, currency) : 'N/A',
          item.orderCount,
          item.avgPriceCents !== null ? formatCurrency(item.avgPriceCents, currency) : 'N/A',
        ]);
        break;

      case 'payment_breakdown':
        headers = ['Payment Method', 'Transaction Count', 'Total Paid', 'Percentage of Revenue'];
        rows = sales.salesByPaymentMethod.map((p) => [
          p.label,
          p.subValue || 0,
          formatCurrency(p.value, currency),
          `${p.percentage}%`,
        ]);
        break;

      case 'branch_comparison':
        headers = ['Branch Name', 'Gross Sales', 'Completed Orders', 'AOV', 'Completion Rate', 'Kitchen Prep Time', 'Waste Cost', 'Avg Rating'];
        rows = (branchComparison || []).map((b) => [
          b.branchName,
          b.grossSalesCents !== null ? formatCurrency(b.grossSalesCents, currency) : 'N/A',
          b.completedOrdersCount,
          b.aovCents !== null ? formatCurrency(b.aovCents, currency) : 'N/A',
          b.completionRate !== null ? `${b.completionRate}%` : 'N/A',
          b.avgPreparationTimeSeconds !== null ? `${Math.round(b.avgPreparationTimeSeconds / 60)}m` : 'N/A',
          b.wasteCostCents !== null ? formatCurrency(b.wasteCostCents, currency) : 'N/A',
          b.avgRating !== null ? `${b.avgRating} ★` : 'N/A',
        ]);
        break;

      case 'sales_summary':
      default:
        headers = ['Metric', 'Value'];
        rows = [
          ['Gross Sales', sales.grossSales.value !== null ? formatCurrency(sales.grossSales.value, currency) : 'Redacted'],
          ['Net Sales', sales.netSales.value !== null ? formatCurrency(sales.netSales.value, currency) : 'Redacted'],
          ['Completed Orders', sales.completedOrders.value || 0],
          ['Placed Orders', sales.placedOrders.value || 0],
          ['Cancelled Orders', sales.cancelledOrders.value || 0],
          ['Rejected Orders', sales.rejectedOrders.value || 0],
          ['Average Order Value', sales.aov.value !== null ? formatCurrency(sales.aov.value, currency) : 'Redacted'],
          ['Items Sold', sales.itemsSold.value || 0],
        ];
        break;
    }

    let fileContent = '';
    let mimeType = 'text/csv';
    let filename = `${validated.reportType}_${validated.preset}_${Date.now()}`;

    if (validated.format === 'csv') {
      fileContent = generateCSV(headers, rows);
      mimeType = 'text/csv';
      filename += '.csv';
    } else if (validated.format === 'xlsx') {
      fileContent = generateXLSXTable(title, 'WSNexa', 'Selected Scope', headers, rows, [
        { label: 'Total Orders', value: String(sales.completedOrders.value || 0) },
      ]);
      mimeType = 'application/vnd.ms-excel';
      filename += '.xls';
    } else if (validated.format === 'pdf') {
      fileContent = generateExecutivePDFHtml({
        title,
        businessName: 'WSNexa',
        branchName: 'Selected Scope',
        dateRangeLabel: summary.resolvedDateRange.label,
        currency,
        summary: {
          totalOrders: sales.placedOrders.value || 0,
          completedOrders: sales.completedOrders.value || 0,
          grossSalesCents: sales.grossSales.value || 0,
          paidRevenueCents: sales.netSales.value || 0,
          outstandingBalanceCents: 0,
          aovCents: sales.aov.value || 0,
          topItemName: menu.topSellingItems[0]?.itemName || 'N/A',
          topCategoryName: menu.categorySales[0]?.label || 'N/A',
        },
        tableHeaders: headers,
        tableRows: rows,
      });
      mimeType = 'text/html';
      filename += '.html';
    }

    return {
      success: true,
      fileContent,
      mimeType,
      filename,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export failed';
    return { success: false, message: msg };
  }
}
