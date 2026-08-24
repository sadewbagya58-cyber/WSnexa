import { ReservationStatus } from '@/lib/reservations/reservation-types';

export class ReservationLifecycleService {
  /**
   * Legal status transitions matrix for WSNexa Reservation Engine.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED', 'DECLINED'],
    CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
    ARRIVED: ['SEATED', 'CANCELLED'],
    SEATED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
    DECLINED: [],
  };

  /**
   * Checks whether a status transition from `fromStatus` to `toStatus` is legal.
   */
  static canTransition(fromStatus: ReservationStatus, toStatus: ReservationStatus): boolean {
    if (fromStatus === toStatus) {
      return false; // Same-state transitions are strictly rejected
    }
    const allowed = this.ALLOWED_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Validates a status transition, throwing a structured Error if illegal.
   */
  static validateTransition(fromStatus: ReservationStatus, toStatus: ReservationStatus): void {
    if (fromStatus === toStatus) {
      const err = new Error(`Reservation is already marked as ${fromStatus}.`);
      (err as unknown as { code: string }).code = 'SAME_STATE_TRANSITION';
      throw err;
    }
    if (!this.canTransition(fromStatus, toStatus)) {
      const err = new Error(`Reservation cannot move from ${fromStatus} to ${toStatus}.`);
      (err as unknown as { code: string }).code = 'ILLEGAL_RESERVATION_TRANSITION';
      throw err;
    }
  }

  /**
   * Checks if status is terminal (COMPLETED, CANCELLED, NO_SHOW, DECLINED).
   */
  static isTerminal(status: ReservationStatus): boolean {
    return ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'DECLINED'].includes(status);
  }

  /**
   * Checks if status represents an active expected arrival (PENDING, CONFIRMED, ARRIVED).
   */
  static isActive(status: ReservationStatus): boolean {
    return ['PENDING', 'CONFIRMED', 'ARRIVED'].includes(status);
  }
}
