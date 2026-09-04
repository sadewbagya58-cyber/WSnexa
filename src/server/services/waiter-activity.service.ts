import { createAdminClient } from '@/lib/supabase/server';

export type WaiterOperationalActivityItem = WaiterOperationalEvent;

export interface WaiterOperationalEvent {
  id: string;
  category: 'assistance_request' | 'order_approval' | 'order_rejection' | 'waiter_order';
  requestType?: string;
  tableName: string;
  serviceAreaId?: string | null;
  serviceAreaName?: string | null;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'dismissed' | 'approved' | 'rejected' | 'confirmed';
  notes?: string | null;
  createdAt: string;
  acceptedByUserId?: string | null;
  acceptedByName?: string | null;
  acceptedByRole?: string | null;
  acceptedAt?: string | null;
  resolvedByUserId?: string | null;
  resolvedByName?: string | null;
  resolvedByRole?: string | null;
  resolvedAt?: string | null;
  orderNumber?: string | null;
  orderId?: string | null;
  totalCents?: number;
  currency?: string;
  isOverdue?: boolean;
  elapsedMinutes?: number;
}

export interface RequestTimelineStep {
  step: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  description: string;
  status: string;
}

export class WaiterActivityService {
  /**
   * Fetches operational waiter activity for the last 48 hours with strict service-area isolation.
   */
  static async get48HourOperationalActivity(
    branchId: string,
    assignedAreaIds?: string[] | null,
    businessId?: string
  ): Promise<WaiterOperationalEvent[]> {
    const admin = createAdminClient();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const now = new Date();

    // 1. Fetch Waiter Requests from last 48 hours
    const { data: rawRequests, error: reqErr } = await admin
      .from('waiter_requests')
      .select(
        `
        id,
        business_id,
        branch_id,
        table_id,
        order_id,
        request_type,
        status,
        notes,
        created_at,
        updated_at,
        accepted_by,
        accepted_at,
        resolved_by,
        resolved_at,
        table:dining_tables(
          id,
          name,
          service_area_id,
          service_area:service_areas(id, name)
        )
      `
      )
      .eq('branch_id', branchId)
      .gte('created_at', fortyEightHoursAgo)
      .order('created_at', { ascending: false });

    if (reqErr) {
      console.warn('[WaiterActivityService] Failed to fetch waiter requests:', reqErr.message);
    }

    // 2. Fetch Recent Orders from last 48 hours that had waiter actions
    const { data: rawOrders, error: ordErr } = await admin
      .from('orders')
      .select(
        `
        id,
        business_id,
        branch_id,
        order_number_formatted,
        order_number,
        status,
        approval_status,
        approved_by_user_id,
        approved_at,
        rejected_by_user_id,
        rejected_at,
        rejection_reason,
        total_cents,
        currency,
        created_at,
        table_id,
        service_area_id,
        service_area_name_snapshot,
        table:dining_tables(
          id,
          name,
          service_area_id,
          service_area:service_areas(id, name)
        )
      `
      )
      .eq('branch_id', branchId)
      .gte('created_at', fortyEightHoursAgo)
      .or('approval_status.eq.approved,approval_status.eq.rejected,approval_status.eq.pending_waiter_approval')
      .order('created_at', { ascending: false })
      .limit(100);

    if (ordErr) {
      console.warn('[WaiterActivityService] Failed to fetch orders:', ordErr.message);
    }

    // Collect all unique user IDs to resolve canonical names and roles in batch
    const userIds = new Set<string>();
    for (const r of rawRequests || []) {
      if (r.accepted_by) userIds.add(r.accepted_by);
      if (r.resolved_by) userIds.add(r.resolved_by);
    }
    for (const o of rawOrders || []) {
      if (o.approved_by_user_id) userIds.add(o.approved_by_user_id);
      if (o.rejected_by_user_id) userIds.add(o.rejected_by_user_id);
    }

    let actorSnapMap = new Map<string, { displayName: string; roleName: string }>();
    if (userIds.size > 0) {
      try {
        const { PermissionService } = await import('./permission.service');
        actorSnapMap = await PermissionService.resolveCanonicalActorSnapshots(
          Array.from(userIds),
          businessId || null
        );
      } catch {
        // Non-blocking fallback
      }
    }

    const events: WaiterOperationalEvent[] = [];

    // Filter and transform assistance requests
    for (const r of rawRequests || []) {
      const tableNode = r.table as unknown as {
        id?: string;
        name?: string;
        service_area_id?: string;
        service_area?: { id?: string; name?: string };
      } | null;

      const areaId = tableNode?.service_area_id || tableNode?.service_area?.id || null;
      const areaName = tableNode?.service_area?.name || null;
      const tableName = tableNode?.name || 'Table';

      // Apply Service Area isolation filter
      if (assignedAreaIds !== undefined && assignedAreaIds !== null) {
        if (!areaId || !assignedAreaIds.includes(areaId)) {
          continue;
        }
      }

      const createdTime = new Date(r.created_at).getTime();
      const elapsedMinutes = Math.floor((now.getTime() - createdTime) / 60000);
      const isOverdue = (r.status === 'pending' || r.status === 'accepted') && elapsedMinutes > 15;

      const acceptedSnap = r.accepted_by ? actorSnapMap.get(r.accepted_by) : null;
      const resolvedSnap = r.resolved_by ? actorSnapMap.get(r.resolved_by) : null;

      events.push({
        id: r.id,
        category: 'assistance_request',
        requestType: r.request_type,
        tableName,
        serviceAreaId: areaId,
        serviceAreaName: areaName,
        status: r.status as WaiterOperationalEvent['status'],
        notes: r.notes,
        createdAt: r.created_at,
        acceptedByUserId: r.accepted_by,
        acceptedByName: acceptedSnap?.displayName || null,
        acceptedByRole: acceptedSnap?.roleName || null,
        acceptedAt: r.accepted_at,
        resolvedByUserId: r.resolved_by,
        resolvedByName: resolvedSnap?.displayName || null,
        resolvedByRole: resolvedSnap?.roleName || null,
        resolvedAt: r.resolved_at,
        orderId: r.order_id,
        isOverdue,
        elapsedMinutes,
      });
    }

    // Filter and transform order approvals
    for (const o of rawOrders || []) {
      const tableNode = o.table as unknown as {
        id?: string;
        name?: string;
        service_area_id?: string;
        service_area?: { id?: string; name?: string };
      } | null;

      const areaId = o.service_area_id || tableNode?.service_area_id || tableNode?.service_area?.id || null;
      const areaName = o.service_area_name_snapshot || tableNode?.service_area?.name || null;
      const tableName = tableNode?.name || 'Table';

      // Apply Service Area isolation filter
      if (assignedAreaIds !== undefined && assignedAreaIds !== null) {
        if (!areaId || !assignedAreaIds.includes(areaId)) {
          continue;
        }
      }

      if (o.approval_status === 'approved') {
        const approverSnap = o.approved_by_user_id ? actorSnapMap.get(o.approved_by_user_id) : null;
        events.push({
          id: `ord-app-${o.id}`,
          category: 'order_approval',
          tableName,
          serviceAreaId: areaId,
          serviceAreaName: areaName,
          status: 'approved',
          createdAt: o.approved_at || o.created_at,
          acceptedByUserId: o.approved_by_user_id,
          acceptedByName: approverSnap?.displayName || null,
          acceptedByRole: approverSnap?.roleName || null,
          acceptedAt: o.approved_at,
          orderNumber: o.order_number_formatted || `#${o.order_number}`,
          orderId: o.id,
          totalCents: o.total_cents,
          currency: o.currency,
        });
      } else if (o.approval_status === 'rejected') {
        const rejectorSnap = o.rejected_by_user_id ? actorSnapMap.get(o.rejected_by_user_id) : null;
        events.push({
          id: `ord-rej-${o.id}`,
          category: 'order_rejection',
          tableName,
          serviceAreaId: areaId,
          serviceAreaName: areaName,
          status: 'rejected',
          notes: o.rejection_reason,
          createdAt: o.rejected_at || o.created_at,
          resolvedByUserId: o.rejected_by_user_id,
          resolvedByName: rejectorSnap?.displayName || null,
          resolvedByRole: rejectorSnap?.roleName || null,
          resolvedAt: o.rejected_at,
          orderNumber: o.order_number_formatted || `#${o.order_number}`,
          orderId: o.id,
          totalCents: o.total_cents,
          currency: o.currency,
        });
      }
    }

    // Sort all events by createdAt descending
    events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return events;
  }

