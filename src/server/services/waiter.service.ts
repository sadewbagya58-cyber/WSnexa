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

    // Check if user is waiter role and set explicit area boundaries
    let allowedAreaIds: string[] | null = null;
    if (memberRole === 'waiter' && membershipId) {
      const { data: areaAssigns } = await supabase
        .from('staff_area_assignments')
        .select('service_area_id')
        .eq('business_membership_id', membershipId);

      allowedAreaIds = (areaAssigns || []).map((a: { service_area_id: string }) => a.service_area_id);

      // If Waiter is assigned zero service areas, return empty request queue immediately
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

    const records = data as unknown as Array<
      WaiterRequestRecord & { table?: { service_area_id?: string } | null }
    >;

    if (allowedAreaIds !== null) {
      return records.filter(
        (r) => r.table?.service_area_id && allowedAreaIds!.includes(r.table.service_area_id)
      );
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

    // Check membership & role for waiterUserId
    const { data: mem } = await admin
      .from('business_memberships')
      .select('id, role')
      .eq('user_id', waiterUserId)
      .maybeSingle();

    let allowedAreaIds: string[] | null = null;
    if (mem && mem.role !== 'business_owner' && mem.role !== 'branch_manager') {
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

    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, approval_status, status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.approval_status === 'approved') {
      return { success: false, message: 'Order has already been approved.' };
    }

    if (order.approval_status === 'rejected') {
      return { success: false, message: 'Order has already been rejected.' };
    }

    const { error } = await admin
      .from('orders')
      .update({
        approval_status: 'approved',
        status: 'confirmed',
        approved_by_user_id: waiterUserId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('approval_status', 'pending_waiter_approval');

    if (error) {
      return { success: false, message: error.message };
    }

    const { OrderSecurityService } = await import('./order-security.service');
    await OrderSecurityService.logSecurityEvent({
      businessId: order.business_id,
      branchId: order.branch_id,
      orderId: order.id,
      actorUserId: waiterUserId,
      eventType: 'WAITER_APPROVED_ORDER',
    });

    return { success: true, message: 'Order approved successfully and sent to kitchen.' };
  }

  /**
   * Rejects a pending guest order.
   */
  static async rejectGuestOrder(orderId: string, waiterUserId: string, reason?: string) {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, approval_status')
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    if (order.approval_status !== 'pending_waiter_approval') {
      return { success: false, message: `Order status is ${order.approval_status}, cannot reject.` };
    }

    const { error } = await admin
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
      .eq('approval_status', 'pending_waiter_approval');

    if (error) {
      return { success: false, message: error.message };
    }

    const { OrderSecurityService } = await import('./order-security.service');
    await OrderSecurityService.logSecurityEvent({
      businessId: order.business_id,
      branchId: order.branch_id,
      orderId: order.id,
      actorUserId: waiterUserId,
      eventType: 'WAITER_REJECTED_ORDER',
      safeMetadata: { reason },
    });

    return { success: true, message: 'Order rejected.' };
  }

  /**
   * Updates status of a waiter request (Accepted / Completed / Dismissed).
   */
  static async updateWaiterRequestStatus(requestId: string, status: WaiterRequestStatus) {
    const tenantContext = await resolveActiveBusinessContext();
    if (!tenantContext || !tenantContext.activeBranch) {
      return { success: false, message: 'Unauthorized or active branch context not found.' };
    }

    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'dismissed') {
      updatePayload.resolved_at = new Date().toISOString();
      updatePayload.resolved_by = tenantContext.user.id;
    }

    const { error } = await supabase
      .from('waiter_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .eq('business_id', tenantContext.business.id)
      .eq('branch_id', tenantContext.activeBranch.id);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: `Request marked as ${status}.` };
  }
}
