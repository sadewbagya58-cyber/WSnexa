import { createAdminClient } from '@/lib/supabase/server';
import { AuthorizationContext } from '@/types/authorization.types';
import { can } from '@/server/auth/policy-engine';
import { maskEmail, maskPhone } from '@/lib/crm/crm-normalization';
import { CustomerDirectoryItemDTO, CustomerDirectoryQueryInput } from '@/lib/crm/crm-types';

export class CustomerDirectoryService {
  /**
   * Queries customer directory with search, filter, pagination, and tenant/property reach bounds.
   */
  static async searchCustomerDirectory(
    authContext: AuthorizationContext,
    input: CustomerDirectoryQueryInput = {}
  ): Promise<{ items: CustomerDirectoryItemDTO[]; totalCount: number }> {
    if (!(await can({ context: authContext, permission: 'customers.view' }))) {
      return { items: [], totalCount: 0 };
    }

    const businessId = input.businessId || authContext.businessId;
    if (authContext.businessId !== businessId) {
      return { items: [], totalCount: 0 };
    }

    const limit = Math.min(input.limit || 20, 100);
    const offset = input.offset || 0;

    const admin = createAdminClient();

    let query = admin
      .from('crm_customers')
      .select('id, business_id, display_name, identity_type, email_normalized, phone_normalized, last_seen_at, auth_user_id', { count: 'exact' })
      .eq('business_id', businessId);

    if (input.identityType) {
      query = query.eq('identity_type', input.identityType);
    }

    if (input.searchQuery) {
      const q = input.searchQuery.trim().toLowerCase();
      if (q) {
        query = query.or(`display_name.ilike.%${q}%,email_normalized.ilike.%${q}%,phone_normalized.ilike.%${q}%`);
      }
    }

    query = query.order('last_seen_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: customers, count } = await query;
    if (!customers) return { items: [], totalCount: 0 };

    // Fetch order counts and spend summary per customer in batch
    const customerIds = customers.map((c) => c.id);
    const { data: ordersData } = await admin
      .from('orders')
      .select('crm_customer_id, status, total_cents')
      .eq('business_id', businessId)
      .in('crm_customer_id', customerIds);

    const orderStatsMap = new Map<string, { totalOrders: number; totalSpendCents: number }>();
    (ordersData || []).forEach((o) => {
      if (!o.crm_customer_id) return;
      const current = orderStatsMap.get(o.crm_customer_id) || { totalOrders: 0, totalSpendCents: 0 };
      current.totalOrders += 1;
      if (o.status === 'completed') {
        current.totalSpendCents += o.total_cents || 0;
      }
      orderStatsMap.set(o.crm_customer_id, current);
    });

    const items: CustomerDirectoryItemDTO[] = customers.map((c) => {
      const stats = orderStatsMap.get(c.id) || { totalOrders: 0, totalSpendCents: 0 };
      return {
        customerId: c.id,
        businessId: c.business_id,
        displayName: c.display_name || 'Guest Customer',
        identityType: c.identity_type,
        emailMasked: maskEmail(c.email_normalized),
        phoneMasked: maskPhone(c.phone_normalized),
        totalOrders: stats.totalOrders,
        totalSpendCents: stats.totalSpendCents,
        currency: 'USD',
        lastSeenAt: c.last_seen_at,
        isAccountLinked: Boolean(c.auth_user_id),
      };
    });

    return {
      items,
      totalCount: count || 0,
    };
  }
}