  /**
   * Builds an entity timeline for a specific waiter assistance request.
   */
  static async getRequestTimeline(requestId: string, branchId: string): Promise<RequestTimelineStep[]> {
    const admin = createAdminClient();

    const { data: req } = await admin
      .from('waiter_requests')
      .select(
        `
        id,
        business_id,
        request_type,
        status,
        notes,
        created_at,
        accepted_by,
        accepted_at,
        resolved_by,
        resolved_at,
        table:dining_tables(name)
      `
      )
      .eq('id', requestId)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (!req) return [];

    const userIds = [req.accepted_by, req.resolved_by].filter(Boolean) as string[];
    let actorSnapMap = new Map<string, { displayName: string; roleName: string }>();

    if (userIds.length > 0) {
      try {
        const { PermissionService } = await import('./permission.service');
        actorSnapMap = await PermissionService.resolveCanonicalActorSnapshots(
          userIds,
          (req as { business_id?: string }).business_id || null
        );
      } catch {
        // Non-blocking fallback
      }
    }

    const steps: RequestTimelineStep[] = [];
    const tableName = (req.table as { name?: string } | null)?.name || 'Dining Table';

    // Step 1: Created
    steps.push({
      step: 'Request Created',
      timestamp: req.created_at,
      actorName: 'Customer / Table QR',
      actorRole: 'Guest',
      description: `Customer at ${tableName} created request: ${req.request_type.replace(/_/g, ' ')}${req.notes ? ` ("${req.notes}")` : ''}`,
      status: 'pending',
    });

    // Step 2: Accepted
    if (req.accepted_at && req.accepted_by) {
      const snap = actorSnapMap.get(req.accepted_by);
      const actorName = snap?.displayName || 'Staff';
      const actorRole = snap?.roleName || 'Staff';
      steps.push({
        step: 'Request Accepted',
        timestamp: req.accepted_at,
        actorName,
        actorRole,
        description: `Request accepted and taken by ${actorName}${actorRole ? ` (${actorRole})` : ''}.`,
        status: 'accepted',
      });
    }

    // Step 3: Completed / Dismissed
    if (req.resolved_at && req.resolved_by) {
      const snap = actorSnapMap.get(req.resolved_by);
      const actorName = snap?.displayName || 'Staff';
      const actorRole = snap?.roleName || 'Staff';
      const isCompleted = req.status === 'completed';
      steps.push({
        step: isCompleted ? 'Request Completed' : 'Request Dismissed',
        timestamp: req.resolved_at,
        actorName,
        actorRole,
        description: isCompleted
          ? `Request successfully fulfilled and completed by ${actorName}.`
          : `Request was dismissed by ${actorName}.`,
        status: req.status,
      });
    }

    return steps;
  }
}
