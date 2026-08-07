import { formatCurrency } from '@/features/cart/cart-calculations';

/**
 * Sanitizes cell values to prevent CSV / Excel formula injection security vulnerabilities (=, +, -, @).
 */
export function sanitizeExportCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);

  // Formula Injection Guard
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Generates an RFC 4180 compliant CSV string from headers and data rows.
 */
export function generateCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const sanitizedHeaders = headers.map((h) => `"${sanitizeExportCell(h).replace(/"/g, '""')}"`);
  const lines = [sanitizedHeaders.join(',')];

  for (const row of rows) {
    const formattedRow = row.map((cell) => {
      const sanitized = sanitizeExportCell(cell);
      return `"${sanitized.replace(/"/g, '""')}"`;
    });
    lines.push(formattedRow.join(','));
  }

  return lines.join('\r\n');
}

/**
 * Generates a Spreadsheet XML / HTML Excel compatible table string for XLSX export.
 */
export function generateXLSXTable(
  title: string,
  businessName: string,
  branchName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
  totals?: { label: string; value: string }[]
): string {
  const headerHtml = headers
    .map((h) => `<th style="background-color:#18181b;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #27272a;">${sanitizeExportCell(h)}</th>`)
    .join('');

  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td style="padding:6px;border:1px solid #e4e4e7;">${sanitizeExportCell(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('');

  const totalsHtml = totals
    ? totals
        .map(
          (t) =>
            `<tr style="font-weight:bold;background-color:#f4f4f5;"><td colspan="${headers.length - 1}" style="padding:6px;border:1px solid #d4d4d8;text-align:right;">${sanitizeExportCell(t.label)}</td><td style="padding:6px;border:1px solid #d4d4d8;">${sanitizeExportCell(t.value)}</td></tr>`
        )
        .join('')
    : '';

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
        <h2>${sanitizeExportCell(title)}</h2>
        <p><strong>Business:</strong> ${sanitizeExportCell(businessName)} | <strong>Branch:</strong> ${sanitizeExportCell(branchName)} | <strong>Exported:</strong> ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>
            ${rowsHtml}
            ${totalsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

/**
 * Generates Executive Summary PDF HTML layout for printing / download.
 */
export function generateExecutivePDFHtml(data: {
  title: string;
  businessName: string;
  branchName: string;
  dateRangeLabel: string;
  currency: string;
  summary: {
    totalOrders: number;
    completedOrders: number;
    grossSalesCents: number;
    paidRevenueCents: number;
    outstandingBalanceCents: number;
    aovCents: number;
    topItemName: string;
    topCategoryName: string;
  };
  tableHeaders: string[];
  tableRows: (string | number)[][];
}): string {
  const { title, businessName, branchName, dateRangeLabel, currency, summary, tableHeaders, tableRows } = data;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title} - ${businessName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #09090b; margin: 0; padding: 20px; line-height: 1.4; }
          .header { border-bottom: 2px solid #09090b; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .header p { margin: 4px 0 0 0; font-size: 12px; color: #71717a; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
          .card { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; }
          .card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #71717a; margin-bottom: 4px; }
          .card-value { font-size: 16px; font-weight: 900; font-family: monospace; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
          th { background: #18181b; color: #ffffff; text-align: left; padding: 8px; font-weight: 700; uppercase; }
          td { border-bottom: 1px solid #e4e4e7; padding: 8px; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 30px; border-top: 1px solid #e4e4e7; pt: 12px; text-align: center; font-size: 10px; color: #a1a1aa; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${title}</h1>
            <p>${businessName} — ${branchName} (${dateRangeLabel})</p>
          </div>
          <div style="text-align: right; font-size: 11px; color: #71717a;">
            Generated: ${new Date().toLocaleString()}
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-label">Gross Sales</div>
            <div class="card-value">${formatCurrency(summary.grossSalesCents, currency)}</div>
          </div>
          <div class="card">
            <div class="card-label">Net Paid Revenue</div>
            <div class="card-value" style="color:#047857;">${formatCurrency(summary.paidRevenueCents, currency)}</div>
          </div>
          <div class="card">
            <div class="card-label">Outstanding Balance</div>
            <div class="card-value" style="color:#b45309;">${formatCurrency(summary.outstandingBalanceCents, currency)}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Orders</div>
            <div class="card-value">${summary.totalOrders}</div>
          </div>
          <div class="card">
            <div class="card-label">Avg Order Value (AOV)</div>
            <div class="card-value">${formatCurrency(summary.aovCents, currency)}</div>
          </div>
          <div class="card">
            <div class="card-label">Top Selling Item</div>
            <div class="card-value" style="font-size:12px;">${summary.topItemName}</div>
          </div>
        </div>

        <h3 style="font-size: 14px; margin-bottom: 8px; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px;">Detailed Breakdown</h3>
        <table>
          <thead>
            <tr>
              ${tableHeaders.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows
              .map(
                (row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          WSNexa Business Intelligence • Confidential Official Report
        </div>
      </body>
    </html>
  `;
}
