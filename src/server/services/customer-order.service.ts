import { createAdminClient } from '@/lib/supabase/server';

interface DbOrderRow {
  id: string;
  order_number: number;
  order_number_formatted: string;
  business_id: string;
  branch_id: string;
  table_id: string | null;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  businesses?: { name: string; logo_url: string | null } | null;
  branches?: { name: string; code: string } | null;
  dining_tables?: { name: string | null; table_number: number } | null;
  order_items?: DbOrderItemRow[];
}

interface DbOrderItemRow {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  unit_price_cents_snapshot: number;
  quantity: number;
  line_subtotal_cents: number;
  special_instructions?: string | null;
  order_item_modifiers?: Array<{
    group_name_snapshot: string;
    option_name_snapshot: string;
    additional_price_cents_snapshot: number;
  }>;
}

interface DbStatusHistoryRow {
  new_status: string;
  created_at: string;
}

interface DbPaymentRow {
  id: string;
  payment_method: string;
  status: string;
  amount_cents: number;
  currency: string;
  completed_at: string | null;
}

export interface FormattedCustomerOrder {
  id: string;
  orderNumberFormatted: string;
  orderNumber: number;
  businessId: string;
  businessName: string;
  businessLogoUrl: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  tableName: string | null;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotalCents: number;
  taxCents: number;
  serviceChargeCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  itemCount: number;
}

export interface FormattedCustomerOrderDetail extends FormattedCustomerOrder {
  items: Array<{
    id: string;
    menuItemId: string;
    itemName: string;
    unitPriceCents: number;
    quantity: number;
    lineSubtotalCents: number;
    specialInstructions: string | null;
    modifiers: Array<{
      groupName: string;
      optionName: string;
      additionalPriceCents: number;
    }>;
  }>;
  statusHistory: Array<{
    status: string;
    changedAt: string;
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string;
    status: string;
    amountCents: number;
    currency: string;
    completedAt: string | null;
  }>;
}

export interface CustomerAnalyticsSummary {
  lifetimeSpendCents: number;
  ordersCompletedCount: number;
  activeOrdersCount: number;
  venuesVisitedCount: number;
  mostVisitedVenueName: string | null;
  mostVisitedVenueCount: number;
  currency: string;
}

export interface VisitedVenue {
  businessId: string;
  businessName: string;
  businessLogoUrl: string | null;
  branchId: string;
  branchName: string;
  branchCode: string;
  visitCount: number;
  totalSpendCents: number;
  lastVisitAt: string;
  currency: string;
}

