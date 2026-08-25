'use server';

import { resolveAuthorizationContext } from '@/server/auth';
import { NotificationService, NotificationDTO } from '@/server/services/notification.service';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetches user notifications for the currently authenticated staff member.
 */
export async function getUserNotificationsAction(params: {
  branchId?: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<ActionResult<NotificationDTO[]>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const notifications = await NotificationService.getUserNotifications(authContext.userId, {
      businessId: authContext.businessId,
      branchId: params.branchId,
      limit: params.limit,
      offset: params.offset,
      unreadOnly: params.unreadOnly,
    });

    return { success: true, data: notifications };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_LOAD_NOTIFICATIONS';
    return { success: false, error: message };
  }
}

/**
 * Gets the unread notification count for the currently authenticated staff member.
 */
export async function getUnreadCountAction(params: {
  branchId?: string;
}): Promise<ActionResult<number>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const count = await NotificationService.getUnreadCount(
      authContext.userId,
      authContext.businessId,
      params.branchId
    );

    return { success: true, data: count };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_GET_UNREAD_COUNT';
    return { success: false, error: message };
  }
}

/**
 * Marks a single notification as read for the authenticated staff member.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<ActionResult<boolean>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (!notificationId) {
      return { success: false, error: 'INVALID_NOTIFICATION_ID' };
    }

    const success = await NotificationService.markAsRead(authContext.userId, notificationId);
    return { success };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_MARK_AS_READ';
    return { success: false, error: message };
  }
}

/**
 * Marks all notifications as read for the authenticated staff member.
 */
export async function markAllNotificationsAsReadAction(
  branchId?: string
): Promise<ActionResult<boolean>> {
  try {
    const authContext = await resolveAuthorizationContext();
    if (!authContext || !authContext.businessId || !authContext.userId) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const success = await NotificationService.markAllAsRead(
      authContext.userId,
      authContext.businessId,
      branchId
    );

    return { success };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FAILED_TO_MARK_ALL_AS_READ';
    return { success: false, error: message };
  }
}
