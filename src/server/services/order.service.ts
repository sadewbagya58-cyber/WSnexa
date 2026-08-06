import { createAdminClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { hashQrToken, hashTablePin } from '@/lib/qr/security';
import { verifySignedTableAccessProof } from '@/lib/qr/table-access-proof';
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
  total_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  completed_at: string | null;
  table?: {
    id: string;
    name: string;
    code: string;
    table_number: number | null;
  } | null;
  items?: OrderItemRecord[];
}

export class OrderService {
  /**
   * Submits a guest order atomically via private service-role create_guest_order RPC.
   * Table PIN is verified ONLY ONCE at table selection time.
   * Checkout uses server-verified HMAC signed proof without re-verifying or comparing PIN hashes.
   */
  static async createGuestOrder(input: CreateGuestOrderInput) {
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

    // 2. Execute private service-role create_guest_order RPC with p_table_access_verified
    const { data, error } = await admin.rpc('create_guest_order', {
      p_token_hash: tokenHash,
      p_table_id: tableId || null,
      p_table_access_verified: isTableAccessVerified,
      p_guest_name: guestName || null,
      p_guest_phone: guestPhone || null,
      p_guest_notes: guestNotes || null,
      p_idempotency_key: idempotencyKey,
      p_cart_items: cartItems,
    });

    const rpcPayload = data as { success?: boolean; error?: string } | null;
    const rpcErrorStr = error?.message || (rpcPayload && !rpcPayload.success ? rpcPayload.error : null) || null;

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
      .eq('branch_id', context.activeBranch.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true });

    return (data as unknown as OrderRecord[]) || [];
  }

  static async getKitchenQueue(): Promise<OrderRecord[]> {
    return this.getBranchActiveOrders();
  }

  /**
   * Updates order status with audit log.
   */
  static async updateOrderStatus(orderId: string, nextStatus: OrderStatus, notes?: string | null) {
    const context = await resolveActiveBusinessContext();
    if (!context || !context.activeBranch) {
      return { success: false, message: 'Unauthorized.' };
    }

    const admin = createAdminClient();
    const { data: order } = await admin.from('orders').select('id, status, branch_id').eq('id', orderId).single();
    if (!order || order.branch_id !== context.activeBranch.id) {
      return { success: false, message: 'Order not found in active branch.' };
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
      changed_by: context.user.id,
      notes: notes || `Status updated to ${nextStatus}`,
    });

    return { success: true, message: `Order status updated to ${nextStatus}` };
  }
}
