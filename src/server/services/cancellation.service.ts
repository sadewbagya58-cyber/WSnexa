import { createAdminClient } from '@/lib/supabase/server';
import { AuditService } from '@/server/services/audit.service';
import { revalidatePath } from 'next/cache';

export type CancellationChannel =
  | 'customer_qr'
  | 'waiter_menu'
  | 'kitchen_kds'
  | 'cashier_pos'
  | 'manager_workflow';

export type RequestedByType = 'customer' | 'staff' | 'system';

export type InventoryDisposition = 'return_to_stock' | 'record_waste' | 'none';

export type CustomerCancellationPolicy =
  | 'disabled'
  | 'before_confirmation'
  | 'within_time_limit'
  | 'before_preparation';

export interface CustomerPolicyEvaluation {
  canCancel: boolean;
  policy: CustomerCancellationPolicy;
  timeLimitMinutes: number;
  timeRemainingSeconds?: number;
  reason?: string;
  order?: {
    id: string;
    business_id: string;
    branch_id: string;
    status: string;
    total_cents: number;
    payment_status: string;
    created_at: string;
  };
}

export interface CancelOrderParams {
  orderId: string;
  channel: CancellationChannel;
  requestedByType: RequestedByType;
  reasonCategory: string;
  reasonNotes?: string;
  inventoryDisposition?: InventoryDisposition;
  actorUserId?: string | null;
  guestAccessToken?: string | null;
  customerUserId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CancelOrderItemParams {
  orderId: string;
  orderItemId: string;
  cancelledQuantity: number;
  channel: CancellationChannel;
  actorUserId: string;
  reasonCategory: string;
  reasonNotes?: string;
  inventoryDisposition: InventoryDisposition;
  metadata?: Record<string, unknown>;
}

export interface RequestCancellationParams {
  orderId: string;
  channel: CancellationChannel;
  requestedByUserId?: string | null;
  reasonCategory: string;
  reasonNotes?: string;
  metadata?: Record<string, unknown>;
}

export class CancellationService {
  /**
   * Evaluates whether a customer is eligible to cancel their order based on venue/branch policy.
   * Enforces server-side identity verification via guestAccessToken or customerUserId.
   */
  static async evaluateCustomerCancellationPolicy(
    orderId: string,
    guestAccessToken?: string | null,
    customerUserId?: string | null
  ): Promise<CustomerPolicyEvaluation> {
    const admin = createAdminClient();

    // 1. Fetch order details
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, business_id, branch_id, status, total_cents, payment_status, access_token, customer_user_id, created_at')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return {
        canCancel: false,
        policy: 'disabled',
        timeLimitMinutes: 0,
        reason: 'Order not found.',
      };
    }

    // 2. Verify customer ownership
    const isGuestOwner = Boolean(guestAccessToken && order.access_token === guestAccessToken);
    const isAccountOwner = Boolean(customerUserId && order.customer_user_id === customerUserId);

    if (!isGuestOwner && !isAccountOwner) {
      return {
        canCancel: false,
        policy: 'disabled',
        timeLimitMinutes: 0,
        reason: 'Unauthorized: You do not have permission to access or cancel this order.',
      };
    }

    // 3. Immutability invariants
    if (order.status === 'completed') {
      return {
        canCancel: false,
        policy: 'disabled',
        timeLimitMinutes: 0,
        reason: 'Completed orders are immutable and cannot be cancelled.',
        order,
      };
    }

    if (order.status === 'cancelled') {
      return {
        canCancel: false,
        policy: 'disabled',
        timeLimitMinutes: 0,
        reason: 'This order is already cancelled.',
        order,
      };
    }

    // 4. Fetch venue policy from branch_order_security_settings
    const { data: settings } = await admin
      .from('branch_order_security_settings')
      .select('customer_cancellation_policy, cancellation_time_limit_minutes')
      .eq('branch_id', order.branch_id)
      .maybeSingle();

    const policy: CustomerCancellationPolicy = settings?.customer_cancellation_policy || 'before_confirmation';
    const timeLimitMinutes: number = settings?.cancellation_time_limit_minutes || 5;

