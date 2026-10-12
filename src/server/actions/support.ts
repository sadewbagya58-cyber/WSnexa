'use server';

import {
  SupportContactSchema,
  ProblemReportSchema,
  SecurityReportSchema,
  SupportContactInput,
  ProblemReportInput,
  SecurityReportInput,
} from '@/lib/validation/support';
import { createAdminClient } from '@/lib/supabase/server';
import { EmailService } from '@/server/email/email.service';
import { PRIMARY_BUSINESS_NOTIFICATION_EMAIL } from '@/server/email/email-config';

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

function generateTicketId(prefix: 'SUP' | 'BUG' | 'SEC'): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

export async function submitSupportRequestAction(
  rawInput: SupportContactInput
): Promise<ActionResponse<{ ticketId: string; supportEmail: string }>> {
  const parseResult = SupportContactSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please fix the errors in your submission.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const ticketId = generateTicketId('SUP');
  const validData = parseResult.data;
  const submittedAt = new Date().toISOString();

  // Log ticket submission securely for operational traceability
  console.info(`[SUPPORT_TICKET_SUBMITTED] Ticket: ${ticketId} | Email: ${validData.email} | Category: ${validData.category}`);

  // 1. Dispatch Email to Primary Business Notification Email (Wsnexaofficial@gmail.com)
  const emailResult = await EmailService.sendSupportInquiryEmail({
    ticketId,
    name: validData.name,
    contactEmail: validData.email,
    category: validData.category,
    subject: validData.subject,
    message: validData.message,
    referenceId: validData.referenceId,
    timestamp: submittedAt,
  });

  // 2. Persist ticket submission to public.audit_logs
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      action: 'SUPPORT_INQUIRY_SUBMITTED',
      target_type: 'support_inquiry',
      target_id: ticketId,
      payload: {
        ticketId,
        name: validData.name,
        email: validData.email,
        category: validData.category,
        subject: validData.subject,
        message: validData.message,
        referenceId: validData.referenceId,
        emailDelivery: {
          success: emailResult.success,
          status: emailResult.status,
          messageId: emailResult.messageId,
          recipient: emailResult.recipient,
        },
        submittedAt,
      },
    });
  } catch (dbErr) {
    console.warn(`[AUDIT_LOG_FALLBACK] Could not persist support inquiry ${ticketId}:`, dbErr);
  }

  return {
    success: true,
    message: `Thank you. Your support inquiry has been received with reference ${ticketId}. Our support desk will respond to ${validData.email} within 24 to 48 business hours.`,
    data: {
      ticketId,
      supportEmail: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    },
  };
}

export async function submitProblemReportAction(
  rawInput: ProblemReportInput
): Promise<ActionResponse<{ ticketId: string; supportEmail: string }>> {
  const parseResult = ProblemReportSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please fix the errors in your report.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const ticketId = generateTicketId('BUG');
  const validData = parseResult.data;
  const submittedAt = new Date().toISOString();

  console.info(`[PROBLEM_REPORT_SUBMITTED] Bug ID: ${ticketId} | Email: ${validData.contactEmail} | Category: ${validData.category}`);

  // 1. Dispatch Problem Report Email to Primary Business Notification Email (Wsnexaofficial@gmail.com)
  const emailResult = await EmailService.sendProblemReportEmail({
    diagnosticReference: ticketId,
    category: validData.category,
    contactEmail: validData.contactEmail,
    description: validData.description,
    stepsToReproduce: validData.stepsToReproduce,
    expectedBehavior: validData.expectedBehavior,
    actualBehavior: validData.actualBehavior,
    deviceBrowser: validData.deviceBrowser,
    timestamp: submittedAt,
  });

  // 2. Persist bug report to public.audit_logs
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      action: 'PROBLEM_REPORT_SUBMITTED',
      target_type: 'problem_report',
      target_id: ticketId,
      payload: {
        diagnosticReference: ticketId,
        category: validData.category,
        description: validData.description,
        stepsToReproduce: validData.stepsToReproduce,
        expectedBehavior: validData.expectedBehavior,
        actualBehavior: validData.actualBehavior,
        contactEmail: validData.contactEmail,
        deviceBrowser: validData.deviceBrowser,
        emailDelivery: {
          success: emailResult.success,
          status: emailResult.status,
          messageId: emailResult.messageId,
          recipient: emailResult.recipient,
        },
        submittedAt,
      },
    });
  } catch (dbErr) {
    console.warn(`[AUDIT_LOG_FALLBACK] Could not persist problem report ${ticketId}:`, dbErr);
  }

  return {
    success: true,
    message: `Problem report logged under reference ${ticketId}. Our engineering team has received your report and will follow up if further diagnostic details are needed.`,
    data: {
      ticketId,
      supportEmail: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    },
  };
}

export async function submitSecurityReportAction(
  rawInput: SecurityReportInput
): Promise<ActionResponse<{ ticketId: string; supportEmail: string }>> {
  const parseResult = SecurityReportSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: 'Please complete all required disclosure fields.',
      fieldErrors: parseResult.error.flatten().fieldErrors,
    };
  }

  const ticketId = generateTicketId('SEC');
  const validData = parseResult.data;
  const submittedAt = new Date().toISOString();

  console.warn(`[SECURITY_VULNERABILITY_SUBMITTED] Report ID: ${ticketId} | Severity: ${validData.severity} | Contact: ${validData.contactEmail}`);

  // 1. Dispatch Security Report Email to Primary Business Notification Email (Wsnexaofficial@gmail.com)
  const emailResult = await EmailService.sendSecurityReportEmail({
    ticketId,
    researcherName: validData.researcherName,
    contactEmail: validData.contactEmail,
    severity: validData.severity,
    summary: validData.summary,
    affectedArea: validData.affectedArea,
    reproductionSteps: validData.reproductionSteps,
    proofOfConcept: validData.proofOfConcept,
    timestamp: submittedAt,
  });

  // 2. Persist security vulnerability report to public.audit_logs
  try {
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({
      action: 'SECURITY_REPORT_SUBMITTED',
      target_type: 'security_report',
      target_id: ticketId,
      payload: {
        ticketId,
        researcherName: validData.researcherName,
        contactEmail: validData.contactEmail,
        severity: validData.severity,
        summary: validData.summary,
        affectedArea: validData.affectedArea,
        reproductionSteps: validData.reproductionSteps,
        proofOfConcept: validData.proofOfConcept,
        emailDelivery: {
          success: emailResult.success,
          status: emailResult.status,
          messageId: emailResult.messageId,
          recipient: emailResult.recipient,
        },
        submittedAt,
      },
    });
  } catch (dbErr) {
    console.warn(`[AUDIT_LOG_FALLBACK] Could not persist security report ${ticketId}:`, dbErr);
  }

  return {
    success: true,
    message: `Security report logged under reference ${ticketId}. In accordance with our Responsible Disclosure policy, our security response team will acknowledge receipt within 48 business hours.`,
    data: {
      ticketId,
      supportEmail: PRIMARY_BUSINESS_NOTIFICATION_EMAIL,
    },
  };
}
