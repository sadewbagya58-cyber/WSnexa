export type ReservationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'SEATED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'DECLINED';

export type ReservationSource =
  | 'PUBLIC_WEB'
  | 'CUSTOMER_PORTAL'
  | 'STAFF'
  | 'PHONE'
  | 'WALK_IN'
  | 'IMPORT'
  | 'API';

export type StatusActorType = 'STAFF' | 'CUSTOMER' | 'SYSTEM';

export interface ReservationDTO {
  id: string;
  businessId: string;
  branchId: string;
  crmCustomerId: string | null;
  createdByUserId: string | null;
  createdBySource: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestEmailMasked: string | null;
  guestPhoneMasked: string | null;
  reservationDate: string;
  reservationStartAt: string;
  reservationEndAt: string;
  partySize: number;
  status: ReservationStatus;
  specialRequests: string | null;
  internalNotes: string | null;
  occasion: string | null;
  source: ReservationSource;
  confirmationCode: string;
  guestAccessToken?: string | null;
  consentPromotional?: boolean;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  arrivedAt: string | null;
  seatedAt: string | null;
  completedAt: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationStatusEventDTO {
  id: string;
  reservationId: string;
  businessId: string;
  branchId: string;
  fromStatus: ReservationStatus | null;
  toStatus: ReservationStatus;
  actorUserId: string | null;
  actorType: StatusActorType;
  reason: string | null;
  createdAt: string;
}

export interface PublicReservationDTO {
  reservationId: string;
  confirmationCode: string;
  status: ReservationStatus;
  branchId: string;
  reservationDate: string;
  reservationStartAt: string;
  reservationEndAt: string;
  partySize: number;
  guestName: string;
  specialRequests: string | null;
  occasion: string | null;
  createdAt: string;
}

export interface ReservationSettingsDTO {
  id: string;
  businessId: string;
  branchId: string;
  reservationsEnabled: boolean;
  defaultDurationMinutes: number;
  minimumPartySize: number;
  maximumPartySize: number;
  minimumAdvanceMinutes: number;
  maximumAdvanceDays: number;
  allowSameDay: boolean;
  requireGuestPhone: boolean;
  requireGuestEmail: boolean;
  autoConfirm: boolean;
  tableTurnoverBufferMinutes?: number;
  maxTableCombination?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationInput {
  businessId: string;
  branchId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  reservationStartAt: string; // ISO string
  durationMinutes?: number;
  partySize: number;
  specialRequests?: string | null;
  internalNotes?: string | null;
  occasion?: string | null;
  source?: ReservationSource;
  crmCustomerId?: string | null;
  guestAccessToken?: string | null;
  consentPromotional?: boolean;
  intent?: ReservationValidationIntent;
  initialStatus?: ReservationStatus;
}

export interface CreatePublicReservationInput {
  branchId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  reservationStartAt: string;
  durationMinutes?: number;
  partySize: number;
  specialRequests?: string | null;
  occasion?: string | null;
  consentPromotional?: boolean;
}

export interface PublicBookingInput {
  venueSlug: string;
  branchId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  reservationStartAt: string;
  partySize: number;
  specialRequests?: string | null;
  occasion?: string | null;
  consentPromotional?: boolean;
}

export interface PublicBookingResultDTO {
  reservationId: string;
  confirmationCode: string;
  guestAccessToken: string;
  status: ReservationStatus;
  venueName: string;
  venueSlug: string;
  branchName: string;
  branchId: string;
  reservationDate: string;
  reservationStartAt: string;
  reservationEndAt: string;
  partySize: number;
  guestName: string;
  occasion: string | null;
  specialRequests: string | null;
}

export interface TimeSlotDTO {
  time: string; // e.g. "18:00"
  displayTime: string; // e.g. "6:00 PM"
  startAt: string; // ISO string
  endAt: string; // ISO string
  available: boolean;
  reason?: string;
}

export interface CustomerReservationDetailDTO extends ReservationDTO {
  venueName: string;
  venueSlug: string;
  branchName: string;
  customerStatusLabel: string;
  cancellationEligible: boolean;
}

export interface UpdateReservationInput {
  reservationId: string;
  guestName?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  reservationStartAt?: string;
  reservationEndAt?: string;
  partySize?: number;
  specialRequests?: string | null;
  internalNotes?: string | null;
  occasion?: string | null;
}

export interface CancelReservationInput {
  reservationId: string;
  guestAccessToken?: string | null;
  reason?: string | null;
}

export interface ListReservationsFilter {
  businessId: string;
  branchId?: string | null;
  authorizedBranchIds?: string[] | null;
  status?: ReservationStatus | ReservationStatus[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  crmCustomerId?: string | null;
  searchQuery?: string | null;
  limit?: number;
  offset?: number;
}

export interface PaginatedReservationsDTO {
  items: ReservationDTO[];
  totalCount: number;
  limit: number;
  offset: number;
}

export type ReservationValidationIntent =
  | 'FUTURE_STAFF_RESERVATION'
  | 'PUBLIC_RESERVATION'
  | 'WALK_IN_SEATING'
  | 'WAITLIST_PROMOTION';

export type ReservationErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_SCOPE'
  | 'NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'SAME_STATE_TRANSITION'
  | 'ILLEGAL_RESERVATION_TRANSITION'
  | 'PAST_RESERVATION_TIME'
  | 'MINIMUM_ADVANCE_TIME'
  | 'MAXIMUM_ADVANCE_TIME'
  | 'SAME_DAY_DISABLED'
  | 'INVALID_PARTY_SIZE'
  | 'RESERVATIONS_DISABLED'
  | 'REQUIRED_CONTACT_MISSING'
  | 'INVALID_INPUT'
  | 'CONCURRENCY_CONFLICT'
  | 'NO_TABLE_AVAILABLE'
  | 'SLOT_NO_LONGER_AVAILABLE'
  | 'CANCELLATION_NOT_ALLOWED'
  | 'INVALID_GUEST_TOKEN'
  | 'WAITLIST_ALREADY_PROMOTED'
  | 'INTERNAL_ERROR';

export type ReservationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ReservationErrorCode; message: string } };
