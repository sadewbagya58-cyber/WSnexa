import type { CustomerSegmentationDTO } from './crm-segmentation.types';

export * from './crm-segmentation.types';

export type IdentityType = 'REGISTERED' | 'KNOWN_GUEST' | 'ANONYMOUS';

export type ConsentChannel =
  | 'TRANSACTIONAL_CONTACT'
  | 'MARKETING_EMAIL'
  | 'MARKETING_SMS'
  | 'MARKETING_WHATSAPP'
  | 'PROFILE_PERSONALIZATION';

export type ConsentStatus = 'GRANTED' | 'DENIED' | 'OPTED_OUT' | 'UNKNOWN';

export interface CustomerConsentDTO {
  channel: ConsentChannel;
  status: ConsentStatus;
  updatedAt: string;
}

export interface CustomerActivitySummaryDTO {
  totalOrders: number;
  completedOrders: number;
  totalSpendCents: number;
  aovCents: number;
  branchesVisitedCount: number;
  lastOrderAt: string | null;
  currency: string;
}

export interface CustomerLoyaltySummaryDTO {
  pointsBalance: number;
  lifetimePointsEarned: number;
  lifetimePointsRedeemed: number;
  tierName: string | null;
}

export interface CustomerReviewSummaryDTO {
  reviewCount: number;
  avgRatingGiven: number | null;
  lastReviewAt: string | null;
}

export interface CustomerTopStatsDTO {
  topOrderedItemName: string | null;
  topCategoryName: string | null;
  mostVisitedBranchName: string | null;
}

export interface UnifiedCustomerProfileDTO {
  customerId: string;
  businessId: string;
  authUserId: string | null;
  identityType: IdentityType;
  displayName: string;
  emailMasked: string | null;
  phoneMasked: string | null;
  emailUnmasked?: string | null;
  phoneUnmasked?: string | null;
  isAccountLinked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  activity: CustomerActivitySummaryDTO;
  loyalty: CustomerLoyaltySummaryDTO;
  reviews: CustomerReviewSummaryDTO;
  topStats: CustomerTopStatsDTO;
  consents: CustomerConsentDTO[];
  segmentation?: CustomerSegmentationDTO;
}

export interface CustomerDirectoryItemDTO {
  customerId: string;
  businessId: string;
  displayName: string;
  identityType: IdentityType;
  emailMasked: string | null;
  phoneMasked: string | null;
  totalOrders: number;
  totalSpendCents: number;
  currency: string;
  lastSeenAt: string;
  isAccountLinked: boolean;
}

export interface CustomerDirectoryQueryInput {
  businessId?: string;
  branchId?: string | null;
  searchQuery?: string;
  identityType?: IdentityType;
  limit?: number;
  offset?: number;
}
