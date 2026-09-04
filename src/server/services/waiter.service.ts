import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { hashQrToken } from '@/lib/qr/security';
import {
  SubmitCustomerAssistanceInput,
  submitCustomerAssistanceSchema,
  WaiterRequestStatus,
} from '@/lib/validation/waiter';

export interface WaiterRequestRecord {
  id: string;
  business_id: string;
  branch_id: string;
  table_id: string;
  order_id: string | null;
  request_type: string;
  status: WaiterRequestStatus;
  notes: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  accepted_staff_name?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  table?: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
  } | null;
}

export class WaiterService {
  /**
   * Submits a customer assistance request (Call Waiter, Need Water, Need Bill, Need Assistance).
   */
  static async submitCustomerAssistance(input: SubmitCustomerAssistanceInput) {
    const parsed = submitCustomerAssistanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid assistance request input.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const { rawQrToken, tableId, requestType, orderId, notes } = parsed.data;
    const tokenHash = hashQrToken(rawQrToken);

    // 1. Authoritative Area QR Resolution & Security Verification
    const { verifyAreaQrToken } = await import('@/lib/qr/area-qr-token');
    const isAreaTokenPrefix = rawQrToken.startsWith('WSN-AQ.');
    const areaVerification = verifyAreaQrToken(rawQrToken);

    if (isAreaTokenPrefix || (areaVerification.valid && areaVerification.payload)) {
      if (!areaVerification.valid || !areaVerification.payload) {
        return {
          success: false,
          message: 'Invalid or tampered Area QR code token.',
          error: 'INVALID_OR_REVOKED_QR',
        };
      }

      const { createAdminClient } = await import('@/lib/supabase/server');
      const admin = createAdminClient();

      // Check persistent DB state in area_qr_codes
      const { data: dbAreaQr } = await admin
        .from('area_qr_codes')
        .select('id, business_id, branch_id, service_area_id, version, is_active, revoked_at, expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!dbAreaQr || !dbAreaQr.is_active || dbAreaQr.revoked_at !== null) {
        return {
          success: false,
          message: 'This Area QR code has been revoked or regenerated.',
          error: 'INVALID_OR_REVOKED_QR',
        };
      }

      if (dbAreaQr.expires_at && new Date(dbAreaQr.expires_at) < new Date()) {
        return {
          success: false,
          message: 'This Area QR code has expired.',
          error: 'INVALID_OR_REVOKED_QR',
        };
      }

      // Validate Branch
      const { data: branchData } = await admin
        .from('branches')
        .select('id, business_id, status, deleted_at')
        .eq('id', dbAreaQr.branch_id)
        .maybeSingle();

      if (!branchData || branchData.status !== 'active' || branchData.deleted_at !== null) {
        return {
          success: false,
          message: 'Venue branch is currently unavailable.',
          error: 'BRANCH_UNAVAILABLE',
        };
      }

      // Validate Table
      if (!tableId) {
        return {
          success: false,
          message: 'Dining table is required for waiter assistance.',
          error: 'TABLE_REQUIRED',
        };
      }

      const { data: tableData } = await admin
        .from('dining_tables')
        .select('id, name, code, is_active, status, deleted_at, branch_id, business_id, service_area_id')
        .eq('id', tableId)
        .maybeSingle();

      if (!tableData || !tableData.is_active || tableData.deleted_at !== null || tableData.status === 'unavailable') {
        return {
          success: false,
          message: 'Selected dining table was not found or is unavailable.',
          error: 'TABLE_NOT_FOUND',
        };
      }

      if (tableData.branch_id !== dbAreaQr.branch_id) {
        return {
          success: false,
          message: 'Selected table does not belong to this venue branch.',
          error: 'CROSS_BRANCH_ATTEMPT_BLOCKED',
        };
      }

      if (tableData.service_area_id !== dbAreaQr.service_area_id) {
        return {
          success: false,
          message: 'Selected table does not belong to this verified dining area.',
          error: 'CROSS_AREA_ATTEMPT_BLOCKED',
        };
      }

      // Optional Order Reference Validation
      if (orderId) {
        const { data: orderData } = await admin
          .from('orders')
          .select('id, branch_id')
          .eq('id', orderId)
          .maybeSingle();

        if (!orderData || orderData.branch_id !== dbAreaQr.branch_id) {
          return {
            success: false,
            message: 'Invalid order reference.',
            error: 'INVALID_ORDER',
          };
        }
      }

      // Insert Waiter Assistance Request
      const { data: newReq, error: reqErr } = await admin
        .from('waiter_requests')
        .insert({
          business_id: dbAreaQr.business_id,
          branch_id: dbAreaQr.branch_id,
          table_id: tableData.id,
          order_id: orderId || null,
          request_type: requestType,
          status: 'pending',
          notes: notes || null,
        })
        .select('id')
        .single();

      if (reqErr || !newReq) {
        return {
          success: false,
          message: reqErr?.message || 'Failed to create waiter assistance request.',
        };
      }

      // Realtime Notification Scoped to Service Area
      const { NotificationService } = await import('./notification.service');
      const isBillReq = requestType === 'need_bill';
      const notificationType = isBillReq ? 'BILL_REQUESTED' : 'WAITER_REQUEST_CREATED';
      const capability = isBillReq ? 'cashier.access' : 'waiter.requests.view';
      const title = isBillReq ? 'Bill Requested' : 'Waiter Assistance Requested';
      const tableName = tableData.name || 'Table';
      const message = `${tableName}: ${notes || (isBillReq ? 'Guest requested bill' : 'Guest requested assistance')}`;
      const actionUrl = isBillReq ? '/dashboard/cashier' : '/dashboard/waiter';

      NotificationService.createNotificationsForCapability({
        businessId: tableData.business_id,
        branchId: tableData.branch_id,
        capability,
        notificationType,
        priority: isBillReq ? 'urgent' : 'high',
        title,
        message,
        entityType: 'waiter_request',
        entityId: newReq.id,
        actionUrl,
        areaId: tableData.service_area_id || null,
      }).catch((err) => console.warn('[WaiterService] Notification dispatch failed:', err));

      return {
        success: true,
        data: {
          requestId: newReq.id,
          tableName: tableData.name,
          requestType,
        },
      };
    }

    // 2. Standard Branch QR Assistance Submission (via RPC)
    const supabase = await createClient();

    const { data, error } = await supabase.rpc('submit_customer_assistance', {
      p_token_hash: tokenHash,
      p_table_id: tableId,
      p_request_type: requestType,
      p_order_id: orderId || null,
      p_notes: notes || null,
    });

    if (error || !data) {
      return {
        success: false,
        message: error?.message || 'Failed to submit assistance request.',
      };
    }

    const res = data as {
      success: boolean;
      error?: string;
      request_id?: string;
      table_name?: string;
      request_type?: string;
    };

    if (!res.success) {
      return {
        success: false,
        message: res.error || 'Failed to submit assistance request.',
      };
    }

    if (res.success && res.request_id && tableId) {
      const { NotificationService } = await import('./notification.service');
      const { createAdminClient } = await import('@/lib/supabase/server');
      const admin = createAdminClient();
      const { data: tableData } = await admin
        .from('dining_tables')
        .select('business_id, branch_id, service_area_id, name')
        .eq('id', tableId)
        .maybeSingle();

      if (tableData) {
        const isBillReq = requestType === 'need_bill';
        const notificationType = isBillReq ? 'BILL_REQUESTED' : 'WAITER_REQUEST_CREATED';
        const capability = isBillReq ? 'cashier.access' : 'waiter.requests.view';
        const title = isBillReq ? 'Bill Requested' : 'Waiter Assistance Requested';
        const tableName = res.table_name || tableData.name || 'Table';
        const message = `${tableName}: ${notes || (isBillReq ? 'Guest requested bill' : 'Guest requested assistance')}`;
        const actionUrl = isBillReq ? '/dashboard/cashier' : '/dashboard/waiter';

        NotificationService.createNotificationsForCapability({
          businessId: tableData.business_id,
          branchId: tableData.branch_id,
          capability,
          notificationType,
          priority: isBillReq ? 'urgent' : 'high',
          title,
          message,
          entityType: 'waiter_request',
          entityId: res.request_id,
          actionUrl,
          areaId: tableData.service_area_id || null,
        }).catch((err) => console.warn('[WaiterService] Notification dispatch failed:', err));
      }
    }

    return {
      success: true,
      data: {
        requestId: res.request_id!,
        tableName: res.table_name!,
        requestType: res.request_type!,
      },
    };
  }