    // 5. Evaluate policy rules
    if (policy === 'disabled') {
      return {
        canCancel: false,
        policy,
        timeLimitMinutes,
        reason: 'Customer cancellation is disabled by this venue. Please notify a staff member.',
        order,
      };
    }

    if (policy === 'before_confirmation') {
      const isPending = order.status === 'pending';
      return {
        canCancel: isPending,
        policy,
        timeLimitMinutes,
        reason: isPending
          ? undefined
          : 'Order has already been confirmed and can no longer be cancelled directly.',
        order,
      };
    }

    if (policy === 'within_time_limit') {
      const orderCreatedAt = new Date(order.created_at).getTime();
      const now = Date.now();
      const elapsedSeconds = (now - orderCreatedAt) / 1000;
      const totalLimitSeconds = timeLimitMinutes * 60;
      const remainingSeconds = Math.max(0, Math.floor(totalLimitSeconds - elapsedSeconds));

      const isWithinLimit = elapsedSeconds <= totalLimitSeconds;
      return {
        canCancel: isWithinLimit,
        policy,
        timeLimitMinutes,
        timeRemainingSeconds: remainingSeconds,
        reason: isWithinLimit
          ? undefined
          : `The ${timeLimitMinutes}-minute cancellation window has expired.`,
        order,
      };
    }

    if (policy === 'before_preparation') {
      const isBeforePrep = order.status === 'pending' || order.status === 'confirmed';
      return {
        canCancel: isBeforePrep,
        policy,
        timeLimitMinutes,
        reason: isBeforePrep
          ? undefined
          : 'Kitchen preparation has already started. Order cannot be cancelled.',
        order,
      };
    }

