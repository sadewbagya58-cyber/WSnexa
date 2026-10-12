import {
  EmailMessage,
  EmailDeliveryResult,
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
import {
  PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
  DEFAULT_FROM_ADDRESS,
  getEmailProviderConfig,
} from './email-config';
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
} from './email-templates';

// In-memory deduplication cache: key -> expiration timestamp
const dedupeCache = new Map<string, number>();

// In-memory delivery log for auditability & testing (max 100 entries)
const deliveryLog: EmailDeliveryResult[] = [];

export class EmailService {
  /**
   * Clears delivery logs and deduplication cache (primarily for test fixtures).
   */
  static clearDeliveryLogs(): void {
    deliveryLog.length = 0;
    dedupeCache.clear();
  }

  /**
   * Retrieves recent delivery logs for operational auditing.
   */
  static getDeliveryLogs(): EmailDeliveryResult[] {
    return [...deliveryLog];
  }

  /**
   * Sends an email through the active provider (Resend, SMTP, or Simulated).
   * Enforces server-level deduplication to prevent duplicate emails.
   */
  static async sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
    const timestamp = new Date().toISOString();
    const recipientStr = Array.isArray(message.to) ? message.to.join(', ') : message.to;

    // Deduplication check
    if (message.dedupeKey) {
      const now = Date.now();
      const cachedExpiry = dedupeCache.get(message.dedupeKey);
      if (cachedExpiry && cachedExpiry > now) {
        console.info(`[EMAIL_DEDUPE_SKIPPED] DedupeKey: ${message.dedupeKey} | Recipient: ${recipientStr}`);
        const skippedResult: EmailDeliveryResult = {
          success: true,
          provider: 'simulated',
          status: 'ACCEPTED',
          messageId: `dedupe_skipped_${message.dedupeKey}`,
          recipient: recipientStr,
          subject: message.subject,
          timestamp,
        };
        return skippedResult;
      }
      // Cache dedupeKey for 10 minutes
      dedupeCache.set(message.dedupeKey, now + 10 * 60 * 1000);
    }

    const config = getEmailProviderConfig();

