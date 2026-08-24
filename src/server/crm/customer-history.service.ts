import { createAdminClient } from '@/lib/supabase/server';
import { AuthorizationContext } from '@/types/authorization.types';
import { can } from '@/server/auth/policy-engine';

export interface CustomerOrderHistoryItemDTO {
  id: string;
  orderNumberFormatted: string;
  branchId: string;
  branchName: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotalCents: number;
  totalCents: number;
  currency: string;
  itemsCount: number;
  createdAt: string;
}

export class CustomerHistoryService {
  /**
   * Fetches paginated order history for a customer within the user's authorized branch reach.
   */
  static async getCustomerOrderHistory(
    customerId: string,
    businessId: string,
    authContext: AuthorizationContext,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ items: CustomerOrderHistoryItemDTO[]; totalCount: number }> {
    if (!(await can({ context: authContext, permission: 'customers.view' }))) {
      return { items: [], totalCount: 0 };
    }

    if (authContext.businessId !== businessId) {
      return { items: [], totalCount: 0 };
    }

    const limit = Math.min(options.limit || 20, 50);
    const offset = options.offset || 0;

    const admin = createAdminClient();

    // 1. Fetch customer to resolve auth_user_id
    const { data: customer } = await admin
      .from('crm_customers')
      .select('auth_user_id')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!customer) return { items: [], totalCount: 0 };

    // 2. Build property-scoped orders query
    let query = admin
      .from('orders')
      .select('id, order_number_formatted, branch_id, status, payment_status, payment_method, subtotal_cents, total_cents, currency, created_at, branches(name), order_items(count)', { count: 'exact' })
      .eq('business_id', businessId)
      .or(`crm_customer_id.eq.${customerId}${customer.auth_user_id ? `,customer_user_id.eq.${customer.auth_user_id}` : ''}`);

    if (authContext.authorizedBranchIds !== null && authContext.authorizedBranchIds.length > 0) {
      query = query.in('branch_id', authContext.authorizedBranchIds);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: orders, count } = await query;
    if (!orders) return { items: [], totalCount: 0 };

    interface OrderWithRelations {
      id: string;
      order_number_formatted: string;
      branch_id: string;
      status: string;
      payment_status: string;
      payment_method: string;
      subtotal_cents: number;
      total_cents: number;
      currency: string;
      created_at: string;
      branches?: { name?: string } | null;
      order_items?: [{ count?: number }];
    }

    const items: CustomerOrderHistoryItemDTO[] = (orders as unknown as OrderWithRelations[]).map((o) => ({
      id: o.id,
      orderNumberFormatted: o.order_number_formatted,
      branchId: o.branch_id,
      branchName: o.branches?.name || 'Main Branch',
      status: o.status,
      paymentStatus: o.payment_status,
      paymentMethod: o.payment_method,
      subtotalCents: o.subtotal_cents,
      totalCents: o.total_cents,
      currency: o.currency,
      itemsCount: o.order_items && o.order_items[0] ? o.order_items[0].count || 0 : 0,
      createdAt: o.created_at,
    }));

    return {
      items,
      totalCount: count || 0,
    };
  }
}