  /**
   * Fetches active waiter requests for active branch staff.
   */
  static async getBranchWaiterRequests(
    branchIdInput?: string,
    userIdInput?: string,
    client?: SupabaseClient
  ): Promise<WaiterRequestRecord[]> {
    const supabase = client || (await createClient());

    let businessId: string;
    let branchId: string;
    let memberRole: string | null = null;
    let membershipId: string | null = null;

    if (branchIdInput && client) {
      branchId = branchIdInput;
      // Resolve businessId from branch
      const { data: bRow } = await supabase
        .from('branches')
        .select('business_id')
        .eq('id', branchIdInput)
        .single();
      businessId = bRow?.business_id;

      if (userIdInput && businessId) {
        const { data: mem } = await supabase
          .from('business_memberships')
          .select('id, role')
          .eq('business_id', businessId)
          .eq('user_id', userIdInput)
          .single();
        if (mem) {
          membershipId = mem.id;
          memberRole = mem.role;
        }
      }
    } else {
      const tenantContext = await resolveActiveBusinessContext();
      if (!tenantContext || !tenantContext.activeBranch) return [];
      businessId = tenantContext.business.id;
      branchId = tenantContext.activeBranch.id;
      membershipId = tenantContext.membership.id;
      memberRole = tenantContext.membership.role;
    }

    // Check if user is waiter role or non-property/org role and set explicit area boundaries
    let allowedAreaIds: string[] | null = null;
    const isPropertyLevel =
      memberRole === 'business_owner' ||
      memberRole === 'branch_manager' ||
      memberRole === 'admin';

    if (!isPropertyLevel && membershipId) {
      const { data: areaAssigns } = await supabase
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', membershipId);

      allowedAreaIds = (areaAssigns || []).map((a: { service_area_id: string }) => a.service_area_id);

      // If Staff is assigned zero service areas, return empty request queue immediately
      if (allowedAreaIds.length === 0) {
        return [];
      }
    }

    const { data, error } = await supabase
      .from('waiter_requests')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number, service_area_id)
      `)
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    let records = data as unknown as Array<
      WaiterRequestRecord & { table?: { service_area_id?: string } | null }
    >;

    if (allowedAreaIds !== null) {
      records = records.filter(
        (r) => r.table?.service_area_id && allowedAreaIds!.includes(r.table.service_area_id)
      );
    }

    const acceptedByIds = Array.from(new Set(records.map((r) => r.accepted_by).filter(Boolean))) as string[];
    if (acceptedByIds.length > 0) {
      try {
        const { PermissionService } = await import('./permission.service');
        const snapMap = await PermissionService.resolveCanonicalActorSnapshots(acceptedByIds, businessId);

        records.forEach((r) => {
          if (r.accepted_by) {
            const snap = snapMap.get(r.accepted_by);
            r.accepted_staff_name = snap ? snap.displayName : 'Staff';
          }
        });
      } catch {
        // Non-blocking fallback
      }
    }

    return records;
  }

  /**
   * Fetches pending guest orders awaiting waiter approval for the active branch and waiter's assigned areas.
   */
  static async getPendingApprovalsForWaiter(
    branchId: string,
    waiterUserId: string,
    customClient?: SupabaseClient
  ) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = customClient || createAdminClient();

    // Resolve branch & business for tenancy safety
    const { data: bRow } = await admin
      .from('branches')
      .select('business_id')
      .eq('id', branchId)
      .maybeSingle();

    if (!bRow?.business_id) return [];

    // Check membership & role for waiterUserId within this business
    const { data: mem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('business_id', bRow.business_id)
      .eq('user_id', waiterUserId)
      .maybeSingle();

    let allowedAreaIds: string[] | null = null;
    const isPropertyLevel =
      mem?.role === 'business_owner' ||
      mem?.role === 'branch_manager' ||
      mem?.role === 'admin';

    if (mem && !isPropertyLevel) {
      const { data: assigns } = await admin
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', mem.id)
        .eq('branch_id', branchId);

      allowedAreaIds = (assigns || []).map((a) => a.service_area_id);
      // Waiter assigned 0 areas receives [] empty queue
      if (allowedAreaIds.length === 0) {
        return [];
      }
    }

    const { data: pendingOrders, error } = await admin
      .from('orders')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number, service_area_id),
        order_items(*, order_item_modifiers(*))
      `)
      .eq('branch_id', branchId)
      .eq('approval_status', 'pending_waiter_approval')
      .order('created_at', { ascending: false });

    if (error || !pendingOrders) return [];

    if (allowedAreaIds !== null) {
      return pendingOrders.filter((o) => {
        const areaId = o.service_area_id || (o.table as { service_area_id?: string } | null)?.service_area_id;
        return areaId && allowedAreaIds!.includes(areaId);
      });
    }

    return pendingOrders;
  }

  /**
   * Approves a pending guest order. Atomically transitions approval_status to 'approved' and releases to kitchen.
   */
  static async approveGuestOrder(orderId: string, waiterUserId: string) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = createAdminClient();

    // 1. Fetch order details with table service area to verify tenancy & scope
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, table_id, service_area_id, approval_status, table:dining_tables(service_area_id)')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.approval_status !== 'pending_waiter_approval') {
      return { success: false, message: 'Order is no longer pending approval.' };
    }

    // Resolve membership & scope in order's business
    const { data: mem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('business_id', order.business_id)
      .eq('user_id', waiterUserId)
      .maybeSingle();

    if (!mem) {
      return { success: false, message: 'Unauthorized staff member.' };
    }

    const isPropertyLevel =
      mem.role === 'business_owner' ||
      mem.role === 'branch_manager' ||
      mem.role === 'admin';

    const orderAreaId = order.service_area_id || (order.table as { service_area_id?: string } | null)?.service_area_id;

    if (!isPropertyLevel && orderAreaId) {
      const { data: assigns } = await admin
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', mem.id)
        .eq('branch_id', order.branch_id);

      const assignedAreaIds = (assigns || []).map((a) => a.service_area_id);
      if (!assignedAreaIds.includes(orderAreaId)) {
        return { success: false, message: 'Forbidden: Order is outside your assigned service area.' };
      }
    }

    const { data: updatedRows, error } = await admin
      .from('orders')
      .update({
        approval_status: 'approved',
        status: 'confirmed',
        approved_by_user_id: waiterUserId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('approval_status', 'pending_waiter_approval')
      .select('id, business_id, branch_id, order_number_formatted');

    if (error) {
      return { success: false, message: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return { success: false, message: 'Order is no longer pending approval.' };
    }

    const updatedOrder = updatedRows[0];

    const { OrderSecurityService } = await import('./order-security.service');
    await OrderSecurityService.logSecurityEvent({
      businessId: updatedOrder.business_id,
      branchId: updatedOrder.branch_id,
      orderId: updatedOrder.id,
      actorUserId: waiterUserId,
      eventType: 'WAITER_APPROVED_ORDER',
    });

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.logAuditEvent({
        businessId: updatedOrder.business_id,
        branchId: updatedOrder.branch_id,
        serviceAreaId: orderAreaId || null,
        actorUserId: waiterUserId,
        action: 'waiter.order.approved',
        entityType: 'order',
        entityId: updatedOrder.id,
        oldValues: { approval_status: 'pending_waiter_approval' },
        newValues: { approval_status: 'approved', status: 'confirmed' },
        metadata: { order_number: updatedOrder.order_number_formatted },
      });
    } catch (auditErr) {
      console.warn('[WaiterService.approveGuestOrder] Audit log warning:', auditErr);
    }

    // Notify Kitchen of newly approved order
    try {
      const { NotificationService } = await import('./notification.service');
      const orderNum = updatedOrder.order_number_formatted || updatedOrder.id.slice(0, 6);
      await NotificationService.createNotificationsForCapability({
        businessId: updatedOrder.business_id,
        branchId: updatedOrder.branch_id,
        capability: 'kitchen.access',
        notificationType: 'ORDER_CREATED',
        priority: 'high',
        title: 'New Order (Approved by Waiter)',
        message: `Order #${orderNum} has been approved and sent to kitchen`,
        entityType: 'order',
        entityId: updatedOrder.id,
        actionUrl: '/dashboard/kitchen',
      });
    } catch (notifErr) {
      console.warn('[WaiterService] Kitchen notification after approval warning:', notifErr);
    }

    // Automated Inventory Consumption Trigger for confirmed order (Phase 28)
    try {
      const { ConsumptionService } = await import('./consumption.service');
      await ConsumptionService.processOrderStageConsumption(updatedOrder.id, 'confirmed', waiterUserId);
    } catch (consErr) {
      console.error('[WaiterService.approveGuestOrder] Automated consumption trigger error:', consErr);
    }

    return { success: true, message: 'Order approved successfully and sent to kitchen.' };
  }

  /**
   * Rejects a pending guest order.
   */
  static async rejectGuestOrder(orderId: string, waiterUserId: string, reason?: string) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = createAdminClient();

    // 1. Fetch order details with table service area to verify tenancy & scope
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, table_id, service_area_id, approval_status, table:dining_tables(service_area_id)')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.approval_status !== 'pending_waiter_approval') {
      return { success: false, message: 'Order is no longer pending approval.' };
    }

    // Resolve membership & scope in order's business
    const { data: mem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('business_id', order.business_id)
      .eq('user_id', waiterUserId)
      .maybeSingle();

    if (!mem) {
      return { success: false, message: 'Unauthorized staff member.' };
    }

    const isPropertyLevel =
      mem.role === 'business_owner' ||
      mem.role === 'branch_manager' ||
      mem.role === 'admin';

    const orderAreaId = order.service_area_id || (order.table as { service_area_id?: string } | null)?.service_area_id;

    if (!isPropertyLevel && orderAreaId) {
      const { data: assigns } = await admin
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', mem.id)
        .eq('branch_id', order.branch_id);

      const assignedAreaIds = (assigns || []).map((a) => a.service_area_id);
      if (!assignedAreaIds.includes(orderAreaId)) {
        return { success: false, message: 'Forbidden: Order is outside your assigned service area.' };
      }
    }

    const { data: updatedRows, error } = await admin
      .from('orders')
      .update({
        approval_status: 'rejected',
        status: 'cancelled',
        rejected_by_user_id: waiterUserId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason || 'Rejected by staff',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('approval_status', 'pending_waiter_approval')
      .select('id, business_id, branch_id');

    if (error) {
      return { success: false, message: error.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return { success: false, message: 'Order is no longer pending approval.' };
    }

    const updatedOrder = updatedRows[0];

    const { OrderSecurityService } = await import('./order-security.service');
    await OrderSecurityService.logSecurityEvent({
      businessId: updatedOrder.business_id,
      branchId: updatedOrder.branch_id,
      orderId: updatedOrder.id,
      actorUserId: waiterUserId,
      eventType: 'WAITER_REJECTED_ORDER',
      safeMetadata: { reason },
    });

    try {
      const { AuditService } = await import('./audit.service');
      await AuditService.logAuditEvent({
        businessId: updatedOrder.business_id,
        branchId: updatedOrder.branch_id,
        serviceAreaId: orderAreaId || null,
        actorUserId: waiterUserId,
        action: 'waiter.order.rejected',
        entityType: 'order',
        entityId: updatedOrder.id,
        oldValues: { approval_status: 'pending_waiter_approval' },
        newValues: { approval_status: 'rejected', status: 'cancelled' },
        reason: reason || 'Rejected by staff',
      });
    } catch (auditErr) {
      console.warn('[WaiterService.rejectGuestOrder] Audit log warning:', auditErr);
    }

    return { success: true, message: 'Order rejected.' };
  }

  /**
   * Updates status of a waiter request (Accepted / Completed / Dismissed) with strict state machine and concurrency protection.
   */
  static async updateWaiterRequestStatus(requestId: string, status: WaiterRequestStatus) {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = createAdminClient();

    // 1. Fetch current request state with table service area
    const { data: currentReq } = await admin
      .from('waiter_requests')
      .select('id, business_id, branch_id, table_id, status, accepted_by, accepted_at, table:dining_tables(service_area_id)')
      .eq('id', requestId)
      .eq('business_id', tenantContext.business.id)
      .maybeSingle();

    if (!currentReq) {
      return { success: false, message: 'Waiter request not found.' };
    }

    const isPropertyLevel =
      tenantContext.membership?.role === 'business_owner' ||
      tenantContext.membership?.role === 'branch_manager' ||
      tenantContext.membership?.role === 'admin';

    const reqAreaId = (currentReq.table as { service_area_id?: string } | null)?.service_area_id;

    if (!isPropertyLevel && reqAreaId && tenantContext.membership) {
      const { data: areaAssigns } = await admin
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', tenantContext.membership.id);

      const assignedAreaIds = (areaAssigns || []).map((a) => a.service_area_id);
      if (!assignedAreaIds.includes(reqAreaId)) {
        return { success: false, message: 'Forbidden: Request is outside your assigned service area.' };
      }
    }

    // 2. Idempotent check: already at target status
    if (currentReq.status === status) {
      return { success: true, message: `Request is already ${status}.` };
    }

    // 3. Terminal state check: completed or dismissed requests cannot be transitioned
    if (currentReq.status === 'completed' || currentReq.status === 'dismissed') {
      return { success: false, message: `Request has already been ${currentReq.status} and cannot be modified.` };
    }

    const nowIso = new Date().toISOString();

    // 4. State Machine Transition: PENDING -> ACCEPTED
    if (status === 'accepted') {
      if (currentReq.status !== 'pending') {
        return { success: false, message: `Request is in ${currentReq.status} state, cannot accept.` };
      }

      // Atomic conditional update: only update if status is still 'pending'
      const { data: updated, error } = await admin
        .from('waiter_requests')
        .update({
          status: 'accepted',
          accepted_by: tenantContext.user.id,
          accepted_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select();

      if (error) {
        return { success: false, message: error.message };
      }

      if (!updated || updated.length === 0) {
        return {
          success: false,
          message: 'This request has already been accepted or handled by another staff member.',
        };
      }

      try {
        const { AuditService } = await import('./audit.service');
        await AuditService.logAuditEvent({
          businessId: currentReq.business_id,
          branchId: currentReq.branch_id,
          serviceAreaId: reqAreaId || null,
          actorUserId: tenantContext.user.id,
          action: 'waiter_request.accepted',
          entityType: 'waiter_request',
          entityId: requestId,
          oldValues: { status: currentReq.status },
          newValues: { status: 'accepted', accepted_by: tenantContext.user.id, accepted_at: nowIso },
        });
      } catch (auditErr) {
        console.warn('[WaiterService.updateWaiterRequestStatus] Audit warning:', auditErr);
      }

      return { success: true, message: 'Request accepted successfully.' };
    }

    // 5. State Machine Transition: ACCEPTED -> COMPLETED
    if (status === 'completed') {
      // Normal waiter must NOT directly complete a PENDING request
      if (currentReq.status === 'pending') {
        const isManager =
          tenantContext.membership?.role === 'business_owner' ||
          tenantContext.membership?.role === 'branch_manager';

        if (!isManager) {
          return {
            success: false,
            message: 'Waiter assistance requests must be accepted before they can be completed.',
          };
        }
      }

      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        resolved_by: tenantContext.user.id,
        resolved_at: nowIso,
        updated_at: nowIso,
      };

      // If completing directly via manager override, snapshot accepted details as well
      if (!currentReq.accepted_by) {
        updatePayload.accepted_by = tenantContext.user.id;
        updatePayload.accepted_at = nowIso;
      }

      const { data: updated, error } = await admin
        .from('waiter_requests')
        .update(updatePayload)
        .eq('id', requestId)
        .in('status', ['pending', 'accepted'])
        .select();

      if (error) {
        return { success: false, message: error.message };
      }

      if (!updated || updated.length === 0) {
        return {
          success: false,
          message: 'This request has already been completed or dismissed.',
        };
      }

      try {
        const { AuditService } = await import('./audit.service');
        await AuditService.logAuditEvent({
          businessId: currentReq.business_id,
          branchId: currentReq.branch_id,
          serviceAreaId: reqAreaId || null,
          actorUserId: tenantContext.user.id,
          action: 'waiter_request.completed',
          entityType: 'waiter_request',
          entityId: requestId,
          oldValues: { status: currentReq.status },
          newValues: { status: 'completed', resolved_by: tenantContext.user.id, resolved_at: nowIso },
        });
      } catch (auditErr) {
        console.warn('[WaiterService.updateWaiterRequestStatus] Audit warning:', auditErr);
      }

      return { success: true, message: 'Request marked as completed.' };
    }

    // 6. State Machine Transition: -> DISMISSED
    if (status === 'dismissed') {
      const { data: updated, error } = await admin
        .from('waiter_requests')
        .update({
          status: 'dismissed',
          resolved_by: tenantContext.user.id,
          resolved_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', requestId)
        .in('status', ['pending', 'accepted'])
        .select();

      if (error) {
        return { success: false, message: error.message };
      }

      if (!updated || updated.length === 0) {
        return {
          success: false,
          message: 'This request has already been handled.',
        };
      }

      try {
        const { AuditService } = await import('./audit.service');
        await AuditService.logAuditEvent({
          businessId: currentReq.business_id,
          branchId: currentReq.branch_id,
          serviceAreaId: reqAreaId || null,
          actorUserId: tenantContext.user.id,
          action: 'waiter_request.dismissed',
          entityType: 'waiter_request',
          entityId: requestId,
          oldValues: { status: currentReq.status },
          newValues: { status: 'dismissed', resolved_by: tenantContext.user.id, resolved_at: nowIso },
        });
      } catch (auditErr) {
        console.warn('[WaiterService.updateWaiterRequestStatus] Audit warning:', auditErr);
      }

      return { success: true, message: 'Request dismissed.' };
    }

    return { success: false, message: `Unsupported status transition to ${status}.` };
  }
}
