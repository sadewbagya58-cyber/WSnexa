export type CRMActionType =
  | 'FOLLOW_UP'
  | 'RETENTION_REVIEW'
  | 'LOYALTY_REVIEW'
  | 'SERVICE_RECOVERY'
  | 'VIP_RECOGNITION'
  | 'REVIEW_RESPONSE'
  | 'PROFILE_REVIEW'
  | 'MANUAL_OUTREACH';

export type CRMActionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'SNOOZED'
  | 'COMPLETED'
  | 'DISMISSED';

export type CRMActionPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type EngagementPurpose =
  | 'TRANSACTIONAL'
  | 'SERVICE_RECOVERY'
  | 'LOYALTY'
  | 'MARKETING'
  | 'MANUAL_GENERAL';

export type EngagementChannel =
  | 'EMAIL'
  | 'SMS'
  | 'WHATSAPP'
  | 'PHONE'
  | 'IN_APP';

export type EngagementEligibilityReasonCode =
  | 'ELIGIBLE'
  | 'NO_CONTACT_AVAILABLE'
  | 'CONSENT_UNKNOWN'
  | 'CONSENT_DENIED'
  | 'OPTED_OUT'
  | 'CHANNEL_NOT_CONFIGURED'
  | 'OUTSIDE_SCOPE'
  | 'CONTACT_VIEW_REQUIRED'
  | 'TRANSACTIONAL_ONLY';

export interface EngagementEligibilityDTO {
  eligible: boolean;
  purpose: EngagementPurpose;
  reasonCode: EngagementEligibilityReasonCode;
  allowedChannels: EngagementChannel[];
  message: string;
}

export interface RetentionOpportunityDTO {
  id: string;
  customerId: string;
  maskedCustomerName: string;
  maskedContact: string;
  reasonCode: string;
  title: string;
  summary: string;
  priority: CRMActionPriority;
  sourceSegment: string;
  retentionRiskLevel: string | null;
  branchId: string | null;
  recommendedAction: string;
  engagementEligibility: EngagementEligibilityDTO;
  status: CRMActionStatus;
  assignedUserId: string | null;
  assignedUserName: string | null;
  snoozedUntil: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface CustomerNoteDTO {
  id: string;
  businessId: string;
  crmCustomerId: string;
  branchId: string | null;
  noteText: string;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CustomerTagDTO {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string | null;
  colorHex: string | null;
  createdAt: string;
}

export interface CustomerTagAssignmentDTO {
  tagId: string;
  tagName: string;
  tagSlug: string;
  colorHex: string | null;
  assignedBy: string;
  assignedAt: string;
}

export type CRMActionEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STARTED'
  | 'SNOOZED'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'REOPENED';

export interface CRMActionEventDTO {
  id: string;
  businessId: string;
  actionId: string;
  eventType: CRMActionEventType;
  actorUserId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