export class CustomerOrderService {
  /**
   * Securely claims an anonymous order for an authenticated customer user.
   * Requires matching orderId + valid access_token.
   */
  static async claimOrder(
    userId: string,
    orderId: string,
    accessToken: string
  ): Promise<{
    success: boolean;
    alreadyClaimed?: boolean;
    claimed?: boolean;
    code?: string;
    message: string;
    orderId?: string;
  }> {
    if (!userId || !orderId || !accessToken) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: 'User identity, order ID, and access token are required to claim an order.',
      };
    }

    const admin = createAdminClient();

    // 1. Fetch target order by ID and access_token
    const { data: order, error } = await admin
      .from('orders')
      .select('id, customer_user_id, access_token, status, total_cents, business_id')
      .eq('id', orderId)
      .eq('access_token', accessToken)
      .single();

    if (error || !order) {
      return {
        success: false,
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Invalid order ID or access token provided.',
      };
    }

    // 2. Check if already claimed by this user (Idempotent)
    if (order.customer_user_id === userId) {
      return {
        success: true,
        alreadyClaimed: true,
        message: 'Order is already saved to your account.',
        orderId: order.id,
      };
    }

    // 3. Reject if claimed by a different user
    if (order.customer_user_id && order.customer_user_id !== userId) {
      return {
        success: false,
        code: 'CLAIMED_BY_ANOTHER_USER',
        message: 'This order has already been claimed by another customer account.',
      };
    }

    // 4. Atomically claim order
    const { error: updateError } = await admin
      .from('orders')
      .update({
        customer_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('access_token', accessToken)
      .is('customer_user_id', null);

    if (updateError) {
      return {
        success: false,
        code: 'CLAIM_FAILED',
        message: updateError.message || 'Failed to claim order.',
      };
    }

    // Record audit log
    await admin.from('audit_logs').insert({
      business_id: order.business_id,
      action: 'order.claimed_by_customer',
      target_type: 'order',
      target_id: order.id,
      payload: { customer_user_id: userId },
    });

    // Retroactively process points for completed order
    const { LoyaltyService } = await import('@/server/services/loyalty.service');
    await LoyaltyService.processOrderPointsEarning(order.id);

    return {
      success: true,
      claimed: true,
      message: 'Order saved to your account successfully!',
      orderId: order.id,
    };
  }

  /**
   * Retrieves filterable claimed order history for a customer.
   */
  static async getCustomerOrders(
    userId: string,
    filter: 'all' | 'active' | 'completed' | 'cancelled' = 'all'
  ): Promise<FormattedCustomerOrder[]> {
    const admin = createAdminClient();

    let query = admin
      .from('orders')
      .select(`
        id,
        order_number,
        order_number_formatted,
        business_id,
        branch_id,
        table_id,
        status,
        payment_status,
        payment_method,
        subtotal_cents,
        tax_cents,
        service_charge_cents,
        total_cents,
        currency,
        created_at,
        completed_at,
        cancelled_at,
        businesses!inner ( name, logo_url ),
        branches!inner ( name, code ),
        dining_tables ( name, table_number ),
        order_items ( id )
      `)
      .eq('customer_user_id', userId)
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.in('status', ['pending', 'confirmed', 'preparing', 'ready']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'cancelled') {
      query = query.eq('status', 'cancelled');
    }

    const { data: rawOrders, error } = await query;
    if (error || !rawOrders) return [];

    return ((rawOrders || []) as unknown as DbOrderRow[]).map((o) => ({
      id: o.id,
      orderNumberFormatted: o.order_number_formatted,
      orderNumber: o.order_number,
      businessId: o.business_id,
      businessName: o.businesses?.name || 'Business',
      businessLogoUrl: o.businesses?.logo_url || null,
      branchId: o.branch_id,
      branchName: o.branches?.name || 'Main Branch',
      branchCode: o.branches?.code || 'MAIN',
      tableName: o.dining_tables ? (o.dining_tables.name || `Table ${o.dining_tables.table_number}`) : null,
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      subtotalCents: o.subtotal_cents,
      taxCents: o.tax_cents,
      serviceChargeCents: o.service_charge_cents,
      totalCents: o.total_cents,
      currency: o.currency || 'USD',
      createdAt: o.created_at,
      completedAt: o.completed_at,
      cancelledAt: o.cancelled_at,
      itemCount: o.order_items?.length || 0,
    }));
  }

  /**
   * Retrieves customer-safe detailed order breakdown and receipt.
   */
  static async getCustomerOrderDetails(
    userId: string,
    orderId: string
  ): Promise<FormattedCustomerOrderDetail | null> {
    const admin = createAdminClient();

    const { data: o, error } = await admin
      .from('orders')
      .select(`
        id,
        order_number,
        order_number_formatted,
        business_id,
        branch_id,
        table_id,
        status,
        payment_status,
        payment_method,
        subtotal_cents,
        tax_cents,
        service_charge_cents,
        total_cents,
        currency,
        created_at,
        completed_at,
        cancelled_at,
        businesses!inner ( name, logo_url ),
        branches!inner ( name, code ),
        dining_tables ( name, table_number ),
        order_items (
          id,
          menu_item_id,
          item_name_snapshot,
          unit_price_cents_snapshot,
          quantity,
          line_subtotal_cents,
          special_instructions,
          order_item_modifiers (
            group_name_snapshot,
            option_name_snapshot,
            additional_price_cents_snapshot
          )
        )
      `)
      .eq('id', orderId)
      .eq('customer_user_id', userId)
      .single();

    if (error || !o) return null;

    const [{ data: rawStatusHistory }, { data: rawPayments }] = await Promise.all([
      admin
        .from('order_status_history')
        .select('new_status, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
      admin
        .from('payments')
        .select('id, payment_method, status, amount_cents, currency, completed_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false }),
    ]);

    const rawMaster = o as unknown as DbOrderRow & { order_items?: DbOrderItemRow[] };
    const items = (rawMaster.order_items || []).map((item) => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      itemName: item.item_name_snapshot,
      unitPriceCents: item.unit_price_cents_snapshot,
      quantity: item.quantity,
      lineSubtotalCents: item.line_subtotal_cents,
      specialInstructions: item.special_instructions || null,
      modifiers: (item.order_item_modifiers || []).map((m) => ({
        groupName: m.group_name_snapshot,
        optionName: m.option_name_snapshot,
        additionalPriceCents: m.additional_price_cents_snapshot,
      })),
    }));

    const statusHistory = ((rawStatusHistory || []) as unknown as DbStatusHistoryRow[]).map((sh) => ({
      status: sh.new_status,
      changedAt: sh.created_at,
    }));

    const payments = ((rawPayments || []) as unknown as DbPaymentRow[]).map((p) => ({
      id: p.id,
      paymentMethod: p.payment_method,
      status: p.status,
      amountCents: p.amount_cents,
      currency: p.currency,
      completedAt: p.completed_at,
    }));

    return {
      id: rawMaster.id,
      orderNumberFormatted: rawMaster.order_number_formatted,
      orderNumber: rawMaster.order_number,
      businessId: rawMaster.business_id,
      businessName: (Array.isArray(rawMaster.businesses) ? rawMaster.businesses[0]?.name : rawMaster.businesses?.name) || 'Business',
      businessLogoUrl: (Array.isArray(rawMaster.businesses) ? rawMaster.businesses[0]?.logo_url : rawMaster.businesses?.logo_url) || null,
      branchId: rawMaster.branch_id,
      branchName: (Array.isArray(rawMaster.branches) ? rawMaster.branches[0]?.name : rawMaster.branches?.name) || 'Main Branch',
      branchCode: (Array.isArray(rawMaster.branches) ? rawMaster.branches[0]?.code : rawMaster.branches?.code) || 'MAIN',
      tableName: rawMaster.dining_tables ? ((Array.isArray(rawMaster.dining_tables) ? rawMaster.dining_tables[0]?.name : rawMaster.dining_tables.name) || `Table ${(Array.isArray(rawMaster.dining_tables) ? rawMaster.dining_tables[0]?.table_number : rawMaster.dining_tables.table_number)}`) : null,
      status: rawMaster.status,
      paymentStatus: rawMaster.payment_status,
      paymentMethod: rawMaster.payment_method,
      subtotalCents: rawMaster.subtotal_cents,
      taxCents: rawMaster.tax_cents,
      serviceChargeCents: rawMaster.service_charge_cents,
      totalCents: rawMaster.total_cents,
      currency: rawMaster.currency || 'USD',
      createdAt: rawMaster.created_at,
      completedAt: rawMaster.completed_at,
      cancelledAt: rawMaster.cancelled_at,
      itemCount: items.length,
      items,
      statusHistory,
      payments,
    };
  }

  /**
   * Calculates executive spending analytics summary for a customer.
   * Excludes cancelled/failed orders.
   */
  static async getCustomerAnalytics(userId: string): Promise<CustomerAnalyticsSummary> {
    const orders = await this.getCustomerOrders(userId, 'all');

    let lifetimeSpendCents = 0;
    let ordersCompletedCount = 0;
    let activeOrdersCount = 0;
    const venueMap: Record<string, { name: string; count: number }> = {};
    let currency = 'USD';

    for (const o of orders) {
      currency = o.currency;
      if (o.status === 'completed' || o.paymentStatus === 'paid') {
        lifetimeSpendCents += o.totalCents;
      }

      if (o.status === 'completed') {
        ordersCompletedCount++;
      } else if (['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)) {
        activeOrdersCount++;
      }

      if (o.status === 'completed' || o.paymentStatus === 'paid') {
        if (!venueMap[o.businessId]) {
          venueMap[o.businessId] = { name: o.businessName, count: 0 };
        }
        venueMap[o.businessId].count++;
      }
    }

    const venueEntries = Object.values(venueMap);
    venueEntries.sort((a, b) => b.count - a.count);

    return {
      lifetimeSpendCents,
      ordersCompletedCount,
      activeOrdersCount,
      venuesVisitedCount: venueEntries.length,
      mostVisitedVenueName: venueEntries[0]?.name || null,
      mostVisitedVenueCount: venueEntries[0]?.count || 0,
      currency,
    };
  }

  /**
   * Aggregates venues visited by the customer across claimed orders.
   */
  static async getCustomerVenues(userId: string): Promise<VisitedVenue[]> {
    const orders = await this.getCustomerOrders(userId, 'all');
    const venueMap: Record<string, VisitedVenue> = {};

    for (const o of orders) {
      if (o.status === 'cancelled') continue;

      const key = `${o.businessId}:${o.branchId}`;
      if (!venueMap[key]) {
        venueMap[key] = {
          businessId: o.businessId,
          businessName: o.businessName,
          businessLogoUrl: o.businessLogoUrl,
          branchId: o.branchId,
          branchName: o.branchName,
          branchCode: o.branchCode,
          visitCount: 0,
          totalSpendCents: 0,
          lastVisitAt: o.createdAt,
          currency: o.currency,
        };
      }

      const v = venueMap[key];
      v.visitCount++;
      if (o.status === 'completed' || o.paymentStatus === 'paid') {
        v.totalSpendCents += o.totalCents;
      }
      if (new Date(o.createdAt) > new Date(v.lastVisitAt)) {
        v.lastVisitAt = o.createdAt;
      }
    }

    return Object.values(venueMap).sort((a, b) => b.visitCount - a.visitCount);
  }
}