    // 1. Resend Provider (Direct HTTP API, 0 extra dependencies)
    if (config.provider === 'resend' && config.resendApiKey) {
      try {
        const payload = {
          from: message.from || DEFAULT_FROM_ADDRESS,
          to: Array.isArray(message.to) ? message.to : [message.to],
          reply_to: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
        };

        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg = data.message || `Resend HTTP ${res.status}: ${res.statusText}`;
          console.error(`[EMAIL_PROVIDER_FAILED] Provider: resend | To: ${recipientStr} | Error: ${errMsg}`);
          const failResult: EmailDeliveryResult = {
            success: false,
            provider: 'resend',
            status: 'FAILED',
            recipient: recipientStr,
            subject: message.subject,
            error: errMsg,
            timestamp,
          };
          this.recordLog(failResult);
          return failResult;
        }

        console.info(`[EMAIL_PROVIDER_ACCEPTED] Provider: resend | ID: ${data.id} | To: ${recipientStr}`);
        const successResult: EmailDeliveryResult = {
          success: true,
          provider: 'resend',
          status: 'ACCEPTED',
          messageId: data.id,
          recipient: recipientStr,
          subject: message.subject,
          timestamp,
        };
        this.recordLog(successResult);
        return successResult;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Resend request failed';
        console.error(`[EMAIL_DISPATCH_EXCEPTION] Provider: resend | To: ${recipientStr} | Error: ${errMsg}`);
        const failResult: EmailDeliveryResult = {
          success: false,
          provider: 'resend',
          status: 'FAILED',
          recipient: recipientStr,
          subject: message.subject,
          error: errMsg,
          timestamp,
        };
        this.recordLog(failResult);
        return failResult;
      }
    }

    // 2. Simulated Mode (Pre-commercial / Test / Dev fallback)
    const simulatedId = `sim_msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    console.info(`[EMAIL_DELIVERY_SIMULATED] Provider: simulated | ID: ${simulatedId} | To: ${recipientStr} | Subject: "${message.subject}"`);

    const simulatedResult: EmailDeliveryResult = {
      success: true,
      provider: 'simulated',
      status: 'SIMULATED',
      messageId: simulatedId,
      recipient: recipientStr,
      subject: message.subject,
      timestamp,
    };
    this.recordLog(simulatedResult);
    return simulatedResult;
  }

  /**
   * Safe wrapper that never throws. Ensures email errors do not crash callers
   * (e.g. payment processing, order flow, or ticket submission).
   */
  static async sendEmailSafe(message: EmailMessage): Promise<EmailDeliveryResult> {
    try {
      return await this.sendEmail(message);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown email dispatch error';
      console.warn(`[EMAIL_SAFE_CATCH] Non-fatal dispatch error: ${errMsg}`);
      return {
        success: false,
        provider: 'simulated',
        status: 'FAILED',
        recipient: Array.isArray(message.to) ? message.to.join(', ') : message.to,
        subject: message.subject,
        error: errMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private static recordLog(res: EmailDeliveryResult): void {
    if (deliveryLog.length >= 100) {
      deliveryLog.shift();
    }
    deliveryLog.push(res);
  }

  // =============================================================
  // Domain Notification Dispatch Methods
  // =============================================================

  /**
   * Dispatches Problem Report email to the primary business notification recipient.
   */
  static async sendProblemReportEmail(data: ProblemReportEmailData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderProblemReportEmail(data);
    return this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      replyTo: data.contactEmail,
      subject,
      html,
      text,
      dedupeKey: `bug_report:${data.diagnosticReference}`,
      metadata: {
        category: data.category,
        diagnosticReference: data.diagnosticReference,
      },
    });
  }

  /**
   * Dispatches Support Inquiry email to the primary business notification recipient.
   */
  static async sendSupportInquiryEmail(data: SupportInquiryEmailData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderSupportInquiryEmail(data);
    return this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      replyTo: data.contactEmail,
      subject,
      html,
      text,
      dedupeKey: `support_ticket:${data.ticketId}`,
      metadata: {
        category: data.category,
        ticketId: data.ticketId,
      },
    });
  }

  /**
   * Dispatches Security Disclosure email to the primary business notification recipient.
   */
  static async sendSecurityReportEmail(data: SecurityReportEmailData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderSecurityReportEmail(data);
    return this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      replyTo: data.contactEmail,
      subject,
      html,
      text,
      dedupeKey: `security_report:${data.ticketId}`,
      metadata: {
        severity: data.severity,
        ticketId: data.ticketId,
      },
    });
  }

  /**
   * Dispatches Bank Transfer Submission notification to the business notification recipient.
   */
  static async sendBankTransferSubmittedAdminEmail(
    data: BankTransferSubmittedAdminData
  ): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderBankTransferSubmittedAdminEmail(data);
    return this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject,
      html,
      text,
      dedupeKey: `bank_transfer_submitted:${data.paymentId}`,
      metadata: {
        paymentId: data.paymentId,
        businessId: data.businessId,
        amountLkr: data.amountLkr,
      },
    });
  }

  /**
   * Dispatches Bank Transfer Settled notifications (Customer Receipt + Admin Confirmation).
   */
  static async sendBankTransferSettledEmails(
    data: BankTransferSettledData
  ): Promise<{ adminResult: EmailDeliveryResult; customerResult?: EmailDeliveryResult }> {
    const { customerSubject, adminSubject, customerHtml, adminHtml, text } =
      renderBankTransferSettledEmail(data);

    // 1. Admin confirmation to business desk
    const adminResult = await this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject: adminSubject,
      html: adminHtml,
      text,
      dedupeKey: `bank_transfer_settled_admin:${data.paymentId}`,
      metadata: { paymentId: data.paymentId, businessId: data.businessId },
    });

    // 2. Customer notification to tenant owner (if owner email provided)
    let customerResult: EmailDeliveryResult | undefined;
    if (data.ownerEmail && data.ownerEmail.toLowerCase() !== PRIMARY_BUSINESS_NOTIFICATION_EMAIL.toLowerCase()) {
      customerResult = await this.sendEmailSafe({
        to: data.ownerEmail,
        subject: customerSubject,
        html: customerHtml,
        text,
        dedupeKey: `bank_transfer_settled_customer:${data.paymentId}`,
        metadata: { paymentId: data.paymentId, businessId: data.businessId },
      });
    }

    return { adminResult, customerResult };
  }

  /**
   * Dispatches Bank Transfer Rejected notifications (Customer Notice + Admin Record).
   */
  static async sendBankTransferRejectedEmails(
    data: BankTransferRejectedData
  ): Promise<{ adminResult: EmailDeliveryResult; customerResult?: EmailDeliveryResult }> {
    const { customerSubject, adminSubject, customerHtml, adminHtml, text } =
      renderBankTransferRejectedEmail(data);

    // 1. Admin record to business desk
    const adminResult = await this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject: adminSubject,
      html: adminHtml,
      text,
      dedupeKey: `bank_transfer_rejected_admin:${data.paymentId}`,
      metadata: { paymentId: data.paymentId, reason: data.rejectionReason },
    });

    // 2. Customer notification to tenant owner (if owner email provided)
    let customerResult: EmailDeliveryResult | undefined;
    if (data.ownerEmail && data.ownerEmail.toLowerCase() !== PRIMARY_BUSINESS_NOTIFICATION_EMAIL.toLowerCase()) {
      customerResult = await this.sendEmailSafe({
        to: data.ownerEmail,
        subject: customerSubject,
        html: customerHtml,
        text,
        dedupeKey: `bank_transfer_rejected_customer:${data.paymentId}`,
        metadata: { paymentId: data.paymentId, reason: data.rejectionReason },
      });
    }

    return { adminResult, customerResult };
  }

  /**
   * Dispatches Subscription Activated notification.
   */
  static async sendSubscriptionActivatedEmails(
    data: SubscriptionActivatedData
  ): Promise<{ adminResult: EmailDeliveryResult; customerResult?: EmailDeliveryResult }> {
    const { subject, html, text } = renderSubscriptionActivatedEmail(data);

    const adminResult = await this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject: `[WSNexa Admin] ${subject}`,
      html,
      text,
      dedupeKey: `sub_activated_admin:${data.businessId}:${data.planCode}`,
      metadata: { businessId: data.businessId, planCode: data.planCode },
    });

    let customerResult: EmailDeliveryResult | undefined;
    if (data.ownerEmail && data.ownerEmail.toLowerCase() !== PRIMARY_BUSINESS_NOTIFICATION_EMAIL.toLowerCase()) {
      customerResult = await this.sendEmailSafe({
        to: data.ownerEmail,
        subject,
        html,
        text,
        dedupeKey: `sub_activated_customer:${data.businessId}:${data.planCode}`,
        metadata: { businessId: data.businessId, planCode: data.planCode },
      });
    }

    return { adminResult, customerResult };
  }

  /**
   * Dispatches Subscription Cancelled notification.
   */
  static async sendSubscriptionCancelledEmails(
    data: SubscriptionCancelledData
  ): Promise<{ adminResult: EmailDeliveryResult; customerResult?: EmailDeliveryResult }> {
    const { subject, html, text } = renderSubscriptionCancelledEmail(data);

    const adminResult = await this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject: `[WSNexa Admin] ${subject}`,
      html,
      text,
      dedupeKey: `sub_cancelled_admin:${data.businessId}`,
      metadata: { businessId: data.businessId },
    });

    let customerResult: EmailDeliveryResult | undefined;
    if (data.ownerEmail && data.ownerEmail.toLowerCase() !== PRIMARY_BUSINESS_NOTIFICATION_EMAIL.toLowerCase()) {
      customerResult = await this.sendEmailSafe({
        to: data.ownerEmail,
        subject,
        html,
        text,
        dedupeKey: `sub_cancelled_customer:${data.businessId}`,
        metadata: { businessId: data.businessId },
      });
    }

    return { adminResult, customerResult };
  }

  /**
   * Dispatches Subscription Payment Failed notification.
   */
  static async sendSubscriptionPaymentFailedEmails(
    data: SubscriptionPaymentFailedData
  ): Promise<{ adminResult: EmailDeliveryResult; customerResult?: EmailDeliveryResult }> {
    const { subject, html, text } = renderSubscriptionPaymentFailedEmail(data);

    const adminResult = await this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject,
      html,
      text,
      dedupeKey: `sub_pay_failed_admin:${data.paymentId}`,
      metadata: { paymentId: data.paymentId, businessId: data.businessId },
    });

    let customerResult: EmailDeliveryResult | undefined;
    if (data.ownerEmail && data.ownerEmail.toLowerCase() !== PRIMARY_BUSINESS_NOTIFICATION_EMAIL.toLowerCase()) {
      customerResult = await this.sendEmailSafe({
        to: data.ownerEmail,
        subject,
        html,
        text,
        dedupeKey: `sub_pay_failed_customer:${data.paymentId}`,
        metadata: { paymentId: data.paymentId, businessId: data.businessId },
      });
    }

    return { adminResult, customerResult };
  }

  /**
   * Dispatches Security Alert email.
   */
  static async sendSecurityAlertEmail(data: SecurityAlertData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderSecurityAlertEmail(data);
    return this.sendEmailSafe({
      to: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
      subject,
      html,
      text,
      dedupeKey: `security_alert:${data.alertType}:${Date.now()}`,
      metadata: {
        alertType: data.alertType,
        severity: data.severity,
      },
    });
  }
}