    return {
      canCancel: false,
      policy: 'disabled',
      timeLimitMinutes: 0,
      reason: 'Unknown cancellation policy.',
      order,
    };
  }

  /**
   * Centralized cancelOrder engine executing full order cancellation across all channels.
   */
  static async cancelOrder(params: CancelOrderParams) {
    const admin = createAdminClient();

    // 1. Fetch target order
    const { data: order, error: fetchErr } = await admin
      .from('orders')
      .select('id, business_id, branch_id, status, payment_status, total_cents, access_token, customer_user_id')
      .eq('id', params.orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return { success: false, code: 'ORDER_NOT_FOUND', message: 'Order not found.' };
    }

    // 2. Strictly prevent cancelling completed orders
    if (order.status === 'completed') {
      return {
        success: false,
        code: 'ORDER_ALREADY_COMPLETED',
        message: 'Completed orders are immutable and cannot be cancelled.',
      };
    }

    // 3. Idempotent check: if order is already cancelled
    if (order.status === 'cancelled') {
      return {
        success: true,
        idempotent: true,
        message: 'Order is already cancelled.',
        data: { orderId: order.id, status: 'cancelled' },
      };
    }

    let effectiveDisposition: InventoryDisposition = params.inventoryDisposition || 'none';

    // 4. Channel / Requestor validation
    if (params.requestedByType === 'customer') {
      const evalResult = await this.evaluateCustomerCancellationPolicy(
        order.id,
        params.guestAccessToken,
        params.customerUserId
      );

      if (!evalResult.canCancel) {
        return {
          success: false,
          code: 'POLICY_VIOLATION',
          message: evalResult.reason || 'Order cancellation is not permitted under current venue policy.',
        };
      }

      // Safe inventory rule: if cancelled before prep, disposition is 'none' (zero phantom stock)
      // If food had already started prep (under time-limit policy), food is wasted
      if (order.status === 'pending' || order.status === 'confirmed') {
        effectiveDisposition = 'none';
      } else {
        effectiveDisposition = 'record_waste';
      }
    } else if (params.requestedByType === 'staff') {
      // Staff authorization validation
      const { can, resolveAuthorizationContext } = await import('@/server/auth');
      let authContext;
      try {
        authContext = await resolveAuthorizationContext();
      } catch {
        return { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized staff session.' };
      }

      if (!authContext || authContext.businessId !== order.business_id) {
        return { success: false, code: 'UNAUTHORIZED', message: 'Staff user does not belong to this business.' };
      }

      const isAuthorized = await can({
        context: authContext,
        permission: 'orders.cancel',
        resource: { type: 'order', id: order.id },
      });

      if (!isAuthorized) {
        return {
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not have permission to cancel orders (orders.cancel).',
        };
      }

      // If order is currently in preparation, check if manager approval is required
      if (order.status === 'preparing' || order.status === 'ready') {
        const { data: settings } = await admin
          .from('branch_order_security_settings')
          .select('require_manager_approval_after_prep')
          .eq('branch_id', order.branch_id)
          .maybeSingle();

        const requiresApproval = settings?.require_manager_approval_after_prep ?? true;
        const isManagerOrOwner =
          authContext.isBusinessOwner ||
          authContext.membershipRole === 'business_owner' ||
          authContext.membershipRole === 'branch_manager' ||
          authContext.membershipRole === 'general_manager';

        if (requiresApproval && !isManagerOrOwner) {
          return {
            success: false,
            code: 'REQUIRES_APPROVAL',
            message: 'Food preparation has already begun. Manager approval is required to cancel this order.',
          };
        }
      }
    }

    // 5. Execute atomic cancellation RPC
    const { data: rpcData, error: rpcError } = await admin.rpc('cancel_order_atomic', {
      p_order_id: order.id,
      p_channel: params.channel,
      p_requested_by_type: params.requestedByType,
      p_reason_category: params.reasonCategory,
      p_reason_notes: params.reasonNotes || '',
      p_disposition: effectiveDisposition,
      p_actor_id: params.actorUserId || null,
      p_guest_access_token_used: Boolean(params.guestAccessToken),
      p_metadata: params.metadata || {},
    });

    if (rpcError || !rpcData?.success) {
      console.error('[CancellationService.cancelOrder] RPC error:', rpcError || rpcData?.error);
      return {
        success: false,
        code: rpcData?.error || 'CANCELLATION_FAILED',
        message: rpcError?.message || rpcData?.error || 'Failed to cancel order.',
      };
    }

    // 6. Audit Logging
    try {
      await AuditService.logAuditEvent({
        businessId: order.business_id,
        branchId: order.branch_id,
        actorUserId: params.actorUserId || null,
        actorNameSnapshot: params.requestedByType === 'customer' ? 'Customer' : 'Staff',
        actorRoleSnapshot: params.requestedByType === 'customer' ? 'customer' : 'staff',
        action: 'order.cancelled',
        entityType: 'order',
        entityId: order.id,
        oldValues: { status: order.status },
        newValues: {
          status: 'cancelled',
          disposition: effectiveDisposition,
          refund_eligibility: rpcData.refund_eligibility,
        },
        reason: params.reasonNotes || params.reasonCategory,
        metadata: {
          channel: params.channel,
          requestedByType: params.requestedByType,
          reasonCategory: params.reasonCategory,
          ...params.metadata,
        },
      });
    } catch (auditErr) {
      console.warn('[CancellationService] Audit log warning:', auditErr);
    }

    // 7. Revalidation for UI responsiveness
    try {
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/kitchen');
      revalidatePath('/dashboard/waiter');
      revalidatePath('/dashboard/cashier');
      revalidatePath(`/dashboard/orders/${order.id}`);
      revalidatePath('/customer/orders');
      revalidatePath(`/customer/orders/${order.id}`);
    } catch {
      // Ignore during non-request contexts
    }

    return {
      success: true,
      message: 'Order cancelled successfully.',
      data: rpcData,
    };
  }

  /**
   * Centralized cancelOrderItem engine executing item-level cancellation/adjustment.
   */
  static async cancelOrderItem(params: CancelOrderItemParams) {
    const admin = createAdminClient();

    // 1. Authorization check
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized staff session.' };
    }

    // 2. Fetch order & target item
    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, status, payment_status, total_cents, subtotal_cents')
      .eq('id', params.orderId)
      .maybeSingle();

    if (!order || order.business_id !== authContext?.businessId) {
      return { success: false, code: 'ORDER_NOT_FOUND', message: 'Order not found in active business.' };
    }

    if (order.status === 'completed') {
      return { success: false, code: 'ORDER_ALREADY_COMPLETED', message: 'Completed orders cannot be modified.' };
    }

    if (order.status === 'cancelled') {
      return { success: false, code: 'ORDER_ALREADY_CANCELLED', message: 'Order is already cancelled.' };
    }

    const isAuthorized = await can({
      context: authContext,
      permission: 'orders.cancel',
      resource: { type: 'order', id: order.id },
    });

    if (!isAuthorized) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: 'You do not have permission to adjust or cancel order items.',
      };
    }

    const { data: item } = await admin
      .from('order_items')
      .select('id, order_id, quantity, cancelled_quantity, unit_price_cents_snapshot, item_name_snapshot, status')
      .eq('id', params.orderItemId)
      .eq('order_id', order.id)
      .maybeSingle();

    if (!item) {
      return { success: false, code: 'ITEM_NOT_FOUND', message: 'Order item not found.' };
    }

    const remainingQty = item.quantity - (item.cancelled_quantity || 0);
    if (params.cancelledQuantity <= 0 || params.cancelledQuantity > remainingQty) {
      return {
        success: false,
        code: 'INVALID_QUANTITY',
        message: `Cancellation quantity must be between 1 and remaining uncancelled quantity (${remainingQty}).`,
      };
    }

    // 3. Execute atomic item inventory reversal RPC
    const { data: rpcData, error: rpcError } = await admin.rpc('reverse_order_item_consumption', {
      p_order_id: order.id,
      p_order_item_id: item.id,
      p_cancelled_qty: params.cancelledQuantity,
      p_disposition: params.inventoryDisposition,
      p_reason: params.reasonNotes || params.reasonCategory,
      p_actor_id: params.actorUserId,
    });

    if (rpcError || !rpcData?.success) {
      return {
        success: false,
        code: rpcData?.error || 'ITEM_REVERSAL_FAILED',
        message: rpcError?.message || rpcData?.error || 'Failed to adjust order item inventory.',
      };
    }

    // 4. Record cancellation audit record
    const centsDeducted = item.unit_price_cents_snapshot * params.cancelledQuantity;
    const isFullItemCancel = params.cancelledQuantity >= remainingQty;

    const { data: cancellationRecord } = await admin
      .from('order_cancellations')
      .insert({
        business_id: order.business_id,
        branch_id: order.branch_id,
        order_id: order.id,
        cancellation_scope: 'item_level',
        channel: params.channel,
        requested_by_type: 'staff',
        requested_by_user_id: params.actorUserId,
        reason_category: params.reasonCategory,
        reason_notes: params.reasonNotes || '',
        approval_status: 'approved',
        approved_by_user_id: params.actorUserId,
        inventory_disposition: params.inventoryDisposition,
        refund_required: order.payment_status === 'paid',
        approved_at: new Date().toISOString(),
        metadata: {
          order_item_id: item.id,
          item_name: item.item_name_snapshot,
          quantity_cancelled: params.cancelledQuantity,
          ...params.metadata,
        },
      })
      .select('id')
      .single();

    if (cancellationRecord?.id) {
      await admin.from('order_cancellation_items').insert({
        cancellation_id: cancellationRecord.id,
        order_item_id: item.id,
        quantity_cancelled: params.cancelledQuantity,
        unit_price_cents_snapshot: item.unit_price_cents_snapshot,
        line_subtotal_cancelled_cents: centsDeducted,
        inventory_disposition: params.inventoryDisposition,
        base_quantity_reversed: rpcData.total_base_qty_reversed || 0.0,
        cost_cents_reversed: rpcData.total_cost_cents_reversed || 0,
      });
    }

    // 5. Check if all items on the order are now cancelled
    const { data: allItems } = await admin
      .from('order_items')
      .select('id, quantity, cancelled_quantity, status')
      .eq('order_id', order.id);

    const allCancelled = allItems?.every((i) => i.status === 'cancelled' || i.quantity <= i.cancelled_quantity);

    if (allCancelled) {
      // Auto-cancel full order
      await this.cancelOrder({
        orderId: order.id,
        channel: params.channel,
        requestedByType: 'staff',
        reasonCategory: params.reasonCategory,
        reasonNotes: 'All items cancelled - auto closing order',
        inventoryDisposition: 'none',
        actorUserId: params.actorUserId,
      });
    }

    // 6. Audit Logging
    try {
      await AuditService.logAuditEvent({
        businessId: order.business_id,
        branchId: order.branch_id,
        actorUserId: params.actorUserId,
        action: 'order.item_cancelled',
        entityType: 'order_item',
        entityId: item.id,
        oldValues: {
          cancelled_quantity: item.cancelled_quantity,
          status: item.status,
        },
        newValues: {
          cancelled_quantity: (item.cancelled_quantity || 0) + params.cancelledQuantity,
          status: isFullItemCancel ? 'cancelled' : 'partially_cancelled',
          disposition: params.inventoryDisposition,
        },
        reason: params.reasonNotes || params.reasonCategory,
      });
    } catch (auditErr) {
      console.warn('[CancellationService] Item audit log warning:', auditErr);
    }

    // 7. Revalidation
    try {
      revalidatePath('/dashboard/orders');
      revalidatePath('/dashboard/kitchen');
      revalidatePath('/dashboard/waiter');
      revalidatePath(`/dashboard/orders/${order.id}`);
    } catch {
      // Ignore during non-request contexts
    }

    return {
      success: true,
      message: `Successfully cancelled ${params.cancelledQuantity}x ${item.item_name_snapshot}.`,
      data: rpcData,
    };
  }

  /**
   * Submits a manager approval request for order cancellation.
   */
  static async requestCancellationApproval(params: RequestCancellationParams) {
    const admin = createAdminClient();

    const { data: order } = await admin
      .from('orders')
      .select('id, business_id, branch_id, status, payment_status')
      .eq('id', params.orderId)
      .maybeSingle();

    if (!order) return { success: false, message: 'Order not found.' };

    const { data: request, error } = await admin
      .from('order_cancellations')
      .insert({
        business_id: order.business_id,
        branch_id: order.branch_id,
        order_id: order.id,
        cancellation_scope: 'request',
        channel: params.channel,
        requested_by_type: 'staff',
        requested_by_user_id: params.requestedByUserId,
        reason_category: params.reasonCategory,
        reason_notes: params.reasonNotes || '',
        approval_status: 'pending_approval',
        refund_required: order.payment_status === 'paid',
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    try {
      await AuditService.logAuditEvent({
        businessId: order.business_id,
        branchId: order.branch_id,
        actorUserId: params.requestedByUserId,
        action: 'order.cancellation_requested',
        entityType: 'order',
        entityId: order.id,
        reason: params.reasonNotes || params.reasonCategory,
      });
    } catch (err) {
      console.warn('[CancellationService] Approval request audit warning:', err);
    }

    return {
      success: true,
      message: 'Cancellation approval requested from management.',
      requestId: request?.id,
    };
  }

  /**
   * Resolves a pending cancellation approval request (by manager or owner).
   */
  static async resolveCancellationApproval(
    requestId: string,
    decision: 'approved' | 'rejected',
    actorUserId?: string | null,
    notes?: string,
    inventoryDisposition: InventoryDisposition = 'record_waste'
  ) {
    const admin = createAdminClient();

    const { data: req } = await admin
      .from('order_cancellations')
      .select('*')
      .eq('id', requestId)
      .eq('approval_status', 'pending_approval')
      .maybeSingle();

    if (!req) {
      return { success: false, message: 'Pending cancellation request not found.', data: null };
    }

    if (decision === 'rejected') {
      await admin
        .from('order_cancellations')
        .update({
          approval_status: 'rejected',
          rejected_at: new Date().toISOString(),
          approved_by_user_id: actorUserId || null,
          reason_notes: notes || req.reason_notes,
        })
        .eq('id', requestId);

      return { success: true, message: 'Cancellation request rejected.', data: null };
    }

    // Approved: execute full cancellation
    const cancelRes = await this.cancelOrder({
      orderId: req.order_id,
      channel: 'manager_workflow',
      requestedByType: 'staff',
      reasonCategory: req.reason_category,
      reasonNotes: notes || req.reason_notes || 'Approved by manager',
      inventoryDisposition,
      actorUserId: actorUserId || undefined,
    });

    if (cancelRes.success) {
      await admin
        .from('order_cancellations')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_user_id: actorUserId || null,
        })
        .eq('id', requestId);
    }

    return cancelRes;
  }
}
