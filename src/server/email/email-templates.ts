import {
  ProblemReportEmailData,
  SupportInquiryEmailData,
  SecurityReportEmailData,
  BankTransferSubmittedAdminData,
  BankTransferSettledData,
  BankTransferRejectedData,
  SubscriptionActivatedData,
  SubscriptionCancelledData,
  SubscriptionPaymentFailedData,
  SecurityAlertData,
} from './email-types';

/**
 * Escapes HTML characters to prevent XSS / markup injection in email clients.
 */
export function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Wraps content in a standardized, responsive WSNexa email layout.
 */
function wrapBaseTemplate({
  headline,
  badgeText,
  badgeColor = '#d97706', // amber
  contentHtml,
}: {
  headline: string;
  badgeText?: string;
  badgeColor?: string;
  contentHtml: string;
}): string {
  const badgeHtml = badgeText
    ? `<span style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;border-radius:12px;background-color:${badgeColor}15;color:${badgeColor};border:1px solid ${badgeColor}30;letter-spacing:0.5px;margin-bottom:12px;">${escapeHtml(badgeText)}</span>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px 32px;background-color:#09090b;text-align:left;border-bottom:2px solid #d97706;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">WSNexa</h1>
                    <p style="margin:4px 0 0 0;font-size:12px;color:#a1a1aa;font-weight:500;">Smart Hospitality. Simplified.</p>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform Notice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              ${badgeHtml}
              <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:800;color:#09090b;letter-spacing:-0.3px;">${escapeHtml(headline)}</h2>
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#fafafa;border-top:1px solid #f4f4f5;font-size:12px;color:#71717a;line-height:1.6;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px 0;font-weight:700;color:#27272a;">WSNexa Operations &amp; Support</p>
                    <p style="margin:0;">Panawewa, Bingiriya, Sri Lanka &bull; <a href="https://wsnexa.app" style="color:#d97706;text-decoration:none;">wsnexa.app</a></p>
                    <p style="margin:4px 0 0 0;color:#a1a1aa;font-size:11px;">Primary notification desk: Wsnexaofficial@gmail.com</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// -------------------------------------------------------------
// 1. Problem / Bug Report Email
// -------------------------------------------------------------

export function renderProblemReportEmail(data: ProblemReportEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa] New Problem Report — ${data.diagnosticReference}`;

  const contentHtml = `
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Diagnostic Reference</td>
        <td style="font-family:monospace;font-weight:800;color:#09090b;font-size:14px;">${escapeHtml(data.diagnosticReference)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Category</td>
        <td style="font-weight:700;color:#09090b;text-transform:capitalize;">${escapeHtml(data.category)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Reporter Email</td>
        <td><a href="mailto:${escapeHtml(data.contactEmail)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(data.contactEmail)}</a></td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Logged At</td>
        <td style="color:#27272a;">${escapeHtml(new Date(data.timestamp).toUTCString())}</td>
      </tr>
      ${data.deviceBrowser ? `
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Device / Browser</td>
        <td style="color:#27272a;">${escapeHtml(data.deviceBrowser)}</td>
      </tr>` : ''}
    </table>

    <div style="margin-top:20px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Problem Description</h3>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#18181b;white-space:pre-wrap;">${escapeHtml(data.description)}</p>
    </div>

    <div style="margin-top:16px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Steps to Reproduce</h3>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#18181b;white-space:pre-wrap;">${escapeHtml(data.stepsToReproduce)}</p>
    </div>

    <div style="margin-top:16px;display:flex;gap:12px;">
      <div style="flex:1;padding:12px;background-color:#f0fdf4;border-radius:8px;border:1px solid #dcfce7;">
        <h4 style="margin:0 0 4px 0;font-size:11px;font-weight:800;text-transform:uppercase;color:#15803d;">Expected Behavior</h4>
        <p style="margin:0;font-size:12px;color:#166534;line-height:1.5;">${escapeHtml(data.expectedBehavior)}</p>
      </div>
      <div style="flex:1;padding:12px;background-color:#fef2f2;border-radius:8px;border:1px solid #fee2e2;margin-top:8px;">
        <h4 style="margin:0 0 4px 0;font-size:11px;font-weight:800;text-transform:uppercase;color:#b91c1c;">Actual Behavior</h4>
        <p style="margin:0;font-size:12px;color:#991b1b;line-height:1.5;">${escapeHtml(data.actualBehavior)}</p>
      </div>
    </div>
  `;

  const html = wrapBaseTemplate({
    headline: `Problem Report Logged — ${data.diagnosticReference}`,
    badgeText: `Category: ${data.category}`,
    badgeColor: '#dc2626',
    contentHtml,
  });

  const text = `[WSNexa] New Problem Report — ${data.diagnosticReference}

Diagnostic Reference: ${data.diagnosticReference}
Category: ${data.category}
Contact Email: ${data.contactEmail}
Logged At: ${new Date(data.timestamp).toUTCString()}
Device/Browser: ${data.deviceBrowser || 'N/A'}

--- Problem Description ---
${data.description}

--- Steps to Reproduce ---
${data.stepsToReproduce}

Expected: ${data.expectedBehavior}
Actual: ${data.actualBehavior}

WSNexa Operations (https://wsnexa.app)`;

  return { subject, html, text };
}

