import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { hashQrToken, hashTablePin } from '@/lib/qr/security';
import { verifySignedTableAccessProof } from '@/lib/qr/table-access-proof';
import { IS_LOYALTY_ENABLED } from '@/lib/config/features';
import {
  CreateGuestOrderInput,
  createGuestOrderSchema,
  OrderStatus,
} from '@/lib/validation/order';

export interface OrderItemModifierRecord {
  id: string;
  group_name_snapshot: string;
  option_name_snapshot: string;
  additional_price_cents_snapshot: number;
}

export interface OrderItemRecord {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_cents_snapshot: number;
  quantity: number;
  line_subtotal_cents: number;
  special_instructions: string | null;
  order_item_modifiers: OrderItemModifierRecord[];
}

export interface OrderRecord {
  id: string;
  business_id: string;
  branch_id: string;
  table_id: string | null;
  order_number: number;
  order_number_formatted: string;
  idempotency_key: string;
  access_token: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  guest_name: string | null;
  guest_phone: string | null;
  guest_notes: string | null;
  subtotal_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  discount_cents?: number;
  reward_id?: string | null;
  reward_title_snapshot?: string | null;
  reward_points_redeemed_snapshot?: number;
  total_cents: number;
  currency: string;
  customer_user_id?: string | null;
  amount_paid_cents?: number;
  balance_due_cents?: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  service_area_id?: string | null;
  service_area_name_snapshot?: string | null;
  approval_status?: string;
  approved_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  location_verified?: boolean;
  table?: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
    service_area?: {
      id: string;
      name: string;
    } | null;
  } | null;
  items?: OrderItemRecord[];
}

export class OrderService {
  /**
   * Submits a guest order atomically via private service-role create_guest_order RPC.
   * Table PIN is verified ONLY ONCE at table selection time.
   * Checkout uses server-verified HMAC signed proof without re-verifying or comparing PIN hashes.
   */
  static async createGuestOrder(input: CreateGuestOrderInput, userIdInput?: string | null) {
    const parsed = createGuestOrderSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        message: 'Invalid order input data.',
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      rawQrToken,
      tableId,
      inputPin,
      signedTableAccessProof,
      guestName,
      guestPhone,
      guestNotes,
      paymentMethod,
      idempotencyKey,
      cartItems,
    } = parsed.data;

    const tokenHash = hashQrToken(rawQrToken);
    const admin = createAdminClient();

