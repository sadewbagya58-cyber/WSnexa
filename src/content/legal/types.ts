export type LegalDocumentStatus = 'active' | 'draft' | 'under_review' | 'deprecated';

export interface LegalSection {
  id: string;
  title: string;
  subsections?: {
    id: string;
    title: string;
    paragraphs: string[];
    bulletPoints?: string[];
  }[];
  paragraphs?: string[];
  bulletPoints?: string[];
}

export interface LegalDocumentMetadata {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  version: string;
  effectiveDate: string;
  lastUpdatedDate: string;
  status: LegalDocumentStatus;
  requiresLegalReview: boolean;
  summary: string;
  href: string;
  sections: LegalSection[];
}

export interface LegalConsentRecord {
  documentId: string;
  version: string;
  acceptedAt: string;
  userId: string;
  businessId?: string;
  ipAddress?: string;
  userAgent?: string;
}
