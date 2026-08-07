'use server';

import { ReportService } from '@/server/services/report.service';
import { reportFilterSchema, reportExportInputSchema, ReportFilterInput, ReportExportInput } from '@/lib/validation/report';
import { generateCSV, generateXLSXTable, generateExecutivePDFHtml } from '@/lib/export/export-engine';
import { formatCurrency } from '@/features/cart/cart-calculations';

export async function fetchAnalyticsAction(rawInput: ReportFilterInput) {
  try {
    const validated = reportFilterSchema.parse(rawInput);
    return await ReportService.getAnalyticsPayload(validated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid reporting parameters';
    return { success: false, message: msg };
  }
}

export async function exportReportAction(rawInput: ReportExportInput) {
  try {
    const validated = reportExportInputSchema.parse(rawInput);

    const analyticsRes = await ReportService.getAnalyticsPayload({
      preset: validated.preset,
      startDate: validated.startDate,
      endDate: validated.endDate,
      branchId: validated.branchId,
    });

    if (!analyticsRes.success || !analyticsRes.data) {
      return { success: false, message: analyticsRes.message || 'Failed to generate report dataset.' };
    }

    const { summary, menuItems, payments, currency, branchName, businessName, dateRangeLabel } = analyticsRes.data;
    const title = `${validated.reportType.replace(/_/g, ' ').toUpperCase()} REPORT`;

    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    switch (validated.reportType) {
      case 'menu_performance':
        headers = ['Item Name', 'Quantity Sold', 'Total Revenue', 'Orders Count', 'Average Price'];
        rows = menuItems.map((item) => [
          item.item_name,
          item.quantity_sold,
          formatCurrency(item.total_revenue_cents, currency),
          item.orders_count,
          formatCurrency(item.avg_price_cents, currency),
        ]);
        break;

      case 'payment_breakdown':
        headers = ['Payment Method', 'Transaction Count', 'Total Paid', 'Percentage of Revenue'];
        rows = payments.map((p) => [
          p.payment_method.toUpperCase(),
          p.transaction_count,
          formatCurrency(p.total_cents, currency),
          `${p.percentage}%`,
        ]);
        break;

      case 'sales_summary':
      default:
        headers = ['Metric', 'Value'];
        rows = [
          ['Total Orders', summary.total_orders],
          ['Completed Orders', summary.completed_orders],
          ['Cancelled Orders', summary.cancelled_orders],
          ['Gross Sales', formatCurrency(summary.gross_sales_cents, currency)],
          ['Paid Revenue', formatCurrency(summary.paid_revenue_cents, currency)],
          ['Outstanding Balance', formatCurrency(summary.outstanding_balance_cents, currency)],
          ['Average Order Value', formatCurrency(summary.aov_cents, currency)],
          ['Top Selling Item', summary.top_item_name],
          ['Top Category', summary.top_category_name],
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
      fileContent = generateXLSXTable(title, businessName, branchName, headers, rows, [
        { label: 'Total Paid Revenue', value: formatCurrency(summary.paid_revenue_cents, currency) },
      ]);
      mimeType = 'application/vnd.ms-excel';
      filename += '.xls';
    } else if (validated.format === 'pdf') {
      fileContent = generateExecutivePDFHtml({
        title,
        businessName,
        branchName,
        dateRangeLabel,
        currency,
        summary: {
          totalOrders: summary.total_orders,
          completedOrders: summary.completed_orders,
          grossSalesCents: summary.gross_sales_cents,
          paidRevenueCents: summary.paid_revenue_cents,
          outstandingBalanceCents: summary.outstanding_balance_cents,
          aovCents: summary.aov_cents,
          topItemName: summary.top_item_name,
          topCategoryName: summary.top_category_name,
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
