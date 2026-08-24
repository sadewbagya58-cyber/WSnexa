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
    if (fromStatus === toStatus) return true;
    const allowed = this.ALLOWED_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Validates a status transition, throwing an Error if illegal.
   */
  static validateTransition(fromStatus: ReservationStatus, toStatus: ReservationStatus): void {
    if (!this.canTransition(fromStatus, toStatus)) {
      throw new Error(`Illegal reservation status transition from '${fromStatus}' to '${toStatus}'`);
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