    const serviceRoleConfigured = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
    );

    let isTableAccessVerified = false;
    let adminTableFound = false;
    let proofValid = false;
    let proofBranchMatches = false;
    let proofTableMatches = false;
    let proofExpired = false;
    let branchIdPrefix = 'none';

    // 1. If table is selected, verify table proof or direct input PIN
    if (tableId) {
      // Fetch table status and branch ID using admin client
      const { data: tableData } = await admin
        .from('dining_tables')
        .select('id, branch_id, is_active, status, deleted_at')
        .eq('id', tableId)
        .maybeSingle();

      if (tableData && tableData.is_active && !tableData.deleted_at && tableData.status !== 'unavailable') {
        adminTableFound = true;
        branchIdPrefix = tableData.branch_id ? tableData.branch_id.substring(0, 8) : 'none';

        // Check if signed table access proof is provided
        if (signedTableAccessProof) {
          const proofResult = verifySignedTableAccessProof(
            signedTableAccessProof,
            tableData.branch_id,
            tableId
          );

          proofValid = proofResult.valid;
          proofExpired = proofResult.error === 'EXPIRED';
          proofBranchMatches = proofResult.error !== 'BRANCH_MISMATCH';
          proofTableMatches = proofResult.error !== 'TABLE_MISMATCH';

          if (proofResult.valid) {
            isTableAccessVerified = true;
          }
        } else if (inputPin && inputPin.trim().length > 0) {
          // Optional direct input PIN verification fallback
          const { data: pinVerifyRes } = await admin.rpc('verify_table_checkout_access', {
            p_branch_id: tableData.branch_id,
            p_table_id: tableId,
            p_pin_hash: hashTablePin(inputPin.trim()),
          });

          if (pinVerifyRes && (pinVerifyRes as { success?: boolean }).success) {
            isTableAccessVerified = true;
          }
        }
      }

      if (proofExpired) {
        return {
          success: false,
          message: 'Table verification expired. Please verify your table again.',
          errorType: 'TABLE_VERIFICATION_EXPIRED',
        };
      }
    }

    let activeUserId = userIdInput || null;
    if (!activeUserId) {
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        activeUserId = user?.id || null;
      } catch {
        activeUserId = null;
      }
    }

    const extendedInput = input as CreateGuestOrderInput & {
      qrVisitSessionToken?: string;
      qrSessionToken?: string;
      userCoordinates?: { latitude: number; longitude: number; accuracy?: number };
      locationProof?: string;
      isServerVerifiedOnlinePayment?: boolean;
    };

    let sessionTokenToUse = extendedInput.qrVisitSessionToken || extendedInput.qrSessionToken || null;
    let targetBranchId: string | null = null;
    let targetBusinessId: string | null = null;
    let authoritativeAreaId: string | null = null;

    const { OrderSecurityService } = await import('./order-security.service');
    const { verifyAreaQrToken } = await import('@/lib/qr/area-qr-token');

    // 1. Check if rawQrToken is a cryptographically signed Area QR token
    const areaVerification = verifyAreaQrToken(rawQrToken);
    if (areaVerification.valid && areaVerification.payload) {
      // Validate against persistent DB state
      const { data: dbAreaQr } = await admin
        .from('area_qr_codes')
        .select('id, business_id, branch_id, service_area_id, version, is_active, revoked_at, expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (dbAreaQr && (!dbAreaQr.is_active || dbAreaQr.revoked_at !== null)) {
        return {
          success: false,
          message: 'This Area QR code has been revoked or regenerated. Please scan the latest QR code on your table tent.',
          errorType: 'QR_REVOKED',
        };
      }

      targetBranchId = areaVerification.payload.branchId;
      targetBusinessId = areaVerification.payload.businessId;
      authoritativeAreaId = areaVerification.payload.areaId;
    }

    // 2. Try resolving target branch and area from active QR visit session token
    if (sessionTokenToUse) {
      const sessionVal = await OrderSecurityService.validateQrVisitSession(sessionTokenToUse);
      if (sessionVal.valid && sessionVal.session) {
        targetBranchId = targetBranchId || sessionVal.session.branch_id;
        targetBusinessId = targetBusinessId || sessionVal.session.business_id;
        authoritativeAreaId = authoritativeAreaId || sessionVal.session.service_area_id || null;
      }
    }

    // 2b. Re-verify table access proof against authoritative area if proof was provided
    if (tableId && signedTableAccessProof && targetBranchId) {
      const reVerify = verifySignedTableAccessProof(
        signedTableAccessProof,
        targetBranchId,
        tableId,
        authoritativeAreaId,
        sessionTokenToUse
      );
      if (!reVerify.valid && reVerify.error === 'AREA_MISMATCH') {
        return {
          success: false,
          message: 'Table verification does not match the active dining area.',
          errorType: 'CROSS_AREA_ORDER_ATTEMPT_BLOCKED',
        };
      }
      if (!reVerify.valid && reVerify.error === 'SESSION_MISMATCH') {
        return {
          success: false,
          message: 'Table verification does not match the active QR visit session.',
          errorType: 'SESSION_MISMATCH',
        };
      }
    }


    // 3. If branch not found via Area QR or visit session, resolve static rawQrToken against all QR tables
    if (!targetBranchId) {
      // 3a. Table QR Codes
      const { data: tQr } = await admin
        .from('table_qr_codes')
        .select('branch_id, business_id')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (tQr && tQr.branch_id) {
        targetBranchId = tQr.branch_id;
        targetBusinessId = tQr.business_id;
      } else {
        // 3b. Branch QR Codes
        const { data: bQr } = await admin
          .from('branch_qr_codes')
          .select('branch_id, business_id')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (bQr && bQr.branch_id) {
          targetBranchId = bQr.branch_id;
          targetBusinessId = bQr.business_id;
        } else {
          // 3c. QR Visit Sessions directly
          const { data: qSession } = await admin
            .from('qr_visit_sessions')
            .select('branch_id, business_id, service_area_id')
            .eq('session_token_hash', tokenHash)
            .maybeSingle();

          if (qSession && qSession.branch_id) {
            targetBranchId = qSession.branch_id;
            targetBusinessId = qSession.business_id;
            authoritativeAreaId = authoritativeAreaId || qSession.service_area_id || null;
          } else if (tableId) {
            // 3d. Table Context fallback
            const { data: tableData } = await admin
              .from('dining_tables')
              .select('branch_id, business_id, service_area_id')
              .eq('id', tableId)
              .maybeSingle();

            if (tableData && tableData.branch_id) {
              targetBranchId = tableData.branch_id;
              targetBusinessId = tableData.business_id;
            }
          }
        }
      }
    }

    // 4. Enforce strict server-side Cross-Area and Cross-Branch Protection
    if (tableId && targetBranchId) {
      const { data: tableCheck } = await admin
        .from('dining_tables')
        .select('id, branch_id, business_id, service_area_id, is_active, deleted_at')
        .eq('id', tableId)
        .maybeSingle();

      if (!tableCheck || tableCheck.branch_id !== targetBranchId) {
        return {
          success: false,
          message: 'Selected table does not belong to this venue branch.',
          errorType: 'CROSS_BRANCH_ORDER_ATTEMPT_BLOCKED',
        };
      }

      if (authoritativeAreaId && tableCheck.service_area_id !== authoritativeAreaId) {
        return {
          success: false,
          message: 'Selected table does not belong to the verified dining area.',
          errorType: 'CROSS_AREA_ORDER_ATTEMPT_BLOCKED',
        };
      }
    }


    if (targetBusinessId) {
      try {
        const { SubscriptionService } = await import('./subscription.service');
        const subContext = await SubscriptionService.resolveSubscriptionContext(targetBusinessId);
        if (subContext.effectiveStatus === 'SUSPENDED' || subContext.effectiveStatus === 'CANCELLED') {
          return {
            success: false,
            message: 'Ordering is currently unavailable for this venue.',
            errorType: 'SUBSCRIPTION_SUSPENDED',
          };
        }
      } catch (subErr) {
        console.warn('[createGuestOrder] Subscription check warning:', subErr);
      }
    }

    if (!targetBranchId) {
      return {
        success: false,
        message: 'Invalid or expired QR code token. Please scan the venue QR code again.',
        errorType: 'INVALID_OR_REVOKED_QR',
      };
    }

    // Check branch ordering_mode (WAITER_ONLY mode blocks customer QR ordering)
    const { data: branchData } = await admin
      .from('branches')
      .select('business_id, ordering_mode')
      .eq('id', targetBranchId)
      .maybeSingle();

    if (branchData?.ordering_mode === 'waiter_only') {
      return {
        success: false,
        message: 'Please ask a staff member to place your order.',
        errorType: 'WAITER_ONLY_MODE',
      };
    }

    // Auto-create/reconcile visit session token if missing or invalid
    if (!sessionTokenToUse) {
      const sessionRes = await OrderSecurityService.createQrVisitSession(
        targetBranchId,
        null,
        tableId || null
      );
      if (sessionRes.success && sessionRes.sessionToken) {
        sessionTokenToUse = sessionRes.sessionToken;
      }
    }

    // SAFE DIAGNOSTICS LOGGING (NO SECRETS LOGGED)
    console.log('[OrderService.createGuestOrder Safe Diagnostics]:', {
      rawQrTokenPrefix: rawQrToken ? rawQrToken.substring(0, 8) : null,
      qrVisitSessionTokenPresent: Boolean(sessionTokenToUse),
      targetBranchIdPrefix: targetBranchId ? targetBranchId.substring(0, 8) : null,
      tableIdPrefix: tableId ? tableId.substring(0, 8) : null,
      hasLocationProof: Boolean(extendedInput.locationProof),
      hasTableAccessProof: Boolean(signedTableAccessProof),
      authenticatedUser: Boolean(activeUserId),
    });

    // 2b. Server-side Payment Method Validation
    if (paymentMethod) {
      const { BranchPaymentService } = await import('./branch-payment.service');
      const isMethodOk = await BranchPaymentService.isMethodEnabled(targetBranchId, paymentMethod);
      if (!isMethodOk) {
        if (targetBusinessId || branchData?.business_id) {
          await OrderSecurityService.logSecurityEvent({
            businessId: targetBusinessId || branchData!.business_id,
            branchId: targetBranchId,
            eventType: 'PAYMENT_METHOD_REJECTED',
            safeMetadata: { paymentMethod },
          });
        }
        return {
          success: false,
          message: 'The selected payment method is not available at this location.',
          errorType: 'PAYMENT_METHOD_DISABLED',
        };
      }
    }

    // 2c. Authoritative Server-side Order Security Engine Evaluation
    let secEvalResult: import('./order-security.service').SecurityEvaluationResult | null = null;
    if (targetBranchId) {
      secEvalResult = await OrderSecurityService.authorizeQrCheckout({
        branchId: targetBranchId,
        tableId: tableId || null,
        qrSessionToken: sessionTokenToUse,
        customerId: activeUserId || null,
        userCoordinates: extendedInput.userCoordinates || null,
        locationProof: extendedInput.locationProof || null,
        isServerVerifiedOnlinePayment: Boolean(extendedInput.isServerVerifiedOnlinePayment),
        orderSource: 'qr_customer',
      });

      if (!secEvalResult.allowed) {
        if (targetBusinessId || branchData?.business_id) {
          await OrderSecurityService.logSecurityEvent({
            businessId: targetBusinessId || branchData!.business_id,
            branchId: targetBranchId,
            eventType: 'ORDER_SECURITY_REJECTED',
            safeMetadata: { reason: secEvalResult.failureReason, code: secEvalResult.failureCode },
          });
        }
        return {
          success: false,
          message: secEvalResult.failureReason || 'Order security checks failed.',
          errorType: secEvalResult.failureCode || 'ORDER_SECURITY_REJECTED',
        };
      }
    }

    // 3. Resolve RPC token hash
    // The private atomic create_guest_order RPC verifies the branch/table QR token hash to anchor business and branch.
    // When the order is placed via an Area QR or Visit Session, resolve the branch's active QR token hash so the RPC succeeds cleanly.
    let rpcTokenHash = tokenHash;
    if (targetBranchId && (areaVerification.valid || sessionTokenToUse)) {
      const { data: bQr } = await admin
        .from('branch_qr_codes')
        .select('token_hash')
        .eq('branch_id', targetBranchId)
        .eq('is_active', true)
        .is('revoked_at', null)
        .maybeSingle();

      if (bQr?.token_hash) {
        rpcTokenHash = bQr.token_hash;
      }
    }

    // 4. Execute atomic private service-role create_guest_order RPC
    const { data, error } = await admin.rpc('create_guest_order', {
      p_token_hash: rpcTokenHash,
      p_table_id: tableId || null,
      p_table_access_verified: isTableAccessVerified,
      p_guest_name: guestName || null,
      p_guest_phone: guestPhone || null,
      p_guest_notes: guestNotes || null,
      p_idempotency_key: idempotencyKey,
      p_cart_items: cartItems,
      p_payment_method: paymentMethod || 'pay_at_counter',
      p_customer_user_id: activeUserId || null,
      p_selected_reward_id: IS_LOYALTY_ENABLED ? (parsed.data.selectedRewardId || null) : null,
    });

    const rpcPayload = data as { success?: boolean; error?: string; order_id?: string } | null;
    const rpcErrorStr = error?.message || (rpcPayload && !rpcPayload.success ? rpcPayload.error : null) || null;

    if (rpcPayload?.success && rpcPayload.order_id) {
      const updateData: Record<string, unknown> = {};
      if (authoritativeAreaId) {
        updateData.service_area_id = authoritativeAreaId;
      }
      if (secEvalResult?.requiresWaiterApproval) {
        updateData.approval_status = 'pending_waiter_approval';
        updateData.status = 'pending';
      } else if (secEvalResult) {
        updateData.approval_status = 'approved';
      }
      if (secEvalResult?.qrVisitSessionId) {
        updateData.qr_visit_session_id = secEvalResult.qrVisitSessionId;
      }
      if (secEvalResult?.tableSessionId) {
        updateData.table_session_id = secEvalResult.tableSessionId;
      }
      if (secEvalResult?.checks?.location === 'passed') {
        updateData.location_verified = true;
      }
      if (secEvalResult?.checks?.paymentBypass === 'applied') {
        updateData.payment_verified_online = true;
      }

      if (Object.keys(updateData).length > 0) {
        await admin.from('orders').update(updateData).eq('id', rpcPayload.order_id);
      }

      // Automated Inventory Consumption Trigger for confirmed orders (Phase 28)
      const isPendingApproval = Boolean(secEvalResult?.requiresWaiterApproval);
      if (!isPendingApproval) {
        try {
          const { ConsumptionService } = await import('@/server/services/consumption.service');
          await ConsumptionService.processOrderStageConsumption(rpcPayload.order_id, 'confirmed', activeUserId || undefined);
        } catch (consErr) {
          console.error('[OrderService.createGuestOrder] Automated consumption trigger error:', consErr);
        }
      }
    }

    const safeLogFormat = {
      tableContextExists: Boolean(tableId),
      proofReturnedFromVerification: Boolean(signedTableAccessProof),
      proofStoredInCart: Boolean(signedTableAccessProof),
      proofLoadedAtCheckout: Boolean(signedTableAccessProof),
      proofSubmittedToAction: Boolean(signedTableAccessProof),
      proofValidOnServer: proofValid,
      proofExpired: proofExpired,
      proofBranchMatches: proofBranchMatches,
      proofTableMatches: proofTableMatches,
      serviceRoleConfigured,
      adminTableFound,
      isTableAccessVerified,
      tableIdPrefix: tableId ? tableId.substring(0, 8) : 'none',
      branchIdPrefix,
      selectedRewardReceivedByOrderService: Boolean(parsed.data.selectedRewardId),
      customerUserIdProvided: Boolean(activeUserId),
      rpcError: rpcErrorStr,
    };

    console.log('[OrderService.createGuestOrder Safe Diagnostics]:', JSON.stringify(safeLogFormat, null, 2));

    if (error || !data) {
      return {
        success: false,
        message: error?.message || 'Failed to execute order RPC.',
      };
    }

    const payload = data as {
      success: boolean;
      error?: string;
      order_id?: string;
      access_token?: string;
      order_number_formatted?: string;
      status?: OrderStatus;
      discount_cents?: number;
      reward_title_snapshot?: string | null;
      reward_points_redeemed_snapshot?: number;
    };

    if (!payload.success) {
      if (payload.error === 'TABLE_VERIFICATION_REQUIRED') {
        return {
          success: false,
          message: 'Table verification is required for this branch. Please verify your table PIN.',
          errorType: 'TABLE_VERIFICATION_REQUIRED',
        };
      }
      return {
        success: false,
        message: payload.error || 'Failed to place order.',
      };
    }

    if (payload.success && payload.order_id && targetBusinessId && targetBranchId) {
      const { NotificationService } = await import('./notification.service');
      const orderNum = payload.order_number_formatted || payload.order_id.slice(0, 6);
      if (secEvalResult?.requiresWaiterApproval) {
        NotificationService.createNotificationsForCapability({
          businessId: targetBusinessId,
          branchId: targetBranchId,
          capability: 'waiter.access',
          notificationType: 'ORDER_CREATED',
          priority: 'high',
          title: 'New Guest Order Awaiting Approval',
          message: `Order #${orderNum} requires waiter review`,
          entityType: 'order',
          entityId: payload.order_id,
          actionUrl: '/dashboard/waiter/order',
        }).catch((err) => console.warn('[OrderService] Waiter notification dispatch failed:', err));
      } else {
        NotificationService.createNotificationsForCapability({
          businessId: targetBusinessId,
          branchId: targetBranchId,
          capability: 'kitchen.access',
          notificationType: 'ORDER_CREATED',
          priority: 'high',
          title: 'New Guest Order',
          message: `Order #${orderNum} placed`,
          entityType: 'order',
          entityId: payload.order_id,
          actionUrl: '/dashboard/kitchen',
        }).catch((err) => console.warn('[OrderService] Kitchen notification dispatch failed:', err));
      }
    }

    return {
      success: true,
      message: 'Order created successfully.',
      data: {
        orderId: payload.order_id!,
        accessToken: payload.access_token!,
        orderNumberFormatted: payload.order_number_formatted!,
        status: payload.status!,
      },
    };
  }

  /**
   * Retrieves single order by ID with item and table details.
   */
  static async getOrderById(orderId: string, accessToken?: string): Promise<OrderRecord | null> {
    const admin = createAdminClient();

    let query = admin
      .from('orders')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number),
        items:order_items(
          id,
          menu_item_id,
          item_name_snapshot,
          unit_price_cents_snapshot,
          quantity,
          line_subtotal_cents,
          special_instructions,
          order_item_modifiers(
            id,
            group_name_snapshot,
            option_name_snapshot,
            additional_price_cents_snapshot
          )
        )
      `)
      .eq('id', orderId);

    if (accessToken) {
      query = query.eq('access_token', accessToken);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) return null;
    return data as unknown as OrderRecord;
  }

  /**
   * Retrieves active order queue for branch (Kitchen Display Queue).
   */
  static async getBranchActiveOrders(): Promise<OrderRecord[]> {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) return [];

    const admin = createAdminClient();
    const { data } = await admin
      .from('orders')
      .select(`
        *,
        table:dining_tables(id, name, code, table_number, service_area:service_areas(id, name)),
        items:order_items(
          id,
          menu_item_id,
          item_name_snapshot,
          unit_price_cents_snapshot,
          quantity,
          line_subtotal_cents,
          special_instructions,
          order_item_modifiers(
            id,
            group_name_snapshot,
            option_name_snapshot,
            additional_price_cents_snapshot
          )
        )
      `)
      .eq('branch_id', context.activeBranch.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    return (data as unknown as OrderRecord[]) || [];
  }

  static async getKitchenQueue(): Promise<OrderRecord[]> {
    return this.getBranchActiveOrders();
  }

  /**
   * Updates order status with audit log.
   */
  static async updateOrderStatus(orderId: string, nextStatus: OrderStatus, notes?: string | null) {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized.' };
    }

    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { data: order } = await admin.from('orders').select('id, status, branch_id, business_id').eq('id', orderId).single();
    if (!order || order.business_id !== authContext.businessId) {
      return { success: false, message: 'Order not found in active business.' };
    }

    let isAuthorized = false;
    const resource = { type: 'order' as const, id: orderId };

    if (nextStatus === 'cancelled') {
      isAuthorized = await can({ context: authContext, permission: 'orders.cancel', resource });
    } else if (nextStatus === 'preparing' || nextStatus === 'ready') {
      isAuthorized =
        (await can({ context: authContext, permission: 'kitchen.update', resource })) ||
        (await can({ context: authContext, permission: 'orders.update_status', resource }));
    } else if (nextStatus === 'completed') {
      isAuthorized =
        (await can({ context: authContext, permission: 'orders.update_status', resource })) ||
        (await can({ context: authContext, permission: 'kitchen.update', resource })) ||
        (await can({ context: authContext, permission: 'cashier.access', resource })) ||
        (await can({ context: authContext, permission: 'payments.record', resource }));
    } else {
      isAuthorized = await can({ context: authContext, permission: 'orders.update_status', resource });
    }

    if (!isAuthorized) {
      return { success: false, message: `Forbidden: Missing permission to transition order to ${nextStatus}.` };
    }

    const previousStatus = order.status;

    const { error: updateErr } = await admin
      .from('orders')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
        cancelled_at: nextStatus === 'cancelled' ? new Date().toISOString() : null,
      })
      .eq('id', orderId);

    if (updateErr) {
      return { success: false, message: updateErr.message };
    }

    await admin.from('order_status_history').insert({
      order_id: orderId,
      previous_status: previousStatus,
      new_status: nextStatus,
      changed_by: authContext.userId,
      notes: notes || `Status updated to ${nextStatus}`,
    });

    // Automated Inventory Consumption Trigger (Phase 28)
    try {
      const { ConsumptionService } = await import('@/server/services/consumption.service');
      await ConsumptionService.processOrderStageConsumption(orderId, nextStatus, authContext.userId);
    } catch (err: unknown) {
      console.error('Failed to trigger order ingredient consumption:', err);
    }

    if (nextStatus === 'completed') {
      const { LoyaltyService } = await import('@/server/services/loyalty.service');
      await LoyaltyService.processOrderPointsEarning(orderId);
    }

    return { success: true, message: `Order status updated to ${nextStatus}` };
  }
}
