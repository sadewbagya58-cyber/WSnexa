'use server';

import {
  SupportContactSchema,
  ProblemReportSchema,
  SecurityReportSchema,
  SupportContactInput,
  ProblemReportInput,
  SecurityReportInput,
} from '@/lib/validation/support';

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

  // Log ticket submission securely for operational traceability
  console.info(`[SUPPORT_TICKET_SUBMITTED] Ticket: ${ticketId} | Email: ${validData.email} | Category: ${validData.category}`);

  return {
    success: true,
    message: `Thank you. Your support inquiry has been received with reference ${ticketId}. Our support desk will respond to ${validData.email} within 24 to 48 business hours.`,
    data: {
      ticketId,
      supportEmail: 'wsnexaofficial@gmail.com',
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

  console.info(`[PROBLEM_REPORT_SUBMITTED] Bug ID: ${ticketId} | Email: ${validData.contactEmail} | Category: ${validData.category}`);

  return {
    success: true,
    message: `Problem report logged under reference ${ticketId}. Our engineering team has received your report and will follow up if further diagnostic details are needed.`,
    data: {
      ticketId,
      supportEmail: 'wsnexaofficial@gmail.com',
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

  console.warn(`[SECURITY_VULNERABILITY_SUBMITTED] Report ID: ${ticketId} | Severity: ${validData.severity} | Contact: ${validData.contactEmail}`);

  return {
    success: true,
    message: `Security report logged under reference ${ticketId}. In accordance with our Responsible Disclosure policy, our security response team will acknowledge receipt within 48 business hours.`,
    data: {
      ticketId,
      supportEmail: 'wsnexaofficial@gmail.com',
    },
  };
}
