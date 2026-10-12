/**
 * Types and interfaces for the WSNexa Email Notification System.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export type EmailDeliveryStatus = 'QUEUED' | 'ACCEPTED' | 'SIMULATED' | 'FAILED';

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'resend' | 'smtp' | 'simulated';
  status: EmailDeliveryStatus;
  messageId?: string;
  recipient: string;
  subject: string;
  error?: string;
  timestamp: string;
}

export interface EmailMessage {
  to: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

// -------------------------------------------------------------
// Domain Event Payload Types
// -------------------------------------------------------------

export interface ProblemReportEmailData {
  diagnosticReference: string;
  category: string;
  contactEmail: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  deviceBrowser?: string;
  timestamp: string;
}

export interface SupportInquiryEmailData {
  ticketId: string;
  name: string;
  contactEmail: string;
  category: string;
  subject: string;
  message: string;
  referenceId?: string;
  timestamp: string;
}

export interface SecurityReportEmailData {
  ticketId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  researcherName?: string;
  contactEmail: string;
  summary: string;
  affectedArea: string;
  reproductionSteps: string;
  proofOfConcept?: string;
  timestamp: string;
}

export interface BankTransferSubmittedAdminData {
  paymentId: string;
  businessId: string;
  businessName?: string;
  planCode: string;
  amountLkr: number;
  rawReference: string;
  filePath: string;
  customerEmail?: string;
  notes?: string;
  timestamp: string;
}

export interface BankTransferSettledData {
  paymentId: string;
  businessId: string;
  businessName?: string;
  planCode: string;
  amountLkr: number;
  periodStartsAt: string;
  periodEndsAt: string;
  reconciliationNote: string;
  externalBankStatementRef: string;
  ownerEmail?: string;
  timestamp: string;
}

export interface BankTransferRejectedData {
  paymentId: string;
  businessId: string;
  businessName?: string;
  planCode?: string;
  amountLkr?: number;
  rejectionReason: string;
  ownerEmail?: string;
  timestamp: string;
}

export interface SubscriptionActivatedData {
  businessId: string;
  businessName?: string;
  planCode: string;
  amountLkr?: number;
  periodEndsAt: string;
  activationSource: string;
  ownerEmail?: string;
  timestamp: string;
}

export interface SubscriptionCancelledData {
  businessId: string;
  businessName?: string;
  planCode: string;
  cancelledAt: string;
  effectiveEndAt?: string;
  reason?: string;
  ownerEmail?: string;
  timestamp: string;
}

export interface SubscriptionPaymentFailedData {
  paymentId: string;
  businessId: string;
  businessName?: string;
  planCode: string;
  amountLkr: number;
  failureCode?: string;
  failureMessage?: string;
  provider: string;
  ownerEmail?: string;
  timestamp: string;
}

export interface SecurityAlertData {
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  actorId?: string;
  targetResource?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
