import { ExecutiveOverviewDTO } from '@/server/analytics/analytics.service';
import { InsightEngine } from '@/server/insights/insight-engine';
import { formatCurrency } from '@/features/cart/cart-calculations';
import { generateCSV } from '@/lib/export/export-engine';
import {
  AnalyticsReportDataset,
  AnalyticsReportMetadata,
  AnalyticsReportResult,
  AnalyticsReportSection,
} from '@/lib/reports/report-types';
import { ExportFormat, ReportType } from '@/lib/validation/report';

/**
 * Builds canonical report dataset and formatted file output from ExecutiveOverviewDTO.
 * Ensures zero formula divergence and strict financial redaction.
 */
export async function buildAnalyticsReport(
  overview: ExecutiveOverviewDTO,
  reportType: ReportType | 'full_executive_report',
  format: ExportFormat
): Promise<AnalyticsReportResult> {
  const { summary, sales, operations, menu, inventory, reviews, branchComparison, authorizedBranches } = overview;
  const currency = summary.currency;
  const hasFinancial = summary.hasFinancialAccess;

  // Resolve scope label for metadata
  const branchScopeLabel =
    authorizedBranches.length === 1
      ? authorizedBranches[0].name
      : `All Authorized Branches (${authorizedBranches.length})`;

  // 1. Fetch active insights for report inclusion
  const insights = await InsightEngine.evaluate(overview);

  // 2. Build display metadata
  const metadata: AnalyticsReportMetadata = {
    reportTitle: getReportTitle(reportType),
    businessName: 'WSNexa Business',
    branchScopeLabel,
    authorizedBranchCount: authorizedBranches.length,
    dateRangeLabel: summary.resolvedDateRange.label,
    timezone: summary.resolvedDateRange.timezone,
    currency,
    generatedAt: new Date().toISOString(),
    dataQualityNotes: [
      summary.dataQuality === 'PARTIAL' ? 'Report contains partial data for selected range.' : '',
      summary.dataQuality === 'UNAVAILABLE' ? 'Some metrics are temporarily unavailable.' : '',
      !hasFinancial ? 'Financial metrics redacted due to user permissions.' : '',
    ].filter(Boolean),
    hasFinancialAccess: hasFinancial,
  };

  const sections: AnalyticsReportSection[] = [];

  // Helper for formatting financial numbers safely
  const fmtMoney = (cents: number | null | undefined): string => {
    if (!hasFinancial) return 'Redacted';
    if (cents === null || cents === undefined) return 'N/A';
    return formatCurrency(cents, currency);
  };

  const fmtPctChange = (pct: number | null | undefined): string => {
    if (pct === null || pct === undefined) return 'N/A';
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  // Section 1: Executive Sales Summary
  if (reportType === 'sales_summary' || reportType === 'full_executive_report') {
    sections.push({
      id: 'sales_summary',
      title: '1. Executive Sales & Revenue',
      headers: ['Metric', 'Current Period Value', 'Prior Period Value', 'Change (%)'],
      rows: [
        ['Gross Sales', fmtMoney(sales.grossSales.value), fmtMoney(sales.grossSales.previousValue), fmtPctChange(sales.grossSales.percentageChange)],
        ['Net Sales', fmtMoney(sales.netSales.value), fmtMoney(sales.netSales.previousValue), fmtPctChange(sales.netSales.percentageChange)],
        ['Completed Orders', sales.completedOrders.value ?? 0, sales.completedOrders.previousValue ?? 'N/A', fmtPctChange(sales.completedOrders.percentageChange)],
        ['Average Order Value (AOV)', fmtMoney(sales.aov.value), fmtMoney(sales.aov.previousValue), fmtPctChange(sales.aov.percentageChange)],
        ['Placed Orders', sales.placedOrders.value ?? 0, 'N/A', 'N/A'],
        ['Cancelled Orders', sales.cancelledOrders.value ?? 0, 'N/A', 'N/A'],
        ['Rejected Orders', sales.rejectedOrders.value ?? 0, 'N/A', 'N/A'],
      ],
    });
  }

  // Section 2: Payment Breakdown
  if (reportType === 'payment_breakdown' || reportType === 'full_executive_report') {
    sections.push({
      id: 'payment_breakdown',
      title: '2. Payment Method Breakdown',
      headers: ['Payment Method', 'Transaction Count', 'Total Collected', 'Share (%)'],
      rows: sales.salesByPaymentMethod.map((pm) => [
        pm.label,
        pm.subValue ?? 0,
        fmtMoney(pm.value),
        `${pm.percentage}%`,
      ]),
    });
  }

  // Section 3: Operations & Speed
  if (reportType === 'operations_performance' || reportType === 'full_executive_report') {
    const prepSecs = operations.avgKitchenPreparationTime.value;
    const fulSecs = operations.avgFulfillmentTime.value;
    sections.push({
      id: 'operations_performance',
      title: '3. Operations & Speed Summary',
      headers: ['Operational Metric', 'Value', 'Status / Benchmark'],
      rows: [
        ['Avg Kitchen Preparation Time', prepSecs !== null ? `${Math.round(prepSecs / 60)} min` : 'N/A', 'Target: ≤ 15 min'],
        ['Avg Fulfillment Time', fulSecs !== null ? `${Math.round(fulSecs / 60)} min` : 'N/A', 'Target: ≤ 25 min'],
        ['Completion Rate', operations.completionRate.value !== null ? `${operations.completionRate.value}%` : 'N/A', 'Target: ≥ 95%'],
        ['Order Cancellation Rate', operations.cancellationRate.value !== null ? `${operations.cancellationRate.value}%` : 'N/A', 'Target: ≤ 3%'],
        ['Order Rejection Rate', operations.rejectionRate.value !== null ? `${operations.rejectionRate.value}%` : 'N/A', 'Target: ≤ 1%'],
      ],
    });
  }

  // Section 4: Menu Performance
  if (reportType === 'menu_performance' || reportType === 'full_executive_report') {
    sections.push({
      id: 'menu_performance',
      title: '4. Menu Item Performance',
      headers: ['Item Name', 'Quantity Sold', 'Orders Count', 'Total Revenue', 'Avg Selling Price'],
      rows: menu.topSellingItems.map((item) => [
        item.itemName,
        item.quantitySold,
        item.orderCount,
        fmtMoney(item.revenueCents),
        fmtMoney(item.avgPriceCents),
      ]),
    });
  }

  // Section 5: Inventory & Waste
  if (reportType === 'inventory_waste' || reportType === 'full_executive_report') {
    sections.push({
      id: 'inventory_waste',
      title: '5. Inventory & Waste Summary',
      headers: ['Metric', 'Value'],
      rows: [
        ['Low Stock Items Count', inventory.lowStockItemCount.value ?? 0],
        ['Out of Stock Items Count', inventory.outOfStockItemCount.value ?? 0],
        ['Total Waste Financial Cost', fmtMoney(inventory.wasteCostCents.value)],
        ['Total Waste Quantity', inventory.wasteQuantity.value ?? 0],
      ],
    });
  }

  // Section 6: Guests & Reputation
  if (reportType === 'reputation_summary' || reportType === 'full_executive_report') {
    sections.push({
      id: 'reputation_summary',
      title: '6. Guests & Reputation Summary',
      headers: ['Metric', 'Value'],
      rows: [
        ['Average Customer Rating', reviews.avgRating.value !== null ? `${reviews.avgRating.value} ★` : 'N/A'],
        ['Total Reviews Received', reviews.reviewCount.value ?? 0],
        ['Review Response Rate', reviews.responseRate.value !== null ? `${reviews.responseRate.value}%` : 'N/A'],
        ['Unresponded Reviews Count', reviews.unrespondedReviewCount.value ?? 0],
      ],
    });
  }

  // Section 7: Branch Comparison (Multi-Branch Fleet)
  if ((reportType === 'branch_comparison' || reportType === 'full_executive_report') && branchComparison && branchComparison.length > 0) {
    sections.push({
      id: 'branch_comparison',
      title: '7. Multi-Branch Fleet Comparison',
      headers: ['Branch Name', 'Gross Sales', 'Completed Orders', 'AOV', 'Completion Rate', 'Prep Speed', 'Waste Cost', 'Rating'],
      rows: branchComparison.map((b) => [
        b.branchName,
        fmtMoney(b.grossSalesCents),
        b.completedOrdersCount,
        fmtMoney(b.aovCents),
        b.completionRate !== null ? `${b.completionRate}%` : 'N/A',
        b.avgPreparationTimeSeconds !== null ? `${Math.round(b.avgPreparationTimeSeconds / 60)}m` : 'N/A',
        fmtMoney(b.wasteCostCents),
        b.avgRating !== null ? `${b.avgRating} ★` : 'N/A',
      ]),
    });
  }

  // Section 8: Operational Insights
  if (insights && insights.length > 0) {
    sections.push({
      id: 'operational_insights',
      title: '8. Operational Insights & Alerts',
      headers: ['Severity', 'Category', 'Insight Title', 'Summary & Evidence', 'Recommended Action'],
      rows: insights.map((insight) => {
        const ev = insight.evidence[0];
        const evStr = ev ? `${ev.label}: ${ev.currentValue}` : '';
        return [
          insight.severity,
          insight.category,
          insight.title,
          `${insight.summary} (${evStr})`,
          insight.recommendation.action,
        ];
      }),
    });
  }

  const dataset: AnalyticsReportDataset = { metadata, sections, insights };

  // 3. Format file output according to format
  let fileContent = '';
  let mimeType = 'text/csv';
  let filename = `${sanitizeFilename(metadata.businessName)}_${reportType}_${sanitizeFilename(metadata.branchScopeLabel)}_${new Date().toISOString().slice(0, 10)}`;

  if (format === 'csv') {
    fileContent = generateReportCSV(dataset);
    mimeType = 'text/csv';
    filename += '.csv';
  } else if (format === 'xlsx') {
    fileContent = generateReportXLSX(dataset);
    mimeType = 'application/vnd.ms-excel';
    filename += '.xls';
  } else if (format === 'pdf') {
    fileContent = generateReportPrintHtml(dataset);
    mimeType = 'text/html';
    filename += '.html';
  }

  return {
    success: true,
    fileContent,
    mimeType,
    filename,
    dataset,
  };
}

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'full_executive_report':
      return 'Comprehensive Executive Analytics Report';
    case 'payment_breakdown':
      return 'Payment Method Breakdown Report';
    case 'menu_performance':
      return 'Menu Item Performance Report';
    case 'inventory_waste':
      return 'Inventory & Waste Management Report';
    case 'operations_performance':
      return 'Operations & Speed Performance Report';
    case 'reputation_summary':
      return 'Customer Reputation & Feedback Report';
    case 'branch_comparison':
      return 'Multi-Branch Fleet Comparison Report';
    case 'sales_summary':
    default:
      return 'Executive Sales & Revenue Report';
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Generates structured CSV with section dividers and formula-injection guards.
 */
function generateReportCSV(dataset: AnalyticsReportDataset): string {
  const { metadata, sections } = dataset;
  const lines: string[] = [
    `"=== ${metadata.reportTitle} ==="`,
    `"Business: ${metadata.businessName}"`,
    `"Scope: ${metadata.branchScopeLabel} (${metadata.authorizedBranchCount} branches)"`,
    `"Period: ${metadata.dateRangeLabel} (${metadata.timezone})"`,
    `"Currency: ${metadata.currency}"`,
    `"Generated At: ${metadata.generatedAt}"`,
  ];

  if (metadata.dataQualityNotes.length > 0) {
    lines.push(`"Notes: ${metadata.dataQualityNotes.join(' | ')}"`);
  }

  lines.push('');

  for (const section of sections) {
    lines.push(`"=== ${section.title} ==="`);
    lines.push(generateCSV(section.headers, section.rows));
    lines.push('');
  }

  return lines.join('\r\n');
}

/**
 * Generates HTML Spreadsheet XML representation for Excel.
 */
function generateReportXLSX(dataset: AnalyticsReportDataset): string {
  const { metadata, sections } = dataset;
  const sectionsHtml = sections
    .map((section) => {
      const headerHtml = section.headers
        .map((h) => `<th style="background-color:#18181b;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #27272a;">${h}</th>`)
        .join('');
      const rowsHtml = section.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td style="padding:6px;border:1px solid #e4e4e7;">${cell}</td>`).join('')}</tr>`
        )
        .join('');

      return `
        <h3 style="margin-top:20px;color:#18181b;">${section.title}</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;
    })
    .join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: sans-serif; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
        </style>
      </head>
      <body>
        <h2>${metadata.reportTitle}</h2>
        <p><strong>Business:</strong> ${metadata.businessName} | <strong>Scope:</strong> ${metadata.branchScopeLabel} | <strong>Period:</strong> ${metadata.dateRangeLabel} (${metadata.currency})</p>
        ${metadata.dataQualityNotes.length > 0 ? `<p style="color:#b45309;"><strong>Notice:</strong> ${metadata.dataQualityNotes.join(' | ')}</p>` : ''}
        ${sectionsHtml}
      </body>
    </html>
  `;
}

/**
 * Generates print-ready HTML page for browser Print / Save to PDF.
 */
function generateReportPrintHtml(dataset: AnalyticsReportDataset): string {
  const { metadata, sections } = dataset;

  const sectionsHtml = sections
    .map((section) => {
      const headerHtml = section.headers.map((h) => `<th>${h}</th>`).join('');
      const rowsHtml = section.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('');

      return `
        <div class="section">
          <h3>${section.title}</h3>
          <table>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${metadata.reportTitle} - ${metadata.businessName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 20px; line-height: 1.4; }
          .header { border-bottom: 2px solid #09090b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #71717a; }
          .meta-bar { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 20px; }
          .section { margin-bottom: 24px; page-break-inside: avoid; }
          .section h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #d4d4d8; padding-bottom: 4px; margin-bottom: 8px; color: #18181b; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #18181b; color: #ffffff; text-align: left; padding: 6px 8px; font-weight: 700; text-transform: uppercase; font-size: 10px; }
          td { border-bottom: 1px solid #e4e4e7; padding: 6px 8px; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 30px; border-top: 1px solid #e4e4e7; padding-top: 12px; text-align: center; font-size: 10px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${metadata.reportTitle}</h1>
            <p>${metadata.businessName} — ${metadata.branchScopeLabel}</p>
          </div>
          <div style="text-align: right; font-size: 11px; color: #71717a;">
            Generated: ${new Date(metadata.generatedAt).toLocaleString()}
          </div>
        </div>

        <div class="meta-bar">
          <strong>Period:</strong> ${metadata.dateRangeLabel} (${metadata.timezone}) &nbsp;|&nbsp;
          <strong>Currency:</strong> ${metadata.currency} &nbsp;|&nbsp;
          <strong>Branches:</strong> ${metadata.branchScopeLabel} (${metadata.authorizedBranchCount})
          ${metadata.dataQualityNotes.length > 0 ? `<br/><span style="color:#b45309;">⚠️ ${metadata.dataQualityNotes.join(' | ')}</span>` : ''}
        </div>

        ${sectionsHtml}

        <div class="footer">
          WSNexa Business Intelligence • Confidential Official Report
        </div>
      </body>
    </html>
  `;
}
