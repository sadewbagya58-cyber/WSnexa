
export type TableAssignmentType = 'AUTO' | 'MANUAL' | 'WALK_IN';

export type WaitlistStatus = 'WAITING' | 'OFFERED' | 'SEATED' | 'CANCELLED' | 'EXPIRED';

export interface DiningTableDTO {
  id: string;
  businessId: string;
  branchId: string;
  serviceAreaId: string;
  name: string;
  code: string;
  tableNumber: number | null;
  capacity: number;
  minCapacity: number;
  reservationsEnabled: boolean;
  status: string;
  isActive: boolean;
}

export interface ReservationTableAssignmentDTO {
  id: string;
  reservationId: string;
  businessId: string;
  branchId: string;
  tableId: string;
  tableName?: string;
  tableNumber?: number | null;
  serviceAreaId?: string;
  assignmentType: TableAssignmentType;
  assignedByUserId: string | null;
  assignedAt: string;
  releasedAt: string | null;
  createdAt: string;
}

export interface TableCombinationDTO {
  tables: DiningTableDTO[];
  totalCapacity: number;
  minCapacity: number;
  tableCount: number;
  serviceAreaId: string;
}

export interface TableAvailabilityResultDTO {
  availableTables: DiningTableDTO[];
  recommendedSingleTable: DiningTableDTO | null;
  recommendedCombination: TableCombinationDTO | null;
  occupiedTableIds: string[];
}

export interface WaitlistEntryDTO {
  id: string;
  businessId: string;
  branchId: string;
  crmCustomerId: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestEmailMasked: string | null;
  guestPhoneMasked: string | null;
  partySize: number;
  requestedStartAt: string;
  requestedEndAt: string;
  status: WaitlistStatus;
  priority: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  seatedAt: string | null;
  cancelledAt: string | null;
}

export interface CreateWaitlistEntryInput {
  businessId: string;
  branchId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  partySize: number;
  requestedStartAt: string;
  requestedEndAt?: string | null;
  priority?: number;
  notes?: string | null;
}

export interface ManualAssignTablesInput {
  reservationId: string;
  tableIds: string[];
}

export interface CreateWalkInSeatingInput {
  businessId: string;
  branchId: string;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  partySize: number;
  tableIds?: string[];
  durationMinutes?: number;
  specialRequests?: string | null;
}

export interface PromoteWaitlistInput {
  waitlistEntryId: string;
  tableIds?: string[];
  autoConfirm?: boolean;
}
