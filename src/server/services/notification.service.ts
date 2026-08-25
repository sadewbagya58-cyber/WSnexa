import { createAdminClient } from '@/lib/supabase/server';
import { resolveAuthorizationContext } from '@/server/auth/authorization-context';
import { can } from '@/server/auth/policy-engine';

export interface NotificationDTO {
  id: string;
  businessId: string;
  branchId: string;
  branchName?: string;
  recipientUserId: string;
  notificationType: string;
  priority: 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  actionUrl: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface CreateCapabilityNotificationInput {
  businessId: string;
  branchId: string;
  capability: string;
  notificationType: string;
  priority?: 'normal' | 'high' | 'urgent';
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  actionUrl: string;
  areaId?: string | null;
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Resolves eligible active staff users for a capability and branch, then batch inserts
   * per-user notification rows using deterministic dedupe_key idempotency.
   */
  static async createNotificationsForCapability(
    input: CreateCapabilityNotificationInput
  ): Promise<{ insertedCount: number; recipientCount: number }> {
    const {
      businessId,
      branchId,
      capability,
      notificationType,
      priority = 'normal',
      title,
      message,
      entityType,
      entityId,
      actionUrl,
      areaId,
      metadata = {},
    } = input;

    const admin = createAdminClient();

    // 1. Fetch active memberships for business
    const { data: memberships, error: memError } = await admin
      .from('business_memberships')
      .select('id, user_id, role, branch_id')
      .eq('business_id', businessId)
      .eq('membership_status', 'active');

    if (memError || !memberships || memberships.length === 0) {
      return { insertedCount: 0, recipientCount: 0 };
    }

    // 2. Fetch area assignments for filtering area-specific requests
    const memberAreaMap: Map<string, string[]> = new Map();
    if (areaId) {
      const membershipIds = memberships.map((m) => m.id);
      const { data: areaRows } = await admin
        .from('staff_invitation_areas')
        .select('invitation_id, service_area_id')
        .in('invitation_id', membershipIds);

      if (areaRows) {
        for (const row of areaRows) {
          const existing = memberAreaMap.get(row.invitation_id) || [];
          existing.push(row.service_area_id);
          memberAreaMap.set(row.invitation_id, existing);
        }
      }
    }

    // 3. Resolve authorization context & capability for each active user
    const recipientUserIds: string[] = [];

    for (const member of memberships) {
      // Area filtering for area-bounded requests (e.g. waiter requests)
      if (areaId) {
        const assignedAreas = memberAreaMap.get(member.id);
        if (assignedAreas && assignedAreas.length > 0 && !assignedAreas.includes(areaId)) {
          continue;
        }
      }

      // Resolve user's full AuthorizationContext
      try {
        const authContext = await resolveAuthorizationContext({
          overrideUserId: member.user_id,
          requestedBusinessId: businessId,
        });

        // Verify branch reach
        if (
          authContext.authorizedBranchIds &&
          authContext.authorizedBranchIds.length > 0 &&
          !authContext.authorizedBranchIds.includes(branchId)
        ) {
          continue;
        }

        // Verify capability permission
        const isAuthorized = await can({
          context: authContext,
          permission: capability,
          resource: { type: 'branch', id: branchId },
        });

        if (isAuthorized) {
          recipientUserIds.push(member.user_id);
        }
      } catch {
        // Skip user if authorization context resolution fails
        continue;
      }
    }

    if (recipientUserIds.length === 0) {
      return { insertedCount: 0, recipientCount: 0 };
    }

    // 4. Construct per-user notification rows with deterministic dedupe_key
    const rowsToInsert = recipientUserIds.map((userId) => ({
      business_id: businessId,
      branch_id: branchId,
      recipient_user_id: userId,
      notification_type: notificationType,
      priority,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      action_url: actionUrl,
      dedupe_key: `${notificationType}:${entityId}:${userId}`,
      metadata,
    }));

    // 5. Batch insert with idempotency guard ON CONFLICT (dedupe_key) DO NOTHING
    const { data: inserted, error: insertError } = await admin
      .from('notifications')
      .upsert(rowsToInsert, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      return { insertedCount: 0, recipientCount: recipientUserIds.length };
    }

    return {
      insertedCount: inserted ? inserted.length : 0,
      recipientCount: recipientUserIds.length,
    };
  }

  /**
   * Retrieves paginated notifications for a specific user.
   */
  static async getUserNotifications(
    userId: string,
    params: {
      businessId: string;
      branchId?: string;
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    }
  ): Promise<NotificationDTO[]> {
    const admin = createAdminClient();
    const { businessId, branchId, limit = 20, offset = 0, unreadOnly = false } = params;

    let query = admin
      .from('notifications')
      .select('*, branches(name)')
      .eq('recipient_user_id', userId)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    type NotificationRowWithBranch = Record<string, unknown> & {
      branches?: { name?: string | null } | null;
    };

    return (data as NotificationRowWithBranch[]).map((row) => ({
      id: String(row.id),
      businessId: String(row.business_id),
      branchId: String(row.branch_id),
      branchName: row.branches?.name || undefined,
      recipientUserId: String(row.recipient_user_id),
      notificationType: String(row.notification_type),
      priority: (row.priority as 'normal' | 'high' | 'urgent') || 'normal',
      title: String(row.title),
      message: String(row.message),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      actionUrl: String(row.action_url),
      dedupeKey: String(row.dedupe_key),
      metadata: (row.metadata as Record<string, unknown>) || {},
      readAt: (row.read_at as string | null) || null,
      createdAt: String(row.created_at),
    }));
  }

  /**
   * Gets the unread notification count for a specific user.
   */
  static async getUnreadCount(
    userId: string,
    businessId: string,
    branchId?: string
  ): Promise<number> {
    const admin = createAdminClient();
    let query = admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_user_id', userId)
      .eq('business_id', businessId)
      .is('read_at', null);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { count, error } = await query;
    if (error || count === null) return 0;
    return count;
  }

  /**
   * Marks a specific notification as read for the owning user.
   */
  static async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_user_id', userId)
      .is('read_at', null);

    return !error;
  }

  /**
   * Marks all unread notifications as read for a specific user.
   */
  static async markAllAsRead(
    userId: string,
    businessId: string,
    branchId?: string
  ): Promise<boolean> {
    const admin = createAdminClient();
    let query = admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', userId)
      .eq('business_id', businessId)
      .is('read_at', null);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { error } = await query;
    return !error;
  }
}