// -------------------------------------------------------------
// 2. Support Contact Inquiry Email
// -------------------------------------------------------------

export function renderSupportInquiryEmail(data: SupportInquiryEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa Support] New Ticket — ${data.ticketId} (${data.subject})`;

  const contentHtml = `
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Ticket Reference</td>
        <td style="font-family:monospace;font-weight:800;color:#09090b;">${escapeHtml(data.ticketId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Customer Name</td>
        <td style="font-weight:700;color:#09090b;">${escapeHtml(data.name)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Customer Email</td>
        <td><a href="mailto:${escapeHtml(data.contactEmail)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${escapeHtml(data.contactEmail)}</a></td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Inquiry Category</td>
        <td style="font-weight:700;color:#09090b;text-transform:capitalize;">${escapeHtml(data.category)}</td>
      </tr>
      ${data.referenceId ? `
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Associated Reference</td>
        <td style="font-family:monospace;color:#27272a;">${escapeHtml(data.referenceId)}</td>
      </tr>` : ''}
    </table>

    <div style="margin-top:20px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Subject: ${escapeHtml(data.subject)}</h3>
      <p style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#18181b;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
    </div>
  `;

  const html = wrapBaseTemplate({
    headline: `Support Ticket Received — ${data.ticketId}`,
    badgeText: `Category: ${data.category}`,
    badgeColor: '#2563eb',
    contentHtml,
  });

  const text = `[WSNexa Support] New Ticket — ${data.ticketId}

Customer: ${data.name} <${data.contactEmail}>
Category: ${data.category}
Subject: ${data.subject}
Reference ID: ${data.referenceId || 'N/A'}
Logged At: ${new Date(data.timestamp).toUTCString()}

--- Message ---
${data.message}

WSNexa Support Desk (https://wsnexa.app)`;

  return { subject, html, text };
}

// -------------------------------------------------------------
// 3. Security Vulnerability Disclosure Email
// -------------------------------------------------------------

export function renderSecurityReportEmail(data: SecurityReportEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const severityColors: Record<string, string> = {
    low: '#2563eb',
    medium: '#d97706',
    high: '#ea580c',
    critical: '#dc2626',
  };
  const color = severityColors[data.severity] || '#dc2626';
  const subject = `[WSNexa Security Alert] Vulnerability Report — ${data.ticketId} [${data.severity.toUpperCase()}]`;

  const contentHtml = `
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Report ID</td>
        <td style="font-family:monospace;font-weight:800;color:#09090b;">${escapeHtml(data.ticketId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Assessed Severity</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:800;text-transform:uppercase;background-color:${color}20;color:${color};">${escapeHtml(data.severity)}</span></td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Affected Area / Endpoint</td>
        <td style="font-family:monospace;font-weight:600;color:#09090b;">${escapeHtml(data.affectedArea)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Researcher Contact</td>
        <td>${data.researcherName ? escapeHtml(data.researcherName) + ' &bull; ' : ''}<a href="mailto:${escapeHtml(data.contactEmail)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(data.contactEmail)}</a></td>
      </tr>
    </table>

    <div style="margin-top:20px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Vulnerability Summary</h3>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#18181b;">${escapeHtml(data.summary)}</p>
    </div>

    <div style="margin-top:16px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Reproduction Steps</h3>
      <pre style="margin:0;font-size:12px;line-height:1.5;color:#18181b;white-space:pre-wrap;font-family:monospace;">${escapeHtml(data.reproductionSteps)}</pre>
    </div>

    ${data.proofOfConcept ? `
    <div style="margin-top:16px;padding:16px;background-color:#fafafa;border-radius:10px;border:1px solid #f4f4f5;">
      <h3 style="margin:0 0 6px 0;font-size:12px;font-weight:800;text-transform:uppercase;color:#52525b;letter-spacing:0.5px;">Proof of Concept</h3>
      <pre style="margin:0;font-size:12px;line-height:1.5;color:#18181b;white-space:pre-wrap;font-family:monospace;">${escapeHtml(data.proofOfConcept)}</pre>
    </div>` : ''}
  `;

  const html = wrapBaseTemplate({
    headline: `Security Disclosure — ${data.ticketId}`,
    badgeText: `Severity: ${data.severity}`,
    badgeColor: color,
    contentHtml,
  });

  const text = `[WSNexa Security Alert] Vulnerability Report — ${data.ticketId} [${data.severity.toUpperCase()}]

Severity: ${data.severity.toUpperCase()}
Endpoint/Area: ${data.affectedArea}
Researcher: ${data.researcherName || 'Anonymous'} <${data.contactEmail}>
Summary: ${data.summary}

--- Reproduction Steps ---
${data.reproductionSteps}

${data.proofOfConcept ? `--- Proof of Concept ---\n${data.proofOfConcept}\n` : ''}
WSNexa Security Response Desk (https://wsnexa.app)`;

  return { subject, html, text };
}

// -------------------------------------------------------------
// 4. Bank Transfer Submitted (Admin Alert)
// -------------------------------------------------------------

export function renderBankTransferSubmittedAdminEmail(data: BankTransferSubmittedAdminData): {
  subject: string;
  html: string;
  text: string;
} {
  const businessLabel = data.businessName ? `${data.businessName} — ` : '';
  const subject = `[WSNexa Admin] Bank Transfer Submitted — ${businessLabel}LKR ${data.amountLkr.toLocaleString()} (${data.planCode.toUpperCase()})`;

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      A hospitality tenant has uploaded bank transfer payment proof for subscription settlement. Review and verify the transaction in the Super Admin Portal.
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Payment Intent ID</td>
        <td style="font-family:monospace;font-weight:700;color:#09090b;">${escapeHtml(data.paymentId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Business Name / ID</td>
        <td style="font-weight:700;color:#09090b;">${escapeHtml(data.businessName || data.businessId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Plan Code</td>
        <td style="font-weight:800;color:#d97706;text-transform:uppercase;">${escapeHtml(data.planCode)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Expected Amount</td>
        <td style="font-weight:800;color:#09090b;font-size:15px;">LKR ${data.amountLkr.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Claimed Reference</td>
        <td style="font-family:monospace;font-weight:700;color:#09090b;">${escapeHtml(data.rawReference)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Receipt File Path</td>
        <td style="font-family:monospace;color:#71717a;font-size:11px;">${escapeHtml(data.filePath)}</td>
      </tr>
      ${data.notes ? `
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Tenant Notes</td>
        <td style="color:#27272a;">${escapeHtml(data.notes)}</td>
      </tr>` : ''}
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://wsnexa.app/admin/subscription-payments" style="display:inline-block;padding:12px 24px;background-color:#09090b;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;">
        Open Admin Settlement Desk &rarr;
      </a>
    </div>
  `;

  const html = wrapBaseTemplate({
    headline: 'Bank Transfer Payment Awaiting Review',
    badgeText: 'Action Required',
    badgeColor: '#d97706',
    contentHtml,
  });

  const text = `[WSNexa Admin] Bank Transfer Submitted — LKR ${data.amountLkr} (${data.planCode.toUpperCase()})

Payment ID: ${data.paymentId}
Business: ${data.businessName || data.businessId}
Plan: ${data.planCode.toUpperCase()}
Amount: LKR ${data.amountLkr}
Reference: ${data.rawReference}
Receipt File: ${data.filePath}
Notes: ${data.notes || 'None'}

Review at: https://wsnexa.app/admin/subscription-payments`;

  return { subject, html, text };
}

// -------------------------------------------------------------
// 5. Bank Transfer Approved & Settled
// -------------------------------------------------------------

export function renderBankTransferSettledEmail(data: BankTransferSettledData): {
  customerSubject: string;
  adminSubject: string;
  customerHtml: string;
  adminHtml: string;
  text: string;
} {
  const customerSubject = `[WSNexa] Subscription Activated — Payment Verified ⚡`;
  const adminSubject = `[WSNexa Admin] Bank Transfer Settled — ${data.planCode.toUpperCase()} (LKR ${data.amountLkr.toLocaleString()})`;

  const formattedPeriodEnd = new Date(data.periodEndsAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const customerContent = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      Great news${data.businessName ? ` for <strong>${escapeHtml(data.businessName)}</strong>` : ''}! Your manual bank transfer payment for the <strong>${escapeHtml(data.planCode.toUpperCase())}</strong> plan has been verified by our finance team. Your commercial subscription is now active.
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Plan Tier</td>
        <td style="font-weight:800;color:#d97706;text-transform:uppercase;">${escapeHtml(data.planCode)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Amount Settled</td>
        <td style="font-weight:800;color:#09090b;">LKR ${data.amountLkr.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Active Through</td>
        <td style="font-weight:700;color:#16a34a;">${escapeHtml(formattedPeriodEnd)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Bank Statement Ref</td>
        <td style="font-family:monospace;color:#27272a;">${escapeHtml(data.externalBankStatementRef)}</td>
      </tr>
    </table>

    <div style="margin-top:24px;text-align:center;">
      <a href="https://wsnexa.app/dashboard/settings/subscription" style="display:inline-block;padding:12px 24px;background-color:#09090b;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;">
        View Subscription Dashboard &rarr;
      </a>
    </div>
  `;

  const customerHtml = wrapBaseTemplate({
    headline: 'Subscription Activated — Payment Verified',
    badgeText: 'Subscription Active',
    badgeColor: '#16a34a',
    contentHtml: customerContent,
  });

  const adminContent = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      Bank transfer settlement completed and subscription activated atomically.
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Payment ID</td>
        <td style="font-family:monospace;">${escapeHtml(data.paymentId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Business</td>
        <td style="font-weight:700;">${escapeHtml(data.businessName || data.businessId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Amount Settled</td>
        <td style="font-weight:800;">LKR ${data.amountLkr.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Reconciliation Note</td>
        <td>${escapeHtml(data.reconciliationNote)}</td>
      </tr>
    </table>
  `;

  const adminHtml = wrapBaseTemplate({
    headline: 'Bank Transfer Settled Successfully',
    badgeText: 'Settled & Verified',
    badgeColor: '#16a34a',
    contentHtml: adminContent,
  });

  const text = `[WSNexa] Subscription Activated — Payment Verified

Plan: ${data.planCode.toUpperCase()}
Amount: LKR ${data.amountLkr}
Active Through: ${formattedPeriodEnd}
Statement Ref: ${data.externalBankStatementRef}

WSNexa (https://wsnexa.app)`;

  return { customerSubject, adminSubject, customerHtml, adminHtml, text };
}

// -------------------------------------------------------------
// 6. Bank Transfer Rejected
// -------------------------------------------------------------

export function renderBankTransferRejectedEmail(data: BankTransferRejectedData): {
  customerSubject: string;
  adminSubject: string;
  customerHtml: string;
  adminHtml: string;
  text: string;
} {
  const customerSubject = `[WSNexa] Payment Verification Notice ⚠️`;
  const adminSubject = `[WSNexa Admin] Bank Transfer Rejected — ${data.paymentId}`;

  const customerContent = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      Your submitted bank transfer proof${data.businessName ? ` for <strong>${escapeHtml(data.businessName)}</strong>` : ''} could not be verified by our billing desk for the following reason:
    </p>

    <div style="padding:16px;background-color:#fef2f2;border-radius:10px;border:1px solid #fee2e2;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#991b1b;">${escapeHtml(data.rejectionReason)}</p>
    </div>

    <p style="margin:0 0 20px 0;font-size:13px;color:#52525b;line-height:1.6;">
      Please double-check your bank transfer slip, ensure the transaction reference and transferred amount match your invoice, and upload a valid receipt.
    </p>

    <div style="text-align:center;">
      <a href="https://wsnexa.app/dashboard/settings/subscription" style="display:inline-block;padding:12px 24px;background-color:#09090b;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;">
        Re-upload Payment Proof &rarr;
      </a>
    </div>
  `;

  const customerHtml = wrapBaseTemplate({
    headline: 'Bank Transfer Verification Notice',
    badgeText: 'Action Required',
    badgeColor: '#dc2626',
    contentHtml: customerContent,
  });

  const adminContent = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      A bank transfer payment proof was rejected.
    </p>
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;">Payment ID</td>
        <td style="font-family:monospace;">${escapeHtml(data.paymentId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Business</td>
        <td>${escapeHtml(data.businessName || data.businessId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Reason</td>
        <td style="color:#b91c1c;font-weight:600;">${escapeHtml(data.rejectionReason)}</td>
      </tr>
    </table>
  `;

  const adminHtml = wrapBaseTemplate({
    headline: 'Bank Transfer Proof Rejected',
    badgeText: 'Rejected',
    badgeColor: '#dc2626',
    contentHtml: adminContent,
  });

  const text = `[WSNexa] Payment Verification Notice

Your bank transfer proof could not be verified:
${data.rejectionReason}

Please visit https://wsnexa.app/dashboard/settings/subscription to submit a valid slip or contact wsnexaofficial@gmail.com.`;

  return { customerSubject, adminSubject, customerHtml, adminHtml, text };
}

// -------------------------------------------------------------
// 7. General Subscription & Lifecycle Events
// -------------------------------------------------------------

export function renderSubscriptionActivatedEmail(data: SubscriptionActivatedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa] Subscription Activated — ${data.planCode.toUpperCase()}`;
  const formattedEnd = new Date(data.periodEndsAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      Subscription activated successfully for <strong>${escapeHtml(data.businessName || data.businessId)}</strong>.
    </p>
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;font-weight:600;">Plan</td>
        <td style="font-weight:800;color:#d97706;text-transform:uppercase;">${escapeHtml(data.planCode)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Valid Until</td>
        <td style="font-weight:700;color:#16a34a;">${escapeHtml(formattedEnd)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;font-weight:600;">Activation Source</td>
        <td style="color:#71717a;">${escapeHtml(data.activationSource)}</td>
      </tr>
    </table>
  `;

  const html = wrapBaseTemplate({
    headline: 'Subscription Activated',
    badgeText: 'Active',
    badgeColor: '#16a34a',
    contentHtml,
  });

  const text = `[WSNexa] Subscription Activated — ${data.planCode.toUpperCase()}

Business: ${data.businessName || data.businessId}
Plan: ${data.planCode.toUpperCase()}
Valid Until: ${formattedEnd}
Source: ${data.activationSource}`;

  return { subject, html, text };
}

export function renderSubscriptionCancelledEmail(data: SubscriptionCancelledData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa] Subscription Cancelled — ${data.businessName || data.businessId}`;

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      Subscription cancellation recorded for <strong>${escapeHtml(data.businessName || data.businessId)}</strong> (${escapeHtml(data.planCode.toUpperCase())}).
    </p>
    ${data.reason ? `<p style="font-size:13px;color:#71717a;">Reason: ${escapeHtml(data.reason)}</p>` : ''}
  `;

  const html = wrapBaseTemplate({
    headline: 'Subscription Cancelled',
    badgeText: 'Cancelled',
    badgeColor: '#71717a',
    contentHtml,
  });

  const text = `[WSNexa] Subscription Cancelled — ${data.businessName || data.businessId}
Plan: ${data.planCode.toUpperCase()}
Reason: ${data.reason || 'Not specified'}`;

  return { subject, html, text };
}

export function renderSubscriptionPaymentFailedEmail(data: SubscriptionPaymentFailedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa Alert] Subscription Payment Failed — LKR ${data.amountLkr.toLocaleString()}`;

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      A subscription payment attempt failed for <strong>${escapeHtml(data.businessName || data.businessId)}</strong>.
    </p>
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;">Payment ID</td>
        <td style="font-family:monospace;">${escapeHtml(data.paymentId)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Amount</td>
        <td style="font-weight:700;">LKR ${data.amountLkr.toLocaleString()}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Provider</td>
        <td>${escapeHtml(data.provider)}</td>
      </tr>
      ${data.failureMessage ? `
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Error Details</td>
        <td style="color:#b91c1c;">${escapeHtml(data.failureMessage)} (${escapeHtml(data.failureCode || 'UNKNOWN')})</td>
      </tr>` : ''}
    </table>
  `;

  const html = wrapBaseTemplate({
    headline: 'Payment Failed',
    badgeText: 'Failed',
    badgeColor: '#dc2626',
    contentHtml,
  });

  const text = `[WSNexa Alert] Subscription Payment Failed
Business: ${data.businessName || data.businessId}
Amount: LKR ${data.amountLkr}
Error: ${data.failureMessage || data.failureCode || 'Payment rejected'}`;

  return { subject, html, text };
}

export function renderSecurityAlertEmail(data: SecurityAlertData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[WSNexa Security Alert] ${data.title} [${data.severity.toUpperCase()}]`;

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#27272a;line-height:1.6;">
      ${escapeHtml(data.message)}
    </p>
    <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;font-size:13px;">
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td width="35%" style="color:#71717a;">Alert Type</td>
        <td style="font-family:monospace;font-weight:700;">${escapeHtml(data.alertType)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Severity</td>
        <td style="font-weight:800;text-transform:uppercase;">${escapeHtml(data.severity)}</td>
      </tr>
      ${data.targetResource ? `
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Resource</td>
        <td>${escapeHtml(data.targetResource)}</td>
      </tr>` : ''}
      <tr style="border-bottom:1px solid #f4f4f5;">
        <td style="color:#71717a;">Timestamp</td>
        <td>${escapeHtml(new Date(data.timestamp).toUTCString())}</td>
      </tr>
    </table>
  `;

  const html = wrapBaseTemplate({
    headline: data.title,
    badgeText: `Security: ${data.severity}`,
    badgeColor: data.severity === 'critical' ? '#dc2626' : '#d97706',
    contentHtml,
  });

  const text = `[WSNexa Security Alert] ${data.title}
Severity: ${data.severity.toUpperCase()}
Message: ${data.message}
Timestamp: ${new Date(data.timestamp).toUTCString()}`;

  return { subject, html, text };
}
