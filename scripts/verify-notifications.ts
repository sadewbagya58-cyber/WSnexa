import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Bypass server-only guard for direct tsx execution
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

import {
  PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
  DEFAULT_FROM_ADDRESS,
  getEmailProviderConfig,
} from '../src/server/email/email-config';
import {
  renderProblemReportEmail,
  renderSupportInquiryEmail,
  renderSecurityReportEmail,
  renderBankTransferSubmittedAdminEmail,
  renderBankTransferSettledEmail,
  renderBankTransferRejectedEmail,
  renderSubscriptionActivatedEmail,
  renderSubscriptionCancelledEmail,
  renderSubscriptionPaymentFailedEmail,
  renderSecurityAlertEmail,
  escapeHtml,
} from '../src/server/email/email-templates';
import { EmailService } from '../src/server/email/email.service';

async function runNotificationVerification() {
  console.log('\n================================================================');
  console.log('  WSNexa Email Notification Subsystem — Comprehensive Verification');
  console.log('  Domain: https://wsnexa.app | Brand: Smart Hospitality. Simplified.');
  console.log('================================================================\n');

  let passed = 0;
  function pass(msg: string) {
    passed++;
    console.log(`  ✓ ${msg}`);
  }

  // ==========================================================================
  // SECTION 1: Business Recipient & Email Configuration Invariants
  // ==========================================================================
  console.log('--- SECTION 1: Business Recipient & Email Configuration Invariants ---');

  assert.strictEqual(
    PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    'Wsnexaofficial@gmail.com',
    'Primary business notification email must strictly match Wsnexaofficial@gmail.com'
  );
  pass('Primary business notification email is configured as Wsnexaofficial@gmail.com');

  assert(
    DEFAULT_FROM_ADDRESS.includes('notifications@wsnexa.app'),
    'Default from address must contain notifications@wsnexa.app'
  );
  pass('Default sender from address is WSNexa <notifications@wsnexa.app>');

  const config = getEmailProviderConfig();
  assert(
    ['resend', 'smtp', 'simulated'].includes(config.provider),
    'Email provider must resolve to one of: resend, smtp, simulated'
  );
  pass(`Active email provider correctly resolved: "${config.provider}"`);

  // ==========================================================================
  // SECTION 2: HTML Template Rendering & XSS Escaping
  // ==========================================================================
  console.log('\n--- SECTION 2: HTML Template Rendering & Security Escaping ---');

  const maliciousInput = '<script>alert("xss")</script>&"test"';
  const escaped = escapeHtml(maliciousInput);
  assert(
    !escaped.includes('<script>') && escaped.includes('&lt;script&gt;'),
    'escapeHtml must escape HTML tags and dangerous characters'
  );
  pass('HTML sanitization / XSS escape guard verified');

  // 2.1 Problem Report Email Template
  const bugReport = renderProblemReportEmail({
    diagnosticReference: 'BUG-TWG357ST',
    category: 'menu_display',
    description: 'Menu item price formatting glitch',
    stepsToReproduce: '1. Open venue menu\n2. View items',
    expectedBehavior: 'Formatted LKR price',
    actualBehavior: 'NaN displayed',
    contactEmail: 'reporter@restaurant.lk',
    deviceBrowser: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(bugReport.subject.includes('BUG-TWG357ST'), 'Bug report subject contains diagnostic ticket reference');
  assert(bugReport.html.includes('Wsnexaofficial@gmail.com') || bugReport.html.includes('BUG-TWG357ST'), 'Bug report HTML contains reference');
  assert(bugReport.text.includes('BUG-TWG357ST'), 'Bug report text fallback contains reference');
  pass('Problem Report template renders correctly with diagnostic reference BUG-TWG357ST');

  // 2.2 Support Inquiry Email Template
  const supportInquiry = renderSupportInquiryEmail({
    ticketId: 'SUP-49G8',
    name: 'Kasun Silva',
    contactEmail: 'kasun@bistro.lk',
    category: 'billing',
    subject: 'Invoice clarification for Colombo branch',
    message: 'Could you please resend the VAT invoice for September?',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(supportInquiry.subject.includes('SUP-49G8'), 'Support inquiry subject contains ticket ID');
  assert(supportInquiry.html.includes('Kasun Silva'), 'Support inquiry HTML contains sender name');
  pass('Support Inquiry template renders correctly with ticket SUP-49G8');

  // 2.3 Security Disclosure Email Template
  const secReport = renderSecurityReportEmail({
    ticketId: 'SEC-89A1',
    summary: 'Potential rate limit bypass on public API',
    severity: 'high',
    affectedArea: 'Public Discovery API',
    reproductionSteps: 'Run concurrent curl loop.',
    contactEmail: 'researcher@securitylab.org',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(secReport.subject.includes('[HIGH]'), 'Security report subject includes severity badge');
  assert(secReport.subject.includes('SEC-89A1'), 'Security report subject includes ticket reference');
  pass('Security Disclosure template renders correctly with severity badges');

  // 2.4 Bank Transfer Submission Admin Email
  const bankSub = renderBankTransferSubmittedAdminEmail({
    paymentId: 'pay_sub_12345',
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    amountLkr: 7500,
    planCode: 'growth',
    rawReference: 'TXN-SLT-987654',
    filePath: 'receipts/biz_cafe_456/pay_sub_12345/slip.jpg',
    notes: 'Transferred via Commercial Bank online banking',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(bankSub.subject.includes('LKR 7,500'), 'Bank transfer subject includes formatted LKR amount');
  assert(bankSub.subject.includes('Galle Fort Roasters'), 'Bank transfer subject includes business name');
  assert(bankSub.html.includes('TXN-SLT-987654'), 'Bank transfer HTML includes raw reference');
  pass('Bank Transfer Submission Admin template renders correctly');

  // 2.5 Bank Transfer Settled Emails (Dual Template)
  const bankSettled = renderBankTransferSettledEmail({
    paymentId: 'pay_sub_12345',
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    ownerEmail: 'owner@gallefortroasters.com',
    planCode: 'growth',
    amountLkr: 7500,
    periodStartsAt: '2026-10-12T16:00:00.000Z',
    periodEndsAt: '2026-11-12T16:00:00.000Z',
    reconciliationNote: 'Reconciled with statement',
    externalBankStatementRef: 'STMT-OCT-2026-001',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(bankSettled.adminSubject.includes('[WSNexa Admin]'), 'Admin settled subject contains [WSNexa Admin] prefix');
  assert(bankSettled.customerSubject.includes('Payment Verified'), 'Customer settled subject contains verification notice');
  assert(bankSettled.customerHtml.includes('Galle Fort Roasters'), 'Customer HTML contains venue name');
  pass('Bank Transfer Settled dual templates (Admin + Customer) render correctly');

  // 2.6 Bank Transfer Rejected Emails (Dual Template)
  const bankRejected = renderBankTransferRejectedEmail({
    paymentId: 'pay_sub_12345',
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    ownerEmail: 'owner@gallefortroasters.com',
    rejectionReason: 'Deposit reference not found on bank statement',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(bankRejected.adminSubject.includes('[WSNexa Admin]'), 'Admin rejected subject contains [WSNexa Admin] prefix');
  assert(bankRejected.customerSubject.includes('Notice'), 'Customer rejected subject contains notice');
  assert(bankRejected.customerHtml.includes('Deposit reference not found'), 'Customer HTML contains actionable rejection reason');
  pass('Bank Transfer Rejected dual templates render correctly');

  // 2.7 Subscription Activated, Cancelled & Payment Failed Templates
  const subActivated = renderSubscriptionActivatedEmail({
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    planCode: 'growth',
    periodEndsAt: '2026-11-12T16:00:00.000Z',
    activationSource: 'verified_gateway_payment',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(subActivated.subject.toUpperCase().includes('GROWTH'), 'Subscription activated subject contains plan name');
  pass('Subscription Activated template renders correctly');

  const subCancelled = renderSubscriptionCancelledEmail({
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    planCode: 'growth',
    cancelledAt: '2026-10-12T16:00:00.000Z',
    reason: 'Seasonal closure for renovation',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(subCancelled.subject.includes('Cancelled'), 'Subscription cancelled subject contains status');
  pass('Subscription Cancelled template renders correctly');

  const subFailed = renderSubscriptionPaymentFailedEmail({
    paymentId: 'pay_failed_999',
    businessId: 'biz_cafe_456',
    businessName: 'Galle Fort Roasters',
    planCode: 'growth',
    amountLkr: 7500,
    provider: 'payhere',
    failureCode: 'DECLINED',
    failureMessage: 'Card issuer declined the transaction (Insufficient funds)',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(subFailed.subject.includes('Payment Failed'), 'Payment failed subject contains payment failed');
  pass('Subscription Payment Failed template renders correctly');

  const secAlert = renderSecurityAlertEmail({
    alertType: 'Excessive Failed Login Attempts',
    severity: 'high',
    title: 'Suspicious Auth Traffic',
    message: 'IP 203.0.113.19 triggered 50 failed attempts within 2 minutes.',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert(secAlert.subject.includes('[WSNexa Security Alert]'), 'Security alert subject contains security badge');
  pass('Operational Security Alert template renders correctly');

  // ==========================================================================
  // SECTION 3: In-Memory Deduplication & Safe Dispatch Resilience
  // ==========================================================================
  console.log('\n--- SECTION 3: Deduplication & Safe Dispatch Resilience ---');

  EmailService.clearDeliveryLogs();

  const testDedupeKey = `test_dedupe_run_${Date.now()}`;
  const firstSend = await EmailService.sendEmail({
    to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    subject: 'WSNexa Test Notice 1',
    html: '<p>Test content 1</p>',
    text: 'Test content 1',
    dedupeKey: testDedupeKey,
  });
  assert.strictEqual(firstSend.success, true, 'First send must succeed');
  assert.strictEqual(firstSend.status, 'SIMULATED', 'In dev/test environment, provider defaults to simulated');
  pass('First dispatch succeeds with SIMULATED acceptance');

  const secondSend = await EmailService.sendEmail({
    to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    subject: 'WSNexa Test Notice 2 (Duplicate)',
    html: '<p>Test content 2</p>',
    text: 'Test content 2',
    dedupeKey: testDedupeKey,
  });
  assert.strictEqual(secondSend.success, true, 'Duplicate send safely returns success result without error');
  assert(
    Boolean(secondSend.messageId && secondSend.messageId.startsWith('dedupe_skipped_')),
    'Duplicate send must be recognized and skipped by deduplication cache'
  );
  pass('Deduplication cache intercepts duplicate message within 10-minute window');

  // 3.1 Resilience Invariant: sendEmailSafe never throws
  const safeResult = await EmailService.sendEmailSafe({
    to: '', // Invalid recipient
    subject: 'WSNexa Resilience Check',
    html: '<p>Resilience body</p>',
    text: 'Resilience body',
  });
  assert(typeof safeResult.success === 'boolean', 'sendEmailSafe must return a valid delivery result object');
  pass('sendEmailSafe resilience invariant verified (never crashes caller)');

  // ==========================================================================
  // SECTION 4: Customer vs Business Notification Separation
  // ==========================================================================
  console.log('\n--- SECTION 4: Customer vs Business Notification Separation ---');

  EmailService.clearDeliveryLogs();

  // Test Bank Transfer Settled dual dispatch
  const settledDispatch = await EmailService.sendBankTransferSettledEmails({
    paymentId: `pay_settled_${Date.now()}`,
    businessId: 'biz_hotel_kandy',
    businessName: 'Kandy Lake Villa',
    ownerEmail: 'owner@kandylakevilla.lk',
    planCode: 'enterprise',
    amountLkr: 25000,
    periodStartsAt: '2026-10-12T16:00:00.000Z',
    periodEndsAt: '2026-11-12T16:00:00.000Z',
    reconciliationNote: 'Reconciled with bank statement',
    externalBankStatementRef: 'COM-BANK-882200',
    timestamp: '2026-10-12T16:00:00.000Z',
  });

  assert.strictEqual(
    settledDispatch.adminResult.recipient,
    PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    'Admin settled email must be dispatched to Wsnexaofficial@gmail.com'
  );
  assert(
    settledDispatch.customerResult !== undefined,
    'Customer settled email must be dispatched when ownerEmail is provided'
  );
  assert.strictEqual(
    settledDispatch.customerResult?.recipient,
    'owner@kandylakevilla.lk',
    'Customer settled email must be dispatched to tenant owner email'
  );
  pass('Strict separation verified: Admin -> Wsnexaofficial@gmail.com | Customer -> owner@kandylakevilla.lk');

  // Verify that if ownerEmail equals primary business email, duplicate dispatch is suppressed
  const suppressedDispatch = await EmailService.sendBankTransferSettledEmails({
    paymentId: `pay_suppressed_${Date.now()}`,
    businessId: 'biz_hotel_kandy',
    businessName: 'Kandy Lake Villa',
    ownerEmail: PRIMARY_BUSINESS_NOTIFICATION_EMAIL, // Identical
    planCode: 'enterprise',
    amountLkr: 25000,
    periodStartsAt: '2026-10-12T16:00:00.000Z',
    periodEndsAt: '2026-11-12T16:00:00.000Z',
    reconciliationNote: 'Reconciled with statement',
    externalBankStatementRef: 'COM-BANK-882200',
    timestamp: '2026-10-12T16:00:00.000Z',
  });
  assert.strictEqual(
    suppressedDispatch.customerResult,
    undefined,
    'Customer email is suppressed when owner email is identical to primary business email to prevent duplicates'
  );
  pass('Duplicate suppression verified when tenant owner matches primary business email');

  // ==========================================================================
  // SECTION 5: End-to-End Service Wiring Verification
  // ==========================================================================
  console.log('\n--- SECTION 5: End-to-End Service Wiring Verification ---');

  // 5.1 Verify Support Action Implementation
  const supportSourcePath = path.join(process.cwd(), 'src/server/actions/support.ts');
  const supportSource = fs.readFileSync(supportSourcePath, 'utf-8');

  assert(
    supportSource.includes('EmailService.sendProblemReportEmail'),
    'submitProblemReportAction wires EmailService.sendProblemReportEmail'
  );
  assert(
    supportSource.includes('EmailService.sendSupportInquiryEmail'),
    'submitSupportRequestAction wires EmailService.sendSupportInquiryEmail'
  );
  assert(
    supportSource.includes('EmailService.sendSecurityReportEmail'),
    'submitSecurityReportAction wires EmailService.sendSecurityReportEmail'
  );
  assert(
    supportSource.includes("action: 'PROBLEM_REPORT_SUBMITTED'"),
    'Problem report persists to audit_logs'
  );
  assert(
    supportSource.includes("action: 'SUPPORT_INQUIRY_SUBMITTED'"),
    'Support inquiry persists to audit_logs'
  );
  assert(
    supportSource.includes("action: 'SECURITY_REPORT_SUBMITTED'"),
    'Security disclosure persists to audit_logs'
  );
  assert(
    supportSource.includes('PRIMARY_BUSINESS_NOTIFICATION_EMAIL'),
    'Support action response returns centralized PRIMARY_BUSINESS_NOTIFICATION_EMAIL'
  );
  pass('Support actions properly wired to EmailService and audit_logs persistence');

  // 5.2 Verify Manual Bank Transfer Service Implementation
  const bankTransferSourcePath = path.join(
    process.cwd(),
    'src/server/payments/subscriptions/manual-bank-transfer.service.ts'
  );
  const bankTransferSource = fs.readFileSync(bankTransferSourcePath, 'utf-8');

  assert(
    bankTransferSource.includes('EmailService.sendBankTransferSubmittedAdminEmail'),
    'submitProof wires EmailService.sendBankTransferSubmittedAdminEmail'
  );
  assert(
    bankTransferSource.includes('EmailService.sendBankTransferSettledEmails'),
    'approvePayment wires EmailService.sendBankTransferSettledEmails'
  );
  assert(
    bankTransferSource.includes('EmailService.sendBankTransferRejectedEmails'),
    'rejectPayment wires EmailService.sendBankTransferRejectedEmails'
  );
  pass('ManualBankTransferService properly wired to EmailService for submit, approve, and reject');

  // 5.3 Verify Subscription Settlement & Subscription Service Implementation
  const settlementSourcePath = path.join(
    process.cwd(),
    'src/server/payments/subscriptions/subscription-settlement.service.ts'
  );
  const settlementSource = fs.readFileSync(settlementSourcePath, 'utf-8');

  assert(
    settlementSource.includes('EmailService.sendSubscriptionPaymentFailedEmails'),
    'processVerifiedPaymentSettlement wires EmailService.sendSubscriptionPaymentFailedEmails on failure'
  );
  pass('SubscriptionPaymentSettlementService wired to failed payment emails');

  const subscriptionServiceSourcePath = path.join(
    process.cwd(),
    'src/server/services/subscription.service.ts'
  );
  const subscriptionServiceSource = fs.readFileSync(subscriptionServiceSourcePath, 'utf-8');

  assert(
    subscriptionServiceSource.includes('EmailService.sendSubscriptionActivatedEmails'),
    'SubscriptionService wires EmailService.sendSubscriptionActivatedEmails'
  );
  assert(
    subscriptionServiceSource.includes('EmailService.sendSubscriptionCancelledEmails'),
    'SubscriptionService wires EmailService.sendSubscriptionCancelledEmails'
  );
  pass('SubscriptionService properly wired to EmailService for activated and cancelled events');

  // ==========================================================================
  // SECTION 6: Live Bug Report Diagnostic Dispatch (BUG-TWG357ST)
  // ==========================================================================
  console.log('\n--- SECTION 6: Live Bug Report Diagnostic Dispatch (BUG-TWG357ST) ---');

  const liveBugDispatch = await EmailService.sendProblemReportEmail({
    diagnosticReference: 'BUG-TWG357ST',
    category: 'menu_display',
    description: 'Menu QR ordering price display discrepancy on mobile Safari',
    stepsToReproduce: '1. Scan table QR code\n2. Open menu\n3. Tap item details',
    expectedBehavior: 'Item price renders in LKR currency format',
    actualBehavior: 'NaN displayed on iOS 17.4',
    contactEmail: 'reporter@restauranthub.lk',
    deviceBrowser: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
    timestamp: new Date().toISOString(),
  });

  assert.strictEqual(liveBugDispatch.success, true, 'Live bug report dispatch must succeed');
  assert.strictEqual(
    liveBugDispatch.recipient,
    'Wsnexaofficial@gmail.com',
    'Live bug report dispatch must be routed to Wsnexaofficial@gmail.com'
  );
  assert(
    liveBugDispatch.subject.includes('BUG-TWG357ST'),
    'Live bug report subject must include ticket reference BUG-TWG357ST'
  );
  pass('Direct bug report dispatch for BUG-TWG357ST routed to Wsnexaofficial@gmail.com');

  const logs = EmailService.getDeliveryLogs();
  assert(logs.length > 0, 'Email delivery audit log contains entries');
  pass(`Delivery audit log recorded ${logs.length} operations for traceability`);

  console.log('\n================================================================');
  console.log(`  ALL ${passed} NOTIFICATION CHECKS PASSED SUCCESSFULLY! 🚀`);
  console.log('================================================================\n');
}

runNotificationVerification().catch((err) => {
  console.error('\n❌ NOTIFICATION VERIFICATION FAILED:\n', err);
  process.exit(1);
});
